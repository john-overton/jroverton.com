import type { NextRequest } from 'next/server';

import { signSessionJwt } from '@/lib/clearcut/auth';
import { handleRouteError, successResponse } from '@/lib/clearcut/errors';
import {
  assertValidTokenParam,
  requireAuthorizedSessionAccess,
  requireSessionByEditToken,
} from '@/lib/clearcut/http';
import { cloneClearcutSession } from '@/lib/clearcut/service';

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
