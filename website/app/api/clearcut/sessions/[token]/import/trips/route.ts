import type { NextRequest } from 'next/server';

import { ApiError, handleRouteError, successResponse } from '@/lib/clearcut/errors';
import {
  assertValidTokenParam,
  requireAuthorizedSessionAccess,
  requireSessionByEditToken,
} from '@/lib/clearcut/http';
import { parseTripsFile } from '@/lib/clearcut/import-validators';
import { updateSessionCounts } from '@/lib/clearcut/registry-db';
import { countRoutes, countTrips, replaceTrips } from '@/lib/clearcut/session-db';

export const runtime = 'nodejs';

async function readUploadedFile(request: NextRequest): Promise<Buffer> {
  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    throw new ApiError(400, 'missing_file', 'Multipart form must include a file field named `file`.');
  }
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    assertValidTokenParam(token);
    const session = requireSessionByEditToken(token);
    requireAuthorizedSessionAccess(request, session, 'edit');

    const fileBuffer = await readUploadedFile(request);
    const trips = parseTripsFile(fileBuffer);
    replaceTrips(token, trips);

    const tripCount = countTrips(token);
    const routeCount = countRoutes(token);
    updateSessionCounts(token, tripCount, routeCount);

    return successResponse({
      imported: true,
      type: 'trips',
      trip_count: tripCount,
      route_count: routeCount,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
