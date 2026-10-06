-- Statewide hazard polygons (FHSZ now; CGS fault/liquefaction, FEMA flood later)
CREATE TABLE IF NOT EXISTS raw.hazard_zones (
  layer_id     text    NOT NULL,           -- 'fhsz_sra' | 'fhsz_lra'
  source_oid   bigint  NOT NULL,
  class_code   smallint,                   -- FHSZ: 1 Moderate, 2 High, 3 Very High
  class_label  text,
  attrs        jsonb   NOT NULL,
  geom         geometry(Geometry, 4326) NOT NULL,
  loaded_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (layer_id, source_oid)
);

-- Subdivided copy: large wildland polygons make ST_Intersects slow
CREATE TABLE IF NOT EXISTS raw.hazard_zones_sub (
  layer_id     text NOT NULL,
  source_oid   bigint NOT NULL,
  class_code   smallint,
  geom         geometry(Geometry, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS hazard_zones_sub_gix ON raw.hazard_zones_sub USING gist (geom);

ALTER TABLE core.parcels
  ADD COLUMN IF NOT EXISTS fhsz_class   smallint,   -- highest class at parcel point-on-surface
  ADD COLUMN IF NOT EXISTS fhsz_layer   text,       -- 'fhsz_sra' | 'fhsz_lra'
  ADD COLUMN IF NOT EXISTS fhsz_checked_at timestamptz;
CREATE INDEX IF NOT EXISTS parcels_fhsz_idx ON core.parcels (fhsz_class) WHERE fhsz_class IS NOT NULL;