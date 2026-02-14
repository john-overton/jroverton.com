import type { NextRequest } from 'next/server';

import { ApiError, handleRouteError, successResponse } from '@/lib/clearcut/errors';
import {
  assertValidTokenParam,
  requireAuthorizedSessionAccess,
  requireSessionByEditToken,
} from '@/lib/clearcut/http';
import { applyImportMapping } from '@/lib/clearcut/import-mapper';
import { updateSessionCounts } from '@/lib/clearcut/registry-db';
import { countRoutes, countTrips, listRoutes, listTrips, replaceRoutes, replaceTrips } from '@/lib/clearcut/session-db';
import type { ImportMappingConfig } from '@/lib/clearcut/types';

export const runtime = 'nodejs';

async function readApplyPayload(
  request: NextRequest,
): Promise<{ fileBuffer: Buffer; config: ImportMappingConfig }> {
  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    throw new ApiError(400, 'missing_file', 'Multipart form must include a file field named `file`.');
  }
  const configRaw = formData.get('config');
  if (typeof configRaw !== 'string') {
    throw new ApiError(400, 'missing_config', 'Multipart form must include config as JSON string.');
  }
  const config = JSON.parse(configRaw) as ImportMappingConfig;
  return {
    fileBuffer: Buffer.from(await file.arrayBuffer()),
    config,
  };
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

    const { fileBuffer, config } = await readApplyPayload(request);
    const existingTrips = listTrips(token);
    const existingRoutes = listRoutes(token);
    const applied = applyImportMapping({
      fileBuffer,
      config,
      existingTrips,
      existingRoutes,
    });

    replaceTrips(token, applied.trips);
    replaceRoutes(token, applied.routes);

    const tripCount = countTrips(token);
    const routeCount = countRoutes(token);
    updateSessionCounts(token, tripCount, routeCount);

    return successResponse({
      ...applied.result,
      trip_count: tripCount,
      route_count: routeCount,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
