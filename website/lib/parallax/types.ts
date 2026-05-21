export const UNROUTED_ROUTE_ID = '__UNROUTED__';

export function isUnrouted(routeId: string): boolean {
  return routeId === UNROUTED_ROUTE_ID;
}

export function displayRouteId(routeId: string): string {
  return routeId === UNROUTED_ROUTE_ID ? '(Unrouted)' : routeId;
}

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
  trip_date?: string | null;
  scheduled_pickup_time: string;
  scheduled_appointment_time: string | null;
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
  passenger_type: 'ambulatory' | 'wheelchair' | 'extra_large';
  passenger_count: string | null;
  pick_odometer: string | null;
  drop_odometer: string | null;
  zone: string | null;
}

export interface RouteRow {
  route_id: string;
  route_date?: string | null;
  route_name: string | null;
  scheduled_start_time: string;
  scheduled_end_time: string;
  actual_start_time: string | null;
  actual_end_time: string | null;
  break1_start: string | null;
  break1_end: string | null;
  break2_start: string | null;
  break2_end: string | null;
  depot_address: string | null;
  depot_lat: string | null;
  depot_lon: string | null;
  distance_to_first_pick: string | null;
  distance_from_last_drop: string | null;
  zone: string | null;
  vehicle_type_id: string | null;
}

export type ServiceDay = 'M' | 'T' | 'W' | 'Th' | 'F' | 'Sa' | 'Su';

export interface NewRouteRow {
  new_route_id: string;
  new_route_name: string;
  split_number: number;
  depot: string | null;
  service_days: string;
  route_area: string | null;
  start_time: string;
  end_time: string;
  platform_hours: string;
  pay_hours: string;
  break_1_start: string | null;
  break_1_end: string | null;
  break_2_start: string | null;
  break_2_end: string | null;
  break_3_start: string | null;
  break_3_end: string | null;
  vehicle_type_id: string | null;
}

export interface VehicleTypeRow {
  vehicle_type_id: string;
  vehicle_type_name: string;
  supported_modes: string;
}

// ── Bid system types ─────────────────────────────────────────────────

export type BidType = 'FTE' | 'PT';

export interface BidConfig {
  fte_min_hours: number;
  fte_max_hours: number;
  min_rest_hours: number;
  max_consecutive_days: number;
  depot_match_required: boolean;
  consistency_weight: 'low' | 'medium' | 'high';
  rank_priority: 'hours' | 'consistency' | 'days_off';
  max_allowable_variance: number;
}

export interface DailyBlock {
  new_route_name: string;
  day: ServiceDay;
  new_route_ids: string[];
  depot: string | null;
  pay_hours: number;
  start_time_minutes: number;
  end_time_minutes: number;
  span_minutes: number;
  break_1_start: string | null;
  break_1_end: string | null;
  break_2_start: string | null;
  break_2_end: string | null;
  break_3_start: string | null;
  break_3_end: string | null;
}

export interface CollapsedRoute {
  new_route_name: string;
  depot: string | null;
  start_time_minutes: number;
  end_time_minutes: number;
  break_1_start: string | null;
  break_1_end: string | null;
  break_2_start: string | null;
  break_2_end: string | null;
  break_3_start: string | null;
  break_3_end: string | null;
  pay_hours: number;
  days: ServiceDay[];
}

export interface BidPackage {
  bid_id: string;
  bid_rank: number;
  type: BidType;
  assigned_new_routes: string[];
  daily_blocks: DailyBlock[];
  weekly_pay_hours: number;
  days_on: ServiceDay[];
  days_off: ServiceDay[];
  consecutive_days_off: number;
  max_consecutive_work: number;
  start_time_variance: number;
  end_time_variance: number;
  consistency_score: number;
  depot: string | null;
}

export interface BidResult {
  config: BidConfig;
  packages: BidPackage[];
  fte_count: number;
  pt_count: number;
  unassigned_blocks: DailyBlock[];
}

export interface DepotRow {
  depot_id: string;
  depot_name: string;
  depot_address: string | null;
  depot_lat: string | null;
  depot_lon: string | null;
}

export interface SettingsRow {
  id: 1;
  avg_ride_time_min: number;
  otp_target_pct: number;
  pickup_otp_window_before_min: number;
  pickup_otp_window_after_min: number;
  dropoff_otp_window_before_min: number;
  dropoff_otp_window_after_min: number;
  productivity_baseline: number;
  deadhead_threshold_pct: number;
  service_day_start: string;
  service_day_end: string;
  day_type: string;
  time_range_start: string | null;
  time_range_end: string | null;
  is_demo: number;
}

export interface OptimizationRow {
  id: 1;
  target_productivity: number | null;
  min_otp_target: number | null;
  max_driver_spread_hrs: number | null;
  peak_vehicles: number | null;
  run_structure_json: string | null;
  bid_result_json: string | null;
}

export interface SessionState {
  session: Omit<
    Pick<
      SessionRecord,
      | 'edit_token'
      | 'readonly_token'
      | 'name'
      | 'created_at'
      | 'updated_at'
      | 'accessed_at'
      | 'trip_count'
      | 'route_count'
    >,
    'edit_token'
  > & { edit_token: string | null; has_password: boolean };
  settings: SettingsRow;
  optimization: OptimizationRow;
  trips: TripRow[];
  routes: RouteRow[];
  new_routes: NewRouteRow[];
  depots: DepotRow[];
  vehicle_types: VehicleTypeRow[];
  bid_result: BidResult | null;
}

export interface SessionSummary {
  tripCount: number;
  routeCount: number;
  dates: string[];
  zones: string[];
  statuses: string[];
  passengerTypes: string[];
  sliderBounds: { startMinutes: number; endMinutes: number };
}

export interface SessionMetadata {
  session: SessionState['session'];
  settings: SettingsRow;
  optimization: OptimizationRow;
  new_routes: NewRouteRow[];
  depots: DepotRow[];
  vehicle_types: VehicleTypeRow[];
  bid_result: BidResult | null;
  summary: SessionSummary;
}

export interface SessionStateUpdateInput {
  settings?: Partial<Omit<SettingsRow, 'id'>>;
  optimization?: Partial<Omit<OptimizationRow, 'id'>>;
  trips?: TripRow[];
  routes?: RouteRow[];
  new_routes?: NewRouteRow[];
  depots?: DepotRow[];
  vehicle_types?: VehicleTypeRow[];
}

export type ImportEventType =
  | 'pullout'
  | 'pullin'
  | 'pickup'
  | 'dropoff'
  | 'break'
  | 'other';

export interface ImportPreviewResponse {
  headers: string[];
  rows: Array<Record<string, string | null>>;
  row_count: number;
  sample_count: number;
  sheet_names: string[];
  selected_sheet: string | null;
}

export interface ImportFieldMapping {
  trip: Partial<Record<keyof TripRow, string>>;
  route: Partial<Record<keyof RouteRow, string>>;
}

export interface ImportMatchRules {
  trip_grouping: {
    keys: Array<keyof TripRow>;
    pickup_key_field: keyof TripRow;
    dropoff_key_field: keyof TripRow;
  };
  trip_route_join: {
    join_columns: Array<{ trip_field: keyof TripRow; route_field: keyof RouteRow }>;
  };
}

export interface ImportMappingConfig {
  event_column: string;
  event_values: Record<string, ImportEventType>;
  field_mapping: ImportFieldMapping;
  match_rules: ImportMatchRules;
}

export interface ImportValidateResponse {
  valid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    sampled_rows: number;
    event_types_detected: ImportEventType[];
  };
}

export interface ImportApplyResponse {
  imported: true;
  summary: {
    processed_rows: number;
    created_trips: number;
    updated_trips: number;
    created_routes: number;
    updated_routes: number;
    skipped_rows: number;
    errors: number;
  };
  errors: Array<{ row: number; reason: string }>;
  inserted_by_date: {
    trips: Array<{ date: string; count: number }>;
    routes: Array<{ date: string; count: number }>;
  };
}

export interface ImportTemplateRecord {
  id: number;
  edit_token: string;
  template_name: string;
  source_system: string;
  notes: string | null;
  event_mapping_json: string;
  field_mapping_json: string;
  match_rules_json: string;
  created_at: string;
  updated_at: string;
}
