import { onRequest } from "firebase-functions/v2/https";
import { createApp } from "./lib/server.js";

const app = createApp();

export const api = onRequest(
  {
    region: "us-central1",
    cors: false,
    invoker: "public",
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  app,
);
