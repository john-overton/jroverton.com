import * as XLSX from 'xlsx';

import { ApiError } from './errors';
import type { RouteRow, TripRow } from './types';

const DATETIME_REGEX = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

const TRIP_REQUIRED_COLUMNS = [
  'trip_id',
  'scheduled_pickup_time',
  'scheduled_appointment_time',
  'pickup_arrive_time',
  'pickup_leave_time',
  'dropoff_arrive_time',
  'dropoff_leave_time',
  'route_id',
  'pickup_address',
  'pickup_lat',
  'pickup_lon',
  'dropoff_address',
  'dropoff_lat',
  'dropoff_lon',
  'status',
  'passenger_count',
  'pick_odometer',
  'drop_odometer',
] as const;

const ROUTE_REQUIRED_COLUMNS = [
  'route_id',
  'scheduled_start_time',
  'scheduled_end_time',
  'actual_start_time',
  'actual_end_time',
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
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
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

function assertColumnsExist(rows: SheetRow[], expectedColumns: readonly string[]): void {
  const first = rows[0] ?? {};
  const normalizedHeaders = new Set(
    Object.keys(first).map((key) => key.trim().toLowerCase()),
  );

  const missing = expectedColumns.filter((column) => !normalizedHeaders.has(column));
  if (missing.length > 0) {
    throw new ApiError(400, 'missing_columns', 'Uploaded file is missing required columns.', {
      missing,
    });
  }
}

function validateDatetime(value: string | null, field: string, rowIndex: number, required: boolean): void {
  if (!value) {
    if (required) {
      throw new ApiError(400, 'invalid_datetime', `Missing required datetime '${field}' at row ${rowIndex}.`);
    }
    return;
  }

  if (!DATETIME_REGEX.test(value)) {
    throw new ApiError(
      400,
      'invalid_datetime',
      `Invalid datetime for '${field}' at row ${rowIndex}. Expected YYYY-MM-DD HH:MM:SS.`,
    );
  }
}

function parsePassengerType(value: string | null): TripRow['passenger_type'] {
  if (!value) {
    return 'ambulatory';
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'ambulatory' || normalized === 'wheelchair' || normalized === 'extra_large') {
    return normalized;
  }

  throw new ApiError(
    400,
    'invalid_passenger_type',
    "passenger_type must be one of 'ambulatory', 'wheelchair', or 'extra_large'.",
  );
}

export function parseTripsFile(fileBuffer: Buffer): TripRow[] {
  const rows = parseWorkbook(fileBuffer);
  assertColumnsExist(rows, TRIP_REQUIRED_COLUMNS);

  const trips = rows.map((row, index) => {
    const rowIndex = index + 2; // header is row 1
    const tripId = getCellValue(row, 'trip_id');
    const routeId = getCellValue(row, 'route_id');
    const status = getCellValue(row, 'status');
    const scheduledPickup = getCellValue(row, 'scheduled_pickup_time');
    const scheduledAppointment = getCellValue(row, 'scheduled_appointment_time');

    if (!tripId || !routeId || !status || !scheduledPickup || !scheduledAppointment) {
      throw new ApiError(400, 'invalid_row', `Missing required fields at row ${rowIndex}.`);
    }

    validateDatetime(scheduledPickup, 'scheduled_pickup_time', rowIndex, true);
    validateDatetime(scheduledAppointment, 'scheduled_appointment_time', rowIndex, true);
    validateDatetime(getCellValue(row, 'pickup_arrive_time'), 'pickup_arrive_time', rowIndex, false);
    validateDatetime(getCellValue(row, 'pickup_leave_time'), 'pickup_leave_time', rowIndex, false);
    validateDatetime(getCellValue(row, 'dropoff_arrive_time'), 'dropoff_arrive_time', rowIndex, false);
    validateDatetime(getCellValue(row, 'dropoff_leave_time'), 'dropoff_leave_time', rowIndex, false);

    return {
      trip_id: tripId,
      scheduled_pickup_time: scheduledPickup,
      scheduled_appointment_time: scheduledAppointment,
      pickup_arrive_time: getCellValue(row, 'pickup_arrive_time'),
      pickup_leave_time: getCellValue(row, 'pickup_leave_time'),
      dropoff_arrive_time: getCellValue(row, 'dropoff_arrive_time'),
      dropoff_leave_time: getCellValue(row, 'dropoff_leave_time'),
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
    } satisfies TripRow;
  });

  return trips;
}

export function parseRoutesFile(fileBuffer: Buffer): RouteRow[] {
  const rows = parseWorkbook(fileBuffer);
  assertColumnsExist(rows, ROUTE_REQUIRED_COLUMNS);

  return rows.map((row, index) => {
    const rowIndex = index + 2;
    const routeId = getCellValue(row, 'route_id');
    const scheduledStart = getCellValue(row, 'scheduled_start_time');
    const scheduledEnd = getCellValue(row, 'scheduled_end_time');
    if (!routeId || !scheduledStart || !scheduledEnd) {
      throw new ApiError(400, 'invalid_row', `Missing required route fields at row ${rowIndex}.`);
    }

    validateDatetime(scheduledStart, 'scheduled_start_time', rowIndex, true);
    validateDatetime(scheduledEnd, 'scheduled_end_time', rowIndex, true);
    validateDatetime(getCellValue(row, 'actual_start_time'), 'actual_start_time', rowIndex, false);
    validateDatetime(getCellValue(row, 'actual_end_time'), 'actual_end_time', rowIndex, false);

    return {
      route_id: routeId,
      route_name: getCellValue(row, 'route_name'),
      scheduled_start_time: scheduledStart,
      scheduled_end_time: scheduledEnd,
      actual_start_time: getCellValue(row, 'actual_start_time'),
      actual_end_time: getCellValue(row, 'actual_end_time'),
      break1: getCellValue(row, 'break1'),
      break2: getCellValue(row, 'break2'),
    } satisfies RouteRow;
  });
}
