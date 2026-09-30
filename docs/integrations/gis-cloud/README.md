# GIS Cloud Integration — Vortex One PropFlow

## Status

GIS Cloud is connected to the Vortex One account and this document defines the integration contract. This change documents the architecture and field mapping; it does not store GIS Cloud credentials in the repository.

## Architecture

```
Public / County GIS Data
        |
        v
Vortex Ingestion
        |
        v
Supabase / Postgres
(System of Record)
        |
        +---- Properties
        +---- Owners
        +---- Leads
        +---- Campaigns
        |
        v
GIS Sync Service
        |
        <----> GIS Cloud
                 |
                 +---- Parcel layer
                 +---- Property layer
                 +---- Owner layer
                 +---- Lead layer
                 +---- Sales layer
                 +---- Tax layer
                 +---- Zoning layer
                 +---- Campaign / territory layer
        |
        v
Vortex One Map UI
        |
        +---- Property Intelligence
        +---- Lead Research
        +---- Geographic Filtering
        +---- Campaign Territory
        +---- CRM / Dialer
```

## System responsibilities

- Supabase/Postgres: authoritative source for Vortex One property, owner, lead, campaign, and application data.
- GIS Cloud: spatial visualization, geographic layers, parcel geometry, and spatial operations.
- Vortex One: business logic, permissions, workflows, lead scoring, CRM, outreach, and user interface.
- GISProvider abstraction: keeps GIS Cloud replaceable without redesigning the Vortex One database.

## GIS layers

| Layer | Primary purpose |
|---|---|
| Parcels | APN and parcel geometry |
| Properties | Property attributes |
| Owners | Owner attributes and ownership relationships |
| Leads | Lead score, status, and qualification |
| Sales | Historical transactions |
| Tax | Tax-related signals |
| Zoning | Zoning / land-use context |
| Campaigns | Outreach territories |
| Users/Agents | Territory and assignment visualization |

## Field mapping

| Vortex / Supabase field | GIS Cloud field | Direction | Notes |
|---|---|---|---|
| property_id | vortex_property_id | Vortex -> GIS | Stable cross-system UUID |
| apn | apn | Vortex -> GIS | Parcel identifier |
| address | site_address | Vortex -> GIS | Display/search |
| city | city | Vortex -> GIS | Geographic filtering |
| state | state | Vortex -> GIS | Geographic filtering |
| zip_code | zip_code | Vortex -> GIS | Geographic filtering |
| county | county | Vortex -> GIS | County filtering |
| latitude | latitude | Vortex -> GIS | Point location |
| longitude | longitude | Vortex -> GIS | Point location |
| parcel_geometry | geometry | Vortex <-> GIS | Prefer authoritative parcel polygon when available |
| property_type | property_type | Vortex -> GIS | Property filtering |
| year_built | year_built | Vortex -> GIS | Property intelligence |
| owner_id | vortex_owner_id | Vortex -> GIS | Owner relationship |
| owner_name | owner_name | Vortex -> GIS | Map popup |
| owner_occupied | owner_occupied | Vortex -> GIS | Lead filtering |
| estimated_value | estimated_value | Vortex -> GIS | Map intelligence |
| equity | equity | Vortex -> GIS | Lead qualification |
| lead_status | lead_status | Vortex -> GIS | Map/status filtering |
| lead_score | lead_score | Vortex -> GIS | Prioritization |
| campaign_id | vortex_campaign_id | Vortex -> GIS | Outreach relationship |
| updated_at | vortex_updated_at | Vortex -> GIS | Synchronization |

## Identity model

Do not use APN as the sole identity key.

```
Vortex property_id (UUID)
    |
    +-- APN
    +-- GIS Cloud feature ID
    +-- Supabase property record
```

The integration should maintain a durable mapping table similar to:

```
gis_sync
-------------------------
vortex_property_id
gis_layer_id
gis_feature_id
last_pushed_at
last_pulled_at
sync_status
sync_hash
error_message
```

## Synchronization behavior

### Vortex -> GIS Cloud

1. Read canonical property/owner/lead records from Supabase.
2. Transform only fields that belong in GIS Cloud.
3. Upsert the corresponding GIS feature.
4. Preserve the GIS feature ID.
5. Record synchronization metadata and errors.

### GIS Cloud -> Vortex

Only spatial or GIS-originated changes that Vortex explicitly supports should flow back.

Examples:
- parcel geometry correction
- GIS feature creation that has been approved for ingestion
- spatial query results
- selected parcel / feature references

GIS Cloud should not silently overwrite authoritative CRM or owner-intelligence fields.

## Spatial operations

Vortex One should support:
- point lookup
- parcel selection
- polygon/area selection
- properties within radius
- properties within a boundary
- geographic filtering
- proximity analysis
- map-based lead selection
- campaign territory selection

## Map-driven lead workflow

```
Draw area
   |
   v
GIS spatial query
   |
   v
Matching parcels
   |
   v
Vortex property + owner intelligence
   |
   v
Lead scoring
   |
   v
Select leads
   |
   v
Create campaign
   |
   v
CRM / Dialer
```

## Provenance

Geographic records should retain:
- source
- source_dataset
- source_record_id
- source_date
- import_batch_id
- geometry_source
- last_verified_at

## Security

GIS Cloud credentials must remain in backend secret/environment configuration. Do not place credentials, API tokens, or private connection secrets in property records, frontend code, or ordinary database tables.

```
Secret / environment configuration
        |
        v
Vortex backend
        |
        v
GIS Cloud API
```

## Error handling

The sync service should distinguish:
- success
- retryable failure
- permanent validation failure
- unauthorized/authentication failure
- rate/usage limit
- quarantined record

Every failure should be logged with the Vortex property ID or GIS feature ID where available.

## Provider abstraction

Use an application-level GIS provider interface so GIS Cloud remains replaceable:

```
GISProvider
   |
   +-- GIS Cloud adapter
   +-- PostGIS adapter
   +-- Future GIS provider
```

This avoids coupling the entire application database and domain model to one GIS vendor.

## Example feature

Vortex:

```
property_id: 8b7c...-property-001
apn: 123-456-78
address: 123 Main Street
owner_name: John Smith
property_type: Single Family
estimated_value: 725000
equity: 412000
lead_score: 87
lead_status: New
latitude: <lat>
longitude: <lon>
geometry: POLYGON(...)
```

GIS Cloud:

```
vortex_property_id: 8b7c...-property-001
apn: 123-456-78
site_address: 123 Main Street
owner_name: John Smith
property_type: Single Family
estimated_value: 725000
equity: 412000
lead_score: 87
lead_status: New
latitude: <lat>
longitude: <lon>
geometry: POLYGON(...)
```

## Implementation boundary

This specification is intentionally separate from credentials and production secrets. The next implementation phase should add the GIS Cloud adapter, synchronization service, database mapping table, tests, and environment variable placeholders without hard-coding credentials.