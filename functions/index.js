const functions = require("firebase-functions");
const express = require("express");

const app = express();

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "vortex-one-propflow" });
});

exports.api = functions.https.onRequest(app);
