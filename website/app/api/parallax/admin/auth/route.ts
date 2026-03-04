import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  getAdminCookieMaxAge,
  getAdminCookieName,
  signAdminToken,
  verifyAdminPassword,
} from '@/lib/parallax/admin-auth';
import { ApiError, handleRouteError } from '@/lib/parallax/errors';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as { password?: string } | null;
    const password = body?.password ?? '';

    if (!password) {
      throw new ApiError(400, 'missing_password', 'Password is required.');
    }

    if (!verifyAdminPassword(password)) {
      throw new ApiError(401, 'invalid_password', 'Invalid admin password.');
    }

    const token = signAdminToken();
    const response = NextResponse.json({ ok: true, data: { authenticated: true } });

    response.cookies.set(getAdminCookieName(), token, {
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      maxAge: getAdminCookieMaxAge(),
      secure: process.env.NODE_ENV === 'production',
    });

    return response;
  } catch (err) {
    return handleRouteError(err);
  }
}
