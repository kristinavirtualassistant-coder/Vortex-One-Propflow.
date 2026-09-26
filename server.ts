import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import { db } from "./src/db/index.js";
import { financialMetrics } from "./src/db/schema.js";
import { requireAuth } from "./src/middleware/auth.js";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get("/api/metrics", async (req, res) => {
    try {
      const data = await db.select().from(financialMetrics);
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching metrics:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gemini/chat", async (req, res) => {
    try {
      const { history, message, options, systemInstruction } = req.body;
      
      const { type } = options || {};
      
      let model = "gemini-3.5-flash";
      const config: any = {
        systemInstruction: systemInstruction || "You are a helpful and professional real estate AI assistant for PropertyFlow.",
      };

      if (type === "maps") {
        config.tools = [{ googleMaps: {} }];
      } else if (type === "search") {
        config.tools = [{ googleSearch: {} }];
      } else if (type === "fast") {
        model = "gemini-3.1-flash-lite";
      } else if (type === "think") {
        model = "gemini-3.1-pro-preview";
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
      }

      // Ensure that we include tool invocations when combining built-in tools (although we are just doing one built-in here)
      // Actually we just set it if we have tools
      if (config.tools) {
          config.toolConfig = { includeServerSideToolInvocations: true };
      }

      const chat = ai.chats.create({
        model,
        config,
        history: history || [],
      });

      const streamResponse = await chat.sendMessageStream({ message });
      
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      for await (const chunk of streamResponse) {
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }
      res.end();
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/maintenance/analyze", async (req, res) => {
    try {
      const { description } = req.body;
      if (!description || !description.trim()) {
        return res.status(400).json({ error: "Description is required" });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: `Analyze the following tenant maintenance request and determine the correct trade category, recommended priority/urgency, a short 5-8 word summary, and a brief one-sentence reason/explanation.

Request Description:
"${description}"`,
        config: {
          systemInstruction: "You are an expert AI Property Maintenance Dispatcher. Your job is to read tenant reports and accurately categorize them by trade type and urgency.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: {
                type: Type.STRING,
                description: "The trade category or department. Must be one of: 'plumbing', 'electrical', 'hvac', 'appliance', 'structural', 'carpentry', 'pest_control', 'general'."
              },
              priority: {
                type: Type.STRING,
                description: "The recommended priority/urgency level. Must be one of: 'routine', 'high', 'urgent'."
              },
              summary: {
                type: Type.STRING,
                description: "A short, concise 5-8 word summary of the maintenance issue."
              },
              explanation: {
                type: Type.STRING,
                description: "A 1-sentence professional explanation of why this category and priority were recommended."
              }
            },
            required: ["category", "priority", "summary", "explanation"]
          }
        }
      });

      const jsonText = response.text?.trim() || "{}";
      const parsedData = JSON.parse(jsonText);
      res.json(parsedData);
    } catch (error: any) {
      console.error("Maintenance analysis Gemini API error:", error);
      res.status(500).json({ error: error.message || "Failed to analyze description" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
