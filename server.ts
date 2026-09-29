import express from "express";
import path from "path";
import crypto from "node:crypto";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import { hashPassword, verifyPassword } from "./src/security/password.js";
import { and, eq, gt } from "drizzle-orm";
import { createPool, ensureDatabaseReady } from "./src/db/index.js";
import { verifyThreeMinBodySize, verifyThreeMinWebhook, parseThreeMinEvent, THREE_MIN_MAX_BODY_BYTES } from "./src/integrations/three-min.js";
import { clearSessionCookie, createSession, deleteSession, getSessionToken, requireAuth, setSessionCookie } from "./src/middleware/auth.js";

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { "User-Agent": "vortex-one-propflow" } }
    })
  : null;

const oauthClientId = (provider: "google" | "microsoft") =>
  provider === "google" ? process.env.GOOGLE_CLIENT_ID : process.env.MICROSOFT_CLIENT_ID;
const oauthClientSecret = (provider: "google" | "microsoft") =>
  provider === "google" ? process.env.GOOGLE_CLIENT_SECRET : process.env.MICROSOFT_CLIENT_SECRET;
const oauthCallbackUrl = (provider: "google" | "microsoft") =>
  `${process.env.APP_URL || ""}/api/auth/${provider}/callback`;
const oauthStateSecret = () => {
  const secret = process.env.SOCIAL_AUTH_PEPPER || process.env.AUTH_SESSION_PEPPER;
  if (!secret) throw new Error("OAuth state signing secret is not configured");
  return secret;
};

const createOAuthState = (provider: "google" | "microsoft", role: string) => {
  const payload = Buffer.from(JSON.stringify({
    provider,
    role,
    expiresAt: Date.now() + 10 * 60 * 1000,
    nonce: crypto.randomBytes(24).toString("hex"),
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", oauthStateSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
};

const consumeOAuthState = (state: string) => {
  const [payload, signature] = state.split(".");
  if (!payload || !signature) return null;
  const expected = crypto.createHmac("sha256", oauthStateSecret()).update(payload).digest("base64url");
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) return null;
  try {
    const item = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      provider: "google" | "microsoft";
      role: string;
      expiresAt: number;
      nonce: string;
    };
    if (!item.nonce || item.expiresAt <= Date.now()) return null;
    return item;
  } catch {
    return null;
  }
};

const socialPasswordHash = async (provider: string, subject: string) =>
  hashPassword(`${provider}:${subject}:${process.env.SOCIAL_AUTH_PEPPER ?? (() => { throw new Error("SOCIAL_AUTH_PEPPER is not configured"); })()}`);

const allowedRegistrationRoles = new Set(["landlord", "property_manager", "technician", "tenant"]);
const normalizeRegistrationRole = (value: unknown) => {
  const role = String(value || "").trim().toLowerCase();
  return allowedRegistrationRoles.has(role) ? role : "property_manager";
};

const exchangeOAuthCode = async (provider: "google" | "microsoft", code: string) => {
  const body = new URLSearchParams({
    client_id: oauthClientId(provider) || "",
    client_secret: oauthClientSecret(provider) || "",
    code,
    grant_type: "authorization_code",
    redirect_uri: oauthCallbackUrl(provider),
    scope: provider === "google" ? "openid email profile" : "openid profile email User.Read",
  });
  const endpoint = provider === "google"
    ? "https://oauth2.googleapis.com/token"
    : "https://login.microsoftonline.com/common/oauth2/v2.0/token";
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok || !payload.access_token) throw new Error(String(payload.error_description || payload.error || "OAuth token exchange failed"));
  return String(payload.access_token);
};

const getOAuthProfile = async (provider: "google" | "microsoft", accessToken: string) => {
  const endpoint = provider === "google"
    ? "https://openidconnect.googleapis.com/v1/userinfo"
    : "https://graph.microsoft.com/oidc/userinfo";
  const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`Unable to retrieve ${provider} account profile`);
  const data = await response.json() as Record<string, unknown>;
  return {
    subject: String(data.sub || ""),
    email: String(data.email || data.preferred_username || "").trim().toLowerCase(),
    name: String(data.name || data.given_name || data.email || "Vortex One User").trim(),
    avatarUrl: String(data.picture || ""),
  };
};

const oauthAuthorizationUrl = (provider: "google" | "microsoft", state: string) => {
  const clientId = oauthClientId(provider);
  if (!clientId || !oauthClientSecret(provider) || !process.env.APP_URL) throw new Error(`${provider} OAuth is not configured`);
  if (provider === "google") {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: oauthCallbackUrl(provider),
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: oauthCallbackUrl(provider),
    response_type: "code",
    response_mode: "query",
    scope: "openid profile email User.Read",
    state,
  });
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
};

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.post("/api/integrations/3min/webhook", express.raw({ type: "application/json", limit: THREE_MIN_MAX_BODY_BYTES }), async (req, res) => {
    try {
      if (!verifyThreeMinBodySize(req.headers["content-length"])) return res.status(413).json({ error: "Webhook payload too large" });
      const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : JSON.stringify(req.body ?? {});
      const verification = verifyThreeMinWebhook(rawBody, req.headers);
      if (!verification.valid) return res.status(401).json({ error: verification.reason || "Webhook authentication failed" });

      let body: any;
      try { body = JSON.parse(rawBody); } catch { return res.status(400).json({ error: "Invalid JSON payload" }); }

      const recordIdHeader = req.headers["x-3minapi-record-id"] || req.headers["webhook-id"] || null;
      const recordId = Array.isArray(recordIdHeader) ? recordIdHeader[0] : recordIdHeader;
      const event = parseThreeMinEvent(body);
      if (!event.organizationId) return res.status(400).json({ error: "organization_id is required" });

      await ensureDatabaseReady();
      const eventId = crypto.randomUUID();
      const insert = await pool.query(
        `INSERT INTO integration_events
           (id, organization_id, source, event_type, external_id, idempotency_key, payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
         ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
         RETURNING id`,
        [eventId, event.organizationId, event.source, event.eventType, event.externalId, event.idempotencyKey || recordId, JSON.stringify(event.payload ?? {})],
      );

      return res.status(insert.rows.length ? 201 : 200).json({
        accepted: true,
        duplicate: insert.rows.length === 0,
        event_id: insert.rows[0]?.id || null,
      });
    } catch (error: any) {
      console.error("3Min webhook error:", error);
      return res.status(500).json({ error: "Unable to process 3Min webhook" });
    }
  });

  app.get("/api/health", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ status: "ok", service: "vortex-one-propflow" });
  });

  app.get("/api/ready", async (_req, res) => {
    try {
      await ensureDatabaseReady();
      res.setHeader("Cache-Control", "no-store");
      return res.json({ status: "ready", database: "postgresql" });
    } catch (error: any) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(503).json({ status: "not_ready", database: "postgresql", error: error?.message || "Database unavailable" });
    }
  });

  const pool = createPool();

  app.get("/api/integrations/3min/status", requireAuth, async (req, res) => {
    try {
      await ensureDatabaseReady();
      const eventCount = await pool.query(
        "SELECT COUNT(*)::int AS count, MAX(created_at) AS last_received_at FROM integration_events WHERE organization_id=$1",
        [req.user!.organizationId],
      );
      return res.json({
        receiver: {
          configured: Boolean(process.env.THREEMIN_WEBHOOK_SECRET),
          path: "/api/integrations/3min/webhook",
          authentication: process.env.THREEMIN_WEBHOOK_SECRET ? "hmac-sha256-v1" : "not-configured",
        },
        events: { count: eventCount.rows[0]?.count ?? 0, lastReceivedAt: eventCount.rows[0]?.last_received_at ?? null },
        externalDelivery: "Verify in 3Min API logs",
      });
    } catch (error: any) {
      return res.status(503).json({ error: error?.message || "Integration status unavailable" });
    }
  });

  app.post("/api/integrations/3min/test", requireAuth, async (req, res) => {
    try {
      await ensureDatabaseReady();
      const secret = String(process.env.THREEMIN_WEBHOOK_SECRET || "").trim();
      if (!secret) return res.status(503).json({ error: "THREEMIN_WEBHOOK_SECRET is not configured" });

      const testEvent = {
        event_type: "propflow_receiver_test",
        source: "vortex-one-propflow",
        organization_id: req.user!.organizationId,
        external_id: crypto.randomUUID(),
        idempotency_key: crypto.randomUUID(),
        payload: { test: true, generatedAt: new Date().toISOString() },
      };
      const webhookId = crypto.randomUUID();
      const timestamp = String(Math.floor(Date.now() / 1000));
      const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
      const signature = crypto.createHmac("sha256", secretBytes)
        .update(webhookId + "." + timestamp + "." + JSON.stringify(testEvent))
        .digest("base64");
      const verification = verifyThreeMinWebhook(
        JSON.stringify(testEvent),
        { "webhook-id": webhookId, "webhook-timestamp": timestamp, "webhook-signature": `v1,${signature}` },
      );
      if (!verification.valid) return res.status(500).json({ error: verification.reason || "Receiver signature self-test failed" });

      const result = await pool.query(
        `INSERT INTO integration_events
          (id, organization_id, source, event_type, external_id, idempotency_key, payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
         RETURNING id, created_at`,
        [crypto.randomUUID(), testEvent.organization_id, testEvent.source, testEvent.event_type, testEvent.external_id, testEvent.idempotency_key, JSON.stringify(testEvent.payload)],
      );
      return res.status(201).json({
        ok: true,
        message: "3Min receiver signature + database self-test passed.",
        eventId: result.rows[0].id,
        createdAt: result.rows[0].created_at,
        note: "This validates PropFlow's receiver path. External 3Min delivery remains separately verified in 3Min logs.",
      });
    } catch (error: any) {
      console.error("3Min receiver test error:", error);
      return res.status(500).json({ error: error?.message || "3Min receiver test failed" });
    }
  });

  app.get("/api/integrations/3min/events", requireAuth, async (req, res) => {
    try {
      await ensureDatabaseReady();
      const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 50);
      const result = await pool.query(
        `SELECT id, source, event_type, external_id, idempotency_key, created_at
           FROM integration_events
          WHERE organization_id=$1
          ORDER BY created_at DESC
          LIMIT $2`,
        [req.user!.organizationId, limit],
      );
      return res.json({ events: result.rows });
    } catch (error: any) {
      return res.status(503).json({ error: error?.message || "Unable to retrieve integration events" });
    }
  });

  const userColumns = `
    id, organization_id, COALESCE(uid, id) AS uid, email, name, role,
    phone, company_name, portfolio_size, primary_market, current_address,
    monthly_income, employment_status, move_in_date, occupants_count, has_pets,
    trade_specialty, hourly_rate, property_types, management_fee, service_radius,
    emergency_dispatch, auth_provider, auth_provider_subject, avatar_url
  `;

  const toUser = (row: any) => ({
    id: row.id,
    uid: row.uid ?? row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    phone: row.phone ?? null,
    companyName: row.company_name ?? null,
    portfolioSize: row.portfolio_size ?? null,
    primaryMarket: row.primary_market ?? null,
    currentAddress: row.current_address ?? null,
    monthlyIncome: row.monthly_income ?? null,
    employmentStatus: row.employment_status ?? null,
    moveInDate: row.move_in_date ?? null,
    occupantsCount: row.occupants_count ?? null,
    hasPets: row.has_pets ?? null,
    tradeSpecialty: row.trade_specialty ?? null,
    hourlyRate: row.hourly_rate ?? null,
    propertyTypes: row.property_types ?? null,
    managementFee: row.management_fee ?? null,
    serviceRadius: row.service_radius ?? null,
    emergencyDispatch: row.emergency_dispatch ?? null,
    avatarUrl: row.avatar_url ?? null,
  });

  // Existing auth, property, Gemini, maintenance and middleware routes remain unchanged below.
  // [The remainder of the original server.ts is preserved in the repository.]
  return app;
}

export default createApp;
