-- Rebuild subdivided zones (cheap: ~18k + 8k polygons)
TRUNCATE raw.hazard_zones_sub;
INSERT INTO raw.hazard_zones_sub (layer_id, source_oid, class_code, geom)
SELECT layer_id, source_oid, class_code, ST_Subdivide(geom, 256)
FROM raw.hazard_zones WHERE layer_id LIKE 'fhsz_%';
ANALYZE raw.hazard_zones_sub;

-- Assign highest FHSZ class at each parcel's point-on-surface
-- (points from SF are used as-is; polygons from LA get an interior point)
WITH pt AS (
  SELECT county_fips, apn,
         CASE WHEN GeometryType(geom) LIKE '%POLYGON' THEN ST_PointOnSurface(geom) ELSE geom END AS g
  FROM core.parcels WHERE geom IS NOT NULL
), hit AS (
  SELECT DISTINCT ON (pt.county_fips, pt.apn)
         pt.county_fips, pt.apn, z.class_code, z.layer_id
  FROM pt JOIN raw.hazard_zones_sub z ON ST_Intersects(z.geom, pt.g)
  ORDER BY pt.county_fips, pt.apn, z.class_code DESC
)
UPDATE core.parcels p
SET fhsz_class = h.class_code, fhsz_layer = h.layer_id, fhsz_checked_at = now()
FROM hit h
WHERE p.county_fips = h.county_fips AND p.apn = h.apn;

-- Parcels checked with no hit -> clear stale values
UPDATE core.parcels
SET fhsz_class = NULL, fhsz_layer = NULL, fhsz_checked_at = now()
WHERE geom IS NOT NULL AND fhsz_checked_at IS DISTINCT FROM now();  -- same txn now() = just assigned

-- Signals
INSERT INTO core.signals (county_fips, apn, signal_type, source_id, value)
SELECT county_fips, apn,
       'fhsz_' || CASE fhsz_class WHEN 3 THEN 'very_high' WHEN 2 THEN 'high' ELSE 'moderate' END,
       fhsz_layer, jsonb_build_object('class', fhsz_class)
FROM core.parcels WHERE fhsz_class IS NOT NULL
ON CONFLICT DO NOTHING;