import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, cookie",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const hashSessionToken = async (token: string) => {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
};

const getCookie = (cookieHeader: string, name: string) => {
  for (const part of cookieHeader.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
};

const sessionCookieNames = ["__Host-vortex_session", "vortex_session"];

const getSession = async (supabaseAdmin: ReturnType<typeof createClient>, req: Request) => {
  const cookieHeader = req.headers.get("cookie") || "";
  const token = sessionCookieNames
    .map((name) => getCookie(cookieHeader, name))
    .find(Boolean);

  if (!token) return null;

  const tokenHash = await hashSessionToken(token);
  const { data: session, error } = await supabaseAdmin
    .from("auth_sessions")
    .select("user_id, expires_at")
    .eq("token_hash", tokenHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !session) return null;

  const { data: user, error: userError } = await supabaseAdmin
    .from("users")
    .select("id, organization_id, email, name, role, disabled_at")
    .eq("id", session.user_id)
    .is("disabled_at", null)
    .maybeSingle();

  if (userError || !user) return null;
  return user;
};

const pointToWkt = (location: unknown) => {
  if (!location) return null;

  try {
    const parsed = typeof location === "string" ? JSON.parse(location) : location;
    if (
      parsed &&
      parsed.type === "Point" &&
      Array.isArray(parsed.coordinates) &&
      parsed.coordinates.length >= 2
    ) {
      const [longitude, latitude] = parsed.coordinates;
      return `POINT(${Number(longitude)} ${Number(latitude)})`;
    }
  } catch {
    // Some PostgREST/PostGIS representations are not JSON; omit geometry rather than failing sync.
  }

  return null;
};

const gisRequest = async (path: string, init: RequestInit = {}) => {
  const apiKey = Deno.env.get("GIS_CLOUD_API_KEY");
  if (!apiKey) throw new Error("GIS_CLOUD_API_KEY is not configured in Supabase Edge Function Secrets");

  const apiBase = Deno.env.get("GIS_CLOUD_API_BASE_URL") || "https://api.giscloud.com/1";
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "API-Key": apiKey,
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    throw new Error(
      `GIS Cloud API ${response.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`,
    );
  }

  return body as Record<string, unknown>;
};

const buildFeature = (property: Record<string, any>, owner: Record<string, any> | null, lead: Record<string, any> | null) => {
  const geometry = pointToWkt(property.location);

  return {
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
      owner_name: owner?.name ?? null,
      owner_occupied: property.is_absentee_owner == null
        ? null
        : property.is_absentee_owner ? "no" : "yes",
      estimated_value: property.estimated_value == null ? null : Number(property.estimated_value),
      estimated_equity: property.estimated_equity == null ? null : Number(property.estimated_equity),
      lead_score: lead?.lead_score ?? 0,
      lead_status: lead?.stage ?? "identified",
      campaign_id: null,
      vortex_updated_at: property.updated_at ?? property.created_at ?? null,
    },
    ...(geometry ? { geometry } : {}),
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    const secretKey = secretKeys.default;
    if (!secretKey) return json({ error: "Supabase server secret key is unavailable" }, 503);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      secretKey,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const user = await getSession(supabaseAdmin, req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const propertyId = String(body.property_id || body.propertyId || "").trim();
    if (!propertyId) return json({ error: "property_id is required" }, 400);

    const mapId = Number(Deno.env.get("GIS_CLOUD_MAP_ID") || "3302957");
    const layerId = Number(Deno.env.get("GIS_CLOUD_LAYER_ID") || "7986496");

    const { data: property, error: propertyError } = await supabaseAdmin
      .from("properties")
      .select("id, organization_id, apn, address, city, state, zip, county, property_type, year_built, owner_id, is_absentee_owner, estimated_value, estimated_equity, location, updated_at, created_at")
      .eq("id", propertyId)
      .eq("organization_id", user.organization_id)
      .maybeSingle();

    if (propertyError) throw propertyError;
    if (!property) return json({ error: "Property not found" }, 404);

    let owner: Record<string, any> | null = null;
    if (property.owner_id) {
      const { data } = await supabaseAdmin
        .from("property_owners")
        .select("id, name")
        .eq("id", property.owner_id)
        .eq("organization_id", user.organization_id)
        .maybeSingle();
      owner = data;
    }

    const { data: leads } = await supabaseAdmin
      .from("leads")
      .select("lead_score, stage, updated_at")
      .eq("organization_id", user.organization_id)
      .eq("primary_property_id", propertyId)
      .order("updated_at", { ascending: false })
      .limit(1);

    const lead = leads?.[0] ?? null;
    const payload = buildFeature(property, owner, lead);
    const syncHashBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify(payload)),
    );
    const syncHash = Array.from(new Uint8Array(syncHashBuffer))
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");

    const { data: existing } = await supabaseAdmin
      .from("gis_cloud_sync")
      .select("id, gis_feature_id, sync_hash")
      .eq("organization_id", user.organization_id)
      .eq("vortex_property_id", propertyId)
      .eq("gis_layer_id", layerId)
      .maybeSingle();

    if (existing?.sync_hash === syncHash && existing.gis_feature_id) {
      return json({
        operation: "unchanged",
        featureId: existing.gis_feature_id,
        mapId,
        layerId,
        hash: syncHash,
      });
    }

    let featureId: string;
    let operation: "created" | "updated";

    if (existing?.gis_feature_id) {
      await gisRequest(
        `/layers/${encodeURIComponent(String(layerId))}/features/${encodeURIComponent(String(existing.gis_feature_id))}.json`,
        { method: "PUT", body: JSON.stringify(payload) },
      );
      featureId = String(existing.gis_feature_id);
      operation = "updated";
    } else {
      const created = await gisRequest(
        `/layers/${encodeURIComponent(String(layerId))}/features.json`,
        { method: "POST", body: JSON.stringify(payload) },
      );
      const returnedId = created.__id ?? created.id ?? created.feature_id;
      if (returnedId == null) throw new Error("GIS Cloud did not return a feature ID");
      featureId = String(returnedId);
      operation = "created";
    }

    const { error: syncError } = await supabaseAdmin
      .from("gis_cloud_sync")
      .upsert({
        id: existing?.id ?? crypto.randomUUID(),
        organization_id: user.organization_id,
        vortex_property_id: propertyId,
        gis_map_id: mapId,
        gis_layer_id: layerId,
        gis_feature_id: featureId,
        sync_hash: syncHash,
        sync_status: "synced",
        last_pushed_at: new Date().toISOString(),
        error_message: null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "organization_id,vortex_property_id,gis_layer_id",
      });

    if (syncError) throw syncError;

    return json({ operation, featureId, mapId, layerId, hash: syncHash });
  } catch (error) {
    console.error("GIS Cloud sync error:", error);
    return json({
      error: error instanceof Error ? error.message : "GIS Cloud synchronization failed",
    }, 502);
  }
});
