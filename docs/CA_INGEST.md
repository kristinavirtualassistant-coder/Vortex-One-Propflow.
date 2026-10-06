# PropFlow CA Ingest — Phase 1 (LA County + San Francisco)

## Verified sources (Oct 2026)
| id | Source | Notes |
|---|---|---|
| la_parcels | LA County Assessor parcel MapServer (`public.gis.lacounty.gov/.../LACounty_Parcel/MapServer/0`) | ~2.4M parcels; weekly cache. Monthly FGDB/SHP on data.lacounty.gov (2nd of month) |
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
Neon/Supabase free tiers (≈0.5 GB) are too small; use a paid tier or self-hosted Postgres.

## Run
```bash
python -m ingest.run inspect sf_roll          # 1. confirm field names
python -m ingest.run inspect la_parcels
#   -> fix key_field in ingest/sources.py and keys in sql/002_normalize.sql if needed
python -m ingest.run load sf_roll --limit 5000   # 2. smoke test
python -m ingest.run load la_parcels --limit 5000
python -m ingest.run normalize                   # 3. raw -> core + signals
python -m ingest.run load la_parcels             # 4. full loads
python -m ingest.run load sf_roll
python -m ingest.run normalize
```

## Verify
```sql
SELECT source_id, status, fetched, changed, finished_at - started_at AS dur
FROM core.ingest_runs ORDER BY id DESC LIMIT 5;
SELECT county_fips, count(*), count(geom) AS with_geom, count(last_sale_date) AS with_sale
FROM core.parcels GROUP BY 1;
SELECT signal_type, count(*) FROM core.signals GROUP BY 1;
SELECT count(*) FROM core.parcels WHERE NOT ST_IsValid(geom);   -- expect 0
```

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