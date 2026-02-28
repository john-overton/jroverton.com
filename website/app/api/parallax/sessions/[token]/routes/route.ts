import type { NextRequest } from 'next/server';

import { handleRouteError, successResponse } from '@/lib/parallax/errors';
import {
  assertValidTokenParam,
  requireAuthorizedSessionAccess,
  requireSessionByToken,
} from '@/lib/parallax/http';
import { touchSessionAccess } from '@/lib/parallax/registry-db';
import { listRoutes } from '@/lib/parallax/session-db';

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
