import type { NextRequest } from 'next/server';

import { ApiError, handleRouteError, successResponse } from '@/lib/clearcut/errors';
import {
  assertValidTokenParam,
  requireAuthorizedSessionAccess,
  requireSessionByEditToken,
} from '@/lib/clearcut/http';
import { renameSession } from '@/lib/clearcut/registry-db';

export const runtime = 'nodejs';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    assertValidTokenParam(token);
    const session = requireSessionByEditToken(token);
    requireAuthorizedSessionAccess(request, session, 'edit');

    const body = (await request.json().catch(() => null)) as { name?: string } | null;
    const name = body?.name?.trim();
    if (!name) {
      throw new ApiError(400, 'invalid_name', 'A non-empty session name is required.');
    }

    renameSession(token, name);
    return successResponse({ name });
  } catch (err) {
    return handleRouteError(err);
  }
}
