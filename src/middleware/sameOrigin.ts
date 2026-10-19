import type { NextFunction, Request, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const originOf = (value: string | undefined): string | null => {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const allowedOrigins = (): Set<string> => {
  const list = [process.env.APP_URL, ...(process.env.ALLOWED_ORIGINS || '').split(',')]
    .map((v) => originOf(v?.trim()))
    .filter((v): v is string => Boolean(v));
  return new Set(list);
};

/**
 * CSRF defence for cookie sessions. State-changing requests that carry a cookie must come from
 * the app's own origin. A browser always sends Origin on cross-site POSTs, so a foreign or
 * "null" Origin is rejected. Requests with no Origin (curl, server-to-server) are not browser
 * CSRF vectors and pass; they still need a valid session.
 */
export function sameOriginGuard(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (!req.headers.cookie) return next();
  if (req.headers.authorization) return next();

  const rawOrigin = req.headers.origin;
  if (rawOrigin === undefined) return next();

  const origin = originOf(String(rawOrigin));
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (origin) {
    if (host && new URL(origin).host === host) return next();
    if (allowedOrigins().has(origin)) return next();
  }
  return res.status(403).json({ error: 'Cross-site request blocked' });
}
