# Vortex One Property Intelligence

This module makes PostgreSQL/PostGIS the source of truth for property intelligence.

## Current vertical slice
- canonical property and owner records
- APN/FIPS identity
- geographic point storage
- property-owner relationships
- source provenance and confidence
- motivated-seller signal fields
- saved searches
- user-scoped property leads

## Connector architecture

Public-record and licensed-source connectors should follow:

discover() -> download() -> parse() -> normalize() -> validate() -> load()

Do not hard-code a single vendor. County/state records, licensed MLS feeds, skip-trace providers and other enrichment sources enter through adapters.

## Search evolution

Phase 1 uses PostgreSQL filters. Phase 2 can add OpenSearch as a read projection for high-cardinality filters, full text, faceting and geospatial search while PostgreSQL remains the system of record.

## Import contract

Normalized imports should supply state/county and preferably APN/FIPS. Preserve the source payload in raw_data and record provenance in property_sources.
