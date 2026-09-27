import express from "express";
import path from "path";
import crypto from "node:crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import { and, eq, gt } from "drizzle-orm";
import { db } from "./src/db/index.js";
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
