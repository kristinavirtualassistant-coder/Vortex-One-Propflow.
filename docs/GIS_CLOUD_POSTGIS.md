# GIS Cloud + PostGIS integration

Vortex One PropFlow now stores property coordinates in `public.properties.location` using PostGIS WGS84 geography points.

## Spatial RPCs
- `public.nearby_properties`: radius search ordered by distance.
- `public.properties_in_view`: map viewport/bounding-box search.
- `public.set_property_location`: set a property point from latitude/longitude.

Supabase remains the application system of record; GIS Cloud can be used for geospatial mapping, import/export, visualization, and field workflows.

Longitude is X and latitude is Y; SRID 4326.
