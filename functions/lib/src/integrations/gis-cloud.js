import crypto from "node:crypto";
const apiBase = () => process.env.GIS_CLOUD_API_BASE_URL || "https://api.giscloud.com/1";
const apiKey = () => process.env.GIS_CLOUD_ACCESS_TOKEN || process.env.GIS_CLOUD_API_KEY || "";
export const gisCloudConfig = () => ({
    mapId: Number(process.env.GIS_CLOUD_MAP_ID || 3302957),
    layerId: Number(process.env.GIS_CLOUD_LAYER_ID || 7986496),
    // The GIS credential is owned by the Supabase Edge Function, not the Vortex One runtime.
    configured: true,
});
const request = async (path, init = {}) => {
    const key = apiKey();
    if (!key)
        throw new Error("GIS_CLOUD_API_KEY is not configured");
    const response = await fetch(`${apiBase()}${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            "API-Key": key,
            ...(init.headers || {}),
        },
    });
    const text = await response.text();
    let body = null;
    try {
        body = text ? JSON.parse(text) : null;
    }
    catch {
        body = text;
    }
    if (!response.ok)
        throw new Error(`GIS Cloud API ${response.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
    return body;
};
export const propertyToFeature = (property) => ({
    data: {
        vortex_property_id: property.id,
        apn: property.apn,
        site_address: property.address,
        city: property.city,
        state: property.state,
        zip_code: property.zip,
        county: property.county,
        property_type: property.property_type,
        year_built: property.year_built,
        owner_id: property.owner_id,
        owner_name: property.owner_name,
        owner_occupied: property.owner_occupied == null ? null : property.owner_occupied ? "yes" : "no",
        estimated_value: property.estimated_value == null ? null : Number(property.estimated_value),
        estimated_equity: property.estimated_equity == null ? null : Number(property.estimated_equity),
        lead_score: property.lead_score,
        lead_status: property.lead_status,
        campaign_id: property.campaign_id,
        vortex_updated_at: property.updated_at,
    },
    ...(property.geometry_wkt ? { geometry: property.geometry_wkt } : {}),
});
export const syncPropertyFeature = async (property, featureId) => {
    const payload = propertyToFeature(property);
    const hash = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    if (featureId) {
        await request(`/layers/${encodeURIComponent(String(gisCloudConfig().layerId))}/features/${encodeURIComponent(featureId)}.json`, {
            method: "PUT",
            body: JSON.stringify(payload),
        });
        return { featureId: String(featureId), hash, operation: "updated" };
    }
    const created = await request(`/layers/${encodeURIComponent(String(gisCloudConfig().layerId))}/features.json`, {
        method: "POST",
        body: JSON.stringify(payload),
    });
    const id = created?.__id ?? created?.id ?? created?.feature_id;
    if (id == null)
        throw new Error("GIS Cloud created the feature but did not return a feature ID");
    return { featureId: String(id), hash, operation: "created" };
};
export const syncPropertyFeatureViaEdge = async (propertyId, cookieHeader) => {
    const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
    if (!supabaseUrl)
        throw new Error("SUPABASE_URL is not configured");
    const response = await fetch(`${supabaseUrl}/functions/v1/gis-cloud-sync`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
        body: JSON.stringify({ property_id: propertyId }),
    });
    const text = await response.text();
    let body = null;
    try {
        body = text ? JSON.parse(text) : null;
    }
    catch {
        body = text;
    }
    if (!response.ok) {
        throw new Error(`Supabase GIS Cloud Edge Function ${response.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
    }
    return body;
};
