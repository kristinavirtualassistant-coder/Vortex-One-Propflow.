-- Derived signals (re-runnable; unique per parcel/type/day)

-- Long tenure (>=15 yrs) via sale date (SF) or Prop 13 land base year (LA)
INSERT INTO core.signals (county_fips, apn, signal_type, source_id, value)
SELECT county_fips, apn, 'long_tenure', 'derived',
       jsonb_build_object('since', COALESCE(extract(year FROM last_sale_date)::int, base_year))
FROM core.parcels
WHERE COALESCE(extract(year FROM last_sale_date)::int, base_year)
      BETWEEN 1900 AND extract(year FROM current_date)::int - 15
ON CONFLICT DO NOTHING;

-- Non-owner-occupied residential (no homeowner exemption) = investor/landlord proxy
INSERT INTO core.signals (county_fips, apn, signal_type, source_id)
SELECT county_fips, apn, 'non_owner_occupied', 'derived'
FROM core.parcels
WHERE homeowner_exempt IS FALSE AND units BETWEEN 1 AND 4
ON CONFLICT DO NOTHING;

-- Absentee owner (only where a mailing address exists)
INSERT INTO core.signals (county_fips, apn, signal_type, source_id)
SELECT county_fips, apn, 'absentee', 'derived'
FROM core.parcels
WHERE mail_address IS NOT NULL AND situs_address IS NOT NULL
  AND upper(regexp_replace(mail_address,'\W','','g'))
      NOT LIKE upper(regexp_replace(situs_address,'\W','','g')) || '%'
ON CONFLICT DO NOTHING;

-- Fire hazard signals: see sql/005_fhsz_assign.sql (run via `assign-hazards`)