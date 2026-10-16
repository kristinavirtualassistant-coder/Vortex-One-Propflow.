"""
Usage:
  python -m ingest.run inspect <source_id>      # print fields + 3 sample rows
  python -m ingest.run load <source_id> [--limit N]
  python -m ingest.run normalize                 # raw -> core.parcels + signals
  python -m ingest.run load-hazard fhsz_sra|fhsz_lra
  python -m ingest.run assign-hazards            # parcels x FHSZ -> fhsz_class + signals
  python -m ingest.run publish [--county 06037] [--confirm] [--budget-mb 400]
                                                 # staging -> Supabase (slim points; dry-run default)
Options: --limit N, --where "<ArcGIS/SoQL filter>" (overrides source filter, for tests)
"""
import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

import psycopg
from psycopg.types.json import Jsonb

from .fetchers import FETCHERS, arcgis_layer_info
from .freshness import freshness_age_days, freshness_state
from .publish import publish
from .guards import is_complete_refresh, positive_int
from .sources import HAZARD_SOURCES, SOURCES

DB_URL = os.getenv("DATABASE_URL")
SQL_DIR = Path(__file__).resolve().parent.parent / "sql"
BATCH = 2000

UPSERT = """
INSERT INTO raw.records (source_id, source_key, roll_year, attrs, geom, row_hash)
VALUES (%s, %s, %s, %s,
        ST_SetSRID(ST_MakeValid(ST_GeomFromGeoJSON(%s)), 4326), %s)
ON CONFLICT (source_id, source_key, roll_year) DO UPDATE SET
  attrs = EXCLUDED.attrs, geom = EXCLUDED.geom, row_hash = EXCLUDED.row_hash,
  last_seen = now()
WHERE raw.records.row_hash IS DISTINCT FROM EXCLUDED.row_hash
"""
TOUCH = "UPDATE raw.records SET last_seen = now() WHERE source_id=%s AND last_seen < %s"


def _year(v):
    try:
        return int(str(v)[:4])
    except (TypeError, ValueError):
        return 0


def inspect(source_id):
    cfg = SOURCES[source_id]
    if cfg["kind"] == "arcgis":
        info = arcgis_layer_info(cfg["url"])
        print("maxRecordCount:", info.get("maxRecordCount"))
        for f in info.get("fields", []):
            print(f"  {f['name']:<30} {f['type']}")
    for i, (attrs, geom) in enumerate(FETCHERS[cfg["kind"]](cfg, limit=3)):
        print(f"\n--- sample {i + 1} (geom: {geom['type'] if geom else None})")
        print(json.dumps(attrs, indent=2, default=str)[:3000])


def report_freshness(stale_days=None):
    """Report whether every configured public-record source has a recent full refresh."""
    if not DB_URL:
        sys.exit("DATABASE_URL not set")
    source_ids = list(SOURCES)
    placeholders = ", ".join(["%s"] * len(source_ids))
    with psycopg.connect(DB_URL) as conn:
        rows = conn.execute(
            f"SELECT id, county_fips, last_run_at, last_count FROM core.sources WHERE id IN ({placeholders})",
            source_ids,
        ).fetchall()
    by_id = {row[0]: row for row in rows}
    healthy = True
    print("Source freshness report")
    for source_id, cfg in SOURCES.items():
        row = by_id.get(source_id)
        county_fips = row[1].strip() if row else cfg.get("county_fips", "unknown")
        last_run_at = row[2] if row else None
        last_count = row[3] if row else None
        threshold = stale_days if stale_days is not None else cfg.get("freshness_max_age_days", 14)
        scope = cfg.get("coverage_scope", "Coverage scope not documented")
        state = freshness_state(last_run_at, threshold)
        age_days = freshness_age_days(last_run_at)
        age_label = "unknown" if age_days is None else f"{age_days:.1f} days"
        run_label = last_run_at.isoformat() if last_run_at else "never recorded"
        count_label = "unknown" if last_count is None else str(last_count)
        print(f"- {source_id} county={county_fips} scope={scope} state={state} age={age_label} "
              f"max_age={threshold} days last_scope_refresh={run_label} last_count={count_label}")
        if state != "fresh":
            healthy = False
    if not healthy:
        print("Freshness check FAILED: resolve missing/stale/future full-refresh metadata before relying on source completeness.")
    else:
        print("Freshness check passed for all configured sources.")
    return healthy


def load(source_id, limit=None, where=None):
    if not DB_URL:
        sys.exit("DATABASE_URL not set")
    cfg = dict(SOURCES[source_id])
    if where:
        cfg["where"] = where
    # A limited sample, explicit query override, or skipped source key is not a complete refresh.
    # Never use partial runs to age out records or advance the source freshness clock.
    with psycopg.connect(DB_URL) as conn:
        run_id = conn.execute(
            "INSERT INTO core.ingest_runs (source_id) VALUES (%s) RETURNING id, started_at",
            (source_id,)).fetchone()
        conn.commit()
        fetched = changed = 0
        skipped_missing_key = 0
        batch = []
        try:
            def flush():
                nonlocal changed
                with conn.cursor() as cur:
                    for row in batch:
                        cur.execute(UPSERT, row)
                        changed += cur.rowcount
                conn.commit()
                batch.clear()

            for attrs, geom in FETCHERS[cfg["kind"]](cfg, limit=limit):
                key = attrs.get(cfg["key_field"])
                if not key:
                    skipped_missing_key += 1
                    continue
                year = _year(attrs.get(cfg["roll_year_field"])) if cfg.get("roll_year_field") else 0
                payload = json.dumps(attrs, sort_keys=True, default=str)
                batch.append((source_id, str(key), year, Jsonb(attrs),
                              json.dumps(geom) if geom else None,
                              hashlib.md5(payload.encode()).hexdigest()))
                fetched += 1
                if len(batch) >= BATCH:
                    flush()
            if batch:
                flush()
            complete_refresh = is_complete_refresh(
                limit=limit, where=where, skipped_keys=skipped_missing_key
            )
            if skipped_missing_key:
                print(f"WARNING: skipped {skipped_missing_key} records without the configured source key; freshness was not advanced.")
            if complete_refresh:
                # Reconcile last_seen only when we fetched the complete configured source scope.
                conn.execute(TOUCH, (source_id, run_id[1]))
            status = 'ok' if complete_refresh else 'partial'
            conn.execute("""UPDATE core.ingest_runs SET finished_at=now(), fetched=%s,
                            changed=%s, status=%s WHERE id=%s""", (fetched, changed, status, run_id[0]))
            if complete_refresh:
                conn.execute("UPDATE core.sources SET last_run_at=now(), last_count=%s WHERE id=%s",
                             (fetched, source_id))
            conn.commit()
        except Exception as e:
            conn.rollback()
            conn.execute("UPDATE core.ingest_runs SET finished_at=now(), status='error', error=%s "
                         "WHERE id=%s", (str(e)[:2000], run_id[0]))
            conn.commit()
            raise
    status_label = "complete" if complete_refresh else "partial (freshness unchanged)"
    print(f"{source_id}: status={status_label} fetched={fetched} new_or_changed={changed} skipped_missing_key={skipped_missing_key}")


HAZ_UPSERT = """
INSERT INTO raw.hazard_zones (layer_id, source_oid, class_code, class_label, attrs, geom)
VALUES (%s, %s, %s, %s, %s, ST_SetSRID(ST_MakeValid(ST_GeomFromGeoJSON(%s)), 4326))
ON CONFLICT (layer_id, source_oid) DO UPDATE SET class_code = EXCLUDED.class_code,
  class_label = EXCLUDED.class_label, attrs = EXCLUDED.attrs, geom = EXCLUDED.geom,
  loaded_at = now()
"""


def load_hazard(layer_id, limit=None):
    cfg = HAZARD_SOURCES[layer_id]
    n = 0
    with psycopg.connect(DB_URL) as conn:
        conn.execute((SQL_DIR / "004_hazards.sql").read_text())
        started = conn.execute("SELECT now()").fetchone()[0]
        with conn.cursor() as cur:
            for attrs, geom in FETCHERS[cfg["kind"]](cfg, limit=limit):
                if not geom:
                    continue
                cur.execute(HAZ_UPSERT, (layer_id, attrs["OBJECTID"], attrs.get(cfg["class_field"]),
                                         attrs.get(cfg["label_field"]), Jsonb(attrs), json.dumps(geom)))
                n += 1
                if n % 1000 == 0:
                    conn.commit()
            if not limit:  # full reload: drop polygons CAL FIRE removed
                cur.execute("DELETE FROM raw.hazard_zones WHERE layer_id=%s AND loaded_at < %s",
                            (layer_id, started))
        conn.commit()
    print(f"{layer_id}: {n} polygons")


def assign_hazards():
    with psycopg.connect(DB_URL) as conn:
        conn.execute((SQL_DIR / "004_hazards.sql").read_text())
        conn.execute((SQL_DIR / "005_fhsz_assign.sql").read_text())
        conn.commit()
        for r in conn.execute("""SELECT county_fips, fhsz_class, count(*) FROM core.parcels
                                 WHERE fhsz_class IS NOT NULL GROUP BY 1,2 ORDER BY 1,2"""):
            print("fhsz", r)


def normalize():
    with psycopg.connect(DB_URL) as conn:
        for f in ("002_normalize.sql", "003_signals.sql"):
            conn.execute((SQL_DIR / f).read_text())
            print("applied", f)
        conn.commit()
        for r in conn.execute("SELECT county_fips, count(*) FROM core.parcels GROUP BY 1"):
            print("parcels", r)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("cmd", choices=["inspect", "load", "normalize", "load-hazard", "assign-hazards", "publish", "freshness"])
    p.add_argument("source", nargs="?")
    p.add_argument("--limit", type=positive_int)
    p.add_argument("--where")
    p.add_argument("--county", help="publish scope, e.g. 06037")
    p.add_argument("--confirm", action="store_true", help="publish: actually write")
    p.add_argument("--budget-mb", type=positive_int, default=400)
    p.add_argument("--stale-days", type=positive_int, help="override all configured source freshness thresholds")
    a = p.parse_args()
    if a.cmd == "inspect":
        inspect(a.source)
    elif a.cmd == "load":
        load(a.source, a.limit, a.where)
    elif a.cmd == "load-hazard":
        load_hazard(a.source, a.limit)
    elif a.cmd == "assign-hazards":
        assign_hazards()
    elif a.cmd == "publish":
        publish(a.county, a.confirm, a.budget_mb)
    elif a.cmd == "freshness":
        if not report_freshness(a.stale_days):
            sys.exit(1)
    else:
        normalize()