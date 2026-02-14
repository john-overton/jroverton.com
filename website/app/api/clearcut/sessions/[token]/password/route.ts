import type { NextRequest } from 'next/server';

import { hashPassword, verifyPassword } from '@/lib/clearcut/auth';
import { ApiError, handleRouteError, successResponse } from '@/lib/clearcut/errors';
import {
  assertValidTokenParam,
  requireAuthorizedSessionAccess,
  requireSessionByEditToken,
} from '@/lib/clearcut/http';
import { setSessionPasswordHash } from '@/lib/clearcut/registry-db';

export const runtime = 'nodejs';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    assertValidTokenParam(token);
    const session = requireSessionByEditToken(token);
    requireAuthorizedSessionAccess(request, session, 'edit');

    const body = (await request.json().catch(() => null)) as {
      newPassword?: string;
      currentPassword?: string;
    } | null;

    const newPassword = body?.newPassword ?? '';
    if (!newPassword) {
      throw new ApiError(400, 'missing_password', 'newPassword is required.');
    }

    if (session.password_hash) {
      const currentPassword = body?.currentPassword ?? '';
      if (!currentPassword) {
        throw new ApiError(400, 'missing_current_password', 'currentPassword is required.');
      }
      const ok = await verifyPassword(currentPassword, session.password_hash);
      if (!ok) {
        throw new ApiError(401, 'invalid_password', 'Current password is invalid.');
      }
    }

    const passwordHash = await hashPassword(newPassword);
    setSessionPasswordHash(token, passwordHash);
    return successResponse({ passwordProtected: true });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    assertValidTokenParam(token);
    const session = requireSessionByEditToken(token);
    requireAuthorizedSessionAccess(request, session, 'edit');

    if (session.password_hash) {
      const body = (await request.json().catch(() => null)) as {
        currentPassword?: string;
      } | null;
      const currentPassword = body?.currentPassword ?? '';
      if (!currentPassword) {
        throw new ApiError(400, 'missing_current_password', 'currentPassword is required.');
      }
      const ok = await verifyPassword(currentPassword, session.password_hash);
      if (!ok) {
        throw new ApiError(401, 'invalid_password', 'Current password is invalid.');
      }
    }

    setSessionPasswordHash(token, null);
    return successResponse({ passwordProtected: false });
  } catch (err) {
    return handleRouteError(err);
  }
}
