import * as XLSX from 'xlsx';

import { ApiError } from './errors';
import type {
  ImportApplyResponse,
  ImportMappingConfig,
  ImportPreviewResponse,
  ImportValidateResponse,
  RouteRow,
  TripRow,
} from './types';

const CANONICAL_EVENTS = new Set(['pullout', 'pullin', 'pickup', 'dropoff', 'break', 'other']);

type RawRow = Record<string, unknown>;
type FlatRow = Record<string, string | null>;

const DEFAULT_TRIP_KEYS: Array<keyof TripRow> = ['trip_id', 'route_id', 'scheduled_pickup_time'];
const DEFAULT_ROUTE_KEYS: Array<keyof RouteRow> = ['route_id', 'scheduled_start_time'];

function normalizeValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const stringValue = String(value).trim();
  return stringValue.length > 0 ? stringValue : null;
}

function readRows(fileBuffer: Buffer): RawRow[] {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new ApiError(400, 'empty_file', 'Uploaded file has no sheets.');
  }
  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<RawRow>(worksheet, {
    defval: '',
    raw: false,
  });
  if (rows.length === 0) {
    throw new ApiError(400, 'empty_file', 'Uploaded file has no data rows.');
  }
  return rows;
}

function flattenRow(row: RawRow): FlatRow {
  const out: FlatRow = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = normalizeValue(value);
  }
  return out;
}

function getValueByHeader(row: FlatRow, header: string): string | null {
  for (const [key, value] of Object.entries(row)) {
    if (key.trim().toLowerCase() === header.trim().toLowerCase()) {
      return value;
    }
  }
  return null;
}

function detectHeaders(rows: RawRow[]): string[] {
  const headerSet = new Set<string>();
  for (const row of rows.slice(0, 100)) {
    for (const key of Object.keys(row)) {
      headerSet.add(key);
    }
  }
  return Array.from(headerSet);
}

export function buildImportPreview(fileBuffer: Buffer): ImportPreviewResponse {
  const rows = readRows(fileBuffer);
  const headers = detectHeaders(rows);
  const sampleRows = rows.slice(0, 100).map(flattenRow);
  return {
    headers,
    rows: sampleRows,
    row_count: rows.length,
    sample_count: sampleRows.length,
  };
}

export function validateImportMapping(
  preview: ImportPreviewResponse,
  config: ImportMappingConfig,
): ImportValidateResponse {
  const errors: string[] = [];
  const warnings: string[] = [];
  const headerSet = new Set(preview.headers.map((h) => h.trim().toLowerCase()));

  if (!headerSet.has(config.event_column.trim().toLowerCase())) {
    errors.push(`Event column '${config.event_column}' is not present in the file headers.`);
  }

  const mappedEvents = new Set(Object.values(config.event_values));
  for (const event of mappedEvents) {
    if (!CANONICAL_EVENTS.has(event)) {
      errors.push(`Invalid canonical event '${event}'.`);
    }
  }

  const requiredTripTargets: Array<keyof TripRow> = ['trip_id', 'route_id', 'scheduled_pickup_time'];
  for (const target of requiredTripTargets) {
    if (!config.field_mapping.trip[target]) {
      warnings.push(`Trip target '${target}' is not mapped.`);
    }
  }
  const requiredRouteTargets: Array<keyof RouteRow> = ['route_id'];
  for (const target of requiredRouteTargets) {
    if (!config.field_mapping.route[target]) {
      warnings.push(`Route target '${target}' is not mapped.`);
    }
  }

  const observedCanonicalEvents = new Set<string>();
  for (const row of preview.rows) {
    const rawEvent = getValueByHeader(row, config.event_column) ?? '';
    const mapped = config.event_values[rawEvent] ?? config.event_values[rawEvent.toLowerCase()] ?? 'other';
    observedCanonicalEvents.add(mapped);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      sampled_rows: preview.sample_count,
      event_types_detected: Array.from(observedCanonicalEvents) as ImportValidateResponse['summary']['event_types_detected'],
    },
  };
}

function rowMatchKey(
  row: FlatRow,
  mapping: Partial<Record<string, string>>,
  keys: string[],
): string | null {
  const parts: string[] = [];
  for (const key of keys) {
    const sourceCol = mapping[key];
    if (!sourceCol) {
      return null;
    }
    const value = getValueByHeader(row, sourceCol);
    if (!value) {
      return null;
    }
    parts.push(value);
  }
  return parts.join('|');
}

function buildLookupByKeys<T extends Record<string, string | null>>(
  rows: T[],
  keys: string[],
): Map<string, T> {
  const lookup = new Map<string, T>();
  for (const row of rows) {
    const parts = keys.map((key) => row[key] ?? '');
    if (parts.some((part) => !part)) {
      continue;
    }
    lookup.set(parts.join('|'), row);
  }
  return lookup;
}

function coerceTripDefaults(value: Partial<TripRow>): TripRow {
  return {
    trip_id: value.trip_id ?? '',
    scheduled_pickup_time: value.scheduled_pickup_time ?? '1970-01-01 00:00:00',
    scheduled_appointment_time: value.scheduled_appointment_time ?? '1970-01-01 00:00:00',
    pickup_arrive_time: value.pickup_arrive_time ?? null,
    pickup_leave_time: value.pickup_leave_time ?? null,
    dropoff_arrive_time: value.dropoff_arrive_time ?? null,
    dropoff_leave_time: value.dropoff_leave_time ?? null,
    route_id: value.route_id ?? '',
    pickup_address: value.pickup_address ?? null,
    pickup_lat: value.pickup_lat ?? null,
    pickup_lon: value.pickup_lon ?? null,
    dropoff_address: value.dropoff_address ?? null,
    dropoff_lat: value.dropoff_lat ?? null,
    dropoff_lon: value.dropoff_lon ?? null,
    status: value.status ?? 'scheduled',
    passenger_type: value.passenger_type ?? 'ambulatory',
    passenger_count: value.passenger_count ?? null,
    pick_odometer: value.pick_odometer ?? null,
    drop_odometer: value.drop_odometer ?? null,
  };
}

function coerceRouteDefaults(value: Partial<RouteRow>): RouteRow {
  return {
    route_id: value.route_id ?? '',
    scheduled_start_time: value.scheduled_start_time ?? '1970-01-01 00:00:00',
    scheduled_end_time: value.scheduled_end_time ?? '1970-01-01 00:00:00',
    actual_start_time: value.actual_start_time ?? null,
    actual_end_time: value.actual_end_time ?? null,
  };
}

export function applyImportMapping(params: {
  fileBuffer: Buffer;
  config: ImportMappingConfig;
  existingTrips: TripRow[];
  existingRoutes: RouteRow[];
}): {
  trips: TripRow[];
  routes: RouteRow[];
  result: ImportApplyResponse;
} {
  const rows = readRows(params.fileBuffer).map(flattenRow);
  const tripKeys = (params.config.match_rules.trip_keys.length > 0
    ? params.config.match_rules.trip_keys
    : DEFAULT_TRIP_KEYS) as string[];
  const routeKeys = (params.config.match_rules.route_keys.length > 0
    ? params.config.match_rules.route_keys
    : DEFAULT_ROUTE_KEYS) as string[];

  const nextTrips = [...params.existingTrips];
  const nextRoutes = [...params.existingRoutes];

  const tripLookup = buildLookupByKeys(nextTrips, tripKeys);
  const routeLookup = buildLookupByKeys(nextRoutes, routeKeys);

  let createdTrips = 0;
  let updatedTrips = 0;
  let createdRoutes = 0;
  let updatedRoutes = 0;
  let skippedRows = 0;
  const errors: Array<{ row: number; reason: string }> = [];

  for (let index = 0; index < rows.length; index += 1) {
    const rowNumber = index + 2;
    const row = rows[index];

    const rawEvent = getValueByHeader(row, params.config.event_column) ?? '';
    const canonicalEvent =
      params.config.event_values[rawEvent] ?? params.config.event_values[rawEvent.toLowerCase()] ?? 'other';

    const tripPartial: Partial<TripRow> = {};
    const routePartial: Partial<RouteRow> = {};
    for (const [target, source] of Object.entries(params.config.field_mapping.trip)) {
      if (!source) continue;
      (tripPartial as Record<string, string | null>)[target] = getValueByHeader(row, source);
    }
    for (const [target, source] of Object.entries(params.config.field_mapping.route)) {
      if (!source) continue;
      (routePartial as Record<string, string | null>)[target] = getValueByHeader(row, source);
    }

    const appliesTrip = canonicalEvent === 'pickup' || canonicalEvent === 'dropoff' || canonicalEvent === 'other';
    const appliesRoute = canonicalEvent === 'pullout' || canonicalEvent === 'pullin' || canonicalEvent === 'break' || canonicalEvent === 'other';

    let rowUsed = false;

    if (appliesTrip) {
      const key = rowMatchKey(row, params.config.field_mapping.trip as Record<string, string>, tripKeys);
      const existing = key ? tripLookup.get(key) : undefined;
      if (existing) {
        Object.assign(existing, tripPartial);
        updatedTrips += 1;
        rowUsed = true;
      } else if (params.config.match_rules.create_missing_trip) {
        const created = coerceTripDefaults(tripPartial);
        if (!created.trip_id || !created.route_id) {
          errors.push({ row: rowNumber, reason: 'Trip create is missing required trip_id/route_id.' });
        } else {
          nextTrips.push(created);
          createdTrips += 1;
          rowUsed = true;
        }
      }
    }

    if (appliesRoute) {
      const key = rowMatchKey(row, params.config.field_mapping.route as Record<string, string>, routeKeys);
      const existing = key ? routeLookup.get(key) : undefined;
      if (existing) {
        Object.assign(existing, routePartial);
        updatedRoutes += 1;
        rowUsed = true;
      } else if (params.config.match_rules.create_missing_route) {
        const created = coerceRouteDefaults(routePartial);
        if (!created.route_id) {
          errors.push({ row: rowNumber, reason: 'Route create is missing required route_id.' });
        } else {
          nextRoutes.push(created);
          createdRoutes += 1;
          rowUsed = true;
        }
      }
    }

    if (!rowUsed) {
      skippedRows += 1;
    }
  }

  return {
    trips: nextTrips,
    routes: nextRoutes,
    result: {
      imported: true,
      summary: {
        processed_rows: rows.length,
        created_trips: createdTrips,
        updated_trips: updatedTrips,
        created_routes: createdRoutes,
        updated_routes: updatedRoutes,
        skipped_rows: skippedRows,
        errors: errors.length,
      },
      errors,
    },
  };
}
