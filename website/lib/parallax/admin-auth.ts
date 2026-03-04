import jwt from 'jsonwebtoken';
import type { NextRequest } from 'next/server';

import { clearcutConfig } from './config';
import { ApiError } from './errors';

const ADMIN_COOKIE_NAME = 'parallax_admin';
const ADMIN_JWT_TTL = 60 * 60 * 8; // 8 hours

function getJwtSecret(): string {
  const secret = clearcutConfig.jwtSecret;
  if (!secret) {
    throw new ApiError(500, 'missing_jwt_secret', 'JWT secret is not configured.');
  }
  return secret;
}

export function verifyAdminPassword(password: string): boolean {
  const expected = clearcutConfig.adminPassword;
  if (!expected) {
    throw new ApiError(500, 'admin_not_configured', 'Admin password is not set in environment.');
  }
  return password === expected;
}

export function signAdminToken(): string {
  return jwt.sign({ role: 'admin' }, getJwtSecret(), {
    expiresIn: ADMIN_JWT_TTL,
    algorithm: 'HS256',
  });
}

export function verifyAdminFromRequest(request: NextRequest): void {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) {
    throw new ApiError(401, 'admin_auth_required', 'Admin authentication required.');
  }
  try {
    const payload = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as { role?: string };
    if (payload.role !== 'admin') {
      throw new Error('not admin');
    }
  } catch {
    throw new ApiError(401, 'admin_auth_invalid', 'Admin session expired or invalid.');
  }
}

export function getAdminCookieName(): string {
  return ADMIN_COOKIE_NAME;
}

export function getAdminCookieMaxAge(): number {
  return ADMIN_JWT_TTL;
}
