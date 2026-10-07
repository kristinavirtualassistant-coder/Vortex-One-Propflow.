-- California public-record ingestion schema used by the Property Intelligence bridge.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA IF NOT EXISTS raw;
CREATE SCHEMA IF NOT EXISTS core;

CREATE TABLE IF NOT EXISTS core.sources (
  id text PRIMARY KEY, county_fips char(5) NOT NULL, url text NOT NULL, kind text NOT NULL,
  last_run_at timestamptz, last_count integer, schema_hash text
);

CREATE TABLE IF NOT EXISTS raw.records (
  source_id text NOT NULL REFERENCES core.sources(id), source_key text NOT NULL,
  roll_year integer NOT NULL DEFAULT 0, attrs jsonb NOT NULL,
  geom geometry(Geometry, 4326), row_hash text NOT NULL,
  first_seen timestamptz NOT NULL DEFAULT now(), last_seen timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, source_key, roll_year)
);
CREATE INDEX IF NOT EXISTS records_geom_gix ON raw.records USING gist (geom);

CREATE TABLE IF NOT EXISTS core.parcels (
  county_fips char(5) NOT NULL, apn text NOT NULL, apn_raw text,
  situs_address text, situs_city text, situs_zip text, owner_name text, mail_address text,
  use_code text, units integer, year_built integer, building_sqft integer, lot_sqft numeric,
  land_value bigint, improvement_value bigint, base_year integer, last_sale_date date,
  roll_year integer, homeowner_exempt boolean, geom geometry(Geometry, 4326),
  updated_at timestamptz NOT NULL DEFAULT now(), fhsz_class smallint, fhsz_layer text,
  fhsz_checked_at timestamptz, PRIMARY KEY (county_fips, apn)
);
CREATE INDEX IF NOT EXISTS parcels_geom_gix ON core.parcels USING gist (geom);
CREATE INDEX IF NOT EXISTS parcels_fhsz_idx ON core.parcels (fhsz_class) WHERE fhsz_class IS NOT NULL;

CREATE TABLE IF NOT EXISTS core.signals (
  id bigserial PRIMARY KEY, county_fips char(5) NOT NULL, apn text NOT NULL,
  signal_type text NOT NULL, source_id text, observed_on date NOT NULL DEFAULT current_date,
  value jsonb, UNIQUE (county_fips, apn, signal_type, observed_on)
);

CREATE TABLE IF NOT EXISTS core.ingest_runs (
  id bigserial PRIMARY KEY, source_id text NOT NULL, started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz, fetched integer DEFAULT 0, changed integer DEFAULT 0, status text DEFAULT 'running', error text
);

CREATE TABLE IF NOT EXISTS raw.hazard_zones (
  layer_id text NOT NULL, source_oid bigint NOT NULL, class_code smallint,
  class_label text, attrs jsonb NOT NULL, geom geometry(Geometry, 4326) NOT NULL,
  loaded_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (layer_id, source_oid)
);
CREATE TABLE IF NOT EXISTS raw.hazard_zones_sub (
  layer_id text NOT NULL, source_oid bigint NOT NULL, class_code smallint,
  geom geometry(Geometry, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS hazard_zones_sub_gix ON raw.hazard_zones_sub USING gist (geom);

INSERT INTO core.sources (id, county_fips, url, kind) VALUES
 ('la_parcels','06037','https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0','arcgis'),
 ('sf_roll','06075','https://data.sfgov.org/resource/wv5m-vpq2.json','socrata')
ON CONFLICT (id) DO NOTHING;
