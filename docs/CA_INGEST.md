# PropFlow CA Ingest — Phase 1 (LA County + San Francisco)

## Verified sources (Oct 2026)
| id | Source | Notes |
|---|---|---|
| la_parcels | LA County Assessor parcel MapServer (`public.gis.lacounty.gov/.../LACounty_Parcel/MapServer/0`) | Official layer has ~2.4M parcels; app coverage is limited to the Malibu-area subset (`SitusCity LIKE 'MALIBU%'`), not countywide. Weekly cache; monthly FGDB/SHP on data.lacounty.gov (2nd of month) |
| sf_roll | DataSF Assessor Historical Secured Property Tax Rolls (`wv5m-vpq2`) | Rolls 2007–2024, annual update ~Aug. PDDL license |

Alternate bulk: LA annual roll CSVs ("Assessor Parcel Data Rolls 2006–present") on data.lacounty.gov.

## Setup
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env && export $(grep -v '^#' .env | xargs)
psql "$DATABASE_URL" -f sql/001_schema.sql
```
DB: Supabase or Neon (PostGIS enabled). LA full load is ~2–4 GB with geometry —
the slim full-county publish is estimated at ~1–2 GB. The workflow's default 400 MB target
budget intentionally prevents a full LA County publish into the current small database.

The current configured LA scope is `SitusCity LIKE 'MALIBU%'` (the 7,752-record snapshot is
Malibu-area only). A successful refresh marks that configured subset as current; it must
never be described as complete coverage of all Los Angeles County parcels. Expand the
scope only when the target storage budget and publication path have been reviewed.

## Run
```bash
python -m ingest.run inspect la_parcels         # confirm upstream field names
python -m ingest.run inspect sf_roll
python -m ingest.run load la_parcels --limit 5000  # sample only; freshness remains unchanged
python -m ingest.run load sf_roll --limit 5000    # sample only; freshness remains unchanged
python -m ingest.run load la_parcels              # complete configured Malibu-area scope only
python -m ingest.run load sf_roll                 # configured secured rolls from 2022 onward
python -m ingest.run normalize                    # raw -> core + signals
python -m ingest.run freshness                    # report scope and latest complete refresh
```

For the production workflow, open **Actions → ca-ingest → Run workflow**. Leave `la_where`
blank to use the configured Malibu-area scope; set `publish=true` only when the dry-run
budget output is acceptable. The default remains dry-run. A city filter override or row
limit is treated as partial and cannot advance source freshness.

## Verify
```sql
SELECT source_id, status, fetched, changed, finished_at - started_at AS dur
FROM core.ingest_runs ORDER BY id DESC LIMIT 5;
SELECT county_fips, count(*), count(geom) AS with_geom, count(last_sale_date) AS with_sale
FROM core.parcels GROUP BY 1;
SELECT signal_type, count(*) FROM core.signals GROUP BY 1;
SELECT count(*) FROM core.parcels WHERE NOT ST_IsValid(geom);   -- expect 0
```

## Source freshness monitoring

Configured source thresholds are in `ingest/sources.py`: 14 days for the LA County weekly-cache layer and 400 days for the annual San Francisco secured roll (including publication lag). Check a staging or production-compatible connection with:

```bash
DATABASE_URL="$SUPABASE_DATABASE_URL" python -m ingest.run freshness
```

The report exits nonzero if any configured source has no recorded complete refresh, is stale, or has a timestamp unexpectedly far in the future. The GitHub Actions workflow `.github/workflows/source-freshness.yml` checks weekly, can be run manually, runs after a successful `ca-ingest` workflow, and reruns when ingestion code/workflow changes are pushed to `main`. It requires the repository secret `SUPABASE_DATABASE_URL`; the workflow only reads source metadata and does not publish or modify records.

A publish to Supabase carries forward only source timestamps from successful complete runs in staging. The generic publish timestamp is not treated as evidence of a source refresh. Partial `--limit` / `--where` loads do not advance the staging source timestamp.

## Refresh safety

Loads that use `--limit`, an explicit `--where` override, or skip records because the
configured source key is missing are recorded with `status='partial'`. They do not
reconcile `raw.records.last_seen` or update `core.sources.last_run_at/last_count`.
This prevents a sample, county/city subset, or malformed upstream result from being
mistaken for a complete refresh and prevents unseen records from being marked as seen.
A full refresh means the configured source scope was fetched without an explicit
limit/query override and without records skipped for missing source keys. For LA, that
configured scope is currently the Malibu-area subset—not all Los Angeles County. The
source-freshness report prints the configured scope beside the status to prevent this
subset from being mistaken for countywide coverage.

## Known gaps
- **Owner name / mailing address** are not in these open datasets. Sources: CPRA request
  to each Assessor (cost-of-duplication), or paid (PropertyRadar/ATTOM/Regrid).
- Field names in `002_normalize.sql` must be confirmed via `inspect` on first run.
- Change detection: `row_hash` updates only changed rows; `last_seen` marks deletions
  (rows with last_seen < latest run = retired parcels).

## Phase 1b — CAL FIRE Fire Hazard Severity Zones ✅
| Layer | Service (owner `prefire.calfire`) | Status | Polygons loaded |
|---|---|---|---|
| fhsz_sra | `FHSZSRA_23_3/FeatureServer/0` | SRA, effective 2024-04-01 | 18,423 |
| fhsz_lra | `FHSALRA25_v1_All/FeatureServer/0` | LRA, recommended 2025-03-24; adopted by local ordinance | 7,798 (NonWildland excluded) |

```bash
psql "$DATABASE_URL" -f sql/004_hazards.sql
python -m ingest.run load-hazard fhsz_sra      # ~2 min
python -m ingest.run load-hazard fhsz_lra      # ~35 s
python -m ingest.run assign-hazards            # subdivide + point-on-surface join + signals
```
Method: polygons are `ST_Subdivide`d (256 vertices) and GiST-indexed; each parcel gets the
**highest** class at its point-on-surface (no edge double-counting). Result columns:
`core.parcels.fhsz_class` (1 Moderate / 2 High / 3 Very High), `fhsz_layer`.
Signals: `fhsz_moderate`, `fhsz_high`, `fhsz_very_high`.

Test (Malibu, 4,000 LA parcels): 95% Very High, 0 invalid zone geometries, re-run idempotent.
Not yet benchmarked on the full 2.4M LA roll — run once and record duration in `ingest_runs`.

Caveats: LRA zones are legally effective only where the city/county adopted them; treat
`fhsz_layer='fhsz_lra'` as "designated or pending" until checked against local ordinance.
FHSZ is a hazard designation, not an insurance outcome.

## Phase 1c (next)
- Load CAL FIRE FHSZ layer -> `raw.fhsz`, enable block in `003_signals.sql`
- SF Assessor-Recorder transfers + DBI violations; LAHD RSO units
- CPRA request letters for LA/SF owner+mailing rolls

## Test results (live data, local PostGIS 16, 3k-row sample per source)
| Check | LA | SF |
|---|---|---|
| Fields mapped | ✅ verified | ✅ verified |
| Geometry | Polygon/MultiPolygon, 0 invalid | Point (centroid), ~4% null |
| Prop 13 base year | ✅ | ❌ (use sale date) |
| Last sale date | ❌ not in layer | ✅ |
| Re-run idempotent | ✅ 0 changed rows | ✅ |
| Signals | long_tenure, non_owner_occupied | same |

Open items: SF `property_location` is fixed-width ("0000 0228 COLLINS ST0000") and needs an
address parser; SF open roll currently ends at the 2024 roll year.

## Staged publish to Supabase (added 2026-10-06)
Heavy data (raw JSONB, polygons, FHSZ) stays in a throwaway staging PostGIS. Only slim
parcels (points) and signals are published to Supabase.

| Env var | Points to |
|---|---|
| `DATABASE_URL` | Staging PostGIS (CI service container, or local) |
| `SUPABASE_DATABASE_URL` | Supabase session pooler, `sslmode=require` (GitHub secret) |

```bash
python -m ingest.run publish --county 06037              # dry run: counts + projected size
python -m ingest.run publish --county 06037 --confirm    # write (aborts if > --budget-mb, default 400)
```
Guards: refuses if staging == target; aborts if projected size > budget; unchanged rows are
skipped (re-runs write 0 rows). Sizing (calibrated): ~400 B/parcel, ~220 B/signal.
Full LA slim ≈ 1–2 GB incl. signals → needs Supabase Pro or staying on geographic stages.

Workflow `ca-ingest` is manual-only (no schedule). Inputs: `la_where` (stage filter,
default Malibu), `sf`, `publish` (default false = dry run), `budget_mb`.