import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2/options";
import { createApp } from "../server.js";

setGlobalOptions({
  region: "us-central1",
  maxInstances: 10,
});

const appPromise = Promise.resolve(createApp());

export const api = onRequest(
  {
    timeoutSeconds: 120,
    memory: "1GiB",
    invoker: "public",
  },
  async (req, res) => {
    try {
      const app = await appPromise;
      return app(req, res);
    } catch (error) {
      console.error("Vortex One Firebase API initialization error:", error);
      if (!res.headersSent) {
        return res.status(500).json({ error: "Server initialization failed" });
      }
      return;
    }
  },
);
