export const REGISTRY_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS sessions (
  edit_token TEXT NOT NULL PRIMARY KEY,
  readonly_token TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT 'Untitled Run Cut',
  password_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  accessed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  trip_count INTEGER NOT NULL DEFAULT 0,
  route_count INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_readonly_token ON sessions(readonly_token);
CREATE INDEX IF NOT EXISTS idx_accessed_at ON sessions(accessed_at);

CREATE TABLE IF NOT EXISTS import_templates (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  edit_token TEXT NOT NULL,
  template_name TEXT NOT NULL,
  source_system TEXT NOT NULL,
  notes TEXT,
  event_mapping_json TEXT NOT NULL,
  field_mapping_json TEXT NOT NULL,
  match_rules_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_import_templates_edit_token ON import_templates(edit_token);
`;

export const SESSION_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS trips (
  trip_id TEXT NOT NULL PRIMARY KEY,
  trip_date TEXT,
  scheduled_pickup_time TEXT NOT NULL,
  scheduled_appointment_time TEXT,
  pickup_arrive_time TEXT,
  pickup_leave_time TEXT,
  dropoff_arrive_time TEXT,
  dropoff_leave_time TEXT,
  route_id TEXT NOT NULL,
  pickup_address TEXT,
  pickup_lat TEXT,
  pickup_lon TEXT,
  dropoff_address TEXT,
  dropoff_lat TEXT,
  dropoff_lon TEXT,
  status TEXT NOT NULL,
  passenger_type TEXT NOT NULL DEFAULT 'ambulatory',
  passenger_count TEXT,
  pick_odometer TEXT,
  drop_odometer TEXT,
  zone TEXT
);

CREATE INDEX IF NOT EXISTS idx_trips_route ON trips(route_id);
CREATE INDEX IF NOT EXISTS idx_trips_pickup_time ON trips(scheduled_pickup_time);

CREATE TABLE IF NOT EXISTS routes (
  route_id TEXT NOT NULL PRIMARY KEY,
  route_date TEXT,
  route_name TEXT,
  scheduled_start_time TEXT NOT NULL,
  scheduled_end_time TEXT NOT NULL,
  actual_start_time TEXT,
  actual_end_time TEXT,
  break1_start TEXT,
  break1_end TEXT,
  break2_start TEXT,
  break2_end TEXT,
  depot_address TEXT,
  depot_lat TEXT,
  depot_lon TEXT,
  distance_to_first_pick TEXT,
  distance_from_last_drop TEXT,
  zone TEXT,
  vehicle_type_id TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER NOT NULL PRIMARY KEY CHECK (id = 1),
  avg_ride_time_min INTEGER NOT NULL DEFAULT 28,
  otp_target_pct REAL NOT NULL DEFAULT 85.0,
  pickup_otp_window_before_min INTEGER NOT NULL DEFAULT 15,
  pickup_otp_window_after_min INTEGER NOT NULL DEFAULT 15,
  dropoff_otp_window_before_min INTEGER NOT NULL DEFAULT 30,
  dropoff_otp_window_after_min INTEGER NOT NULL DEFAULT 1,
  productivity_baseline REAL NOT NULL DEFAULT 1.8,
  deadhead_threshold_pct REAL NOT NULL DEFAULT 60.0,
  service_day_start TEXT NOT NULL DEFAULT '04:00',
  service_day_end TEXT NOT NULL DEFAULT '21:00',
  day_type TEXT NOT NULL DEFAULT 'weekday',
  time_range_start TEXT,
  time_range_end TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS optimization (
  id INTEGER NOT NULL PRIMARY KEY CHECK (id = 1),
  target_productivity REAL,
  min_otp_target REAL,
  max_driver_spread_hrs REAL,
  peak_vehicles INTEGER,
  run_structure_json TEXT,
  bid_result_json TEXT
);

CREATE TABLE IF NOT EXISTS vehicle_types (
  vehicle_type_id TEXT NOT NULL PRIMARY KEY,
  vehicle_type_name TEXT NOT NULL,
  supported_modes TEXT NOT NULL DEFAULT '["ambulatory","wheelchair","extra_large"]'
);

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
  break_3_end TEXT,
  vehicle_type_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_new_routes_name ON new_routes(new_route_name);
`;
