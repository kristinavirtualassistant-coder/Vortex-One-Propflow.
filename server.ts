import express from "express";
import path from "path";
import crypto from "node:crypto";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import { and, eq, gt } from "drizzle-orm";
import { db, createPool, ensureDatabaseReady } from "./src/db/index.js";
import { financialMetrics, sessions, users } from "./src/db/schema.js";
import { createSession, deleteSession, requireAuth } from "./src/middleware/auth.js";
import { localDb } from "./src/db/localDb.js";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'vortex-one-propflow',
    }
  }
});

const hashPassword = (password: string) => crypto.createHash('sha256').update(password).digest('hex');
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

const socialPasswordHash = (provider: string, subject: string) =>
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

  app.use(express.json());


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

      const existingBySubject = await db.select().from(users).where(eq(users.authProviderSubject, profile.subject)).limit(1);
      const existingByEmail = await db.select().from(users).where(eq(users.email, profile.email)).limit(1);
      let account: any = existingBySubject[0] || existingByEmail[0];

      if (account && account.authProvider !== 'password' && account.authProvider !== provider) {
        return res.status(409).send('This email is already linked to a different sign-in provider.');
      }

      if (!account) {
        const uid = crypto.randomUUID();
        const created = await db.insert(users).values({
          uid,
          email: profile.email,
          passwordHash: socialPasswordHash(provider, profile.subject),
          name: profile.name,
          role: stateData.role,
          profileComplete: 0,
          authProvider: provider,
          authProviderSubject: profile.subject,
          avatarUrl: profile.avatarUrl || null,
        }).returning({ id: users.id, uid: users.uid, email: users.email, name: users.name, role: users.role });
        account = created[0];
      } else {
        const updated = await db.update(users)
          .set({
            authProvider: provider,
            authProviderSubject: profile.subject,
            avatarUrl: profile.avatarUrl || account.avatarUrl || null,
            name: profile.name || account.name,
          })
          .where(eq(users.id, account.id))
          .returning({ id: users.id, uid: users.uid, email: users.email, name: users.name, role: users.role });
        account = updated[0];
      }

      const session = await createSession(account.id);
      return res.redirect(`/dashboard?session=${encodeURIComponent(session.id)}`);
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
      const {
        email,
        password,
        role,
        name,
        phone,
        companyName,
        portfolioSize,
        primaryMarket,
        currentAddress,
        monthlyIncome,
        employmentStatus,
        moveInDate,
        occupantsCount,
        hasPets,
        tradeSpecialty,
        hourlyRate,
        propertyTypes,
        managementFee,
        serviceRadius,
        emergencyDispatch
      } = req.body ?? {};
      if (!email || !password || !name) return res.status(400).json({ error: "Name, email, and password are required" });
      if (typeof password !== 'string' || password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

      const normalizedEmail = String(email).trim().toLowerCase();

      if (global._isUsingLocalFallback) {
        const existing = localDb.getUsers().find(u => u.email === normalizedEmail);
        if (existing) return res.status(409).json({ error: "An account with that email already exists" });

        const uid = crypto.randomUUID();
        const newUser = {
          id: Math.floor(Math.random() * 1000000),
          uid,
          email: normalizedEmail,
          passwordHash: hashPassword(password),
          name: String(name).trim(),
          role: role || 'property_manager',
          profileComplete: 0,
          phone: phone ? String(phone).trim() : null,
          companyName: companyName ? String(companyName).trim() : null,
          portfolioSize: portfolioSize ? String(portfolioSize).trim() : null,
          primaryMarket: primaryMarket ? String(primaryMarket).trim() : null,
          currentAddress: currentAddress ? String(currentAddress).trim() : null,
          monthlyIncome: monthlyIncome ? String(monthlyIncome).trim() : null,
          employmentStatus: employmentStatus ? String(employmentStatus).trim() : null,
          moveInDate: moveInDate ? String(moveInDate).trim() : null,
          occupantsCount: occupantsCount ? Number(occupantsCount) : null,
          hasPets: hasPets ? String(hasPets).trim() : null,
          tradeSpecialty: tradeSpecialty ? String(tradeSpecialty).trim() : null,
          hourlyRate: hourlyRate ? String(hourlyRate).trim() : null,
          propertyTypes: propertyTypes ? String(propertyTypes).trim() : null,
          managementFee: managementFee ? String(managementFee).trim() : null,
          serviceRadius: serviceRadius ? String(serviceRadius).trim() : null,
          emergencyDispatch: emergencyDispatch ? String(emergencyDispatch).trim() : null,
        };

        localDb.saveUser(newUser);
        const session = {
          id: crypto.randomBytes(32).toString('hex'),
          userId: newUser.id,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        };
        localDb.saveSession(session);

        return res.status(201).json({ user: newUser, session });
      }

      const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, normalizedEmail)).limit(1);
      if (existing.length) return res.status(409).json({ error: "An account with that email already exists" });

      const uid = crypto.randomUUID();
      const newUser = await db.insert(users).values({
        uid,
        email: normalizedEmail,
        passwordHash: hashPassword(password),
        name: String(name).trim(),
        role: role || 'property_manager',
        profileComplete: 0,
        phone: phone ? String(phone).trim() : null,
        companyName: companyName ? String(companyName).trim() : null,
        portfolioSize: portfolioSize ? String(portfolioSize).trim() : null,
        primaryMarket: primaryMarket ? String(primaryMarket).trim() : null,
        currentAddress: currentAddress ? String(currentAddress).trim() : null,
        monthlyIncome: monthlyIncome ? String(monthlyIncome).trim() : null,
        employmentStatus: employmentStatus ? String(employmentStatus).trim() : null,
        moveInDate: moveInDate ? String(moveInDate).trim() : null,
        occupantsCount: occupantsCount ? Number(occupantsCount) : null,
        hasPets: hasPets ? String(hasPets).trim() : null,
        tradeSpecialty: tradeSpecialty ? String(tradeSpecialty).trim() : null,
        hourlyRate: hourlyRate ? String(hourlyRate).trim() : null,
        propertyTypes: propertyTypes ? String(propertyTypes).trim() : null,
        managementFee: managementFee ? String(managementFee).trim() : null,
        serviceRadius: serviceRadius ? String(serviceRadius).trim() : null,
        emergencyDispatch: emergencyDispatch ? String(emergencyDispatch).trim() : null,
      }).returning({
        id: users.id,
        uid: users.uid,
        email: users.email,
        name: users.name,
        role: users.role,
        phone: users.phone,
        companyName: users.companyName,
        portfolioSize: users.portfolioSize,
        primaryMarket: users.primaryMarket,
        currentAddress: users.currentAddress,
        monthlyIncome: users.monthlyIncome,
        employmentStatus: users.employmentStatus,
        moveInDate: users.moveInDate,
        occupantsCount: users.occupantsCount,
        hasPets: users.hasPets,
        tradeSpecialty: users.tradeSpecialty,
        hourlyRate: users.hourlyRate,
        propertyTypes: users.propertyTypes,
        managementFee: users.managementFee,
        serviceRadius: users.serviceRadius,
        emergencyDispatch: users.emergencyDispatch,
      });

      const session = await createSession(newUser[0].id);
      return res.status(201).json({ user: newUser[0], session });
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

      if (global._isUsingLocalFallback) {
        const user = localDb.getUsers().find(u => u.email === normalizedEmail);
        if (!user || user.passwordHash !== hashPassword(String(password))) {
          return res.status(401).json({ error: "Invalid email or password" });
        }
        const session = {
          id: crypto.randomBytes(32).toString('hex'),
          userId: user.id,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        };
        localDb.saveSession(session);
        return res.json({ user, session });
      }

      const rows = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
      const user = rows[0];
      if (!user || user.passwordHash !== hashPassword(String(password))) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const session = await createSession(user.id);
      return res.json({
        user: { id: user.id, uid: user.uid, email: user.email, name: user.name, role: user.role },
        session,
      });
    } catch (error: any) {
      console.error("Login error:", error);
      return res.status(500).json({ error: error.message || "Unable to sign in" });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    res.json({ user: req.user });
  });

  app.patch("/api/auth/me", requireAuth, async (req, res) => {
    try {
      await ensureDatabaseReady();
      const fields = req.body ?? {};
      
      const allowedFields = [
        'phone',
        'companyName',
        'portfolioSize',
        'primaryMarket',
        'currentAddress',
        'monthlyIncome',
        'employmentStatus',
        'moveInDate',
        'occupantsCount',
        'hasPets',
        'tradeSpecialty',
        'hourlyRate',
        'propertyTypes',
        'managementFee',
        'serviceRadius',
        'emergencyDispatch'
      ];
      
      const filteredFields: Record<string, any> = {};
      for (const key of allowedFields) {
        if (fields[key] !== undefined) {
          filteredFields[key] = fields[key];
        }
      }
      
      if (global._isUsingLocalFallback) {
        const updated = localDb.updateUser(req.user!.uid, filteredFields);
        if (!updated) return res.status(404).json({ error: "User not found" });
        return res.json({ user: updated });
      }
      
      const updated = await db.update(users)
        .set(filteredFields)
        .where(eq(users.id, req.user!.id))
        .returning({
          id: users.id,
          uid: users.uid,
          email: users.email,
          name: users.name,
          role: users.role,
          phone: users.phone,
          companyName: users.companyName,
          portfolioSize: users.portfolioSize,
          primaryMarket: users.primaryMarket,
          currentAddress: users.currentAddress,
          monthlyIncome: users.monthlyIncome,
          employmentStatus: users.employmentStatus,
          moveInDate: users.moveInDate,
          occupantsCount: users.occupantsCount,
          hasPets: users.hasPets,
          tradeSpecialty: users.tradeSpecialty,
          hourlyRate: users.hourlyRate,
          propertyTypes: users.propertyTypes,
          managementFee: users.managementFee,
          serviceRadius: users.serviceRadius,
          emergencyDispatch: users.emergencyDispatch,
        });
        
      if (!updated.length) return res.status(404).json({ error: "User not found" });
      return res.json({ user: updated[0] });
    } catch (error: any) {
      console.error("Error updating user profile:", error);
      return res.status(500).json({ error: error.message || "Failed to update profile" });
    }
  });

  app.post("/api/auth/logout", requireAuth, async (req, res) => {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
    if (token) await deleteSession(token);
    res.status(204).end();
  });

  const pool = createPool();

  app.get("/api/data/:collection", requireAuth, async (req, res) => {
    try {
      const collection = String(req.params.collection);
      if (global._isUsingLocalFallback) {
        if (collection === "users") {
          const records = localDb.getUsers().map(u => ({ id: u.id, data: u }));
          return res.json({ records });
        }
        const records = localDb.getRecords(collection, req.user!.uid);
        return res.json({ records: records.map(r => ({ id: r.id, data: r.data, createdAt: r.created_at })) });
      }

      if (collection === "users") {
        const result = await pool.query("SELECT id, uid, email, name, role, phone, company_name, trade_specialty, hourly_rate, service_radius, emergency_dispatch FROM users");
        let records = result.rows.map((row: any) => ({ id: row.id, data: row }));
        const whereParams = Array.isArray(req.query.where) ? req.query.where : (req.query.where ? [req.query.where] : []);
        for (const raw of whereParams) { try { const w = JSON.parse(String(raw)); records = records.filter((r: any) => r.data?.[w.field] === w.value); } catch {} }
        const orderBy = String(req.query.orderBy || "");
        const order = String(req.query.order || "asc");
        if (orderBy) records.sort((a: any, b: any) => String(a.data?.[orderBy] ?? "").localeCompare(String(b.data?.[orderBy] ?? "")));
        if (order === "desc") records.reverse();
        const max = Number(req.query.limit || 0); if (max > 0) records = records.slice(0, max);
        return res.json({ records });
      }
      const result = await pool.query("SELECT id, data, created_at FROM app_records WHERE owner_uid = $1 AND collection = $2", [req.user!.uid, collection]);
      let records = result.rows.map((row: any) => ({ id: row.id, data: row.data || {}, createdAt: row.created_at }));
      const whereParams = Array.isArray(req.query.where) ? req.query.where : (req.query.where ? [req.query.where] : []);
      for (const raw of whereParams) { try { const w = JSON.parse(String(raw)); records = records.filter((r: any) => r.data?.[w.field] === w.value); } catch {} }
      const orderBy = String(req.query.orderBy || "");
      const order = String(req.query.order || "asc");
      if (orderBy) records.sort((a: any, b: any) => String(a.data?.[orderBy] ?? "").localeCompare(String(b.data?.[orderBy] ?? "")));
      if (order === "desc") records.reverse();
      const max = Number(req.query.limit || 0); if (max > 0) records = records.slice(0, max);
      return res.json({ records });
    } catch (error: any) { console.error("Data read error:", error); return res.status(500).json({ error: error.message || "Unable to read records" }); }
  });

  app.post("/api/data/:collection", requireAuth, async (req, res) => {
    try {
      const collection = String(req.params.collection);
      if (global._isUsingLocalFallback) {
        if (collection === "users") return res.status(403).json({ error: "User records are managed by authentication." });
        const rec = localDb.addRecord(collection, req.user!.uid, req.body?.data || {});
        return res.status(201).json({ id: rec.id });
      }

      const id = crypto.randomUUID();
      if (collection === "users") return res.status(403).json({ error: "User records are managed by authentication." });
      await pool.query("INSERT INTO app_records (id, owner_uid, collection, data) VALUES ($1, $2, $3, $4::jsonb)", [id, req.user!.uid, collection, JSON.stringify(req.body?.data || {})]);
      return res.status(201).json({ id });
    } catch (error: any) { console.error("Data create error:", error); return res.status(500).json({ error: error.message || "Unable to create record" }); }
  });

  app.patch("/api/data/:collection/:id", requireAuth, async (req, res) => {
    try {
      const collection = String(req.params.collection);
      if (global._isUsingLocalFallback) {
        const rec = localDb.updateRecord(String(req.params.id), collection, req.user!.uid, req.body?.data || {});
        if (!rec) return res.status(404).json({ error: "Record not found" });
        return res.json({ id: rec.id });
      }

      const result = await pool.query("UPDATE app_records SET data = data || $1::jsonb WHERE id = $2 AND owner_uid = $3 AND collection = $4 RETURNING id", [JSON.stringify(req.body?.data || {}), String(req.params.id), req.user!.uid, collection]);
      if (!result.rows.length) return res.status(404).json({ error: "Record not found" });
      return res.json({ id: String(req.params.id) });
    } catch (error: any) { console.error("Data update error:", error); return res.status(500).json({ error: error.message || "Unable to update record" }); }
  });

  app.delete("/api/data/:collection/:id", requireAuth, async (req, res) => {
    try {
      const collection = String(req.params.collection);
      if (global._isUsingLocalFallback) {
        localDb.deleteRecord(String(req.params.id), collection, req.user!.uid);
        return res.status(204).end();
      }

      await pool.query("DELETE FROM app_records WHERE id = $1 AND owner_uid = $2 AND collection = $3", [String(req.params.id), req.user!.uid, collection]);
      return res.status(204).end();
    } catch (error: any) { console.error("Data delete error:", error); return res.status(500).json({ error: error.message || "Unable to delete record" }); }
  });

  app.post("/api/storage", requireAuth, async (req, res) => {
    try {
      const { path: storagePath, name, type, data } = req.body || {};
      if (!storagePath || !data) return res.status(400).json({ error: "File path and data are required" });
      if (Buffer.byteLength(String(data), "utf8") > 5000000) return res.status(413).json({ error: "File is too large for this upload path." });

      if (global._isUsingLocalFallback) {
        const record = { path: String(storagePath), name: String(name || storagePath), type: String(type || "application/octet-stream"), data: String(data) };
        const rec = localDb.addRecord('_storage', req.user!.uid, record);
        return res.status(201).json({ id: rec.id, downloadURL: "/api/storage/" + encodeURIComponent(String(storagePath)) });
      }

      const id = crypto.randomUUID();
      const record = { path: String(storagePath), name: String(name || storagePath), type: String(type || "application/octet-stream"), data: String(data) };
      await pool.query("INSERT INTO app_records (id, owner_uid, collection, data) VALUES ($1, $2, '_storage', $3::jsonb)", [id, req.user!.uid, JSON.stringify(record)]);
      return res.status(201).json({ id, downloadURL: "/api/storage/" + encodeURIComponent(String(storagePath)) });
    } catch (error: any) { console.error("Storage upload error:", error); return res.status(500).json({ error: error.message || "Unable to upload file" }); }
  });

  app.get("/api/storage/:path", requireAuth, async (req, res) => {
    try {
      const storagePath = decodeURIComponent(String(req.params.path));
      if (global._isUsingLocalFallback) {
        const records = localDb.getRecords('_storage', req.user!.uid);
        const matchRec = [...records].reverse().find(r => r.data?.path === storagePath);
        if (!matchRec) return res.status(404).send("File not found");
        const record = matchRec.data;
        const match = String(record.data).match(/^data:([^;]+);base64,(.+)$/s);
        if (!match) return res.status(500).send("Stored file is invalid");
        res.setHeader("Content-Type", record.type || match[1]);
        return res.send(Buffer.from(match[2], "base64"));
      }

      const result = await pool.query("SELECT data FROM app_records WHERE owner_uid = $1 AND collection = '_storage' AND data->>'path' = $2 ORDER BY created_at DESC LIMIT 1", [req.user!.uid, storagePath]);
      if (!result.rows.length) return res.status(404).send("File not found");
      const record: any = result.rows[0].data;
      const match = String(record.data).match(/^data:([^;]+);base64,(.+)$/s);
      if (!match) return res.status(500).send("Stored file is invalid");
      res.setHeader("Content-Type", record.type || match[1]);
      return res.send(Buffer.from(match[2], "base64"));
    } catch (error: any) { console.error("Storage download error:", error); return res.status(500).send("Unable to download file"); }
  });

  app.delete("/api/storage/:path", requireAuth, async (req, res) => {
    try {
      const storagePath = decodeURIComponent(String(req.params.path));
      if (global._isUsingLocalFallback) {
        const records = localDb.getRecords('_storage', req.user!.uid);
        const matchRec = records.find(r => r.data?.path === storagePath);
        if (matchRec) {
          localDb.deleteRecord(matchRec.id, '_storage', req.user!.uid);
        }
        return res.status(204).end();
      }

      await pool.query("DELETE FROM app_records WHERE owner_uid = $1 AND collection = '_storage' AND data->>'path' = $2", [req.user!.uid, storagePath]);
      return res.status(204).end();
    } catch (error: any) { console.error("Storage delete error:", error); return res.status(500).json({ error: error.message || "Unable to delete file" }); }
  });

  // Property Intelligence API
  app.get("/api/properties/search", requireAuth, async (req, res) => {
    try {
      await ensureDatabaseReady();
      if (global._isUsingLocalFallback) return res.status(503).json({ error: "Property search requires PostgreSQL/PostGIS." });

      const pool = createPool();
      const params: any[] = [];
      const where: string[] = [];
      const q = String(req.query.q || "").trim();
      const state = String(req.query.state || "").trim();
      const county = String(req.query.county || "").trim();
      const postalCode = String(req.query.postalCode || "").trim();
      const propertyType = String(req.query.propertyType || "").trim();
      const minValue = Number(req.query.minValue || 0);
      const maxValue = Number(req.query.maxValue || 0);
      const minBeds = Number(req.query.minBeds || 0);
      const vacant = req.query.vacant === "true";
      const taxDelinquent = req.query.taxDelinquent === "true";
      const preForeclosure = req.query.preForeclosure === "true";
      const foreclosure = req.query.foreclosure === "true";
      const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);

      if (q) {
        params.push("%" + q + "%");
        where.push("(address_line1 ILIKE $" + params.length + " OR city ILIKE $" + params.length + " OR apn ILIKE $" + params.length + ")");
      }
      if (state) { params.push(state); where.push("state = $" + params.length); }
      if (county) { params.push(county); where.push("county = $" + params.length); }
      if (postalCode) { params.push(postalCode); where.push("postal_code = $" + params.length); }
      if (propertyType) { params.push(propertyType); where.push("property_type = $" + params.length); }
      if (minValue > 0) { params.push(minValue); where.push("COALESCE(estimated_value, assessed_value) >= $" + params.length); }
      if (maxValue > 0) { params.push(maxValue); where.push("COALESCE(estimated_value, assessed_value) <= $" + params.length); }
      if (minBeds > 0) { params.push(minBeds); where.push("COALESCE(bedrooms,0) >= $" + params.length); }
      if (vacant) where.push("vacancy_status = 'vacant'");
      if (taxDelinquent) where.push("tax_delinquent = true");
      if (preForeclosure) where.push("pre_foreclosure = true");
      if (foreclosure) where.push("foreclosure = true");

      const sql = "SELECT p.id, p.apn, p.fips, p.state, p.county, p.address_line1, p.city, p.postal_code, p.property_type, p.bedrooms, p.bathrooms, p.living_sqft, p.lot_sqft, p.year_built, p.assessed_value, p.estimated_value, p.estimated_rent, p.last_sale_price, p.last_sale_date, p.latitude, p.longitude, p.vacancy_status, p.owner_occupied, p.tax_delinquent, p.pre_foreclosure, p.foreclosure, p.probate, p.lien_count, p.mortgage_balance, COALESCE(json_agg(json_build_object('ownerId', o.id, 'name', o.canonical_name, 'type', o.owner_type, 'mailingAddress', o.mailing_address)) FILTER (WHERE o.id IS NOT NULL), '[]') AS owners FROM properties p LEFT JOIN property_owner_links pol ON pol.property_id = p.id LEFT JOIN property_owners o ON o.id = pol.owner_id" +
        (where.length ? " WHERE " + where.join(" AND ") : "") +
        " GROUP BY p.id ORDER BY p.updated_at DESC LIMIT " + String(limit);
      const result = await pool.query(sql, params);
      return res.json({ count: result.rowCount, properties: result.rows });
    } catch (error: any) {
      console.error("Property search error:", error);
      return res.status(500).json({ error: error.message || "Unable to search properties" });
    }
  });

  app.get("/api/properties/:id", requireAuth, async (req, res) => {
    try {
      await ensureDatabaseReady();
      if (global._isUsingLocalFallback) return res.status(503).json({ error: "Property intelligence requires PostgreSQL/PostGIS." });
      const pool = createPool();
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Invalid property id" });
      const property = await pool.query(
        "SELECT p.*, COALESCE(json_agg(json_build_object('ownerId',o.id,'name',o.canonical_name,'type',o.owner_type,'mailingAddress',o.mailing_address)) FILTER (WHERE o.id IS NOT NULL),'[]') AS owners FROM properties p LEFT JOIN property_owner_links pol ON pol.property_id=p.id LEFT JOIN property_owners o ON o.id=pol.owner_id WHERE p.id=$1 GROUP BY p.id",
        [id]
      );
      if (!property.rows.length) return res.status(404).json({ error: "Property not found" });
      const sources = await pool.query("SELECT * FROM property_sources WHERE property_id=$1 ORDER BY retrieved_at DESC", [id]);
      return res.json({ property: property.rows[0], sources: sources.rows });
    } catch (error: any) {
      console.error("Property detail error:", error);
      return res.status(500).json({ error: error.message || "Unable to retrieve property" });
    }
  });

  app.post("/api/properties/import", requireAuth, async (req, res) => {
    try {
      await ensureDatabaseReady();
      if (global._isUsingLocalFallback) return res.status(503).json({ error: "Property imports require PostgreSQL/PostGIS." });
      const records = Array.isArray(req.body?.records) ? req.body.records : [];
      if (!records.length) return res.status(400).json({ error: "records array is required" });
      if (records.length > 5000) return res.status(413).json({ error: "Import limited to 5,000 records per request." });

      const pool = createPool();
      let inserted = 0;
      let updated = 0;
      for (const input of records) {
        const r = input || {};
        const owner = r.owner || {};
        const source = r.source || {};
        let propertyId: number;
        if (r.apn && r.fips) {
          const existing = await pool.query("SELECT id FROM properties WHERE apn=$1 AND fips=$2 LIMIT 1", [String(r.apn), String(r.fips)]);
          if (existing.rows.length) {
            propertyId = Number(existing.rows[0].id);
            await pool.query(
              "UPDATE properties SET state=$1,county=$2,address_line1=$3,city=$4,postal_code=$5,property_type=$6,bedrooms=$7,bathrooms=$8,living_sqft=$9,lot_sqft=$10,year_built=$11,assessed_value=$12,estimated_value=$13,estimated_rent=$14,last_sale_price=$15,last_sale_date=$16,latitude=$17,longitude=$18,vacancy_status=$19,owner_occupied=$20,tax_delinquent=$21,pre_foreclosure=$22,foreclosure=$23,probate=$24,lien_count=$25,mortgage_balance=$26,raw_data=$27::jsonb,updated_at=now() WHERE id=$28",
              [r.state||null,r.county||null,r.addressLine1||null,r.city||null,r.postalCode||null,r.propertyType||null,r.bedrooms??null,r.bathrooms??null,r.livingSqft??null,r.lotSqft??null,r.yearBuilt??null,r.assessedValue??null,r.estimatedValue??null,r.estimatedRent??null,r.lastSalePrice??null,r.lastSaleDate||null,r.latitude??null,r.longitude??null,r.vacancyStatus||null,r.ownerOccupied??null,Boolean(r.taxDelinquent),Boolean(r.preForeclosure),Boolean(r.foreclosure),Boolean(r.probate),Number(r.lienCount||0),r.mortgageBalance??null,JSON.stringify(r),propertyId]
            );
            updated++;
          } else {
            const created = await pool.query(
              "INSERT INTO properties (apn,fips,state,county,address_line1,city,postal_code,property_type,bedrooms,bathrooms,living_sqft,lot_sqft,year_built,assessed_value,estimated_value,estimated_rent,last_sale_price,last_sale_date,latitude,longitude,vacancy_status,owner_occupied,tax_delinquent,pre_foreclosure,foreclosure,probate,lien_count,mortgage_balance,raw_data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29) RETURNING id",
              [r.apn,r.fips,r.state||null,r.county||null,r.addressLine1||null,r.city||null,r.postalCode||null,r.propertyType||null,r.bedrooms??null,r.bathrooms??null,r.livingSqft??null,r.lotSqft??null,r.yearBuilt??null,r.assessedValue??null,r.estimatedValue??null,r.estimatedRent??null,r.lastSalePrice??null,r.lastSaleDate||null,r.latitude??null,r.longitude??null,r.vacancyStatus||null,r.ownerOccupied??null,Boolean(r.taxDelinquent),Boolean(r.preForeclosure),Boolean(r.foreclosure),Boolean(r.probate),Number(r.lienCount||0),r.mortgageBalance??null,JSON.stringify(r)]
            );
            propertyId = Number(created.rows[0].id);
            inserted++;
          }
        } else {
          const created = await pool.query(
            "INSERT INTO properties (state,county,address_line1,city,postal_code,property_type,bedrooms,bathrooms,living_sqft,lot_sqft,year_built,assessed_value,estimated_value,estimated_rent,latitude,longitude,raw_data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id",
            [r.state||null,r.county||null,r.addressLine1||null,r.city||null,r.postalCode||null,r.propertyType||null,r.bedrooms??null,r.bathrooms??null,r.livingSqft??null,r.lotSqft??null,r.yearBuilt??null,r.assessedValue??null,r.estimatedValue??null,r.estimatedRent??null,r.latitude??null,r.longitude??null,JSON.stringify(r)]
          );
          propertyId = Number(created.rows[0].id);
          inserted++;
        }

        if (owner.canonicalName) {
          const normalizedName = String(owner.canonicalName).trim().toLowerCase().replace(/\s+/g, " ");
          let ownerId: number | null = null;
          const existingOwner = await pool.query("SELECT id FROM property_owners WHERE normalized_name=$1 LIMIT 1", [normalizedName]);
          if (existingOwner.rows.length) ownerId = Number(existingOwner.rows[0].id);
          else {
            const createdOwner = await pool.query(
              "INSERT INTO property_owners (canonical_name,owner_type,normalized_name,mailing_address,city,state,postal_code,source,source_record_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id",
              [String(owner.canonicalName),owner.ownerType||"person",normalizedName,owner.mailingAddress||null,owner.city||null,owner.state||null,owner.postalCode||null,source.source||null,source.sourceRecordId||null]
            );
            ownerId = Number(createdOwner.rows[0].id);
          }
          await pool.query("INSERT INTO property_owner_links(property_id,owner_id,role,source) VALUES($1,$2,'owner',$3) ON CONFLICT DO NOTHING",[propertyId,ownerId,source.source||null]);
        }

        await pool.query("INSERT INTO property_sources(property_id,source,source_record_id,effective_date,confidence,record_hash) VALUES($1,$2,$3,$4,$5,$6)",
          [propertyId,source.source||"unknown",source.sourceRecordId||null,source.effectiveDate||null,source.confidence??null,crypto.createHash("sha256").update(JSON.stringify(r)).digest("hex")]);
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
  const app = createApp();
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));

  const listenPort = 3000;
  app.listen(listenPort, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${listenPort}`);
  });
}

export default createApp;
