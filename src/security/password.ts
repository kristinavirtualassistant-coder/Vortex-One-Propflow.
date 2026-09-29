import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(crypto.scrypt);
const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 32;

export const hashPassword = async (password: string): Promise<string> => {
  const salt = crypto.randomBytes(16);
  const derivedKey = await scryptAsync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 64 * 1024 * 1024,
  }) as Buffer;

  return `$scrypt$N=${SCRYPT_N},r=${SCRYPT_R},p=${SCRYPT_P}$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`;
};

const verifyScrypt = async (password: string, encoded: string): Promise<boolean> => {
  const parts = encoded.split('$');
  if (parts.length !== 5 || parts[1] !== 'scrypt' || parts[2] !== 'N=32768,r=8,p=1') return false;

  const salt = Buffer.from(parts[3], 'base64url');
  const expected = Buffer.from(parts[4], 'base64url');
  const actual = await scryptAsync(password, salt, expected.length, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 64 * 1024 * 1024,
  }) as Buffer;

  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

const legacySha256 = (password: string) =>
  crypto.createHash('sha256').update(password).digest('hex');

export const verifyPassword = async (
  password: string,
  storedHash: string,
): Promise<{ valid: boolean; needsRehash: boolean }> => {
  if (storedHash.startsWith('$scrypt$')) {
    return { valid: await verifyScrypt(password, storedHash), needsRehash: false };
  }

  if (/^[a-f0-9]{64}$/i.test(storedHash)) {
    const legacy = legacySha256(password);
    const valid = crypto.timingSafeEqual(Buffer.from(legacy), Buffer.from(storedHash));
    return { valid, needsRehash: valid };
  }

  return { valid: false, needsRehash: false };
};
