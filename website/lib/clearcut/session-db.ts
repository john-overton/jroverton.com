import fs from 'node:fs';

import Database from 'better-sqlite3';

import { getSessionDbPath, getSessionsDirPath } from './config';
import { ApiError } from './errors';
import { SESSION_SCHEMA_SQL } from './schema';
import type {
  OptimizationRow,
  RouteRow,
  SessionStateUpdateInput,
  SettingsRow,
  TripRow,
} from './types';

const PASSENGER_TYPES = new Set<TripRow['passenger_type']>([
  'ambulatory',
  'wheelchair',
  'extra_large',
]);

const TRIP_COLUMNS = [
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
  'passenger_type',
  'passenger_count',
  'pick_odometer',
  'drop_odometer',
] as const;

const ROUTE_COLUMNS = [
  'route_id',
  'scheduled_start_time',
  'scheduled_end_time',
  'actual_start_time',
  'actual_end_time',
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
      "ALTER TABLE trips ADD COLUMN passenger_type TEXT NOT NULL DEFAULT 'ambulatory' CHECK (passenger_type IN ('ambulatory', 'wheelchair', 'extra_large'));",
    );
  }
}

function normalizePassengerType(value: string | null | undefined): TripRow['passenger_type'] {
  if (value && PASSENGER_TYPES.has(value as TripRow['passenger_type'])) {
    return value as TripRow['passenger_type'];
  }
  return 'ambulatory';
}

function normalizeTripRow(row: TripRow): TripRow {
  return {
    ...row,
    passenger_type: normalizePassengerType(row.passenger_type),
  };
}

function openSessionDb(editToken: string): Database.Database {
  ensureSessionsDirectory();
  const db = new Database(getSessionDbPath(editToken));
  db.pragma('journal_mode = WAL');
  db.exec(SESSION_SCHEMA_SQL);
  ensureTripPassengerTypeColumn(db);
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

export function replaceTrips(editToken: string, trips: TripRow[]): void {
  withSessionDb(editToken, (db) => {
    const insertTrip = db.prepare(
      `INSERT INTO trips (${TRIP_COLUMNS.join(',')})
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

export function saveSessionState(editToken: string, input: SessionStateUpdateInput): void {
  withSessionDb(editToken, (db) => {
    const transaction = db.transaction(() => {
      if (input.settings) {
        db.prepare(
          `UPDATE settings
           SET avg_ride_time_min = COALESCE(@avg_ride_time_min, avg_ride_time_min),
               otp_target_pct = COALESCE(@otp_target_pct, otp_target_pct),
               productivity_baseline = COALESCE(@productivity_baseline, productivity_baseline),
               deadhead_threshold_pct = COALESCE(@deadhead_threshold_pct, deadhead_threshold_pct),
               service_day_start = COALESCE(@service_day_start, service_day_start),
               service_day_end = COALESCE(@service_day_end, service_day_end),
               day_type = COALESCE(@day_type, day_type),
               time_range_start = COALESCE(@time_range_start, time_range_start),
               time_range_end = COALESCE(@time_range_end, time_range_end)
           WHERE id = 1`,
        ).run(input.settings);
      }

      if (input.optimization) {
        db.prepare(
          `UPDATE optimization
           SET target_productivity = COALESCE(@target_productivity, target_productivity),
               min_otp_target = COALESCE(@min_otp_target, min_otp_target),
               max_driver_spread_hrs = COALESCE(@max_driver_spread_hrs, max_driver_spread_hrs),
               peak_vehicles = COALESCE(@peak_vehicles, peak_vehicles),
               run_structure_json = COALESCE(@run_structure_json, run_structure_json)
           WHERE id = 1`,
        ).run(input.optimization);
      }

      if (input.trips) {
        const insertTrip = db.prepare(
          `INSERT INTO trips (${TRIP_COLUMNS.join(',')})
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
    });

    transaction();
  });
}
