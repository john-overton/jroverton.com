import type { NextRequest } from 'next/server';

import { buildDemoTripsAndRoutes } from '@/lib/parallax/demo-data';
import { handleRouteError, successResponse } from '@/lib/parallax/errors';
import {
  assertValidTokenParam,
  requireAuthorizedSessionAccess,
  requireSessionByEditToken,
} from '@/lib/parallax/http';
import { getSessionState, saveAndRefreshSessionState } from '@/lib/parallax/service';

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

    const payload = buildDemoTripsAndRoutes();

    const updatedSession = saveAndRefreshSessionState(session, {
      trips: payload.trips,
      routes: payload.routes,
      depots: payload.depots,
      settings: { is_demo: 1 },
    });

    const state = getSessionState(updatedSession);
    return successResponse(state);
  } catch (err) {
    return handleRouteError(err);
  }
}
