"""Source definitions. Add a county = add one entry."""
SOURCES = {
    "la_parcels": {
        "kind": "arcgis",
        "url": "https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0",
        "key_field": "AIN",          # verify with `inspect`
        "roll_year_field": None,
        "page_size": 1000,           # clamped to layer maxRecordCount
    },
    "sf_roll": {
        "kind": "socrata",
        "url": "https://data.sfgov.org/resource/wv5m-vpq2.json",
        "key_field": "parcel_number",
        "roll_year_field": "closed_roll_year",
        "geom_field": "the_geom",
        "page_size": 50000,
        # Pull only recent rolls by default (full history is ~3M rows)
        "where": "closed_roll_year >= '2022'",
    },
}

# Statewide hazard layers (polygons). Loaded into raw.hazard_zones.
CALFIRE = "https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services"
HAZARD_SOURCES = {
    "fhsz_sra": {
        "kind": "arcgis",
        "url": f"{CALFIRE}/FHSZSRA_23_3/FeatureServer/0",   # SRA, effective 2024-04-01
        "class_field": "FHSZ", "label_field": "FHSZ_Description",
        "where": "FHSZ > 0", "page_size": 250,
    },
    "fhsz_lra": {
        "kind": "arcgis",
        "url": f"{CALFIRE}/FHSALRA25_v1_All/FeatureServer/0",  # LRA, recommended 2025-03-24
        "class_field": "FHSZ", "label_field": "FHSZ_Description",
        "where": "FHSZ > 0", "page_size": 250,                  # drops NonWildland (-3)
    },
}