-- raw -> core.parcels. Field keys verified against live endpoints Oct 2026.
-- Re-run `python -m ingest.run inspect <source>` if a load starts producing NULLs.

-- San Francisco: latest roll year per parcel
INSERT INTO core.parcels AS p (county_fips, apn, apn_raw, situs_address, use_code, units,
  year_built, building_sqft, lot_sqft, land_value, improvement_value, last_sale_date,
  roll_year, homeowner_exempt, geom, updated_at)
SELECT DISTINCT ON (r.source_key)
  '06075',
  regexp_replace(r.source_key, '[^0-9A-Za-z]', '', 'g'),
  r.source_key,
  r.attrs->>'property_location',
  r.attrs->>'use_code',
  nullif(r.attrs->>'number_of_units','')::numeric::int,
  nullif(r.attrs->>'year_property_built','')::numeric::int,
  nullif(r.attrs->>'property_area','')::numeric::int,
  nullif(r.attrs->>'lot_area','')::numeric,
  nullif(r.attrs->>'assessed_land_value','')::numeric::bigint,
  nullif(r.attrs->>'assessed_improvement_value','')::numeric::bigint,
  nullif(left(r.attrs->>'current_sales_date',10),'')::date,
  r.roll_year,
  nullif(r.attrs->>'homeowner_exemption_value','')::numeric > 0,
  r.geom, now()
FROM raw.records r
WHERE r.source_id = 'sf_roll'
ORDER BY r.source_key, r.roll_year DESC
ON CONFLICT (county_fips, apn) DO UPDATE SET
  situs_address = EXCLUDED.situs_address, use_code = EXCLUDED.use_code,
  units = EXCLUDED.units, year_built = EXCLUDED.year_built,
  building_sqft = EXCLUDED.building_sqft, lot_sqft = EXCLUDED.lot_sqft,
  land_value = EXCLUDED.land_value, improvement_value = EXCLUDED.improvement_value,
  last_sale_date = EXCLUDED.last_sale_date, roll_year = EXCLUDED.roll_year,
  homeowner_exempt = EXCLUDED.homeowner_exempt, geom = COALESCE(EXCLUDED.geom, p.geom), updated_at = now();

-- Los Angeles parcel layer
INSERT INTO core.parcels AS p (county_fips, apn, apn_raw, situs_address, situs_city,
  situs_zip, use_code, units, year_built, building_sqft, land_value, improvement_value,
  base_year, homeowner_exempt, roll_year, geom, updated_at)
SELECT
  '06037',
  regexp_replace(r.source_key, '[^0-9]', '', 'g'),
  r.source_key,
  COALESCE(r.attrs->>'SitusFullAddress', r.attrs->>'SitusAddress'),
  nullif(trim(regexp_replace(upper(r.attrs->>'SitusCity'), '[ ,]+(CA|CALIF|CALIFORNIA)\.?$', '')), ''),
  r.attrs->>'SitusZIP',
  r.attrs->>'UseCode',
  nullif(r.attrs->>'Units1','')::numeric::int,
  nullif(r.attrs->>'YearBuilt1','')::numeric::int,
  nullif(r.attrs->>'SQFTmain1','')::numeric::int,
  nullif(r.attrs->>'Roll_LandValue','')::numeric::bigint,
  nullif(r.attrs->>'Roll_ImpValue','')::numeric::bigint,
  nullif(r.attrs->>'Roll_LandBaseYear','')::numeric::int,
  nullif(r.attrs->>'Roll_HomeOwnersExemp','')::numeric > 0,
  nullif(r.attrs->>'Roll_Year','')::numeric::int,
  r.geom, now()
FROM raw.records r
WHERE r.source_id = 'la_parcels'
ON CONFLICT (county_fips, apn) DO UPDATE SET
  situs_address = EXCLUDED.situs_address, situs_city = EXCLUDED.situs_city,
  situs_zip = EXCLUDED.situs_zip, use_code = EXCLUDED.use_code, units = EXCLUDED.units,
  year_built = EXCLUDED.year_built, building_sqft = EXCLUDED.building_sqft,
  land_value = EXCLUDED.land_value, improvement_value = EXCLUDED.improvement_value,
  base_year = EXCLUDED.base_year, homeowner_exempt = EXCLUDED.homeowner_exempt,
  roll_year = EXCLUDED.roll_year, geom = COALESCE(EXCLUDED.geom, p.geom), updated_at = now();