import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { db, ensureDatabaseReady } from '../db/index.js';
import { sessions, users } from '../db/schema.js';
import { localDb } from '../db/localDb.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        uid: string;
        email: string;
        name: string;
        role: string;
        phone?: string | null;
        companyName?: string | null;
        portfolioSize?: string | null;
        primaryMarket?: string | null;
        currentAddress?: string | null;
        monthlyIncome?: string | null;
        employmentStatus?: string | null;
        moveInDate?: string | null;
        occupantsCount?: number | null;
        hasPets?: string | null;
        tradeSpecialty?: string | null;
        hourlyRate?: string | null;
        propertyTypes?: string | null;
        managementFee?: string | null;
        serviceRadius?: string | null;
        emergencyDispatch?: string | null;
      };
    }
  }
}

export interface AuthRequest extends Request {
  user?: {
    id: number;
    uid: string;
    email: string;
    name: string;
    role: string;
    phone?: string | null;
    companyName?: string | null;
    portfolioSize?: string | null;
    primaryMarket?: string | null;
    currentAddress?: string | null;
    monthlyIncome?: string | null;
    employmentStatus?: string | null;
    moveInDate?: string | null;
    occupantsCount?: number | null;
    hasPets?: string | null;
    tradeSpecialty?: string | null;
    hourlyRate?: string | null;
    propertyTypes?: string | null;
    managementFee?: string | null;
    serviceRadius?: string | null;
    emergencyDispatch?: string | null;
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
  if (global._isUsingLocalFallback) {
    localDb.deleteSession(sessionId);
    return;
  }
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
    if (global._isUsingLocalFallback) {
      const session = localDb.getSessions().find(s => s.id === token && new Date(s.expiresAt) > new Date());
      if (!session) return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
      const user = localDb.getUsers().find(u => u.id === session.userId);
      if (!user) return res.status(401).json({ error: 'Unauthorized: User not found' });
      req.user = user;
      return next();
    }

    const rows = await db
      .select({
        sessionId: sessions.id,
        userId: users.id,
        uid: users.uid,
        email: users.email,
        name: users.name,
        role: users.role,
        phone: users.phone,
        companyName: users.companyName,
        portfolioSize: users.portfolioSize,
        primaryMarket: users.primaryMarket,
        currentAddress: users.currentAddress,
        monthlyIncome: users.monthlyIncome,
        employmentStatus: users.employmentStatus,
        moveInDate: users.moveInDate,
        occupantsCount: users.occupantsCount,
        hasPets: users.hasPets,
        tradeSpecialty: users.tradeSpecialty,
        hourlyRate: users.hourlyRate,
        propertyTypes: users.propertyTypes,
        managementFee: users.managementFee,
        serviceRadius: users.serviceRadius,
        emergencyDispatch: users.emergencyDispatch,
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
      phone: rows[0].phone,
      companyName: rows[0].companyName,
      portfolioSize: rows[0].portfolioSize,
      primaryMarket: rows[0].primaryMarket,
      currentAddress: rows[0].currentAddress,
      monthlyIncome: rows[0].monthlyIncome,
      employmentStatus: rows[0].employmentStatus,
      moveInDate: rows[0].moveInDate,
      occupantsCount: rows[0].occupantsCount,
      hasPets: rows[0].hasPets,
      tradeSpecialty: rows[0].tradeSpecialty,
      hourlyRate: rows[0].hourlyRate,
      propertyTypes: rows[0].propertyTypes,
      managementFee: rows[0].managementFee,
      serviceRadius: rows[0].serviceRadius,
      emergencyDispatch: rows[0].emergencyDispatch,
    };
    return next();
  } catch (error) {
    console.error('Error verifying application session:', error);
    return res.status(500).json({ error: 'Authentication service unavailable' });
  }
};
