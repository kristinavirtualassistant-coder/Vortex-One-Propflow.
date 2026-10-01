import type { NextFunction, Request, Response } from 'express';

type Options = {
  windowMs: number;
  max: number;
  // Return the bucket key(s) for a request; the request counts against every key.
  keys: (req: Request) => string[];
  message?: string;
};

// In-memory fixed-window limiter. State is per server instance, so on a multi-instance
// deployment the effective limit is max * instances; use a shared store if that matters.
export const rateLimit = ({ windowMs, max, keys, message }: Options) => {
  const hits = new Map<string, { count: number; resetAt: number }>();
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, windowMs);
  sweep.unref?.();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    let retryAfterMs = 0;
    for (const key of keys(req)) {
      let entry = hits.get(key);
      if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + windowMs };
        hits.set(key, entry);
      }
      entry.count += 1;
      if (entry.count > max) retryAfterMs = Math.max(retryAfterMs, entry.resetAt - now);
    }
    if (retryAfterMs > 0) {
      res.setHeader('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
      return res.status(429).json({ error: message || 'Too many requests. Please try again later.' });
    }
    return next();
  };
};

export const clientIp = (req: Request) => req.ip || req.socket.remoteAddress || 'unknown';
