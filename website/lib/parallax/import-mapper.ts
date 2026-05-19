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

const DEFAULT_TRIP_GROUPING_KEYS: Array<keyof TripRow> = ['trip_date', 'route_id'];
const DEFAULT_TRIP_JOIN_COLUMNS: Array<{ trip_field: keyof TripRow; route_field: keyof RouteRow }> = [
  { trip_field: 'trip_date', route_field: 'route_date' },
  { trip_field: 'route_id', route_field: 'route_id' },
];

function normalizeValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const stringValue = String(value).trim();
  return stringValue.length > 0 ? stringValue : null;
}

const DATE_TIME_FIELDS = new Set<string>([
  'trip_date',
  'scheduled_pickup_time',
  'scheduled_appointment_time',
  'pickup_arrive_time',
  'pickup_leave_time',
  'dropoff_arrive_time',
  'dropoff_leave_time',
  'route_date',
  'scheduled_start_time',
  'scheduled_end_time',
  'actual_start_time',
  'actual_end_time',
]);

const DATE_ONLY_FIELDS = new Set<string>(['trip_date', 'route_date']);

/**
 * Normalize date/time strings from various formats into YYYY-MM-DD HH:MM:SS.
 * Handles: M/D/YY H:MM, MM/DD/YYYY HH:MM:SS, M-D-YYYY, and already-correct formats.
 * Also accepts time-only values (H:MM, HH:MM, HH:MM:SS) combined with a fallback date.
 * For date-only fields, returns YYYY-MM-DD.
 */
function normalizeDateTimeString(value: string | null, dateOnly: boolean, fallbackDate?: string | null): string | null {
  if (!value || !value.trim()) {
    return value;
  }
  const trimmed = value.trim();

  // Already in YYYY-MM-DD format — pass through
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    if (dateOnly) {
      return trimmed.slice(0, 10);
    }
    // Ensure time portion exists
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return `${trimmed} 00:00:00`;
    }
    return trimmed;
  }

  // YYYY-MM-DD with optional time but missing seconds (e.g., 2022-04-01 05:00)
  if (!dateOnly) {
    const isoDateTimeMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (isoDateTimeMatch) {
      const datePart = isoDateTimeMatch[1];
      const hours = (isoDateTimeMatch[2] ?? '0').padStart(2, '0');
      const minutes = (isoDateTimeMatch[3] ?? '00').padStart(2, '0');
      const seconds = (isoDateTimeMatch[4] ?? '00').padStart(2, '0');
      return `${datePart} ${hours}:${minutes}:${seconds}`;
    }
  }

  // Time-only: H:MM, HH:MM, H:MM:SS, HH:MM:SS — combine with fallback date
  if (!dateOnly) {
    const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (timeMatch) {
      const hours = timeMatch[1].padStart(2, '0');
      const minutes = timeMatch[2];
      const seconds = timeMatch[3] ?? '00';
      const datePart = extractDatePart(fallbackDate);
      return `${datePart} ${hours}:${minutes}:${seconds}`;
    }
  }

  // Match M/D/YY or M/D/YYYY with optional time (H:MM, HH:MM, HH:MM:SS, H:MM:SS)
  // Also handles M-D-YY and M-D-YYYY variants
  const match = trimmed.match(
    /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (!match) {
    return value;
  }

  const month = match[1].padStart(2, '0');
  const day = match[2].padStart(2, '0');
  let yearStr = match[3];
  if (yearStr.length === 2) {
    const twoDigit = parseInt(yearStr, 10);
    yearStr = twoDigit >= 70 ? `19${yearStr}` : `20${yearStr}`;
  }
  const year = yearStr.padStart(4, '0');

  if (dateOnly) {
    return `${year}-${month}-${day}`;
  }

  const hours = (match[4] ?? '0').padStart(2, '0');
  const minutes = (match[5] ?? '00').padStart(2, '0');
  const seconds = (match[6] ?? '00').padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Extract a YYYY-MM-DD date string from a value that may itself be in various formats.
 * Falls back to 1970-01-01 if no date can be determined.
 */
function extractDatePart(value: string | null | undefined): string {
  if (!value || !value.trim()) {
    return '1970-01-01';
  }
  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }

  const match = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (match) {
    const month = match[1].padStart(2, '0');
    const day = match[2].padStart(2, '0');
    let yearStr = match[3];
    if (yearStr.length === 2) {
      const twoDigit = parseInt(yearStr, 10);
      yearStr = twoDigit >= 70 ? `19${yearStr}` : `20${yearStr}`;
    }
    return `${yearStr.padStart(4, '0')}-${month}-${day}`;
  }

  return '1970-01-01';
}

function readRows(
  fileBuffer: Buffer,
  selectedSheetName?: string,
): { rows: RawRow[]; sheetNames: string[]; selectedSheet: string } {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer', raw: true });
  const sheetNames = workbook.SheetNames;
  const firstSheetName = sheetNames[0];
  if (!firstSheetName || sheetNames.length === 0) {
    throw new ApiError(400, 'empty_file', 'Uploaded file has no sheets.');
  }
  const selectedSheet = selectedSheetName?.trim() || firstSheetName;
  if (!sheetNames.includes(selectedSheet)) {
    throw new ApiError(400, 'invalid_sheet', `Sheet '${selectedSheet}' is not present in the uploaded file.`);
  }

  const worksheet = workbook.Sheets[selectedSheet];
  const rows = XLSX.utils.sheet_to_json<RawRow>(worksheet, {
    defval: '',
    raw: false,
  });
  if (rows.length === 0) {
    throw new ApiError(400, 'empty_file', `Sheet '${selectedSheet}' has no data rows.`);
  }
  return { rows, sheetNames, selectedSheet };
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

export function buildImportPreview(fileBuffer: Buffer, selectedSheetName?: string): ImportPreviewResponse {
  const { rows, sheetNames, selectedSheet } = readRows(fileBuffer, selectedSheetName);
  const headers = detectHeaders(rows);
  const sampleRows = rows.slice(0, 100).map(flattenRow);
  return {
    headers,
    rows: sampleRows,
    row_count: rows.length,
    sample_count: sampleRows.length,
    sheet_names: sheetNames,
    selected_sheet: selectedSheet,
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

  const tripGrouping = resolveTripGrouping(config.match_rules.trip_grouping);
  if (tripGrouping.keys.length === 0) {
    errors.push('Trip grouping must include at least one key.');
  }
  if (!tripGrouping.pickupKeyField || !tripGrouping.dropoffKeyField) {
    errors.push('Trip grouping requires pickup and dropoff key fields.');
  }

  const tripRouteJoin = resolveTripRouteJoin(config.match_rules.trip_route_join);
  if (tripRouteJoin.joinColumns.length === 0) {
    errors.push('Trip-route join must include at least one join column.');
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

function existingRowKey<T extends object>(row: T, keys: string[]): string | null {
  const rowMap = row as Record<string, string | null | undefined>;
  const parts: string[] = [];
  for (const key of keys) {
    const value = rowMap[key];
    if (!value) {
      return null;
    }
    parts.push(value);
  }
  return parts.join('|');
}

function pickDateFromDateTime(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, 10);
}

function resolveTripGrouping(config: ImportMappingConfig['match_rules']['trip_grouping']) {
  const safeConfig = config ?? {
    keys: DEFAULT_TRIP_GROUPING_KEYS,
    pickup_key_field: 'trip_id',
    dropoff_key_field: 'trip_id',
  };
  return {
    keys: safeConfig.keys.length > 0 ? safeConfig.keys : DEFAULT_TRIP_GROUPING_KEYS,
    pickupKeyField: safeConfig.pickup_key_field,
    dropoffKeyField: safeConfig.dropoff_key_field,
  };
}

function resolveTripRouteJoin(config: ImportMappingConfig['match_rules']['trip_route_join']) {
  const safeConfig = config ?? {
    join_columns: DEFAULT_TRIP_JOIN_COLUMNS,
  };
  return {
    joinColumns: safeConfig.join_columns.length > 0 ? safeConfig.join_columns : DEFAULT_TRIP_JOIN_COLUMNS,
  };
}

function findExistingByKey<T extends object>(
  rows: T[],
  keys: string[],
  incomingKey: string | null,
): T | undefined {
  if (!incomingKey) {
    return undefined;
  }
  return rows.find((row) => existingRowKey(row, keys) === incomingKey);
}

function incrementDateCount(bucket: Map<string, number>, value: string | null | undefined): void {
  const key = value && value.trim().length > 0 ? value.trim() : '(no date)';
  bucket.set(key, (bucket.get(key) ?? 0) + 1);
}

function dateCountList(bucket: Map<string, number>): Array<{ date: string; count: number }> {
  return Array.from(bucket.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function mergeNonNullFields<T extends object>(target: T, patch: Partial<T>): void {
  for (const [key, value] of Object.entries(patch) as Array<[keyof T, T[keyof T] | undefined]>) {
    if (value !== null && value !== undefined) {
      target[key] = value;
    }
  }
}

function normalizeRouteIdPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function deriveRouteIdFromPartials(
  tripPartial: Partial<TripRow>,
  routePartial: Partial<RouteRow>,
): string | null {
  const explicitRouteId = (routePartial.route_id ?? tripPartial.route_id ?? '').trim();
  if (explicitRouteId) {
    return explicitRouteId;
  }

  const candidateDate =
    (routePartial.route_date ?? tripPartial.trip_date ?? '').trim() ||
    pickDateFromDateTime(routePartial.scheduled_start_time) ||
    pickDateFromDateTime(tripPartial.scheduled_pickup_time);
  const candidateName = (routePartial.route_name ?? '').trim();
  const normalizedName = candidateName ? normalizeRouteIdPart(candidateName) : '';

  if (candidateDate && normalizedName) {
    return `${candidateDate}__${normalizedName}`;
  }
  if (normalizedName) {
    return normalizedName;
  }

  return null;
}

function coerceTripDefaults(value: Partial<TripRow>): TripRow {
  const resolvedPickup = value.scheduled_pickup_time ?? '1970-01-01 00:00:00';
  return {
    trip_id: value.trip_id ?? '',
    trip_date: value.trip_date ?? pickDateFromDateTime(resolvedPickup) ?? null,
    scheduled_pickup_time: resolvedPickup,
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
    zone: value.zone ?? null,
  };
}

function coerceRouteDefaults(value: Partial<RouteRow>): RouteRow {
  const resolvedStart = value.scheduled_start_time ?? '1970-01-01 00:00:00';
  return {
    route_id: value.route_id ?? '',
    route_date: value.route_date ?? pickDateFromDateTime(resolvedStart) ?? null,
    route_name: value.route_name ?? null,
    scheduled_start_time: resolvedStart,
    scheduled_end_time: value.scheduled_end_time ?? '1970-01-01 00:00:00',
    actual_start_time: value.actual_start_time ?? null,
    actual_end_time: value.actual_end_time ?? null,
    break1_start: value.break1_start ?? null,
    break1_end: value.break1_end ?? null,
    break2_start: value.break2_start ?? null,
    break2_end: value.break2_end ?? null,
    depot_address: value.depot_address ?? null,
    depot_lat: value.depot_lat ?? null,
    depot_lon: value.depot_lon ?? null,
    distance_to_first_pick: value.distance_to_first_pick ?? null,
    distance_from_last_drop: value.distance_from_last_drop ?? null,
    zone: value.zone ?? null,
  };
}

export function applyImportMapping(params: {
  fileBuffer: Buffer;
  config: ImportMappingConfig;
  selectedSheetName?: string;
  existingTrips: TripRow[];
  existingRoutes: RouteRow[];
}): {
  trips: TripRow[];
  routes: RouteRow[];
  result: ImportApplyResponse;
} {
  const rows = readRows(params.fileBuffer, params.selectedSheetName).rows.map(flattenRow);
  const tripGrouping = resolveTripGrouping(params.config.match_rules.trip_grouping);
  const tripJoin = resolveTripRouteJoin(params.config.match_rules.trip_route_join);

  const nextTrips = [...params.existingTrips];
  const nextRoutes = [...params.existingRoutes];

  let createdTrips = 0;
  let updatedTrips = 0;
  let createdRoutes = 0;
  let updatedRoutes = 0;
  let skippedRows = 0;
  const errors: Array<{ row: number; reason: string }> = [];
  const insertedTripDates = new Map<string, number>();
  const insertedRouteDates = new Map<string, number>();

  for (let index = 0; index < rows.length; index += 1) {
    const rowNumber = index + 2;
    const row = rows[index];

    const rawEvent = getValueByHeader(row, params.config.event_column) ?? '';
    const canonicalEvent =
      params.config.event_values[rawEvent] ?? params.config.event_values[rawEvent.toLowerCase()] ?? 'other';

    const tripPartial: Partial<TripRow> = {};
    const routePartial: Partial<RouteRow> = {};

    // First pass: extract date fields so they can serve as fallback for time-only values
    const tripDateSource = params.config.field_mapping.trip['trip_date'];
    const rawTripDate = tripDateSource ? getValueByHeader(row, tripDateSource) : null;
    const routeDateSource = params.config.field_mapping.route['route_date'];
    const rawRouteDate = routeDateSource ? getValueByHeader(row, routeDateSource) : null;

    for (const [target, source] of Object.entries(params.config.field_mapping.trip)) {
      if (!source) continue;
      let value = getValueByHeader(row, source);
      if (value && DATE_TIME_FIELDS.has(target)) {
        value = normalizeDateTimeString(value, DATE_ONLY_FIELDS.has(target), rawTripDate);
      }
      (tripPartial as Record<string, string | null>)[target] = value;
    }
    for (const [target, source] of Object.entries(params.config.field_mapping.route)) {
      if (!source) continue;
      let value = getValueByHeader(row, source);
      if (value && DATE_TIME_FIELDS.has(target)) {
        value = normalizeDateTimeString(value, DATE_ONLY_FIELDS.has(target), rawRouteDate ?? rawTripDate);
      }
      (routePartial as Record<string, string | null>)[target] = value;
    }
    const derivedRouteId = deriveRouteIdFromPartials(tripPartial, routePartial);
    if (derivedRouteId) {
      if (!tripPartial.route_id) {
        tripPartial.route_id = derivedRouteId;
      }
      if (!routePartial.route_id) {
        routePartial.route_id = derivedRouteId;
      }
    }

    const appliesTrip = canonicalEvent === 'pickup' || canonicalEvent === 'dropoff' || canonicalEvent === 'other';
    const appliesRoute = canonicalEvent === 'pullout' || canonicalEvent === 'pullin' || canonicalEvent === 'break' || canonicalEvent === 'other';

    let rowUsed = false;

    if (appliesTrip) {
      const eventSpecificKey =
        canonicalEvent === 'pickup'
          ? tripGrouping.pickupKeyField
          : canonicalEvent === 'dropoff'
            ? tripGrouping.dropoffKeyField
            : null;
      const effectiveTripKeys = Array.from(
        new Set([...(tripGrouping.keys as string[]), ...(eventSpecificKey ? [eventSpecificKey] : [])]),
      );
      const key = rowMatchKey(row, params.config.field_mapping.trip as Record<string, string>, effectiveTripKeys);
      const existing = findExistingByKey(
        nextTrips,
        effectiveTripKeys,
        key,
      );
      if (existing) {
        mergeNonNullFields(existing, tripPartial);
        updatedTrips += 1;
        rowUsed = true;
      } else {
        const created = coerceTripDefaults(tripPartial);
        if (!created.trip_id || !created.route_id) {
          errors.push({ row: rowNumber, reason: 'Trip create is missing required trip_id/route_id.' });
        } else {
          nextTrips.push(created);
          incrementDateCount(insertedTripDates, created.trip_date);
          createdTrips += 1;
          rowUsed = true;
        }
      }
    }

    if (appliesRoute) {
      const routeId = (routePartial.route_id ?? tripPartial.route_id ?? '').trim();
      const existing = routeId
        ? nextRoutes.find((route) => (route.route_id ?? '').trim() === routeId)
        : undefined;
      if (existing) {
        if (!routePartial.route_id && routeId) {
          routePartial.route_id = routeId;
        }
        mergeNonNullFields(existing, routePartial);
        updatedRoutes += 1;
        rowUsed = true;
      } else {
        if (!routePartial.route_id && routeId) {
          routePartial.route_id = routeId;
        }
        const created = coerceRouteDefaults(routePartial);
        if (!created.route_id) {
          errors.push({ row: rowNumber, reason: 'Route create is missing required route_id.' });
        } else {
          nextRoutes.push(created);
          incrementDateCount(insertedRouteDates, created.route_date);
          createdRoutes += 1;
          rowUsed = true;
        }
      }
    }

    if (!rowUsed) {
      skippedRows += 1;
      errors.push({
        row: rowNumber,
        reason:
          'Row skipped: did not contribute to any trip or route. Check event mapping, key fields, and required identifiers.',
      });
    }
  }

  // Collect all valid route IDs (existing + newly created)
  const validRouteIds = new Set(nextRoutes.map((route) => route.route_id.trim()));

  // Filter out newly-created trips whose route was skipped/missing.
  // Preserve existing trips (they were already in the DB with their route).
  const existingTripIds = new Set(params.existingTrips.map((trip) => trip.trip_id));
  const filteredTrips: TripRow[] = [];
  let removedTripCount = 0;
  for (const trip of nextTrips) {
    if (existingTripIds.has(trip.trip_id) || validRouteIds.has(trip.route_id.trim())) {
      filteredTrips.push(trip);
    } else {
      removedTripCount += 1;
    }
  }
  if (removedTripCount > 0) {
    errors.push({ row: 0, reason: `${removedTripCount} trip(s) removed because their route_id had no matching route.` });
    skippedRows += removedTripCount;
    createdTrips -= removedTripCount;
  }

  return {
    trips: filteredTrips,
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
      inserted_by_date: {
        trips: dateCountList(insertedTripDates),
        routes: dateCountList(insertedRouteDates),
      },
    },
  };
}
