import fs from 'node:fs';

import Database from 'better-sqlite3';

import { getSessionDbPath, getSessionsDirPath } from './config';
import { ApiError } from './errors';
import { SESSION_SCHEMA_SQL } from './schema';
import { computeServiceDayWindow } from './metrics';
import type {
  DepotRow,
  NewRouteRow,
  NewRoutesDelta,
  NewRoutesDeltaResult,
  OptimizationRow,
  RouteRow,
  SessionMetadata,
  SessionSummary,
  SessionStateUpdateInput,
  SettingsRow,
  TripRow,
  VehicleTypeRow,
} from './types';


const TRIP_COLUMNS = [
  'trip_id',
  'trip_date',
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
  'passenger_type',
  'passenger_count',
  'pick_odometer',
  'drop_odometer',
  'zone',
] as const;

const ROUTE_COLUMNS = [
  'route_id',
  'route_date',
  'route_name',
  'scheduled_start_time',
  'scheduled_end_time',
  'actual_start_time',
  'actual_end_time',
  'break1_start',
  'break1_end',
  'break2_start',
  'break2_end',
  'depot_address',
  'depot_lat',
  'depot_lon',
  'distance_to_first_pick',
  'distance_from_last_drop',
  'zone',
  'vehicle_type_id',
] as const;

const NEW_ROUTE_COLUMNS = [
  'new_route_id',
  'new_route_name',
  'split_number',
  'depot',
  'service_days',
  'route_area',
  'start_time',
  'end_time',
  'platform_hours',
  'pay_hours',
  'break_1_start',
  'break_1_end',
  'break_2_start',
  'break_2_end',
  'break_3_start',
  'break_3_end',
  'vehicle_type_id',
] as const;

const VEHICLE_TYPE_COLUMNS = [
  'vehicle_type_id',
  'vehicle_type_name',
  'supported_modes',
] as const;

const DEPOT_COLUMNS = [
  'depot_id',
  'depot_name',
  'depot_address',
  'depot_lat',
  'depot_lon',
] as const;

function ensureSessionsDirectory(): void {
  fs.mkdirSync(getSessionsDirPath(), { recursive: true });
}

function ensureTripPassengerTypeColumn(db: Database.Database): void {
  const columns = db
    .prepare("SELECT name FROM pragma_table_info('trips')")
    .all() as Array<{ name: string }>;
  const hasPassengerType = columns.some((column) => column.name === 'passenger_type');
  if (!hasPassengerType) {
    db.exec(
      "ALTER TABLE trips ADD COLUMN passenger_type TEXT NOT NULL DEFAULT 'ambulatory';",
    );
  }
}

function ensureSettingsOtpWindowColumns(db: Database.Database): void {
  const columns = db
    .prepare("SELECT name FROM pragma_table_info('settings')")
    .all() as Array<{ name: string }>;
  const existing = new Set(columns.map((column) => column.name));
  if (!existing.has('pickup_otp_window_before_min')) {
    db.exec('ALTER TABLE settings ADD COLUMN pickup_otp_window_before_min INTEGER NOT NULL DEFAULT 15;');
  }
  if (!existing.has('pickup_otp_window_after_min')) {
    db.exec('ALTER TABLE settings ADD COLUMN pickup_otp_window_after_min INTEGER NOT NULL DEFAULT 15;');
  }
  if (!existing.has('dropoff_otp_window_before_min')) {
    db.exec('ALTER TABLE settings ADD COLUMN dropoff_otp_window_before_min INTEGER NOT NULL DEFAULT 30;');
  }
  if (!existing.has('dropoff_otp_window_after_min')) {
    db.exec('ALTER TABLE settings ADD COLUMN dropoff_otp_window_after_min INTEGER NOT NULL DEFAULT 1;');
  }
}

function ensureRouteColumns(db: Database.Database): void {
  const columns = db
    .prepare("SELECT name FROM pragma_table_info('routes')")
    .all() as Array<{ name: string }>;
  const existing = new Set(columns.map((column) => column.name));
  if (!existing.has('route_name')) {
    db.exec('ALTER TABLE routes ADD COLUMN route_name TEXT;');
  }
  if (!existing.has('break1_start')) {
    db.exec('ALTER TABLE routes ADD COLUMN break1_start TEXT;');
  }
  if (!existing.has('break1_end')) {
    db.exec('ALTER TABLE routes ADD COLUMN break1_end TEXT;');
  }
  if (!existing.has('break2_start')) {
    db.exec('ALTER TABLE routes ADD COLUMN break2_start TEXT;');
  }
  if (!existing.has('break2_end')) {
    db.exec('ALTER TABLE routes ADD COLUMN break2_end TEXT;');
  }
  if (!existing.has('route_date')) {
    db.exec('ALTER TABLE routes ADD COLUMN route_date TEXT;');
  }
  if (!existing.has('depot_address')) {
    db.exec('ALTER TABLE routes ADD COLUMN depot_address TEXT;');
  }
  if (!existing.has('depot_lat')) {
    db.exec('ALTER TABLE routes ADD COLUMN depot_lat TEXT;');
  }
  if (!existing.has('depot_lon')) {
    db.exec('ALTER TABLE routes ADD COLUMN depot_lon TEXT;');
  }
  if (!existing.has('distance_to_first_pick')) {
    db.exec('ALTER TABLE routes ADD COLUMN distance_to_first_pick TEXT;');
  }
  if (!existing.has('distance_from_last_drop')) {
    db.exec('ALTER TABLE routes ADD COLUMN distance_from_last_drop TEXT;');
  }
  if (!existing.has('vehicle_type_id')) {
    db.exec('ALTER TABLE routes ADD COLUMN vehicle_type_id TEXT;');
  }
}

function ensureTripColumns(db: Database.Database): void {
  const columns = db
    .prepare("SELECT name FROM pragma_table_info('trips')")
    .all() as Array<{ name: string }>;
  const existing = new Set(columns.map((column) => column.name));
  if (!existing.has('trip_date')) {
    db.exec('ALTER TABLE trips ADD COLUMN trip_date TEXT;');
  }
}

function ensureNewRoutesTable(db: Database.Database): void {
  // Check if old 'runs' table exists and migrate
  const oldTables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='runs'")
    .all() as Array<{ name: string }>;

  if (oldTables.length > 0) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS new_routes (
        new_route_id TEXT NOT NULL PRIMARY KEY,
        new_route_name TEXT NOT NULL,
        split_number INTEGER NOT NULL DEFAULT 0,
        depot TEXT,
        service_days TEXT NOT NULL DEFAULT '["M","T","W","Th","F"]',
        route_area TEXT,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        platform_hours TEXT NOT NULL DEFAULT '0',
        pay_hours TEXT NOT NULL DEFAULT '0',
        break_1_start TEXT,
        break_1_end TEXT,
        break_2_start TEXT,
        break_2_end TEXT,
        break_3_start TEXT,
        break_3_end TEXT
      );
      INSERT OR IGNORE INTO new_routes (
        new_route_id, new_route_name, split_number, depot,
        service_days, route_area, start_time, end_time,
        platform_hours, pay_hours,
        break_1_start, break_1_end, break_2_start, break_2_end,
        break_3_start, break_3_end
      )
      SELECT run_id, run_name, split_number, depot,
        service_days, route_area, start_time, end_time,
        platform_hours, pay_hours,
        break_1_start, break_1_end, break_2_start, break_2_end,
        break_3_start, break_3_end
      FROM runs;
      DROP TABLE runs;
      CREATE INDEX IF NOT EXISTS idx_new_routes_name ON new_routes(new_route_name);
    `);
    return;
  }

  // Fresh creation if new_routes doesn't exist
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='new_routes'")
    .all() as Array<{ name: string }>;
  if (tables.length === 0) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS new_routes (
        new_route_id TEXT NOT NULL PRIMARY KEY,
        new_route_name TEXT NOT NULL,
        split_number INTEGER NOT NULL DEFAULT 0,
        depot TEXT,
        service_days TEXT NOT NULL DEFAULT '["M","T","W","Th","F"]',
        route_area TEXT,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        platform_hours TEXT NOT NULL DEFAULT '0',
        pay_hours TEXT NOT NULL DEFAULT '0',
        break_1_start TEXT,
        break_1_end TEXT,
        break_2_start TEXT,
        break_2_end TEXT,
        break_3_start TEXT,
        break_3_end TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_new_routes_name ON new_routes(new_route_name);
    `);
  }
}

function ensureDepotsTable(db: Database.Database): void {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='depots'")
    .all() as Array<{ name: string }>;
  if (tables.length === 0) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS depots (
        depot_id TEXT NOT NULL PRIMARY KEY,
        depot_name TEXT NOT NULL,
        depot_address TEXT,
        depot_lat TEXT,
        depot_lon TEXT
      );
    `);
  }
}

function ensureVehicleTypesTable(db: Database.Database): void {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='vehicle_types'")
    .all() as Array<{ name: string }>;
  if (tables.length === 0) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS vehicle_types (
        vehicle_type_id TEXT NOT NULL PRIMARY KEY,
        vehicle_type_name TEXT NOT NULL,
        supported_modes TEXT NOT NULL DEFAULT '["ambulatory","wheelchair","extra_large"]'
      );
    `);
  }
}

function ensureNewRouteVehicleTypeColumn(db: Database.Database): void {
  const columns = db
    .prepare("SELECT name FROM pragma_table_info('new_routes')")
    .all() as Array<{ name: string }>;
  const existing = new Set(columns.map((column) => column.name));
  if (!existing.has('vehicle_type_id')) {
    db.exec('ALTER TABLE new_routes ADD COLUMN vehicle_type_id TEXT;');
  }
}

function ensureBidResultColumn(db: Database.Database): void {
  const columns = db
    .prepare("SELECT name FROM pragma_table_info('optimization')")
    .all() as Array<{ name: string }>;
  const existing = new Set(columns.map((column) => column.name));
  if (!existing.has('bid_result_json')) {
    db.exec('ALTER TABLE optimization ADD COLUMN bid_result_json TEXT;');
  }
}

function ensureSettingsIsDemoColumn(db: Database.Database): void {
  const columns = db
    .prepare("SELECT name FROM pragma_table_info('settings')")
    .all() as Array<{ name: string }>;
  const existing = new Set(columns.map((column) => column.name));
  if (!existing.has('is_demo')) {
    db.exec('ALTER TABLE settings ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0;');
  }
}

function ensureTripZoneColumn(db: Database.Database): void {
  const columns = db
    .prepare("SELECT name FROM pragma_table_info('trips')")
    .all() as Array<{ name: string }>;
  const existing = new Set(columns.map((column) => column.name));
  if (!existing.has('zone')) {
    db.exec('ALTER TABLE trips ADD COLUMN zone TEXT;');
  }
}

function ensureRouteZoneColumn(db: Database.Database): void {
  const columns = db
    .prepare("SELECT name FROM pragma_table_info('routes')")
    .all() as Array<{ name: string }>;
  const existing = new Set(columns.map((column) => column.name));
  if (!existing.has('zone')) {
    db.exec('ALTER TABLE routes ADD COLUMN zone TEXT;');
  }
}

function ensureNewRoutesVersionColumn(db: Database.Database): void {
  const columns = db
    .prepare("SELECT name FROM pragma_table_info('settings')")
    .all() as Array<{ name: string }>;
  const existing = new Set(columns.map((column) => column.name));
  if (!existing.has('new_routes_version')) {
    db.exec('ALTER TABLE settings ADD COLUMN new_routes_version INTEGER NOT NULL DEFAULT 0;');
  }
}

function normalizeTripRow(row: TripRow): TripRow {
  return {
    ...row,
    trip_date: row.trip_date ?? null,
    passenger_type: row.passenger_type || 'ambulatory',
  };
}

function openSessionDb(editToken: string): Database.Database {
  ensureSessionsDirectory();
  const db = new Database(getSessionDbPath(editToken));
  db.pragma('journal_mode = WAL');
  db.exec(SESSION_SCHEMA_SQL);
  ensureTripColumns(db);
  ensureTripPassengerTypeColumn(db);
  ensureSettingsOtpWindowColumns(db);
  ensureRouteColumns(db);
  ensureNewRoutesTable(db);
  ensureDepotsTable(db);
  ensureVehicleTypesTable(db);
  ensureNewRouteVehicleTypeColumn(db);
  ensureBidResultColumn(db);
  ensureSettingsIsDemoColumn(db);
  ensureTripZoneColumn(db);
  ensureRouteZoneColumn(db);
  ensureNewRoutesVersionColumn(db);
  db.prepare('INSERT OR IGNORE INTO settings (id) VALUES (1)').run();
  db.prepare('INSERT OR IGNORE INTO optimization (id) VALUES (1)').run();
  return db;
}

function withSessionDb<T>(editToken: string, fn: (db: Database.Database) => T): T {
  const db = openSessionDb(editToken);
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

export function deleteSessionDb(editToken: string): void {
  const dbPath = getSessionDbPath(editToken);
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
}

export function cloneSessionDb(sourceEditToken: string, targetEditToken: string): void {
  const source = getSessionDbPath(sourceEditToken);
  const target = getSessionDbPath(targetEditToken);

  if (!fs.existsSync(source)) {
    throw new ApiError(404, 'session_db_not_found', 'Source session database was not found.');
  }

  ensureSessionsDirectory();
  fs.copyFileSync(source, target);
}

export function getSettings(editToken: string): SettingsRow {
  return withSessionDb(editToken, (db) => {
    const row = db.prepare('SELECT * FROM settings WHERE id = 1').get() as SettingsRow | undefined;
    if (!row) {
      throw new ApiError(500, 'settings_missing', 'Session settings are missing.');
    }

    return row;
  });
}

export function getOptimization(editToken: string): OptimizationRow {
  return withSessionDb(editToken, (db) => {
    const row = db
      .prepare('SELECT * FROM optimization WHERE id = 1')
      .get() as OptimizationRow | undefined;
    if (!row) {
      throw new ApiError(500, 'optimization_missing', 'Session optimization state is missing.');
    }

    return row;
  });
}

export function listTrips(editToken: string, limit?: number, offset?: number): TripRow[] {
  return withSessionDb(editToken, (db) => {
    const hasPagination = typeof limit === 'number' || typeof offset === 'number';
    if (!hasPagination) {
      const trips = db
        .prepare('SELECT * FROM trips ORDER BY scheduled_pickup_time, trip_id')
        .all() as TripRow[];
      return trips.map(normalizeTripRow);
    }

    const resolvedLimit = typeof limit === 'number' ? Math.max(1, Math.min(limit, 5000)) : 500;
    const resolvedOffset = typeof offset === 'number' ? Math.max(0, offset) : 0;
    const trips = db
      .prepare('SELECT * FROM trips ORDER BY scheduled_pickup_time, trip_id LIMIT ? OFFSET ?')
      .all(resolvedLimit, resolvedOffset) as TripRow[];
    return trips.map(normalizeTripRow);
  });
}

export function listRoutes(editToken: string): RouteRow[] {
  return withSessionDb(editToken, (db) => {
    return db.prepare('SELECT * FROM routes ORDER BY route_id').all() as RouteRow[];
  });
}

export function listNewRoutes(editToken: string): NewRouteRow[] {
  return withSessionDb(editToken, (db) => {
    return db.prepare('SELECT * FROM new_routes ORDER BY new_route_name, split_number').all() as NewRouteRow[];
  });
}

export function listDepots(editToken: string): DepotRow[] {
  return withSessionDb(editToken, (db) => {
    return db.prepare('SELECT * FROM depots ORDER BY depot_name').all() as DepotRow[];
  });
}

export function listVehicleTypes(editToken: string): VehicleTypeRow[] {
  return withSessionDb(editToken, (db) => {
    return db.prepare('SELECT * FROM vehicle_types ORDER BY vehicle_type_name').all() as VehicleTypeRow[];
  });
}

export function countTrips(editToken: string): number {
  return withSessionDb(editToken, (db) => {
    const row = db.prepare('SELECT COUNT(*) as count FROM trips').get() as { count: number };
    return row.count;
  });
}

export function countRoutes(editToken: string): number {
  return withSessionDb(editToken, (db) => {
    const row = db.prepare('SELECT COUNT(*) as count FROM routes').get() as { count: number };
    return row.count;
  });
}

export function getAllSessionMetadata(editToken: string, access: 'edit' | 'readonly', session: {
  edit_token: string;
  readonly_token: string;
  name: string;
  created_at: string;
  updated_at: string;
  accessed_at: string;
  trip_count: number;
  route_count: number;
  password_hash: string | null;
}): SessionMetadata {
  return withSessionDb(editToken, (db) => {
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as SettingsRow;
    const optimization = db.prepare('SELECT * FROM optimization WHERE id = 1').get() as OptimizationRow;
    const newRoutes = db.prepare('SELECT * FROM new_routes ORDER BY new_route_name, split_number').all() as NewRouteRow[];
    const depots = db.prepare('SELECT * FROM depots ORDER BY depot_name').all() as DepotRow[];
    const vehicleTypes = db.prepare('SELECT * FROM vehicle_types ORDER BY vehicle_type_name').all() as VehicleTypeRow[];

    const tripCount = (db.prepare('SELECT COUNT(*) as count FROM trips').get() as { count: number }).count;
    const routeCount = (db.prepare('SELECT COUNT(*) as count FROM routes').get() as { count: number }).count;

    const dateRows = db.prepare(`
      SELECT DISTINCT SUBSTR(COALESCE(
        REPLACE(pickup_arrive_time, 'T', ' '),
        REPLACE(pickup_leave_time, 'T', ' '),
        REPLACE(scheduled_pickup_time, 'T', ' ')
      ), 1, 10) as d
      FROM trips
      WHERE d IS NOT NULL
      UNION
      SELECT DISTINCT SUBSTR(COALESCE(
        REPLACE(actual_start_time, 'T', ' '),
        REPLACE(scheduled_start_time, 'T', ' ')
      ), 1, 10) as d
      FROM routes
      WHERE d IS NOT NULL
      ORDER BY d
    `).all() as { d: string }[];

    const zoneRows = db.prepare(`
      SELECT DISTINCT zone FROM trips WHERE zone IS NOT NULL
      UNION
      SELECT DISTINCT zone FROM routes WHERE zone IS NOT NULL
      UNION
      SELECT DISTINCT route_area FROM new_routes WHERE route_area IS NOT NULL
      ORDER BY 1
    `).all() as { zone: string }[];

    const statusRows = db.prepare(
      'SELECT DISTINCT status FROM trips WHERE status IS NOT NULL ORDER BY status',
    ).all() as { status: string }[];

    const ptRows = db.prepare(
      'SELECT DISTINCT passenger_type FROM trips WHERE passenger_type IS NOT NULL ORDER BY passenger_type',
    ).all() as { passenger_type: string }[];

    const timeMinutesExpr = (col: string) =>
      `(CAST(SUBSTR(REPLACE(${col}, 'T', ' '), 12, 2) AS INTEGER) * 60 + CAST(SUBSTR(REPLACE(${col}, 'T', ' '), 15, 2) AS INTEGER))`;

    const boundsRow = db.prepare(`
      SELECT MIN(m) as earliest, MAX(m) as latest FROM (
        SELECT ${timeMinutesExpr('COALESCE(pickup_arrive_time, pickup_leave_time, scheduled_pickup_time)')} as m
        FROM trips WHERE COALESCE(pickup_arrive_time, pickup_leave_time, scheduled_pickup_time) IS NOT NULL
        UNION ALL
        SELECT ${timeMinutesExpr('COALESCE(dropoff_leave_time, dropoff_arrive_time, scheduled_appointment_time)')} as m
        FROM trips WHERE COALESCE(dropoff_leave_time, dropoff_arrive_time, scheduled_appointment_time) IS NOT NULL
        UNION ALL
        SELECT ${timeMinutesExpr('COALESCE(actual_start_time, scheduled_start_time)')} as m
        FROM routes WHERE COALESCE(actual_start_time, scheduled_start_time) IS NOT NULL
        UNION ALL
        SELECT ${timeMinutesExpr('COALESCE(actual_end_time, scheduled_end_time)')} as m
        FROM routes WHERE COALESCE(actual_end_time, scheduled_end_time) IS NOT NULL
      )
    `).get() as { earliest: number | null; latest: number | null };

    let startMinutes: number;
    let endMinutes: number;
    const fallbackStart = clockToMinutesOrDefault(settings.service_day_start, 4 * 60);
    const fallbackEnd = clockToMinutesOrDefault(settings.service_day_end, 21 * 60);

    if (boundsRow.earliest == null || boundsRow.latest == null) {
      startMinutes = fallbackStart;
      endMinutes = fallbackEnd;
    } else {
      let earliest = boundsRow.earliest;
      let latest = boundsRow.latest;
      for (const nr of newRoutes) {
        const s = parseClockMinutes(nr.start_time);
        const e = parseClockMinutes(nr.end_time);
        if (s >= 0) { if (s < earliest) earliest = s; if (s > latest) latest = s; }
        if (e >= 0) { if (e < earliest) earliest = e; if (e > latest) latest = e; }
      }
      startMinutes = Math.max(0, Math.floor((earliest - 30) / 15) * 15);
      endMinutes = Math.min(24 * 60, Math.ceil((Math.max(startMinutes + 60, latest + 30)) / 15) * 15);
    }

    let bidResult = null;
    if (optimization.bid_result_json) {
      try { bidResult = JSON.parse(optimization.bid_result_json); } catch { /* ignore */ }
    }

    return {
      session: {
        edit_token: access === 'edit' ? session.edit_token : null,
        readonly_token: session.readonly_token,
        name: session.name,
        created_at: session.created_at,
        updated_at: session.updated_at,
        accessed_at: session.accessed_at,
        trip_count: session.trip_count,
        route_count: session.route_count,
        has_password: Boolean(session.password_hash),
      },
      settings,
      optimization,
      new_routes: newRoutes,
      depots,
      vehicle_types: vehicleTypes,
      bid_result: bidResult,
      new_routes_version: (settings as SettingsRow & { new_routes_version: number }).new_routes_version ?? 0,
      summary: {
        tripCount,
        routeCount,
        dates: dateRows.map((r) => r.d),
        zones: zoneRows.map((r) => r.zone),
        statuses: statusRows.map((r) => r.status),
        passengerTypes: ptRows.map((r) => r.passenger_type),
        sliderBounds: { startMinutes, endMinutes },
      },
    };
  });
}

function parseClockMinutes(value: string | null | undefined): number {
  if (!value) return -1;
  const parts = value.split(':');
  if (parts.length < 2) return -1;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return -1;
  return h * 60 + m;
}

function clockToMinutesOrDefault(value: string | null | undefined, fallback: number): number {
  const m = parseClockMinutes(value);
  return m >= 0 ? m : fallback;
}

export function replaceTrips(editToken: string, trips: TripRow[]): void {
  withSessionDb(editToken, (db) => {
    const insertTrip = db.prepare(
      `INSERT OR REPLACE INTO trips (${TRIP_COLUMNS.join(',')})
       VALUES (${TRIP_COLUMNS.map(() => '?').join(',')})`,
    );
    const transaction = db.transaction((rows: TripRow[]) => {
      db.prepare('DELETE FROM trips').run();
      for (const row of rows) {
        const normalized = normalizeTripRow(row);
        insertTrip.run(...TRIP_COLUMNS.map((column) => normalized[column]));
      }
    });
    transaction(trips);
  });
}

export function replaceRoutes(editToken: string, routes: RouteRow[]): void {
  withSessionDb(editToken, (db) => {
    const insertRoute = db.prepare(
      `INSERT INTO routes (${ROUTE_COLUMNS.join(',')})
       VALUES (${ROUTE_COLUMNS.map(() => '?').join(',')})`,
    );
    const transaction = db.transaction((rows: RouteRow[]) => {
      db.prepare('DELETE FROM routes').run();
      for (const row of rows) {
        insertRoute.run(...ROUTE_COLUMNS.map((column) => row[column]));
      }
    });
    transaction(routes);
  });
}

export function upsertTrips(editToken: string, trips: TripRow[]): { inserted: number; updated: number } {
  let inserted = 0;
  let updated = 0;
  withSessionDb(editToken, (db) => {
    const existingIds = new Set(
      (db.prepare('SELECT trip_id FROM trips').all() as { trip_id: string }[]).map((r) => r.trip_id),
    );
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO trips (${TRIP_COLUMNS.join(',')})
       VALUES (${TRIP_COLUMNS.map(() => '?').join(',')})`,
    );
    const transaction = db.transaction((rows: TripRow[]) => {
      for (const row of rows) {
        const normalized = normalizeTripRow(row);
        stmt.run(...TRIP_COLUMNS.map((column) => normalized[column]));
        if (existingIds.has(normalized.trip_id)) {
          updated += 1;
        } else {
          inserted += 1;
        }
      }
    });
    transaction(trips);
  });
  return { inserted, updated };
}

export function upsertRoutes(editToken: string, routes: RouteRow[]): { inserted: number; updated: number } {
  let inserted = 0;
  let updated = 0;
  withSessionDb(editToken, (db) => {
    const existingIds = new Set(
      (db.prepare('SELECT route_id FROM routes').all() as { route_id: string }[]).map((r) => r.route_id),
    );
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO routes (${ROUTE_COLUMNS.join(',')})
       VALUES (${ROUTE_COLUMNS.map(() => '?').join(',')})`,
    );
    const transaction = db.transaction((rows: RouteRow[]) => {
      for (const row of rows) {
        stmt.run(...ROUTE_COLUMNS.map((column) => row[column]));
        if (existingIds.has(row.route_id)) {
          updated += 1;
        } else {
          inserted += 1;
        }
      }
    });
    transaction(routes);
  });
  return { inserted, updated };
}

export function replaceNewRoutes(editToken: string, newRoutes: NewRouteRow[]): void {
  withSessionDb(editToken, (db) => {
    const insertNewRoute = db.prepare(
      `INSERT INTO new_routes (${NEW_ROUTE_COLUMNS.join(',')})
       VALUES (${NEW_ROUTE_COLUMNS.map(() => '?').join(',')})`,
    );
    const transaction = db.transaction((rows: NewRouteRow[]) => {
      db.prepare('DELETE FROM new_routes').run();
      for (const row of rows) {
        insertNewRoute.run(...NEW_ROUTE_COLUMNS.map((column) => row[column as keyof NewRouteRow]));
      }
    });
    transaction(newRoutes);
  });
}

export function saveSessionState(editToken: string, input: SessionStateUpdateInput): void {
  withSessionDb(editToken, (db) => {
    const transaction = db.transaction(() => {
      if (input.settings) {
        // Pad with null so every named SQL parameter exists; COALESCE keeps existing values for nulls
        const settingsParams = {
          avg_ride_time_min: null,
          otp_target_pct: null,
          pickup_otp_window_before_min: null,
          pickup_otp_window_after_min: null,
          dropoff_otp_window_before_min: null,
          dropoff_otp_window_after_min: null,
          productivity_baseline: null,
          deadhead_threshold_pct: null,
          service_day_start: null,
          service_day_end: null,
          day_type: null,
          time_range_start: null,
          time_range_end: null,
          is_demo: null,
          ...input.settings,
        };
        db.prepare(
          `UPDATE settings
           SET avg_ride_time_min = COALESCE(@avg_ride_time_min, avg_ride_time_min),
               otp_target_pct = COALESCE(@otp_target_pct, otp_target_pct),
               pickup_otp_window_before_min = COALESCE(@pickup_otp_window_before_min, pickup_otp_window_before_min),
               pickup_otp_window_after_min = COALESCE(@pickup_otp_window_after_min, pickup_otp_window_after_min),
               dropoff_otp_window_before_min = COALESCE(@dropoff_otp_window_before_min, dropoff_otp_window_before_min),
               dropoff_otp_window_after_min = COALESCE(@dropoff_otp_window_after_min, dropoff_otp_window_after_min),
               productivity_baseline = COALESCE(@productivity_baseline, productivity_baseline),
               deadhead_threshold_pct = COALESCE(@deadhead_threshold_pct, deadhead_threshold_pct),
               service_day_start = COALESCE(@service_day_start, service_day_start),
               service_day_end = COALESCE(@service_day_end, service_day_end),
               day_type = COALESCE(@day_type, day_type),
               time_range_start = COALESCE(@time_range_start, time_range_start),
               time_range_end = COALESCE(@time_range_end, time_range_end),
               is_demo = COALESCE(@is_demo, is_demo)
           WHERE id = 1`,
        ).run(settingsParams);
      }

      if (input.optimization) {
        const optimizationParams = {
          target_productivity: null,
          min_otp_target: null,
          max_driver_spread_hrs: null,
          peak_vehicles: null,
          run_structure_json: null,
          bid_result_json: null,
          ...input.optimization,
        };
        db.prepare(
          `UPDATE optimization
           SET target_productivity = COALESCE(@target_productivity, target_productivity),
               min_otp_target = COALESCE(@min_otp_target, min_otp_target),
               max_driver_spread_hrs = COALESCE(@max_driver_spread_hrs, max_driver_spread_hrs),
               peak_vehicles = COALESCE(@peak_vehicles, peak_vehicles),
               run_structure_json = COALESCE(@run_structure_json, run_structure_json),
               bid_result_json = COALESCE(@bid_result_json, bid_result_json)
           WHERE id = 1`,
        ).run(optimizationParams);
      }

      if (input.trips) {
        const insertTrip = db.prepare(
          `INSERT OR REPLACE INTO trips (${TRIP_COLUMNS.join(',')})
           VALUES (${TRIP_COLUMNS.map(() => '?').join(',')})`,
        );
        db.prepare('DELETE FROM trips').run();
        for (const row of input.trips) {
          const normalized = normalizeTripRow(row);
          insertTrip.run(...TRIP_COLUMNS.map((column) => normalized[column]));
        }
      }

      if (input.routes) {
        const insertRoute = db.prepare(
          `INSERT INTO routes (${ROUTE_COLUMNS.join(',')})
           VALUES (${ROUTE_COLUMNS.map(() => '?').join(',')})`,
        );
        db.prepare('DELETE FROM routes').run();
        for (const row of input.routes) {
          insertRoute.run(...ROUTE_COLUMNS.map((column) => row[column]));
        }
      }

      if (input.new_routes) {
        const insertNewRoute = db.prepare(
          `INSERT INTO new_routes (${NEW_ROUTE_COLUMNS.join(',')})
           VALUES (${NEW_ROUTE_COLUMNS.map(() => '?').join(',')})`,
        );
        db.prepare('DELETE FROM new_routes').run();
        for (const row of input.new_routes) {
          insertNewRoute.run(...NEW_ROUTE_COLUMNS.map((column) => row[column as keyof NewRouteRow]));
        }
        db.prepare('UPDATE settings SET new_routes_version = new_routes_version + 1 WHERE id = 1').run();
      }

      if (input.depots) {
        const insertDepot = db.prepare(
          `INSERT INTO depots (${DEPOT_COLUMNS.join(',')})
           VALUES (${DEPOT_COLUMNS.map(() => '?').join(',')})`,
        );
        db.prepare('DELETE FROM depots').run();
        for (const row of input.depots) {
          insertDepot.run(...DEPOT_COLUMNS.map((column) => row[column as keyof DepotRow]));
        }
      }

      if (input.vehicle_types) {
        const insertVehicleType = db.prepare(
          `INSERT INTO vehicle_types (${VEHICLE_TYPE_COLUMNS.join(',')})
           VALUES (${VEHICLE_TYPE_COLUMNS.map(() => '?').join(',')})`,
        );
        db.prepare('DELETE FROM vehicle_types').run();
        for (const row of input.vehicle_types) {
          insertVehicleType.run(...VEHICLE_TYPE_COLUMNS.map((column) => row[column as keyof VehicleTypeRow]));
        }
      }
    });

    transaction();
  });
}

export function getNewRoutesVersion(editToken: string): number {
  return withSessionDb(editToken, (db) => {
    const row = db.prepare('SELECT new_routes_version FROM settings WHERE id = 1').get() as { new_routes_version: number } | undefined;
    return row?.new_routes_version ?? 0;
  });
}

export function applyNewRoutesDelta(
  editToken: string,
  delta: NewRoutesDelta,
): NewRoutesDeltaResult {
  return withSessionDb(editToken, (db) => {
    const result = db.transaction(() => {
      const row = db.prepare('SELECT new_routes_version FROM settings WHERE id = 1').get() as { new_routes_version: number };
      const currentVersion = row.new_routes_version;

      if (currentVersion !== delta.expected_version) {
        const all = db.prepare('SELECT * FROM new_routes ORDER BY new_route_name, split_number').all() as NewRouteRow[];
        return { conflict: true as const, version: currentVersion, all };
      }

      if (delta.delete_ids.length > 0) {
        const deleteSt = db.prepare('DELETE FROM new_routes WHERE new_route_id = ?');
        for (const id of delta.delete_ids) {
          deleteSt.run(id);
        }
      }

      if (delta.upsert.length > 0) {
        const upsertSt = db.prepare(
          `INSERT OR REPLACE INTO new_routes (${NEW_ROUTE_COLUMNS.join(',')})
           VALUES (${NEW_ROUTE_COLUMNS.map(() => '?').join(',')})`,
        );
        for (const row of delta.upsert) {
          upsertSt.run(...NEW_ROUTE_COLUMNS.map((column) => row[column as keyof NewRouteRow]));
        }
      }

      db.prepare('UPDATE settings SET new_routes_version = new_routes_version + 1 WHERE id = 1').run();
      const updated = db.prepare('SELECT new_routes_version FROM settings WHERE id = 1').get() as { new_routes_version: number };
      return { conflict: false as const, version: updated.new_routes_version };
    })();

    return result;
  });
}

export function recalculateServiceWindow(editToken: string): void {
  withSessionDb(editToken, (db) => {
    const trips = db
      .prepare('SELECT * FROM trips ORDER BY scheduled_pickup_time, trip_id')
      .all() as TripRow[];
    const routes = db
      .prepare('SELECT * FROM routes ORDER BY route_id')
      .all() as RouteRow[];

    const window = computeServiceDayWindow(trips, routes);
    if (!window) {
      return;
    }

    db.prepare(
      `UPDATE settings
       SET service_day_start = @service_day_start,
           service_day_end = @service_day_end,
           time_range_start = @time_range_start,
           time_range_end = @time_range_end
       WHERE id = 1`,
    ).run({
      service_day_start: window.start,
      service_day_end: window.end,
      time_range_start: window.start,
      time_range_end: window.end,
    });
  });
}
