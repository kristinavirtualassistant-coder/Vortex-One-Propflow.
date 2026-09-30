# GIS Cloud Field Mapping Contract

## Canonical mapping

| Domain | Vortex field | GIS field | Type | Direction |
|---|---|---|---|---|
| Identity | property_id | vortex_property_id | UUID/string | Vortex -> GIS |
| Parcel | apn | apn | string | Vortex -> GIS |
| Address | address | site_address | string | Vortex -> GIS |
| Location | city | city | string | Vortex -> GIS |
| Location | state | state | string | Vortex -> GIS |
| Location | zip_code | zip_code | string | Vortex -> GIS |
| Location | county | county | string | Vortex -> GIS |
| Spatial | latitude | latitude | decimal | Vortex -> GIS |
| Spatial | longitude | longitude | decimal | Vortex -> GIS |
| Spatial | parcel_geometry | geometry | geometry | Vortex <-> GIS |
| Property | property_type | property_type | string | Vortex -> GIS |
| Property | year_built | year_built | integer | Vortex -> GIS |
| Owner | owner_id | vortex_owner_id | UUID/string | Vortex -> GIS |
| Owner | owner_name | owner_name | string | Vortex -> GIS |
| Owner | owner_occupied | owner_occupied | boolean | Vortex -> GIS |
| Valuation | estimated_value | estimated_value | numeric | Vortex -> GIS |
| Equity | equity | equity | numeric | Vortex -> GIS |
| Lead | lead_status | lead_status | enum/string | Vortex -> GIS |
| Lead | lead_score | lead_score | numeric | Vortex -> GIS |
| Campaign | campaign_id | vortex_campaign_id | UUID/string | Vortex -> GIS |
| Sync | updated_at | vortex_updated_at | timestamp | Vortex -> GIS |

## Reserved GIS fields

- gis_feature_id
- gis_layer_id
- gis_source
- gis_last_synced_at
- gis_sync_status
- gis_sync_hash

## Mapping rules

1. Supabase/Postgres remains the source of truth for business data.
2. GIS Cloud is authoritative only for GIS-native/spatial information explicitly designated as GIS-managed.
3. APN is a business identifier, not the sole cross-system identity.
4. `property_id` is the durable Vortex identity used to associate records across systems.

## Null handling

- Unknown values remain null.
- Do not convert null numeric values to zero.
- Do not invent coordinates.
- A missing geometry must not be replaced with a fabricated polygon.
- Geometry should be validated before publication to the map.

## Change detection

Use `sync_hash` or an equivalent deterministic field comparison so unchanged records are not rewritten unnecessarily.

## Audit requirement

Every synchronization operation should identify:

- vortex_property_id
- gis_feature_id
- GIS layer
- operation
- changed fields
- timestamp
- status
- error_message when applicable