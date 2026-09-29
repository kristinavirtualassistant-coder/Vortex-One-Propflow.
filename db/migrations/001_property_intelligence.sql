CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS property_owners (
  id serial PRIMARY KEY,
  canonical_name text NOT NULL,
  owner_type text NOT NULL DEFAULT 'person',
  normalized_name text,
  mailing_address text,
  city text,
  state text,
  postal_code text,
  source text,
  source_record_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS properties (
  id serial PRIMARY KEY,
  apn text,
  fips text,
  state text,
  county text,
  address_line1 text,
  city text,
  postal_code text,
  property_type text,
  bedrooms numeric,
  bathrooms numeric,
  living_sqft integer,
  lot_sqft integer,
  year_built integer,
  assessed_value numeric,
  estimated_value numeric,
  estimated_rent numeric,
  last_sale_price numeric,
  last_sale_date timestamptz,
  latitude double precision,
  longitude double precision,
  geom geography(Point,4326),
  vacancy_status text,
  owner_occupied boolean,
  tax_delinquent boolean NOT NULL DEFAULT false,
  pre_foreclosure boolean NOT NULL DEFAULT false,
  foreclosure boolean NOT NULL DEFAULT false,
  probate boolean NOT NULL DEFAULT false,
  lien_count integer NOT NULL DEFAULT 0,
  mortgage_balance numeric,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS properties_apn_fips_uidx ON properties(fips, apn) WHERE apn IS NOT NULL;
CREATE INDEX IF NOT EXISTS properties_state_county_idx ON properties(state, county);
CREATE INDEX IF NOT EXISTS properties_postal_idx ON properties(postal_code);
CREATE INDEX IF NOT EXISTS properties_lat_lon_idx ON properties(latitude, longitude);
CREATE INDEX IF NOT EXISTS properties_geom_gix ON properties USING GIST(geom);
CREATE INDEX IF NOT EXISTS properties_signals_idx ON properties(tax_delinquent, pre_foreclosure, foreclosure, probate, vacancy_status);

CREATE TABLE IF NOT EXISTS property_owner_links (
  id serial PRIMARY KEY,
  property_id integer NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id integer NOT NULL REFERENCES property_owners(id) ON DELETE CASCADE,
  ownership_percent numeric,
  role text NOT NULL DEFAULT 'owner',
  source text
);
CREATE UNIQUE INDEX IF NOT EXISTS property_owner_links_uidx ON property_owner_links(property_id, owner_id, role);

CREATE TABLE IF NOT EXISTS property_sources (
  id serial PRIMARY KEY,
  property_id integer REFERENCES properties(id) ON DELETE CASCADE,
  source text NOT NULL,
  source_record_id text,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  effective_date timestamptz,
  confidence numeric,
  record_hash text
);
CREATE INDEX IF NOT EXISTS property_sources_property_idx ON property_sources(property_id);
CREATE INDEX IF NOT EXISTS property_sources_source_idx ON property_sources(source, source_record_id);

CREATE TABLE IF NOT EXISTS property_leads (
  id serial PRIMARY KEY,
  user_id text NOT NULL,
  property_id integer NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, property_id)
);
CREATE INDEX IF NOT EXISTS property_leads_user_score_idx ON property_leads(user_id, score DESC);

CREATE TABLE IF NOT EXISTS saved_property_searches (
  id serial PRIMARY KEY,
  user_id text NOT NULL,
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_property_geom() RETURNS trigger AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS properties_geom_trigger ON properties;
CREATE TRIGGER properties_geom_trigger BEFORE INSERT OR UPDATE ON properties
FOR EACH ROW EXECUTE FUNCTION set_property_geom();
