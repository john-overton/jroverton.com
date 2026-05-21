import type { NextRequest } from 'next/server';

import {
  parseBearerToken,
  signSessionJwt,
  verifyJwtFromRequest,
} from '@/lib/parallax/auth';
import { ApiError, handleRouteError, successResponse } from '@/lib/parallax/errors';
import {
  assertValidTokenParam,
  getClientIp,
  requireSessionByToken,
} from '@/lib/parallax/http';
import { recordApiEvent } from '@/lib/parallax/metrics-db';
import { getSessionMetadataResponse } from '@/lib/parallax/service';

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

    const metadata = getSessionMetadataResponse(resolved.session, access);

    try {
      recordApiEvent({
        ip: getClientIp(request),
        method: 'GET',
        path: `/api/parallax/sessions/${token}/metadata`,
        action: 'session_metadata',
        sessionToken: token,
        statusCode: 200,
      });
    } catch {
      // Metrics recording should never break the main flow
    }

    return successResponse({
      ...metadata,
      ...(issuedJwt ? { jwt: issuedJwt } : {}),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
