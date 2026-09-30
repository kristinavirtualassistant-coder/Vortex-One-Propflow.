import crypto from "node:crypto";

export type GisCloudProperty = {
  id: string;
  apn: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  property_type: string;
  year_built: number | null;
  owner_id: string | null;
  owner_name: string | null;
  owner_occupied: boolean | null;
  estimated_value: string | number | null;
  estimated_equity: string | number | null;
  lead_score: number | null;
  lead_status: string | null;
  campaign_id: string | null;
  updated_at: string | null;
  geometry_wkt: string | null;
};

const apiBase = () => process.env.GIS_CLOUD_API_BASE_URL || "https://api.giscloud.com/1";
const apiKey = () => process.env.GIS_CLOUD_API_KEY || "";

export const gisCloudConfig = () => ({
  mapId: Number(process.env.GIS_CLOUD_MAP_ID || 3302957),
  layerId: Number(process.env.GIS_CLOUD_LAYER_ID || 7986496),
  configured: Boolean(apiKey()),
});

const request = async (path: string, init: RequestInit = {}) => {
  const key = apiKey();
  if (!key) throw new Error("GIS_CLOUD_API_KEY is not configured");
  const response = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "API-Key": key,
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) throw new Error(`GIS Cloud API ${response.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  return body as any;
};

export const propertyToFeature = (property: GisCloudProperty) => ({
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

export const syncPropertyFeature = async (property: GisCloudProperty, featureId?: string | null) => {
  const payload = propertyToFeature(property);
  const hash = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  if (featureId) {
    await request(`/layers/${encodeURIComponent(String(gisCloudConfig().layerId))}/features/${encodeURIComponent(featureId)}.json`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return { featureId: String(featureId), hash, operation: "updated" as const };
  }
  const created = await request(`/layers/${encodeURIComponent(String(gisCloudConfig().layerId))}/features.json`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const id = created?.__id ?? created?.id ?? created?.feature_id;
  if (id == null) throw new Error("GIS Cloud created the feature but did not return a feature ID");
  return { featureId: String(id), hash, operation: "created" as const };
};

export const syncPropertyFeatureViaEdge = async (propertyId: string, cookieHeader: string | undefined) => {
  const supabaseUrl = process.env.SUPABASE_URL || "https://qnmcobypbhnkuvqctspy.supabase.co";
  const response = await fetch(`${supabaseUrl}/functions/v1/gis-cloud-sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    body: JSON.stringify({ property_id: propertyId }),
  });

  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }

  if (!response.ok) {
    throw new Error(
      `Supabase GIS Cloud Edge Function ${response.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`,
    );
  }

  return body as {
    operation: "created" | "updated" | "unchanged";
    featureId: string;
    mapId: number;
    layerId: number;
    hash: string;
  };
};
