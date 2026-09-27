import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { db, ensureDatabaseReady } from '../db/index.js';
import { sessions, users } from '../db/schema.js';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    uid: string;
    email: string;
    name: string;
    role: string;
  };
}

export const createSession = async (userId: number) => {
  await ensureDatabaseReady();
  const id = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  await db.insert(sessions).values({ id, userId, expiresAt });
  return { id, expiresAt };
};

export const deleteSession = async (sessionId: string) => {
  await ensureDatabaseReady();
  await db.delete(sessions).where(eq(sessions.id, sessionId));
};

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'Unauthorized: Missing session token' });

  try {
    await ensureDatabaseReady();
    const rows = await db
      .select({
        sessionId: sessions.id,
        userId: users.id,
        uid: users.uid,
        email: users.email,
        name: users.name,
        role: users.role,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.id, token), gt(sessions.expiresAt, new Date())))
      .limit(1);

    if (!rows.length) return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
    req.user = {
      id: rows[0].userId,
      uid: rows[0].uid,
      email: rows[0].email,
      name: rows[0].name,
      role: rows[0].role,
    };
    return next();
  } catch (error) {
    console.error('Error verifying application session:', error);
    return res.status(500).json({ error: 'Authentication service unavailable' });
  }
};
