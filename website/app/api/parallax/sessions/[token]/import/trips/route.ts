import type { NextRequest } from 'next/server';

import { handleRouteError, successResponse } from '@/lib/parallax/errors';
import {
  assertValidTokenParam,
  requireAuthorizedSessionAccess,
  requireSessionByEditToken,
} from '@/lib/parallax/http';
import { readUploadedFile } from '@/lib/parallax/import-upload';
import { parseTripsFile } from '@/lib/parallax/import-validators';
import { updateSessionCounts } from '@/lib/parallax/registry-db';
import { countRoutes, countTrips, recalculateServiceWindow, replaceTrips, saveSessionState } from '@/lib/parallax/session-db';

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

    const { fileBuffer } = await readUploadedFile(request);
    const { rows: trips, skipped } = parseTripsFile(fileBuffer);
    replaceTrips(token, trips);
    saveSessionState(token, { settings: { is_demo: 0 } });
    recalculateServiceWindow(token);

    const tripCount = countTrips(token);
    const routeCount = countRoutes(token);
    updateSessionCounts(token, tripCount, routeCount);

    return successResponse({
      imported: true,
      type: 'trips',
      trip_count: tripCount,
      route_count: routeCount,
      skipped_rows: skipped,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
