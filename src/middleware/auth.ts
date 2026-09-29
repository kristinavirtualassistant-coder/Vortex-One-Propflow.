import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { createPool, ensureDatabaseReady } from '../db/index.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
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
  user?: Express.Request['user'];
}

const hashSessionToken = (token: string) =>
  crypto.createHash('sha256').update(token).digest('hex');

export const createSession = async (userId: string) => {
  await ensureDatabaseReady();
  const pool = createPool();
  const token = crypto.randomBytes(32).toString('hex');
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  await pool.query(
    'INSERT INTO auth_sessions (id, user_id, token_hash, expires_at, last_seen_at) VALUES ($1,$2,$3,$4,now())',
    [id, userId, hashSessionToken(token), expiresAt]
  );
  return { id: token, expiresAt };
};

export const deleteSession = async (token: string) => {
  await ensureDatabaseReady();
  const pool = createPool();
  await pool.query('DELETE FROM auth_sessions WHERE token_hash=$1', [hashSessionToken(token)]);
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
    const pool = createPool();
    const result = await pool.query(
      `SELECT
        u.id, COALESCE(u.uid, u.id) AS uid, u.email, u.name, u.role,
        u.phone, u.company_name, u.portfolio_size, u.primary_market,
        u.current_address, u.monthly_income, u.employment_status, u.move_in_date,
        u.occupants_count, u.has_pets, u.trade_specialty, u.hourly_rate,
        u.property_types, u.management_fee, u.service_radius, u.emergency_dispatch
       FROM auth_sessions s
       JOIN users u ON u.id=s.user_id
       WHERE s.token_hash=$1 AND s.expires_at>now() AND u.disabled_at IS NULL
       LIMIT 1`,
      [hashSessionToken(token)]
    );
    if (!result.rows.length) return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
    req.user = result.rows[0];
    await pool.query('UPDATE auth_sessions SET last_seen_at=now() WHERE token_hash=$1', [hashSessionToken(token)]);
    return next();
  } catch (error) {
    console.error('Error verifying application session:', error);
    return res.status(500).json({ error: 'Authentication service unavailable' });
  }
};
