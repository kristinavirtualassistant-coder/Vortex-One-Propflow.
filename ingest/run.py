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
from .publish import publish
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


def load(source_id, limit=None, where=None):
    if not DB_URL:
        sys.exit("DATABASE_URL not set")
    cfg = dict(SOURCES[source_id])
    if where:
        cfg["where"] = where
    with psycopg.connect(DB_URL) as conn:
        run_id = conn.execute(
            "INSERT INTO core.ingest_runs (source_id) VALUES (%s) RETURNING id, started_at",
            (source_id,)).fetchone()
        conn.commit()
        fetched = changed = 0
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
            conn.execute(TOUCH, (source_id, run_id[1]))
            conn.execute("""UPDATE core.ingest_runs SET finished_at=now(), fetched=%s,
                            changed=%s, status='ok' WHERE id=%s""", (fetched, changed, run_id[0]))
            conn.execute("UPDATE core.sources SET last_run_at=now(), last_count=%s WHERE id=%s",
                         (fetched, source_id))
            conn.commit()
        except Exception as e:
            conn.rollback()
            conn.execute("UPDATE core.ingest_runs SET finished_at=now(), status='error', error=%s "
                         "WHERE id=%s", (str(e)[:2000], run_id[0]))
            conn.commit()
            raise
    print(f"{source_id}: fetched={fetched} new_or_changed={changed}")


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
    p.add_argument("cmd", choices=["inspect", "load", "normalize", "load-hazard", "assign-hazards", "publish"])
    p.add_argument("source", nargs="?")
    p.add_argument("--limit", type=int)
    p.add_argument("--where")
    p.add_argument("--county", help="publish scope, e.g. 06037")
    p.add_argument("--confirm", action="store_true", help="publish: actually write")
    p.add_argument("--budget-mb", type=int, default=400)
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
    else:
        normalize()