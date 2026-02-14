export type AccessLevel = 'edit' | 'readonly';

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiSuccessResponse<T> {
  ok: true;
  data: T;
}

export interface ApiErrorResponse {
  ok: false;
  error: ApiErrorPayload;
}

export interface SessionRecord {
  edit_token: string;
  readonly_token: string;
  name: string;
  password_hash: string | null;
  created_at: string;
  updated_at: string;
  accessed_at: string;
  trip_count: number;
  route_count: number;
}

export interface ClearCutJwtClaims {
  sub: string;
  access: AccessLevel;
  iat?: number;
  exp?: number;
}

export interface TripRow {
  trip_id: string;
  scheduled_pickup_time: string;
  scheduled_appointment_time: string;
  pickup_arrive_time: string | null;
  pickup_leave_time: string | null;
  dropoff_arrive_time: string | null;
  dropoff_leave_time: string | null;
  route_id: string;
  pickup_address: string | null;
  pickup_lat: string | null;
  pickup_lon: string | null;
  dropoff_address: string | null;
  dropoff_lat: string | null;
  dropoff_lon: string | null;
  status: string;
  passenger_count: string | null;
  pick_odometer: string | null;
  drop_odometer: string | null;
}

export interface RouteRow {
  route_id: string;
  scheduled_start_time: string;
  scheduled_end_time: string;
  actual_start_time: string | null;
  actual_end_time: string | null;
}

export interface SettingsRow {
  id: 1;
  avg_ride_time_min: number;
  otp_target_pct: number;
  productivity_baseline: number;
  deadhead_threshold_pct: number;
  service_day_start: string;
  service_day_end: string;
  day_type: string;
  time_range_start: string | null;
  time_range_end: string | null;
}

export interface OptimizationRow {
  id: 1;
  target_productivity: number | null;
  min_otp_target: number | null;
  max_driver_spread_hrs: number | null;
  peak_vehicles: number | null;
  run_structure_json: string | null;
}

export interface SessionState {
  session: Pick<
    SessionRecord,
    | 'edit_token'
    | 'readonly_token'
    | 'name'
    | 'created_at'
    | 'updated_at'
    | 'accessed_at'
    | 'trip_count'
    | 'route_count'
  >;
  settings: SettingsRow;
  optimization: OptimizationRow;
  trips: TripRow[];
  routes: RouteRow[];
}

export interface SessionStateUpdateInput {
  settings?: Partial<Omit<SettingsRow, 'id'>>;
  optimization?: Partial<Omit<OptimizationRow, 'id'>>;
  trips?: TripRow[];
  routes?: RouteRow[];
}
