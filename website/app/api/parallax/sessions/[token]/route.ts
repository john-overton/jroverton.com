import type { NextRequest } from 'next/server';

import {
  parseBearerToken,
  signSessionJwt,
  verifyJwtFromRequest,
} from '@/lib/parallax/auth';
import { ApiError, handleRouteError, successResponse } from '@/lib/parallax/errors';
import {
  assertValidTokenParam,
  requireAuthorizedSessionAccess,
  requireSessionByEditToken,
  requireSessionByToken,
} from '@/lib/parallax/http';
import {
  deleteClearcutSession,
  getSessionState,
  saveAndRefreshSessionState,
} from '@/lib/parallax/service';
import type { SessionStateUpdateInput } from '@/lib/parallax/types';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    assertValidTokenParam(token);
    const resolved = requireSessionByToken(token);
    const existingBearer = parseBearerToken(request);

    const access = resolved.tokenType === 'readonly' ? 'readonly' : 'edit';
    let issuedJwt: string | null = null;
    if (existingBearer) {
      const claims = verifyJwtFromRequest(request);
      const expectedSub = claims.access === 'edit' ? resolved.session.edit_token : resolved.session.readonly_token;
      if (claims.sub !== expectedSub) {
        throw new ApiError(403, 'jwt_session_mismatch', 'JWT is not valid for this session.');
      }
    } else if (resolved.tokenType === 'edit' && resolved.session.password_hash) {
      throw new ApiError(401, 'password_required', 'This session requires a password.', {
        name: resolved.session.name,
      });
    } else {
      issuedJwt = signSessionJwt(
        resolved.tokenType === 'readonly' ? resolved.session.readonly_token : resolved.session.edit_token,
        access,
      );
    }

    const state = getSessionState(resolved.session, access);
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
