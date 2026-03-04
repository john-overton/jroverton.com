import type { NextRequest } from 'next/server';

import { signSessionJwt } from '@/lib/parallax/auth';
import { handleRouteError, successResponse } from '@/lib/parallax/errors';
import {
  assertValidTokenParam,
  getClientIp,
  requireAuthorizedSessionAccess,
  requireSessionByEditToken,
} from '@/lib/parallax/http';
import { recordApiEvent } from '@/lib/parallax/metrics-db';
import { cloneClearcutSession } from '@/lib/parallax/service';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    assertValidTokenParam(token);
    const session = requireSessionByEditToken(token);
    requireAuthorizedSessionAccess(request, session, 'edit');

    const cloned = await cloneClearcutSession(session);
    const jwt = signSessionJwt(cloned.edit_token, 'edit');

    try {
      recordApiEvent({
        ip: getClientIp(request),
        method: 'POST',
        path: `/api/parallax/sessions/${token}/clone`,
        action: 'session_clone',
        sessionToken: token,
        statusCode: 201,
      });
    } catch {
      // Metrics recording should never break the main flow
    }

    return successResponse(
      {
        session: {
          edit_token: cloned.edit_token,
          readonly_token: cloned.readonly_token,
          name: cloned.name,
        },
        jwt,
      },
      201,
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
