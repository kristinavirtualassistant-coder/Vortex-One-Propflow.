import type { Request, Response, NextFunction } from "express";
import { createApp } from "../server.js";

let appPromise: ReturnType<typeof createApp> | null = null;

const getApp = () => {
  if (!appPromise) appPromise = createApp();
  return appPromise;
};

export default async function handler(req: Request, res: Response, next: NextFunction) {
  try {
    const app = await getApp();
    return app(req, res, next);
  } catch (error) {
    console.error("Vortex One API initialization error:", error);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Server initialization failed" });
    }
    return next(error);
  }
}
