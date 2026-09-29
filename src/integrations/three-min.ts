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
  mode: "hmac" | "token" | "disabled";
  reason?: string;
};

const getHeader = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const timingSafeEqual = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

export const verifyThreeMinWebhook = (
  rawBody: string,
  headers: Record<string, string | string[] | undefined>,
): ThreeMinVerification => {
  const secret = String(process.env.THREEMIN_WEBHOOK_SECRET || "").trim();
  const expectedToken = String(process.env.THREEMIN_WEBHOOK_TOKEN || "").trim();

  if (!secret && !expectedToken) {
    return {
      valid: process.env.THREEMIN_WEBHOOK_ALLOW_UNAUTHENTICATED === "true",
      mode: process.env.THREEMIN_WEBHOOK_ALLOW_UNAUTHENTICATED === "true" ? "disabled" : "token",
      reason: "No webhook secret/token configured",
    };
  }

  const signature =
    getHeader(headers["x-3min-signature"]) ||
    getHeader(headers["x-webhook-signature"]) ||
    getHeader(headers["x-signature"]);

  if (secret && signature) {
    const supplied = String(signature).replace(/^sha256=/i, "").trim();
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    if (timingSafeEqual(supplied, expected)) {
      return { valid: true, mode: "hmac" };
    }
  }

  const authorization = getHeader(headers.authorization);
  const token =
    authorization?.replace(/^Bearer\s+/i, "").trim() ||
    getHeader(headers["x-3min-webhook-token"]) ||
    getHeader(headers["x-webhook-token"]);

  if (expectedToken && token && timingSafeEqual(token, expectedToken)) {
    return { valid: true, mode: "token" };
  }

  return {
    valid: false,
    mode: secret ? "hmac" : "token",
    reason: "Webhook authentication failed",
  };
};

export const parseThreeMinEvent = (body: ThreeMinEvent) => {
  const eventType = String(body.event_type || body.type || "unknown").trim().slice(0, 120);
  const source = String(body.source || "3min").trim().slice(0, 120);
  const externalId = body.external_id == null ? null : String(body.external_id).slice(0, 200);
  const idempotencyKey =
    body.idempotency_key == null ? null : String(body.idempotency_key).slice(0, 200);

  const organizationId =
    body.organization_id == null ? null : String(body.organization_id).slice(0, 200);

  return {
    eventType: eventType || "unknown",
    source: source || "3min",
    externalId,
    idempotencyKey,
    organizationId,
    payload: body.payload ?? body,
  };
};

export const verifyThreeMinBodySize = (contentLength?: string | string[]) => {
  const raw = Array.isArray(contentLength) ? contentLength[0] : contentLength;
  if (!raw) return true;
  const size = Number(raw);
  return Number.isFinite(size) && size >= 0 && size <= MAX_BODY_BYTES;
};

export const THREE_MIN_MAX_BODY_BYTES = MAX_BODY_BYTES;
