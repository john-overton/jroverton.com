import type { NextRequest } from 'next/server';

import { matchVehicleTypesForRoutes } from '@/lib/parallax/depot-utils';
import { ApiError, handleRouteError, successResponse } from '@/lib/parallax/errors';
import {
  assertValidTokenParam,
  requireAuthorizedSessionAccess,
  requireSessionByEditToken,
} from '@/lib/parallax/http';
import { parseRoutesFile } from '@/lib/parallax/import-validators';
import { updateSessionCounts } from '@/lib/parallax/registry-db';
import { countRoutes, countTrips, listVehicleTypes, recalculateServiceWindow, replaceRoutes, saveSessionState } from '@/lib/parallax/session-db';

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
    const { rows: routes, skipped, vehicleTypeMap, routeVehicleTypeNames } = parseRoutesFile(fileBuffer);

    const existingVehicleTypes = listVehicleTypes(token);
    const { updatedRoutes, newVehicleTypes } = matchVehicleTypesForRoutes(
      routes,
      existingVehicleTypes,
      vehicleTypeMap,
      routeVehicleTypeNames,
    );

    if (newVehicleTypes.length > 0) {
      saveSessionState(token, { vehicle_types: [...existingVehicleTypes, ...newVehicleTypes] });
    }

    replaceRoutes(token, updatedRoutes);
    saveSessionState(token, { settings: { is_demo: 0 } });
    recalculateServiceWindow(token);

    const tripCount = countTrips(token);
    const routeCount = countRoutes(token);
    updateSessionCounts(token, tripCount, routeCount);

    return successResponse({
      imported: true,
      type: 'routes',
      trip_count: tripCount,
      route_count: routeCount,
      skipped_rows: skipped,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
