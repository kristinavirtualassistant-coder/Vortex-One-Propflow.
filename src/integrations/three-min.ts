import crypto from "node:crypto";

const MAX_BODY_BYTES = 256 * 1024;

export type ThreeMinEvent = {
  event_type?: unknown;
  source?: unknown;
  organization_id?: unknown;
  external_id?: unknown;
  idempotency_key?: unknown;
  payload?: unknown;
  [key: string]: unknown;
};

export type ThreeMinVerification = {
  valid: boolean;
  reason?: string;
};

const getHeader = (headers: Record<string, string | string[] | undefined>, name: string) => {
  const value = headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
};

const parseSignatures = (value: string) => String(value || "").split(/\s+/).filter(Boolean).filter((item) => item.startsWith("v1,")).map((item) => item.slice(3));

const constantTimeEqual = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const decodeSecret = (secret: string) => Buffer.from(secret.replace(/^whsec_/, ""), "base64");

export const buildThreeMinSignature = (rawBody: string, webhookId: string, timestamp: string) => {
  const secret = String(process.env.THREEMIN_WEBHOOK_SECRET || "").trim();
  if (!secret) throw new Error("THREEMIN_WEBHOOK_SECRET is not configured");
  return crypto.createHmac("sha256", decodeSecret(secret)).update(`${webhookId}.${timestamp}.${rawBody}`).digest("base64");
};

export const verifyThreeMinWebhook = (rawBody: string, headers: Record<string, string | string[] | undefined>): ThreeMinVerification => {
  const secret = String(process.env.THREEMIN_WEBHOOK_SECRET || "").trim();
  if (!secret) return { valid: false, reason: "THREEMIN_WEBHOOK_SECRET is not configured" };

  const webhookId = getHeader(headers, "webhook-id") || getHeader(headers, "x-3minapi-record-id");
  const timestamp = getHeader(headers, "webhook-timestamp");
  const signatureHeader = getHeader(headers, "webhook-signature");
  if (!webhookId || !timestamp || !signatureHeader) return { valid: false, reason: "Missing 3Min webhook signature headers" };

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return { valid: false, reason: "Invalid webhook timestamp" };
  const skewSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds);
  if (skewSeconds > 5 * 60) return { valid: false, reason: "Webhook timestamp is outside the allowed replay window" };

  const signedContent = webhookId + "." + timestamp + "." + rawBody;
  const expected = crypto.createHmac("sha256", decodeSecret(secret)).update(signedContent).digest("base64");
  const valid = parseSignatures(signatureHeader).some((candidate) => constantTimeEqual(candidate, expected));
  return valid ? { valid: true } : { valid: false, reason: "Webhook signature verification failed" };
};

export const parseThreeMinEvent = (body: ThreeMinEvent) => {
  const eventType = String(body.event_type || body.type || "unknown").trim().slice(0, 120);
  const source = String(body.source || "3min").trim().slice(0, 120);
  const externalId = body.external_id == null ? null : String(body.external_id).slice(0, 200);
  const idempotencyKey = body.idempotency_key == null ? null : String(body.idempotency_key).slice(0, 200);
  const organizationId = body.organization_id == null ? null : String(body.organization_id).slice(0, 200);
  return { eventType: eventType || "unknown", source: source || "3min", externalId, idempotencyKey, organizationId, payload: body.payload ?? body };
};

export const verifyThreeMinBodySize = (contentLength?: string | string[]) => {
  const raw = Array.isArray(contentLength) ? contentLength[0] : contentLength;
  if (!raw) return true;
  const size = Number(raw);
  return Number.isFinite(size) && size >= 0 && size <= MAX_BODY_BYTES;
};

export const THREE_MIN_MAX_BODY_BYTES = MAX_BODY_BYTES;
