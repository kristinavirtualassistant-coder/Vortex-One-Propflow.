import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2/options";
import { defineSecret } from "firebase-functions/params";
import { createApp } from "../server.js";
setGlobalOptions({
    region: "us-central1",
    maxInstances: 10,
});
const secrets = [
    "DATABASE_URL",
    "GEMINI_API_KEY",
    "GOOGLE_CLIENT_SECRET",
    "MICROSOFT_CLIENT_SECRET",
    "AUTH_SESSION_PEPPER",
    "SOCIAL_AUTH_PEPPER",
    "THREEMIN_WEBHOOK_SECRET",
    "THREEMIN_WEBHOOK_TOKEN",
    "GIS_CLOUD_ACCESS_TOKEN",
];
const firebaseSecrets = Object.fromEntries(secrets.map((name) => [name, defineSecret(name)]));
const appPromise = Promise.resolve(createApp());
export const api = onRequest({
    timeoutSeconds: 120,
    memory: "1GiB",
    invoker: "public",
    secrets: Object.values(firebaseSecrets),
}, async (req, res) => {
    try {
        const app = await appPromise;
        return app(req, res);
    }
    catch (error) {
        console.error("Vortex One Firebase API initialization error:", error);
        if (!res.headersSent) {
            return res.status(500).json({ error: "Server initialization failed" });
        }
        return;
    }
});
