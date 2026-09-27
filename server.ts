import express from "express";
import path from "path";
import crypto from "node:crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import { and, eq, gt } from "drizzle-orm";
import { db, createPool } from "./src/db/index.js";
import { financialMetrics, sessions, users } from "./src/db/schema.js";
import { createSession, deleteSession, requireAuth } from "./src/middleware/auth.js";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'vortex-one-propflow',
    }
  }
});

const hashPassword = (password: string) => crypto.createHash('sha256').update(password).digest('hex');

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, role, name } = req.body ?? {};
      if (!email || !password || !name) return res.status(400).json({ error: "Name, email, and password are required" });
      if (typeof password !== 'string' || password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

      const normalizedEmail = String(email).trim().toLowerCase();
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
      }).returning({
        id: users.id,
        uid: users.uid,
        email: users.email,
        name: users.name,
        role: users.role,
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
      const { email, password } = req.body ?? {};
      if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

      const normalizedEmail = String(email).trim().toLowerCase();
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

  app.post("/api/auth/logout", requireAuth, async (req, res) => {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
    if (token) await deleteSession(token);
    res.status(204).end();
  });

  const pool = createPool();
  await pool.query("CREATE TABLE IF NOT EXISTS app_records (id text PRIMARY KEY, owner_uid text NOT NULL, collection text NOT NULL, data jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now())");
  await pool.query("CREATE INDEX IF NOT EXISTS app_records_owner_collection_idx ON app_records(owner_uid, collection)");

  app.get("/api/data/:collection", requireAuth, async (req, res) => {
    try {
      const collection = String(req.params.collection);
      if (collection === "users") {
        const result = await pool.query("SELECT id, uid, email, name, role FROM users");
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
      const id = crypto.randomUUID();
      const collection = String(req.params.collection);
      if (collection === "users") return res.status(403).json({ error: "User records are managed by authentication." });
      await pool.query("INSERT INTO app_records (id, owner_uid, collection, data) VALUES ($1, $2, $3, $4::jsonb)", [id, req.user!.uid, collection, JSON.stringify(req.body?.data || {})]);
      return res.status(201).json({ id });
    } catch (error: any) { console.error("Data create error:", error); return res.status(500).json({ error: error.message || "Unable to create record" }); }
  });

  app.patch("/api/data/:collection/:id", requireAuth, async (req, res) => {
    try {
      const result = await pool.query("UPDATE app_records SET data = data || $1::jsonb WHERE id = $2 AND owner_uid = $3 AND collection = $4 RETURNING id", [JSON.stringify(req.body?.data || {}), String(req.params.id), req.user!.uid, String(req.params.collection)]);
      if (!result.rows.length) return res.status(404).json({ error: "Record not found" });
      return res.json({ id: String(req.params.id) });
    } catch (error: any) { console.error("Data update error:", error); return res.status(500).json({ error: error.message || "Unable to update record" }); }
  });

  app.delete("/api/data/:collection/:id", requireAuth, async (req, res) => {
    try {
      await pool.query("DELETE FROM app_records WHERE id = $1 AND owner_uid = $2 AND collection = $3", [String(req.params.id), req.user!.uid, String(req.params.collection)]);
      return res.status(204).end();
    } catch (error: any) { console.error("Data delete error:", error); return res.status(500).json({ error: error.message || "Unable to delete record" }); }
  });

  app.post("/api/storage", requireAuth, async (req, res) => {
    try {
      const { path: storagePath, name, type, data } = req.body || {};
      if (!storagePath || !data) return res.status(400).json({ error: "File path and data are required" });
      if (Buffer.byteLength(String(data), "utf8") > 5000000) return res.status(413).json({ error: "File is too large for this upload path." });
      const id = crypto.randomUUID();
      const record = { path: String(storagePath), name: String(name || storagePath), type: String(type || "application/octet-stream"), data: String(data) };
      await pool.query("INSERT INTO app_records (id, owner_uid, collection, data) VALUES ($1, $2, '_storage', $3::jsonb)", [id, req.user!.uid, JSON.stringify(record)]);
      return res.status(201).json({ id, downloadURL: "/api/storage/" + encodeURIComponent(String(storagePath)) });
    } catch (error: any) { console.error("Storage upload error:", error); return res.status(500).json({ error: error.message || "Unable to upload file" }); }
  });

  app.get("/api/storage/:path", requireAuth, async (req, res) => {
    try {
      const storagePath = decodeURIComponent(String(req.params.path));
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
      await pool.query("DELETE FROM app_records WHERE owner_uid = $1 AND collection = '_storage' AND data->>'path' = $2", [req.user!.uid, storagePath]);
      return res.status(204).end();
    } catch (error: any) { console.error("Storage delete error:", error); return res.status(500).json({ error: error.message || "Unable to delete file" }); }
  });

  app.get("/api/metrics", requireAuth, async (_req, res) => {
    try {
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

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
