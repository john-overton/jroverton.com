import type { NextRequest } from 'next/server';

import { ApiError, handleRouteError, successResponse } from '@/lib/parallax/errors';
import {
  assertValidTokenParam,
  requireAuthorizedSessionAccess,
  requireSessionByEditToken,
} from '@/lib/parallax/http';
import { applyImportMapping } from '@/lib/parallax/import-mapper';
import { updateSessionCounts } from '@/lib/parallax/registry-db';
import { countRoutes, countTrips, listRoutes, listTrips, recalculateServiceWindow, replaceRoutes, replaceTrips } from '@/lib/parallax/session-db';
import type { ImportMappingConfig } from '@/lib/parallax/types';

export const runtime = 'nodejs';

async function readApplyPayload(
  request: NextRequest,
): Promise<{ fileBuffer: Buffer; config: ImportMappingConfig; selectedSheetName?: string }> {
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
  const sheetNameRaw = formData.get('sheet_name');
  const selectedSheetName = typeof sheetNameRaw === 'string' && sheetNameRaw.trim() ? sheetNameRaw : undefined;
  return {
    fileBuffer: Buffer.from(await file.arrayBuffer()),
    config,
    selectedSheetName,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const startedAt = Date.now();
  let stage = 'init';
  let tokenForLog = '';
  try {
    const { token } = await params;
    tokenForLog = token;
    stage = 'validate_token';
    assertValidTokenParam(token);
    stage = 'authorize_session';
    const session = requireSessionByEditToken(token);
    requireAuthorizedSessionAccess(request, session, 'edit');

    stage = 'read_payload';
    const { fileBuffer, config, selectedSheetName } = await readApplyPayload(request);
    console.info('[clearcut.import.apply] request_received', {
      token,
      file_size_bytes: fileBuffer.byteLength,
      selected_sheet_name: selectedSheetName ?? null,
      event_column: config.event_column,
      trip_field_mappings: Object.keys(config.field_mapping.trip ?? {}).length,
      route_field_mappings: Object.keys(config.field_mapping.route ?? {}).length,
      trip_grouping_keys: config.match_rules?.trip_grouping?.keys ?? [],
      trip_route_join_columns: config.match_rules?.trip_route_join?.join_columns ?? [],
    });

    stage = 'read_existing_rows';
    const existingTrips = listTrips(token);
    const existingRoutes = listRoutes(token);
    console.info('[clearcut.import.apply] existing_counts', {
      token,
      existing_trips: existingTrips.length,
      existing_routes: existingRoutes.length,
    });

    stage = 'apply_mapping';
    const applied = applyImportMapping({
      fileBuffer,
      config,
      selectedSheetName,
      existingTrips,
      existingRoutes,
    });
    console.info('[clearcut.import.apply] mapping_result', {
      token,
      processed_rows: applied.result.summary.processed_rows,
      created_trips: applied.result.summary.created_trips,
      updated_trips: applied.result.summary.updated_trips,
      created_routes: applied.result.summary.created_routes,
      updated_routes: applied.result.summary.updated_routes,
      skipped_rows: applied.result.summary.skipped_rows,
      errors: applied.result.summary.errors,
    });

    stage = 'replace_trips';
    replaceTrips(token, applied.trips);
    stage = 'replace_routes';
    replaceRoutes(token, applied.routes);
    stage = 'recalculate_settings';
    recalculateServiceWindow(token);

    stage = 'count_rows';
    const tripCount = countTrips(token);
    const routeCount = countRoutes(token);
    stage = 'update_registry';
    updateSessionCounts(token, tripCount, routeCount);
    console.info('[clearcut.import.apply] completed', {
      token,
      trip_count: tripCount,
      route_count: routeCount,
      elapsed_ms: Date.now() - startedAt,
    });

    return successResponse({
      ...applied.result,
      trip_count: tripCount,
      route_count: routeCount,
    });
  } catch (err) {
    const errorObject = err instanceof Error
      ? {
          name: err.name,
          message: err.message,
          stack: err.stack,
        }
      : { value: String(err) };
    console.error('[clearcut.import.apply] failed', {
      token: tokenForLog || '(unknown)',
      stage,
      elapsed_ms: Date.now() - startedAt,
      error: errorObject,
    });
    return handleRouteError(err);
  }
}
