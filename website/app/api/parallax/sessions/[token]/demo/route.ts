import type { NextRequest } from 'next/server';

import { buildDemoTripsAndRoutes } from '@/lib/parallax/demo-data';
import { matchVehicleTypesForRoutes } from '@/lib/parallax/depot-utils';
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

    const { updatedRoutes, newVehicleTypes } = matchVehicleTypesForRoutes(
      payload.routes,
      [],
      payload.vehicleTypeMap,
      payload.routeVehicleTypeNames,
    );

    const { record: updatedSession } = saveAndRefreshSessionState(session, {
      trips: payload.trips,
      routes: updatedRoutes,
      depots: payload.depots,
      vehicle_types: newVehicleTypes,
      settings: { is_demo: 1 },
    });

    const state = getSessionState(updatedSession);
    return successResponse(state);
  } catch (err) {
    return handleRouteError(err);
  }
}
