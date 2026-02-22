import * as XLSX from 'xlsx';

import { ApiError } from './errors';
import type { RouteRow, TripRow } from './types';

const DATETIME_REGEX = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/**
 * Normalize date/time strings from various formats into YYYY-MM-DD HH:MM:SS.
 * Handles: M/D/YY H:MM, MM/DD/YYYY HH:MM:SS, M-D-YYYY, and already-correct formats.
 * Also accepts time-only values (H:MM, HH:MM, HH:MM:SS) combined with a fallback date.
 */
function normalizeDateTimeString(value: string | null, fallbackDate?: string | null): string | null {
  if (!value || !value.trim()) {
    return value;
  }
  const trimmed = value.trim();

  // Already in YYYY-MM-DD HH:MM:SS format
  if (DATETIME_REGEX.test(trimmed)) {
    return trimmed;
  }

  // YYYY-MM-DD with optional time but missing seconds (e.g., 2022-04-01 05:00)
  const isoDateTimeMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (isoDateTimeMatch) {
    const datePart = isoDateTimeMatch[1];
    const hours = (isoDateTimeMatch[2] ?? '0').padStart(2, '0');
    const minutes = (isoDateTimeMatch[3] ?? '00').padStart(2, '0');
    const seconds = (isoDateTimeMatch[4] ?? '00').padStart(2, '0');
    return `${datePart} ${hours}:${minutes}:${seconds}`;
  }

  // Already YYYY-MM-DD with no time — append midnight
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed} 00:00:00`;
  }

  // Time-only: H:MM, HH:MM, H:MM:SS, HH:MM:SS — combine with fallback date
  const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeMatch) {
    const hours = timeMatch[1].padStart(2, '0');
    const minutes = timeMatch[2];
    const seconds = timeMatch[3] ?? '00';
    const datePart = extractDatePart(fallbackDate);
    return `${datePart} ${hours}:${minutes}:${seconds}`;
  }

  // Match M/D/YY or M/D/YYYY with optional time (H:MM, HH:MM, HH:MM:SS)
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

  // Already YYYY-MM-DD...
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }

  // M/D/YY or M/D/YYYY
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

const TRIP_REQUIRED_COLUMNS = [
  'trip_id',
  'route_id',
  'scheduled_pickup_time',
  // scheduled_appointment_time is optional – many trips do not have an appointment
  'status',
] as const;

const ROUTE_REQUIRED_COLUMNS = [
  'route_id',
  'scheduled_start_time',
  'scheduled_end_time',
] as const;

type SheetRow = Record<string, unknown>;

function normalizeValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const stringValue = String(value).trim();
  return stringValue.length > 0 ? stringValue : null;
}

function getCellValue(row: SheetRow, key: string): string | null {
  const foundKey = Object.keys(row).find((candidate) => candidate.trim().toLowerCase() === key);
  if (!foundKey) {
    return null;
  }
  return normalizeValue(row[foundKey]);
}

function parseWorkbook(fileBuffer: Buffer): SheetRow[] {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer', raw: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new ApiError(400, 'empty_file', 'Uploaded file has no sheets.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<SheetRow>(worksheet, {
    defval: '',
    raw: false,
  });

  if (rows.length === 0) {
    throw new ApiError(400, 'empty_file', 'Uploaded file has no data rows.');
  }

  return rows;
}

function assertColumnsExist(rows: SheetRow[], expectedColumns: readonly string[], fileLabel: string): void {
  const first = rows[0] ?? {};
  const foundHeaders = Object.keys(first).map((key) => key.trim().toLowerCase());
  const normalizedHeaders = new Set(foundHeaders);

  const missing = expectedColumns.filter((column) => !normalizedHeaders.has(column));
  if (missing.length > 0) {
    throw new ApiError(
      400,
      'missing_columns',
      `${fileLabel} is missing required columns: ${missing.join(', ')}. Found columns: ${foundHeaders.join(', ')}`,
      { missing, found: foundHeaders },
    );
  }
}

function isValidDatetime(value: string | null, required: boolean): boolean {
  if (!value) {
    return !required;
  }
  return DATETIME_REGEX.test(value);
}

function parsePassengerType(value: string | null): TripRow['passenger_type'] {
  if (!value) {
    return 'ambulatory';
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'ambulatory' || normalized === 'wheelchair' || normalized === 'extra_large') {
    return normalized;
  }

  return 'ambulatory';
}

export interface ParseResult<T> {
  rows: T[];
  skipped: Array<{ row: number; reason: string }>;
}

export function parseTripsFile(fileBuffer: Buffer): ParseResult<TripRow> {
  const rows = parseWorkbook(fileBuffer);
  assertColumnsExist(rows, TRIP_REQUIRED_COLUMNS, 'Trip file');

  const trips: TripRow[] = [];
  const skipped: Array<{ row: number; reason: string }> = [];

  for (let index = 0; index < rows.length; index++) {
    const rowIndex = index + 2; // header is row 1
    const row = rows[index];
    const tripId = getCellValue(row, 'trip_id');
    const routeId = getCellValue(row, 'route_id');
    const status = getCellValue(row, 'status');
    const scheduledPickup = getCellValue(row, 'scheduled_pickup_time');
    const scheduledAppointment = getCellValue(row, 'scheduled_appointment_time');

    if (!tripId || !routeId || !status || !scheduledPickup) {
      skipped.push({
        row: rowIndex,
        reason:
          'Missing required fields (trip_id, route_id, status, or scheduled_pickup_time). scheduled_appointment_time is optional.',
      });
      continue;
    }

    const tripDate = getCellValue(row, 'trip_date');
    const normalizedPickup = normalizeDateTimeString(scheduledPickup, tripDate);
    const normalizedAppointment = normalizeDateTimeString(scheduledAppointment, tripDate);
    const normalizedPickupArrive = normalizeDateTimeString(getCellValue(row, 'pickup_arrive_time'), tripDate);
    const normalizedPickupLeave = normalizeDateTimeString(getCellValue(row, 'pickup_leave_time'), tripDate);
    const normalizedDropoffArrive = normalizeDateTimeString(getCellValue(row, 'dropoff_arrive_time'), tripDate);
    const normalizedDropoffLeave = normalizeDateTimeString(getCellValue(row, 'dropoff_leave_time'), tripDate);

    // Only derive trip_date from the explicit trip_date column (no inference from time-of-day)
    const effectiveTripDate = tripDate ? extractDatePart(tripDate) : null;

    if (!isValidDatetime(normalizedPickup, true)) {
      skipped.push({
        row: rowIndex,
        reason: 'Invalid or missing required datetime (scheduled_pickup_time).',
      });
      continue;
    }

    if (
      !isValidDatetime(normalizedPickupArrive, false) ||
      !isValidDatetime(normalizedPickupLeave, false) ||
      !isValidDatetime(normalizedDropoffArrive, false) ||
      !isValidDatetime(normalizedDropoffLeave, false)
    ) {
      skipped.push({ row: rowIndex, reason: 'Invalid datetime format in an optional time field.' });
      continue;
    }

    trips.push({
      trip_id: tripId,
      trip_date: effectiveTripDate,
      scheduled_pickup_time: normalizedPickup!,
      // Appointment time is optional; if absent or invalid, store NULL
      scheduled_appointment_time: normalizedAppointment ?? null,
      pickup_arrive_time: normalizedPickupArrive,
      pickup_leave_time: normalizedPickupLeave,
      dropoff_arrive_time: normalizedDropoffArrive,
      dropoff_leave_time: normalizedDropoffLeave,
      route_id: routeId,
      pickup_address: getCellValue(row, 'pickup_address'),
      pickup_lat: getCellValue(row, 'pickup_lat'),
      pickup_lon: getCellValue(row, 'pickup_lon'),
      dropoff_address: getCellValue(row, 'dropoff_address'),
      dropoff_lat: getCellValue(row, 'dropoff_lat'),
      dropoff_lon: getCellValue(row, 'dropoff_lon'),
      status,
      passenger_type: parsePassengerType(getCellValue(row, 'passenger_type')),
      passenger_count: getCellValue(row, 'passenger_count'),
      pick_odometer: getCellValue(row, 'pick_odometer'),
      drop_odometer: getCellValue(row, 'drop_odometer'),
    });
  }

  return { rows: trips, skipped };
}

export function parseRoutesFile(fileBuffer: Buffer): ParseResult<RouteRow> {
  const rows = parseWorkbook(fileBuffer);
  assertColumnsExist(rows, ROUTE_REQUIRED_COLUMNS, 'Route file');

  const routes: RouteRow[] = [];
  const skipped: Array<{ row: number; reason: string }> = [];

  for (let index = 0; index < rows.length; index++) {
    const rowIndex = index + 2;
    const row = rows[index];
    const routeId = getCellValue(row, 'route_id');
    const scheduledStart = getCellValue(row, 'scheduled_start_time');
    const scheduledEnd = getCellValue(row, 'scheduled_end_time');
    const routeDate = getCellValue(row, 'route_date');

    if (!routeId || !scheduledStart || !scheduledEnd) {
      skipped.push({ row: rowIndex, reason: 'Missing required fields (route_id, scheduled_start_time, or scheduled_end_time).' });
      continue;
    }

    const normalizedStart = normalizeDateTimeString(scheduledStart, routeDate);
    const normalizedEnd = normalizeDateTimeString(scheduledEnd, routeDate);
    const normalizedActualStart = normalizeDateTimeString(getCellValue(row, 'actual_start_time'), routeDate);
    const normalizedActualEnd = normalizeDateTimeString(getCellValue(row, 'actual_end_time'), routeDate);

    // Only derive route_date from the explicit route_date column (no inference from times)
    const effectiveRouteDate = routeDate ? extractDatePart(routeDate) : null;

    if (!isValidDatetime(normalizedStart, true) || !isValidDatetime(normalizedEnd, true)) {
      skipped.push({ row: rowIndex, reason: 'Invalid or missing required datetime (scheduled_start_time or scheduled_end_time).' });
      continue;
    }

    if (!isValidDatetime(normalizedActualStart, false) || !isValidDatetime(normalizedActualEnd, false)) {
      skipped.push({ row: rowIndex, reason: 'Invalid datetime format in an optional time field.' });
      continue;
    }

    routes.push({
      route_id: routeId,
      route_date: effectiveRouteDate,
      route_name: getCellValue(row, 'route_name'),
      scheduled_start_time: normalizedStart!,
      scheduled_end_time: normalizedEnd!,
      actual_start_time: normalizedActualStart,
      actual_end_time: normalizedActualEnd,
      break1: getCellValue(row, 'break1'),
      break2: getCellValue(row, 'break2'),
      depot_address: getCellValue(row, 'depot_address'),
      depot_lat: getCellValue(row, 'depot_lat'),
      depot_lon: getCellValue(row, 'depot_lon'),
      distance_to_first_pick: getCellValue(row, 'distance_to_first_pick'),
      distance_from_last_drop: getCellValue(row, 'distance_from_last_drop'),
    });
  }

  return { rows: routes, skipped };
}
