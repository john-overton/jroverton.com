import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import { getDemoLocationsDbPath } from './config';

// ── Types ───────────────────────────────────────────────────────────

export interface DemoCityRow {
  city_id: number;
  name: string;
  state: string;
  center_lat: number;
  center_lon: number;
}

export interface DemoLocationRow {
  location_id: number;
  city_id: number;
  category: 'destination' | 'residential' | 'depot';
  address: string;
  lat: number;
  lon: number;
  place_name: string | null;
}

// ── Schema ──────────────────────────────────────────────────────────

const DEMO_LOCATIONS_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS cities (
  city_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  center_lat REAL NOT NULL,
  center_lon REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS locations (
  location_id INTEGER PRIMARY KEY AUTOINCREMENT,
  city_id INTEGER NOT NULL REFERENCES cities(city_id),
  category TEXT NOT NULL CHECK (category IN ('destination', 'residential', 'depot')),
  address TEXT NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  place_name TEXT
);

CREATE INDEX IF NOT EXISTS idx_locations_city ON locations(city_id, category);
`;

// ── Database Access ─────────────────────────────────────────────────

function ensureDataDirectory(): void {
  const dbPath = getDemoLocationsDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

function openDemoLocationsDb(): Database.Database {
  ensureDataDirectory();
  const db = new Database(getDemoLocationsDbPath());
  db.pragma('journal_mode = WAL');
  db.exec(DEMO_LOCATIONS_SCHEMA_SQL);

  // Ensure unique constraint on (city_id, address) — prevents duplicate locations.
  // For existing DBs that may already have dupes, remove them first.
  try {
    db.exec(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_unique_address ON locations(city_id, address)',
    );
  } catch {
    db.exec(`
      DELETE FROM locations WHERE location_id NOT IN (
        SELECT MIN(location_id) FROM locations GROUP BY city_id, address
      )
    `);
    db.exec(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_unique_address ON locations(city_id, address)',
    );
  }

  return db;
}

export function withDemoLocationsDb<T>(fn: (db: Database.Database) => T): T {
  const db = openDemoLocationsDb();
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

// ── Write Helpers (used by population script) ───────────────────────

export function clearAllData(db: Database.Database): void {
  db.exec('DELETE FROM locations');
  db.exec('DELETE FROM cities');
}

export function insertCity(
  db: Database.Database,
  city: { name: string; state: string; centerLat: number; centerLon: number },
): number {
  const result = db.prepare(
    'INSERT INTO cities (name, state, center_lat, center_lon) VALUES (?, ?, ?, ?)',
  ).run(city.name, city.state, city.centerLat, city.centerLon);
  return Number(result.lastInsertRowid);
}

export function insertLocation(
  db: Database.Database,
  location: {
    cityId: number;
    category: 'destination' | 'residential' | 'depot';
    address: string;
    lat: number;
    lon: number;
    placeName?: string | null;
  },
): number | null {
  const result = db.prepare(
    'INSERT OR IGNORE INTO locations (city_id, category, address, lat, lon, place_name) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(
    location.cityId,
    location.category,
    location.address,
    location.lat,
    location.lon,
    location.placeName ?? null,
  );
  // changes === 0 means the row was a duplicate and was ignored
  return result.changes > 0 ? Number(result.lastInsertRowid) : null;
}

// ── Read Helpers (used by demo data generator) ──────────────────────

export function listCities(db: Database.Database): DemoCityRow[] {
  return db.prepare('SELECT * FROM cities ORDER BY city_id').all() as DemoCityRow[];
}

export function getLocationsByCity(
  db: Database.Database,
  cityId: number,
): { destinations: DemoLocationRow[]; residential: DemoLocationRow[]; depots: DemoLocationRow[] } {
  const all = db.prepare(
    'SELECT * FROM locations WHERE city_id = ? ORDER BY location_id',
  ).all(cityId) as DemoLocationRow[];

  return {
    destinations: all.filter((loc) => loc.category === 'destination'),
    residential: all.filter((loc) => loc.category === 'residential'),
    depots: all.filter((loc) => loc.category === 'depot'),
  };
}

export function getCityCounts(db: Database.Database): Array<{
  city_id: number;
  name: string;
  state: string;
  destinations: number;
  residential: number;
  depots: number;
}> {
  return db.prepare(`
    SELECT
      c.city_id,
      c.name,
      c.state,
      SUM(CASE WHEN l.category = 'destination' THEN 1 ELSE 0 END) as destinations,
      SUM(CASE WHEN l.category = 'residential' THEN 1 ELSE 0 END) as residential,
      SUM(CASE WHEN l.category = 'depot' THEN 1 ELSE 0 END) as depots
    FROM cities c
    LEFT JOIN locations l ON c.city_id = l.city_id
    GROUP BY c.city_id
    ORDER BY c.city_id
  `).all() as Array<{
    city_id: number;
    name: string;
    state: string;
    destinations: number;
    residential: number;
    depots: number;
  }>;
}

export function demoLocationsDbExists(): boolean {
  return fs.existsSync(getDemoLocationsDbPath());
}

export function getCityByName(
  db: Database.Database,
  name: string,
  state: string,
): DemoCityRow | null {
  return (
    (db.prepare('SELECT * FROM cities WHERE name = ? AND state = ?').get(name, state) as
      | DemoCityRow
      | undefined) ?? null
  );
}

export function getExistingAddressesForCity(db: Database.Database, cityId: number): Set<string> {
  const rows = db
    .prepare('SELECT address FROM locations WHERE city_id = ?')
    .all(cityId) as Array<{ address: string }>;
  return new Set(rows.map((r) => r.address.toLowerCase().trim()));
}
