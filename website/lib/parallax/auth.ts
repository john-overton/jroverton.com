import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { NextRequest } from 'next/server';

import { clearcutConfig, CLEARCUT_JWT_TTL_SECONDS } from './config';
import { ApiError } from './errors';
import type { AccessLevel, ClearCutJwtClaims, SessionRecord } from './types';

const BCRYPT_ROUNDS = 12;

function getJwtSecret(): string {
  const secret = clearcutConfig.jwtSecret;
  if (!secret) {
    throw new ApiError(500, 'missing_jwt_secret', 'CLEARCUT_JWT_SECRET is not configured.');
  }

  return secret;
}

export function signSessionJwt(subjectToken: string, access: AccessLevel): string {
  return jwt.sign(
    {
      sub: subjectToken,
      access,
    } satisfies ClearCutJwtClaims,
    getJwtSecret(),
    {
      expiresIn: CLEARCUT_JWT_TTL_SECONDS,
      algorithm: 'HS256',
    },
  );
}

export function parseBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}

export function verifyJwtFromRequest(request: NextRequest): ClearCutJwtClaims {
  const token = parseBearerToken(request);
  if (!token) {
    throw new ApiError(401, 'missing_auth', 'Missing bearer token.');
  }

  try {
    const payload = jwt.verify(token, getJwtSecret(), {
      algorithms: ['HS256'],
    }) as ClearCutJwtClaims;
    if (!payload.sub || (payload.access !== 'edit' && payload.access !== 'readonly')) {
      throw new ApiError(401, 'invalid_jwt', 'JWT payload is invalid.');
    }
    return payload;
  } catch {
    throw new ApiError(401, 'invalid_jwt', 'JWT is invalid or expired.');
  }
}

export function assertJwtForSession(
  claims: ClearCutJwtClaims,
  session: SessionRecord,
  requiredAccess: AccessLevel,
): void {
  const expectedSub = claims.access === 'edit' ? session.edit_token : session.readonly_token;
  if (claims.sub !== expectedSub) {
    throw new ApiError(403, 'jwt_session_mismatch', 'JWT is not valid for this session.');
  }

  if (requiredAccess === 'edit' && claims.access !== 'edit') {
    throw new ApiError(403, 'insufficient_access', 'Edit access is required for this endpoint.');
  }
}

export function validatePasswordStrength(password: string): void {
  if (password.length < 6) {
    throw new ApiError(400, 'weak_password', 'Password must be at least 6 characters.');
  }
}

export async function hashPassword(password: string): Promise<string> {
  validatePasswordStrength(password);
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
