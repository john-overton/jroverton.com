import type { NextRequest } from 'next/server';

import {
  parseBearerToken,
  signSessionJwt,
  verifyJwtFromRequest,
} from '@/lib/clearcut/auth';
import { ApiError, handleRouteError, successResponse } from '@/lib/clearcut/errors';
import {
  assertValidTokenParam,
  requireAuthorizedSessionAccess,
  requireSessionByEditToken,
  requireSessionByToken,
} from '@/lib/clearcut/http';
import {
  deleteClearcutSession,
  getSessionState,
  saveAndRefreshSessionState,
} from '@/lib/clearcut/service';
import type { SessionStateUpdateInput } from '@/lib/clearcut/types';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    assertValidTokenParam(token);
    const resolved = requireSessionByToken(token);
    const existingBearer = parseBearerToken(request);

    let issuedJwt: string | null = null;
    if (existingBearer) {
      const claims = verifyJwtFromRequest(request);
      if (claims.sub !== resolved.session.edit_token) {
        throw new ApiError(403, 'jwt_session_mismatch', 'JWT is not valid for this session.');
      }
    } else if (resolved.tokenType === 'edit' && resolved.session.password_hash) {
      throw new ApiError(401, 'password_required', 'This session requires a password.', {
        name: resolved.session.name,
      });
    } else {
      issuedJwt = signSessionJwt(
        resolved.session.edit_token,
        resolved.tokenType === 'readonly' ? 'readonly' : 'edit',
      );
    }

    const state = getSessionState(resolved.session);
    return successResponse({
      ...state,
      ...(issuedJwt ? { jwt: issuedJwt } : {}),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    assertValidTokenParam(token);
    const session = requireSessionByEditToken(token);
    requireAuthorizedSessionAccess(request, session, 'edit');

    const body = (await request.json().catch(() => null)) as SessionStateUpdateInput | null;
    if (!body || typeof body !== 'object') {
      throw new ApiError(400, 'invalid_json', 'Request body must be a valid JSON object.');
    }

    const updatedSession = saveAndRefreshSessionState(session, body);
    const state = getSessionState(updatedSession);
    return successResponse(state);
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

    deleteClearcutSession(session.edit_token);
    return successResponse({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
