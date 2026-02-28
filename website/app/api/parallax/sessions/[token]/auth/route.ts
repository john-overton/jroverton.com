import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  AUTH_ATTEMPT_WINDOW_MS,
  AUTH_LOCKOUT_MS,
  AUTH_MAX_ATTEMPTS,
} from '@/lib/parallax/config';
import { signSessionJwt, verifyPassword } from '@/lib/parallax/auth';
import { ApiError, handleRouteError, successResponse } from '@/lib/parallax/errors';
import { assertValidTokenParam, getClientIp, requireSessionByEditToken } from '@/lib/parallax/http';

export const runtime = 'nodejs';

interface AuthAttemptState {
  failures: number[];
  lockoutUntil: number;
}

const authAttempts = new Map<string, AuthAttemptState>();

function getAttemptKey(token: string, ip: string): string {
  return `${token}:${ip}`;
}

function getOrCreateState(key: string): AuthAttemptState {
  const now = Date.now();
  const existing = authAttempts.get(key);
  if (!existing) {
    const initial: AuthAttemptState = { failures: [], lockoutUntil: 0 };
    authAttempts.set(key, initial);
    return initial;
  }

  existing.failures = existing.failures.filter((ts) => now - ts <= AUTH_ATTEMPT_WINDOW_MS);
  return existing;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    assertValidTokenParam(token);
    const session = requireSessionByEditToken(token);
    const ip = getClientIp(request);
    const key = getAttemptKey(token, ip);
    const state = getOrCreateState(key);
    const now = Date.now();

    if (state.lockoutUntil > now) {
      const retryAfter = Math.ceil((state.lockoutUntil - now) / 1000);
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'auth_locked',
            message: 'Too many failed attempts. Try again later.',
          },
        },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) },
        },
      );
    }

    if (!session.password_hash) {
      const jwt = signSessionJwt(session.edit_token, 'edit');
      return successResponse({ jwt, access: 'edit' });
    }

    const body = (await request.json().catch(() => null)) as { password?: string } | null;
    const password = body?.password ?? '';
    if (!password) {
      throw new ApiError(400, 'missing_password', 'Password is required.');
    }

    const valid = await verifyPassword(password, session.password_hash);
    if (!valid) {
      state.failures.push(now);
      if (state.failures.length > AUTH_MAX_ATTEMPTS) {
        state.lockoutUntil = now + AUTH_LOCKOUT_MS;
      }
      throw new ApiError(401, 'invalid_password', 'Password is invalid.');
    }

    state.failures = [];
    state.lockoutUntil = 0;
    const jwt = signSessionJwt(session.edit_token, 'edit');
    return successResponse({ jwt, access: 'edit' });
  } catch (err) {
    return handleRouteError(err);
  }
}
