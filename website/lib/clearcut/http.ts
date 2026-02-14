import type { NextRequest } from 'next/server';

import { assertJwtForSession, verifyJwtFromRequest } from './auth';
import { ApiError } from './errors';
import { findSessionByAnyToken, findSessionByEditToken } from './registry-db';
import { isValidToken } from './tokens';
import type { AccessLevel, SessionRecord } from './types';

export function getClientIp(request: NextRequest): string {
  const fromHeader = request.headers.get('x-forwarded-for');
  if (fromHeader) {
    return fromHeader.split(',')[0]?.trim() || 'unknown';
  }
  return 'unknown';
}

export function assertValidTokenParam(token: string): void {
  if (!isValidToken(token)) {
    throw new ApiError(400, 'invalid_token_format', 'Token must be a 12-character lowercase hex string.');
  }
}

export function requireSessionByToken(token: string): {
  session: SessionRecord;
  tokenType: 'edit' | 'readonly';
} {
  assertValidTokenParam(token);
  const resolved = findSessionByAnyToken(token);
  if (!resolved) {
    throw new ApiError(404, 'session_not_found', 'Session not found.');
  }
  return resolved;
}

export function requireSessionByEditToken(editToken: string): SessionRecord {
  assertValidTokenParam(editToken);
  const session = findSessionByEditToken(editToken);
  if (!session) {
    throw new ApiError(404, 'session_not_found', 'Session not found.');
  }
  return session;
}

export function requireAuthorizedSessionAccess(
  request: NextRequest,
  session: SessionRecord,
  requiredAccess: AccessLevel,
): void {
  const claims = verifyJwtFromRequest(request);
  assertJwtForSession(claims, session, requiredAccess);
}
