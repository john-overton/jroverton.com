import type { NextRequest } from 'next/server';

import { handleRouteError, successResponse } from '@/lib/clearcut/errors';
import {
  assertValidTokenParam,
  requireAuthorizedSessionAccess,
  requireSessionByToken,
} from '@/lib/clearcut/http';
import { touchSessionAccess } from '@/lib/clearcut/registry-db';
import { listRoutes } from '@/lib/clearcut/session-db';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    assertValidTokenParam(token);
    const resolved = requireSessionByToken(token);
    requireAuthorizedSessionAccess(request, resolved.session, 'readonly');
    touchSessionAccess(resolved.session.edit_token);

    const routes = listRoutes(resolved.session.edit_token);
    return successResponse({ items: routes, count: routes.length });
  } catch (err) {
    return handleRouteError(err);
  }
}
