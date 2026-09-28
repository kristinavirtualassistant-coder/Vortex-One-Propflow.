import express from "express";
import { createServer as createViteServer } from "vite";
import { createApp } from "./server.js";

const app = createApp();
const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: "spa",
});
app.use(vite.middlewares);

const port = 3000;
app.listen(port, "0.0.0.0", () => {
  console.log(`Development server running on http://0.0.0.0:${port}`);
});
