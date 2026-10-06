"""Publish slim parcels (points, no raw JSONB, no hazard polygons) from the staging
PostGIS (DATABASE_URL) to the app database (SUPABASE_DATABASE_URL).

Dry-run by default. Writes only with --confirm, and only if the projected target size
stays under --budget-mb (default 400 MB, leaving headroom on the 500 MB Free plan).
"""
import os
import sys

import psycopg

# Calibrated 2026-10-06 on 4,000 LA parcels / 8,055 signals after VACUUM FULL:
# 334 B/parcel and 195 B/signal incl. indexes. ~15% margin added.
BYTES_PER_PARCEL = 400
BYTES_PER_SIGNAL = 220

COLS = ("county_fips, apn, apn_raw, situs_address, situs_city, situs_zip, owner_name, "
        "mail_address, use_code, units, year_built, building_sqft, lot_sqft, land_value, "
        "improvement_value, base_year, last_sale_date, roll_year, homeowner_exempt, "
        "fhsz_class, fhsz_layer, fhsz_checked_at")
COL_LIST = [c.strip() for c in COLS.split(",")]

SELECT_PARCELS = f"""
SELECT {COLS},
       encode(ST_AsEWKB(CASE WHEN GeometryType(geom) LIKE '%%POLYGON'
                             THEN ST_PointOnSurface(geom) ELSE geom END), 'hex') AS geom_hex
FROM core.parcels WHERE (%(county)s::text IS NULL OR county_fips = %(county)s)
ORDER BY county_fips, apn
"""
SELECT_SIGNALS = """
SELECT county_fips, apn, signal_type, source_id, observed_on, value::text
FROM core.signals WHERE (%(county)s::text IS NULL OR county_fips = %(county)s)
"""

STAGE_DDL = f"""
CREATE TEMP TABLE stage_parcels (LIKE core.parcels INCLUDING DEFAULTS) ON COMMIT DROP;
ALTER TABLE stage_parcels DROP COLUMN geom, ADD COLUMN geom_hex text;
CREATE TEMP TABLE stage_signals (county_fips char(5), apn text, signal_type text,
  source_id text, observed_on date, value jsonb) ON COMMIT DROP;
"""
MERGE_PARCELS = f"""
INSERT INTO core.parcels AS p ({COLS}, geom, updated_at)
SELECT {COLS}, ST_SetSRID(ST_GeomFromEWKB(decode(geom_hex, 'hex')), 4326), now()
FROM stage_parcels
ON CONFLICT (county_fips, apn) DO UPDATE SET
  {", ".join(f"{c} = EXCLUDED.{c}" for c in COL_LIST[2:])},
  geom = EXCLUDED.geom, updated_at = now()
WHERE ({", ".join("p." + c for c in COL_LIST[2:])}, p.geom)
      IS DISTINCT FROM
      ({", ".join("EXCLUDED." + c for c in COL_LIST[2:])}, EXCLUDED.geom)
"""
MERGE_SIGNALS = """
INSERT INTO core.signals (county_fips, apn, signal_type, source_id, observed_on, value)
SELECT county_fips, apn, signal_type, source_id, observed_on, value FROM stage_signals
ON CONFLICT (county_fips, apn, signal_type, observed_on) DO NOTHING
"""


def _mb(b):
    return round(b / 1024 / 1024, 1)


def publish(county=None, confirm=False, budget_mb=400):
    src_url, dst_url = os.getenv("DATABASE_URL"), os.getenv("SUPABASE_DATABASE_URL")
    if not src_url or not dst_url:
        sys.exit("DATABASE_URL (staging) and SUPABASE_DATABASE_URL (target) must both be set")
    if src_url == dst_url:
        sys.exit("Refusing: staging and target are the same database")
    params = {"county": county}

    with psycopg.connect(src_url) as src, psycopg.connect(dst_url) as dst:
        n_parcels = src.execute(
            "SELECT count(*) FROM core.parcels WHERE (%(county)s::text IS NULL OR county_fips=%(county)s)",
            params).fetchone()[0]
        n_signals = src.execute(
            "SELECT count(*) FROM core.signals WHERE (%(county)s::text IS NULL OR county_fips=%(county)s)",
            params).fetchone()[0]
        target_now = dst.execute("SELECT pg_database_size(current_database())").fetchone()[0]
        already = dst.execute(
            "SELECT count(*) FROM core.parcels WHERE (%(county)s::text IS NULL OR county_fips=%(county)s)",
            params).fetchone()[0]
        new_rows = max(n_parcels - already, 0)
        added = new_rows * BYTES_PER_PARCEL + n_signals * BYTES_PER_SIGNAL
        projected = target_now + added

        print(f"scope:        county={county or 'ALL'}")
        print(f"staging:      {n_parcels:,} parcels, {n_signals:,} signals")
        print(f"target now:   {_mb(target_now)} MB ({already:,} parcels in scope already)")
        print(f"projected:    +{_mb(added)} MB -> {_mb(projected)} MB (budget {budget_mb} MB)")

        if projected > budget_mb * 1024 * 1024:
            sys.exit("ABORT: projected size exceeds budget. Narrow the stage or raise --budget-mb.")
        if not confirm:
            print("DRY RUN: nothing written. Re-run with --confirm to publish.")
            return

        with dst.transaction():
            dst.execute(STAGE_DDL)
            with src.cursor(name="pub_parcels") as rc, \
                 dst.cursor().copy(f"COPY stage_parcels ({COLS}, geom_hex) FROM STDIN") as cp:
                rc.itersize = 5000
                rc.execute(SELECT_PARCELS, params)
                for row in rc:
                    cp.write_row(row)
            with src.cursor(name="pub_signals") as rc, \
                 dst.cursor().copy("COPY stage_signals FROM STDIN") as cp:
                rc.itersize = 5000
                rc.execute(SELECT_SIGNALS, params)
                for row in rc:
                    cp.write_row(row)
            up = dst.execute(MERGE_PARCELS).rowcount
            sig = dst.execute(MERGE_SIGNALS).rowcount
            dst.execute("""INSERT INTO core.ingest_runs (source_id, finished_at, fetched, changed, status)
                           VALUES (%s, now(), %s, %s, 'ok')""",
                        (f"publish:{county or 'ALL'}", n_parcels, up))
        final = dst.execute("SELECT pg_database_size(current_database())").fetchone()[0]
        print(f"PUBLISHED:    {up:,} parcels new/changed, {sig:,} new signals; target now {_mb(final)} MB")