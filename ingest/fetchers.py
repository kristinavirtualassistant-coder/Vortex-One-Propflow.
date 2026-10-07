"""Paginated fetchers for ArcGIS REST and Socrata. Yield (attrs, geojson_geom)."""
import os
import time
import requests

SESSION = requests.Session()
SESSION.headers["User-Agent"] = "PropFlow-Ingest/1.0"
if os.getenv("SOCRATA_APP_TOKEN"):
    SESSION.headers["X-App-Token"] = os.environ["SOCRATA_APP_TOKEN"]


def _get(url, params, retries=5):
    for attempt in range(retries):
        try:
            r = SESSION.get(url, params=params, timeout=120)
            if r.status_code in (429, 500, 502, 503, 504):
                raise requests.HTTPError(f"{r.status_code}")
            r.raise_for_status()
            data = r.json()
            if isinstance(data, dict) and "error" in data:
                raise RuntimeError(data["error"])
            return data
        except Exception as e:  # noqa: BLE001
            wait = 2 ** attempt
            print(f"  retry {attempt + 1}/{retries} in {wait}s: {e}")
            time.sleep(wait)
    raise RuntimeError(f"failed after {retries} retries: {url}")


def arcgis_layer_info(url):
    return _get(url, {"f": "json"})


def fetch_arcgis(cfg, limit=None):
    info = arcgis_layer_info(cfg["url"])
    page = min(cfg["page_size"], info.get("maxRecordCount") or cfg["page_size"])
    supports_paging = info.get("advancedQueryCapabilities", {}).get("supportsPagination", True)
    oid_field = info.get("objectIdField") or "OBJECTID"
    offset, last_oid, total = 0, -1, 0
    while True:
        base_where = cfg.get("where") or "1=1"
        params = {"where": base_where, "outFields": "*", "f": "geojson",
                  "outSR": 4326, "resultRecordCount": page}
        if supports_paging:
            params.update(resultOffset=offset, orderByFields=oid_field)
        else:  # keyset pagination on objectId
            params["where"] = f"({base_where}) AND {oid_field} > {last_oid}"
            params["orderByFields"] = oid_field
        data = _get(cfg["url"] + "/query", params)
        feats = data.get("features", [])
        if not feats:
            break
        for f in feats:
            props = f.get("properties") or {}
            last_oid = max(last_oid, props.get(oid_field) or last_oid)
            yield props, f.get("geometry")
            total += 1
            if limit and total >= limit:
                return
        offset += len(feats)
        print(f"  arcgis: {total} rows")


def fetch_socrata(cfg, limit=None):
    page, offset, total = cfg["page_size"], 0, 0
    while True:
        params = {"$limit": page, "$offset": offset, "$order": ":id"}
        if cfg.get("where"):
            params["$where"] = cfg["where"]
        rows = _get(cfg["url"], params)
        if not rows:
            break
        for row in rows:
            geom = row.pop(cfg.get("geom_field", "the_geom"), None)
            yield row, geom
            total += 1
            if limit and total >= limit:
                return
        offset += len(rows)
        print(f"  socrata: {total} rows")


FETCHERS = {"arcgis": fetch_arcgis, "socrata": fetch_socrata}