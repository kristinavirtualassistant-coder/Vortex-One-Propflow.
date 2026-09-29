import express from "express";
import path from "path";
import crypto from "node:crypto";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import { hashPassword, verifyPassword } from "./src/security/password.js";
import { and, eq, gt } from "drizzle-orm";
import { db, createPool, ensureDatabaseReady } from "./src/db/index.js";
import { financialMetrics } from "./src/db/schema.js";
import { clearSessionCookie, createSession, deleteSession, getSessionToken, requireAuth, setSessionCookie } from "./src/middleware/auth.js";
import { localDb } from "./src/db/localDb.js";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'vortex-one-propflow',
    }
  }
});

const oauthClientId = (provider: 'google' | 'microsoft') =>
  provider === 'google' ? process.env.GOOGLE_CLIENT_ID : process.env.MICROSOFT_CLIENT_ID;
const oauthClientSecret = (provider: 'google' | 'microsoft') =>
  provider === 'google' ? process.env.GOOGLE_CLIENT_SECRET : process.env.MICROSOFT_CLIENT_SECRET;
const oauthCallbackUrl = (provider: 'google' | 'microsoft') =>
  `${process.env.APP_URL || ''}/api/auth/${provider}/callback`;

const oauthStateSecret = () =>
  process.env.SOCIAL_AUTH_PEPPER || process.env.AUTH_SESSION_PEPPER || 'vortex-one-oauth-state-fallback';

const createOAuthState = (provider: 'google' | 'microsoft', role: string) => {
  const payload = Buffer.from(JSON.stringify({
    provider,
    role,
    expiresAt: Date.now() + 10 * 60 * 1000,
    nonce: crypto.randomBytes(24).toString('hex'),
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', oauthStateSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
};

const consumeOAuthState = (state: string) => {
  const [payload, signature] = state.split('.');
  if (!payload || !signature) return null;

  const expected = crypto.createHmac('sha256', oauthStateSecret()).update(payload).digest('base64url');
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
  ) return null;

  try {
    const item = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      provider: 'google' | 'microsoft';
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
  hashPassword(`${provider}:${subject}:${process.env.SOCIAL_AUTH_PEPPER || 'vortex-one-social-auth'}`);

const exchangeOAuthCode = async (provider: 'google' | 'microsoft', code: string) => {
  const body = new URLSearchParams({
    client_id: oauthClientId(provider) || '',
    client_secret: oauthClientSecret(provider) || '',
    code,
    grant_type: 'authorization_code',
    redirect_uri: oauthCallbackUrl(provider),
    scope: provider === 'google' ? 'openid email profile' : 'openid profile email User.Read',
  });
  const endpoint = provider === 'google'
    ? 'https://oauth2.googleapis.com/token'
    : 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok || !payload.access_token) {
    throw new Error(String(payload.error_description || payload.error || 'OAuth token exchange failed'));
  }
  return String(payload.access_token);
};

const getOAuthProfile = async (provider: 'google' | 'microsoft', accessToken: string) => {
  const endpoint = provider === 'google'
    ? 'https://openidconnect.googleapis.com/v1/userinfo'
    : 'https://graph.microsoft.com/oidc/userinfo';
  const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`Unable to retrieve ${provider} account profile`);
  const data = await response.json() as Record<string, unknown>;
  return {
    subject: String(data.sub || ''),
    email: String(data.email || data.preferred_username || '').trim().toLowerCase(),
    name: String(data.name || data.given_name || data.email || 'Vortex One User').trim(),
    avatarUrl: String(data.picture || ''),
  };
};

const oauthAuthorizationUrl = (provider: 'google' | 'microsoft', state: string) => {
  const clientId = oauthClientId(provider);
  if (!clientId || !oauthClientSecret(provider) || !process.env.APP_URL) {
    throw new Error(`${provider} OAuth is not configured`);
  }
  if (provider === 'google') {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: oauthCallbackUrl(provider),
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: oauthCallbackUrl(provider),
    response_type: 'code',
    response_mode: 'query',
    scope: 'openid profile email User.Read',
    state,
  });
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
};


export function createApp() {
  const app = express();
  const PORT = 3000;

  app.disable('x-powered-by');
  app.use(express.json());

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

  const profileFields: Record<string, string> = {
    phone: 'phone',
    companyName: 'company_name',
    portfolioSize: 'portfolio_size',
    primaryMarket: 'primary_market',
    currentAddress: 'current_address',
    monthlyIncome: 'monthly_income',
    employmentStatus: 'employment_status',
    moveInDate: 'move_in_date',
    occupantsCount: 'occupants_count',
    hasPets: 'has_pets',
    tradeSpecialty: 'trade_specialty',
    hourlyRate: 'hourly_rate',
    propertyTypes: 'property_types',
    managementFee: 'management_fee',
    serviceRadius: 'service_radius',
    emergencyDispatch: 'emergency_dispatch',
  };

  app.get("/api/auth/google/start", (req, res) => {
    try {
      const state = createOAuthState('google', String(req.query.role || 'property_manager'));
      return res.redirect(oauthAuthorizationUrl('google', state));
    } catch (error: any) {
      const missing = [
        !process.env.APP_URL ? 'APP_URL' : null,
        !process.env.GOOGLE_CLIENT_ID ? 'GOOGLE_CLIENT_ID' : null,
        !process.env.GOOGLE_CLIENT_SECRET ? 'GOOGLE_CLIENT_SECRET' : null,
      ].filter(Boolean);
      console.error('Google OAuth configuration check failed', { missing });
      return res.status(503).send(error.message || 'Google OAuth is not configured');
    }
  });

  app.get("/api/auth/microsoft/start", (req, res) => {
    try {
      const state = createOAuthState('microsoft', String(req.query.role || 'property_manager'));
      return res.redirect(oauthAuthorizationUrl('microsoft', state));
    } catch (error: any) {
      const missing = [
        !process.env.APP_URL ? 'APP_URL' : null,
        !process.env.MICROSOFT_CLIENT_ID ? 'MICROSOFT_CLIENT_ID' : null,
        !process.env.MICROSOFT_CLIENT_SECRET ? 'MICROSOFT_CLIENT_SECRET' : null,
      ].filter(Boolean);
      console.error('Microsoft OAuth configuration check failed', { missing });
      return res.status(503).send(error.message || 'Microsoft OAuth is not configured');
    }
  });

  const completeOAuth = async (provider: 'google' | 'microsoft', req: express.Request, res: express.Response) => {
    try {
      await ensureDatabaseReady();
      const code = String(req.query.code || '');
      const state = String(req.query.state || '');
      if (!code || !state) return res.status(400).send('Missing OAuth authorization response.');
      const stateData = consumeOAuthState(state);
      if (!stateData || stateData.provider !== provider) return res.status(400).send('Invalid or expired OAuth state.');

      const accessToken = await exchangeOAuthCode(provider, code);
      const profile = await getOAuthProfile(provider, accessToken);
      if (!profile.subject || !profile.email) return res.status(400).send('Provider did not return a usable email identity.');

      const existingBySubject = await pool.query(
        `SELECT ${userColumns} FROM users WHERE auth_provider_subject=$1 LIMIT 1`,
        [profile.subject]
      );
      const existingByEmail = await pool.query(
        `SELECT ${userColumns} FROM users WHERE lower(email)=lower($1) LIMIT 1`,
        [profile.email]
      );
      let account = existingBySubject.rows[0] || existingByEmail.rows[0];

      if (account && account.auth_provider !== 'password' && account.auth_provider !== provider) {
        return res.status(409).send('This email is already linked to a different sign-in provider.');
      }

      if (!account) {
        const organizationId = crypto.randomUUID();
        const userId = crypto.randomUUID();
        await pool.query('BEGIN');
        try {
          await pool.query(
            'INSERT INTO organizations (id,name,slug) VALUES ($1,$2,$3)',
            [organizationId, profile.name ? `${profile.name} Organization` : 'Vortex One Organization', `vortex-${userId.slice(0,8)}`]
          );
          const created = await pool.query(
            `INSERT INTO users
              (id,organization_id,uid,email,password_hash,name,role,auth_provider,auth_provider_subject,avatar_url)
             VALUES ($1,$2,$1,$3,$4,$5,$6,$7,$8,$9)
             RETURNING ${userColumns}`,
            [userId, organizationId, profile.email, await socialPasswordHash(provider, profile.subject), profile.name, stateData.role, provider, profile.subject, profile.avatarUrl || null]
          );
          account = created.rows[0];
          await pool.query('COMMIT');
        } catch (error) {
          await pool.query('ROLLBACK');
          throw error;
        }
      } else {
        const updated = await pool.query(
          `UPDATE users
             SET uid=COALESCE(uid,id), auth_provider=$1, auth_provider_subject=$2,
                 avatar_url=COALESCE($3,avatar_url), name=COALESCE($4,name)
           WHERE id=$5
           RETURNING ${userColumns}`,
          [provider, profile.subject, profile.avatarUrl || null, profile.name || null, account.id]
        );
        account = updated.rows[0];
      }

      const session = await createSession(String(account.id));
      setSessionCookie(res, session.id, session.expiresAt);
      return res.redirect('/dashboard');
    } catch (error: any) {
      console.error(`${provider} OAuth callback error:`, error);
      return res.status(500).send(error.message || 'Unable to complete social sign-in');
    }
  };

  app.get("/api/auth/google/callback", (req, res) => completeOAuth('google', req, res));
  app.get("/api/auth/microsoft/callback", (req, res) => completeOAuth('microsoft', req, res));

  app.post("/api/auth/signup", async (req, res) => {
    try {
      await ensureDatabaseReady();
      const body = req.body ?? {};
      const { email, password, role, name } = body;
      if (!email || !password || !name) return res.status(400).json({ error: "Name, email, and password are required" });
      if (typeof password !== 'string' || password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

      const normalizedEmail = String(email).trim().toLowerCase();
      const userId = crypto.randomUUID();
      const organizationId = crypto.randomUUID();
      const uid = userId;
      const userValues: any[] = [
        userId, organizationId, uid, normalizedEmail, await hashPassword(password),
        String(name).trim(), role || 'property_manager',
        body.phone ? String(body.phone).trim() : null,
        body.companyName ? String(body.companyName).trim() : null,
        body.portfolioSize ? String(body.portfolioSize).trim() : null,
        body.primaryMarket ? String(body.primaryMarket).trim() : null,
        body.currentAddress ? String(body.currentAddress).trim() : null,
        body.monthlyIncome ? String(body.monthlyIncome).trim() : null,
        body.employmentStatus ? String(body.employmentStatus).trim() : null,
        body.moveInDate ? String(body.moveInDate).trim() : null,
        body.occupantsCount !== undefined && body.occupantsCount !== null ? Number(body.occupantsCount) : null,
        body.hasPets ? String(body.hasPets).trim() : null,
        body.tradeSpecialty ? String(body.tradeSpecialty).trim() : null,
        body.hourlyRate ? String(body.hourlyRate).trim() : null,
        body.propertyTypes ? String(body.propertyTypes).trim() : null,
        body.managementFee ? String(body.managementFee).trim() : null,
        body.serviceRadius ? String(body.serviceRadius).trim() : null,
        body.emergencyDispatch ? String(body.emergencyDispatch).trim() : null,
      ];

      await pool.query('BEGIN');
      try {
        await pool.query(
          'INSERT INTO organizations (id,name,slug) VALUES ($1,$2,$3)',
          [organizationId, `${String(name).trim()} Organization`, `vortex-${userId.slice(0,8)}`]
        );
        const created = await pool.query(
          `INSERT INTO users
            (id,organization_id,uid,email,password_hash,name,role,phone,company_name,portfolio_size,primary_market,current_address,monthly_income,employment_status,move_in_date,occupants_count,has_pets,trade_specialty,hourly_rate,property_types,management_fee,service_radius,emergency_dispatch)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
           RETURNING ${userColumns}`,
          userValues
        );
        await pool.query('COMMIT');
        const user = toUser(created.rows[0]);
        const session = await createSession(user.id);
        setSessionCookie(res, session.id, session.expiresAt);
        return res.status(201).json({ user });
      } catch (error) {
        await pool.query('ROLLBACK');
        throw error;
      }
    } catch (error: any) {
      console.error("Signup error:", error);
      return res.status(500).json({ error: error.message || "Unable to create account" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      await ensureDatabaseReady();
      const { email, password } = req.body ?? {};
      if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

      const normalizedEmail = String(email).trim().toLowerCase();
      const result = await pool.query(
        `SELECT ${userColumns}, password_hash FROM users WHERE lower(email)=lower($1) AND disabled_at IS NULL LIMIT 1`,
        [normalizedEmail]
      );
      const user = result.rows[0];
      if (!user || !user.password_hash) return res.status(401).json({ error: "Invalid email or password" });

      const verification = await verifyPassword(String(password), user.password_hash);
      if (!verification.valid) return res.status(401).json({ error: "Invalid email or password" });

      if (verification.needsRehash) {
        await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [await hashPassword(String(password)), user.id]);
      }

      await pool.query('UPDATE users SET last_login_at=now(), uid=COALESCE(uid,id) WHERE id=$1', [user.id]);
      const session = await createSession(String(user.id));
      setSessionCookie(res, session.id, session.expiresAt);
      return res.json({ user: toUser(user) });
    } catch (error: any) {
      console.error("Login error:", error);
      return res.status(503).json({ error: error.message || "Authentication service unavailable" });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    res.json({ user: req.user });
  });

  app.patch("/api/auth/me", requireAuth, async (req, res) => {
    try {
      await ensureDatabaseReady();
      const body = req.body ?? {};
      const entries = Object.entries(profileFields).filter(([key]) => body[key] !== undefined);
      if (!entries.length) return res.json({ user: req.user });

      const setParts: string[] = [];
      const values: any[] = [];
      for (const [key, column] of entries) {
        values.push(body[key]);
        setParts.push(`${column}=$${values.length}`);
      }
      values.push(req.user!.id);
      const updated = await pool.query(
        `UPDATE users SET ${setParts.join(',')} WHERE id=$${values.length} RETURNING ${userColumns}`,
        values
      );
      if (!updated.rows.length) return res.status(404).json({ error: "User not found" });
      return res.json({ user: toUser(updated.rows[0]) });
    } catch (error: any) {
      console.error("Error updating user profile:", error);
      return res.status(500).json({ error: error.message || "Failed to update profile" });
    }
  });

  app.post("/api/auth/logout", requireAuth, async (req, res) => {
    try {
      const token = getSessionToken(req);
      if (token) await deleteSession(token);
    } finally {
      clearSessionCookie(res);
      res.status(204).end();
    }
  });


  app.get("/api/data/:collection", requireAuth, async (req, res) => {
    try {
      const collection = String(req.params.collection);

      if (collection === "users") {
        const result = await pool.query(
          `SELECT id, email, name, role
             FROM users
            WHERE organization_id=$1`,
          [req.user!.organizationId]
        );
        let records = result.rows.map((row: any) => ({ id: row.id, data: row }));
        const whereParams = Array.isArray(req.query.where) ? req.query.where : (req.query.where ? [req.query.where] : []);
        for (const raw of whereParams) {
          try {
            const w = JSON.parse(String(raw));
            records = records.filter((r: any) => r.data?.[w.field] === w.value);
          } catch {}
        }
        const max = Number(req.query.limit || 0);
        if (max > 0) records = records.slice(0, max);
        return res.json({ records });
      }

      return res.status(404).json({ error: "Collection not available in the canonical database model." });
    } catch (error: any) {
      console.error("Data read error:", error);
      return res.status(500).json({ error: error.message || "Unable to read records" });
    }
  });

  app.post("/api/data/:collection", requireAuth, async (req, res) => {
    if (String(req.params.collection) === "users") {
      return res.status(403).json({ error: "User records are managed by authentication." });
    }
    return res.status(404).json({ error: "Generic app-record collections are not part of the canonical Supabase schema." });
  });

  app.patch("/api/data/:collection/:id", requireAuth, async (_req, res) => {
    return res.status(404).json({ error: "Generic app-record collections are not part of the canonical Supabase schema." });
  });

  app.delete("/api/data/:collection/:id", requireAuth, async (_req, res) => {
    return res.status(404).json({ error: "Generic app-record collections are not part of the canonical Supabase schema." });
  });

  // File storage is intentionally not implemented through the database.
  // The canonical platform uses Supabase Storage with its own RLS policies.
  app.post("/api/storage", requireAuth, async (_req, res) => {
    return res.status(501).json({ error: "File storage must use the canonical Supabase Storage integration." });
  });

  app.get("/api/storage/:path", requireAuth, async (_req, res) => {
    return res.status(501).json({ error: "File storage must use the canonical Supabase Storage integration." });
  });

  app.delete("/api/storage/:path", requireAuth, async (_req, res) => {
    return res.status(501).json({ error: "File storage must use the canonical Supabase Storage integration." });
  });

  // Property Intelligence API
  app.get("/api/properties/search", requireAuth, async (req, res) => {
    try {
      await ensureDatabaseReady();
      const pool = createPool();
      const params: unknown[] = [req.user!.organizationId];
      const where = ["p.organization_id = $1"];
      const q = String(req.query.q || "").trim();
      const state = String(req.query.state || "").trim();
      const county = String(req.query.county || "").trim();
      const zip = String(req.query.zip || req.query.postalCode || "").trim();
      const propertyType = String(req.query.propertyType || "").trim();
      const minValue = Number(req.query.minValue || 0);
      const maxValue = Number(req.query.maxValue || 0);
      const taxDelinquent = req.query.taxDelinquent === "true";
      const absentee = req.query.absentee === "true";
      const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);

      if (q) {
        params.push("%" + q + "%");
        const p = params.length;
        where.push("(p.address ILIKE $" + p + " OR p.city ILIKE $" + p + " OR p.apn ILIKE $" + p + ")");
      }
      if (state) { params.push(state); where.push("p.state = $" + params.length); }
      if (county) { params.push(county); where.push("p.county = $" + params.length); }
      if (zip) { params.push(zip); where.push("p.zip = $" + params.length); }
      if (propertyType) { params.push(propertyType); where.push("p.property_type = $" + params.length); }
      if (minValue > 0) { params.push(minValue); where.push("p.estimated_value >= $" + params.length); }
      if (maxValue > 0) { params.push(maxValue); where.push("p.estimated_value <= $" + params.length); }
      if (taxDelinquent) where.push("p.tax_delinquent = true");
      if (absentee) where.push("p.is_absentee_owner = true");

      const sql = `
        SELECT
          p.id,
          p.apn,
          p.address,
          p.city,
          p.state,
          p.zip,
          p.county,
          p.property_type,
          p.units_count,
          p.square_feet,
          p.year_built,
          p.estimated_value,
          p.assessed_tax_value,
          p.estimated_equity,
          p.mortgage_balance,
          p.is_absentee_owner,
          p.is_corporate_owned,
          p.tax_delinquent,
          p.last_sale_date,
          p.last_sale_price,
          p.provenance,
          po.id AS owner_id,
          po.name AS owner_name,
          po.entity_type AS owner_type,
          po.mailing_address,
          po.mailing_city,
          po.mailing_state,
          po.mailing_zip
        FROM properties p
        LEFT JOIN property_owners po
          ON po.id = p.owner_id
         AND po.organization_id = p.organization_id
        WHERE ${where.join(" AND ")}
        ORDER BY p.created_at DESC
        LIMIT ${Math.min(limit, 200)}
      `;
      const result = await pool.query(sql, params);
      const properties = result.rows.map((row: any) => ({
        ...row,
        address_line1: row.address,
        postal_code: row.zip,
        owner_occupied: row.is_absentee_owner === null ? null : !row.is_absentee_owner,
        estimated_value: row.estimated_value,
        assessed_value: row.assessed_tax_value,
        mortgage_balance: row.mortgage_balance,
        owners: row.owner_id
          ? [{
              ownerId: row.owner_id,
              name: row.owner_name,
              type: row.owner_type,
              mailingAddress: row.mailing_address
                ? [row.mailing_address, row.mailing_city, row.mailing_state, row.mailing_zip].filter(Boolean).join(", ")
                : null,
            }]
          : [],
      }));
      return res.json({ count: properties.length, properties });
    } catch (error: any) {
      console.error("Property search error:", error);
      return res.status(500).json({ error: error.message || "Unable to search properties" });
    }
  });

  app.post("/api/property-leads", requireAuth, async (req, res) => {
    try {
      await ensureDatabaseReady();
      const pool = createPool();
      const propertyId = String(req.body?.propertyId || "");
      const score = Math.max(0, Math.min(Number(req.body?.score || 0), 100));
      const reasons = Array.isArray(req.body?.reasons) ? req.body.reasons : [];
      if (!propertyId) return res.status(400).json({ error: "Valid propertyId is required" });

      const property = await pool.query(
        "SELECT id FROM properties WHERE id=$1 AND organization_id=$2 LIMIT 1",
        [propertyId, req.user!.organizationId]
      );
      if (!property.rows.length) return res.status(404).json({ error: "Property not found" });

      const existing = await pool.query(
        "SELECT id FROM leads WHERE organization_id=$1 AND primary_property_id=$2 AND owner_id=(SELECT owner_id FROM users WHERE id=$3 LIMIT 1) LIMIT 1",
        [req.user!.organizationId, propertyId, req.user!.id]
      );
      let leadId = existing.rows[0]?.id || crypto.randomUUID();

      if (existing.rows.length) {
        const result = await pool.query(
          "UPDATE leads SET lead_score=$1,factors=$2::jsonb,updated_at=now() WHERE id=$3 AND organization_id=$4 RETURNING *",
          [score, JSON.stringify(reasons), leadId, req.user!.organizationId]
        );
        return res.status(200).json({ lead: result.rows[0] });
      }

      const result = await pool.query(
        "INSERT INTO leads (id,organization_id,lead_score,factors,primary_property_id) VALUES ($1,$2,$3,$4::jsonb,$5) RETURNING *",
        [leadId, req.user!.organizationId, score, JSON.stringify(reasons), propertyId]
      );
      return res.status(201).json({ lead: result.rows[0] });
    } catch (error: any) {
      console.error("Property lead error:", error);
      return res.status(500).json({ error: error.message || "Unable to save property lead" });
    }
  });

  app.get("/api/properties/:id", requireAuth, async (req, res) => {
    try {
      await ensureDatabaseReady();
      const pool = createPool();
      const id = String(req.params.id || "");
      if (!id) return res.status(400).json({ error: "Invalid property id" });

      const property = await pool.query(
        `SELECT
           p.*,
           po.id AS owner_id,
           po.name AS owner_name,
           po.entity_type AS owner_type,
           po.mailing_address,
           po.mailing_city,
           po.mailing_state,
           po.mailing_zip
         FROM properties p
         LEFT JOIN property_owners po
           ON po.id=p.owner_id
          AND po.organization_id=p.organization_id
         WHERE p.id=$1 AND p.organization_id=$2
         LIMIT 1`,
        [id, req.user!.organizationId]
      );
      if (!property.rows.length) return res.status(404).json({ error: "Property not found" });

      const sources = property.rows[0].provenance ? [property.rows[0].provenance] : [];
      return res.json({ property: property.rows[0], sources });
    } catch (error: any) {
      console.error("Property detail error:", error);
      return res.status(500).json({ error: error.message || "Unable to retrieve property" });
    }
  });

  app.post("/api/properties/import", requireAuth, async (req, res) => {
    try {
      await ensureDatabaseReady();
      const records = Array.isArray(req.body?.records) ? req.body.records : [];
      if (!records.length) return res.status(400).json({ error: "records array is required" });
      if (records.length > 5000) return res.status(413).json({ error: "Import limited to 5,000 records per request." });

      const pool = createPool();
      let inserted = 0;
      let updated = 0;

      for (const input of records) {
        const r = input || {};
        const owner = r.owner || {};
        const id = String(r.id || crypto.randomUUID());
        const apn = String(r.apn || "");
        if (!apn || !r.address || !r.city || !r.state || !r.zip || !r.county || !r.propertyType) {
          return res.status(400).json({
            error: "Each property requires apn, address, city, state, zip, county, and propertyType."
          });
        }

        let ownerId: string | null = null;
        if (owner.name || owner.canonicalName) {
          const ownerName = String(owner.name || owner.canonicalName).trim();
          const ownerSearch = await pool.query(
            "SELECT id FROM property_owners WHERE organization_id=$1 AND lower(name)=lower($2) LIMIT 1",
            [req.user!.organizationId, ownerName]
          );
          if (ownerSearch.rows.length) {
            ownerId = ownerSearch.rows[0].id;
          } else {
            const createdOwner = await pool.query(
              `INSERT INTO property_owners
                 (id,organization_id,name,entity_type,mailing_address,mailing_city,mailing_state,mailing_zip)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
               RETURNING id`,
              [
                crypto.randomUUID(),
                req.user!.organizationId,
                ownerName,
                String(owner.entityType || owner.ownerType || "individual"),
                owner.mailingAddress ? String(owner.mailingAddress) : null,
                owner.mailingCity || owner.city || null,
                owner.mailingState || owner.state || null,
                owner.mailingZip || owner.postalCode || null,
              ]
            );
            ownerId = createdOwner.rows[0].id;
          }
        }

        const existing = await pool.query(
          "SELECT id FROM properties WHERE organization_id=$1 AND apn=$2 LIMIT 1",
          [req.user!.organizationId, apn]
        );

        const values = [
          id,
          req.user!.organizationId,
          ownerId,
          String(r.address),
          String(r.city),
          String(r.state),
          String(r.zip),
          String(r.county),
          apn,
          String(r.propertyType),
          Math.max(1, Number(r.unitsCount || 1)),
          Math.max(0, Number(r.squareFeet || r.livingSqft || 0)),
          r.yearBuilt == null ? null : Number(r.yearBuilt),
          Number(r.estimatedValue || 0),
          Number(r.assessedTaxValue ?? r.assessedValue ?? 0),
          Number(r.estimatedEquity || 0),
          Number(r.mortgageBalance || 0),
          Boolean(r.isAbsenteeOwner ?? (r.ownerOccupied === false)),
          Boolean(r.isCorporateOwned),
          Boolean(r.taxDelinquent),
          r.lastSaleDate || null,
          r.lastSalePrice == null ? null : Number(r.lastSalePrice),
          r.provenance || r.rawData || {},
        ];

        if (existing.rows.length) {
          await pool.query(
            `UPDATE properties SET
               owner_id=$3,address=$4,city=$5,state=$6,zip=$7,county=$8,apn=$9,
               property_type=$10,units_count=$11,square_feet=$12,year_built=$13,
               estimated_value=$14,assessed_tax_value=$15,estimated_equity=$16,
               mortgage_balance=$17,is_absentee_owner=$18,is_corporate_owned=$19,
               tax_delinquent=$20,last_sale_date=$21,last_sale_price=$22,provenance=$23,
               created_at=created_at
             WHERE organization_id=$2 AND id=$1`,
            values
          );
          updated++;
        } else {
          await pool.query(
            `INSERT INTO properties (
               id,organization_id,owner_id,address,city,state,zip,county,apn,
               property_type,units_count,square_feet,year_built,estimated_value,
               assessed_tax_value,estimated_equity,mortgage_balance,is_absentee_owner,
               is_corporate_owned,tax_delinquent,last_sale_date,last_sale_price,provenance
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
            values
          );
          inserted++;
        }
      }

      return res.status(201).json({ inserted, updated, total: records.length });
    } catch (error: any) {
      console.error("Property import error:", error);
      return res.status(500).json({ error: error.message || "Unable to import properties" });
    }
  });

  app.get("/api/metrics", requireAuth, async (_req, res) => {
    try {
      if (global._isUsingLocalFallback) {
        return res.json(localDb.getMetrics());
      }
      const data = await db.select().from(financialMetrics);
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching metrics:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gemini/chat", requireAuth, async (req, res) => {
    try {
      const { history, message, options, systemInstruction } = req.body;
      const { type } = options || {};
      let model = "gemini-3.5-flash";
      const config: any = {
        systemInstruction: systemInstruction || "You are a helpful and professional real estate AI assistant for Vortex One PropFlow.",
      };

      if (type === "maps") config.tools = [{ googleMaps: {} }];
      else if (type === "search") config.tools = [{ googleSearch: {} }];
      else if (type === "fast") model = "gemini-3.1-flash-lite";
      else if (type === "think") {
        model = "gemini-3.1-pro-preview";
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
      }

      if (config.tools) config.toolConfig = { includeServerSideToolInvocations: true };

      const chat = ai.chats.create({ model, config, history: history || [] });
      const streamResponse = await chat.sendMessageStream({ message });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      for await (const chunk of streamResponse) {
        if (chunk.text) res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
      res.end();
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/maintenance/analyze", requireAuth, async (req, res) => {
    try {
      const { description } = req.body;
      if (!description || !description.trim()) return res.status(400).json({ error: "Description is required" });

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: `Analyze the following tenant maintenance request and determine the correct trade category, recommended priority/urgency, a short 5-8 word summary, and a brief one-sentence reason/explanation.\n\nRequest Description:\n"${description}"`,
        config: {
          systemInstruction: "You are an expert AI Property Maintenance Dispatcher.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING, description: "The trade category or department." },
              priority: { type: Type.STRING, description: "The recommended priority/urgency level." },
              summary: { type: Type.STRING, description: "A short, concise 5-8 word summary." },
              explanation: { type: Type.STRING, description: "A 1-sentence professional explanation." }
            },
            required: ["category", "priority", "summary", "explanation"]
          }
        }
      });

      const jsonText = response.text?.trim() || "{}";
      res.json(JSON.parse(jsonText));
    } catch (error: any) {
      console.error("Maintenance analysis Gemini API error:", error);
      res.status(500).json({ error: error.message || "Failed to analyze description" });
    }
  });

  return app;
}

const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith("/server.ts") || 
  process.argv[1].endsWith("/server.js") || 
  process.argv[1].endsWith("/server.cjs") ||
  process.argv[1] === "server.ts" ||
  process.argv[1] === "server.js" ||
  process.argv[1] === "server.cjs"
);

if (!process.env.VERCEL && isDirectRun) {
  const start = async () => {
    try {
      await ensureDatabaseReady();
      const app = createApp();
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));

      const listenPort = 3000;
      app.listen(listenPort, "0.0.0.0", () => {
        console.log(`Server running on http://0.0.0.0:${listenPort}`);
      });
    } catch (error) {
      console.error('Vortex One startup aborted: PostgreSQL is required.', error);
      process.exitCode = 1;
    }
  };
  void start();
}

export default createApp;
