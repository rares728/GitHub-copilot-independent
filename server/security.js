import { createHash, randomBytes, scrypt as callbackScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { pool } from './db.js';

const scrypt = promisify(callbackScrypt);
export const SESSION_COOKIE = 'rcca_session';

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${Buffer.from(key).toString('hex')}`;
}

export async function verifyPassword(password, encoded) {
  if (!encoded) return false;
  const [algorithm, salt, expected] = encoded.split('$');
  if (algorithm !== 'scrypt' || !salt || !expected) return false;
  const actual = Buffer.from(await scrypt(password, salt, 64));
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

export const hashToken = (token) => createHash('sha256').update(token).digest('hex');

export function readCookie(request, name) {
  const cookieHeader = request.headers.cookie || '';
  for (const part of cookieHeader.split(';')) {
    const [key, ...valueParts] = part.trim().split('=');
    if (key === name) {
      try {
        return decodeURIComponent(valueParts.join('='));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export async function createSession(userId) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)`,
    [hashToken(token), userId, expiresAt],
  );
  return { token, expiresAt };
}

export function setSessionCookie(response, token, expiresAt) {
  response.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    expires: expiresAt,
    path: '/',
  });
}

export function clearSessionCookie(response) {
  response.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
  });
}

export async function requireUser(request, response, next) {
  try {
    const token = readCookie(request, SESSION_COOKIE);
    if (!token) return response.status(401).json({ error: 'Authentication required.' });
    const result = await pool.query(
      `SELECT records.data
       FROM auth_sessions sessions
       JOIN entity_records records
         ON records.entity_name = 'User' AND records.id = sessions.user_id
       WHERE sessions.token_hash = $1 AND sessions.expires_at > now()`,
      [hashToken(token)],
    );
    if (!result.rowCount) {
      clearSessionCookie(response);
      return response.status(401).json({ error: 'Session expired. Please sign in again.' });
    }
    request.user = result.rows[0].data;
    request.sessionTokenHash = hashToken(token);
    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireAdmin(request, response, next) {
  if (request.user?.role !== 'admin') {
    return response.status(403).json({ error: 'Administrator access required.' });
  }
  return next();
}
