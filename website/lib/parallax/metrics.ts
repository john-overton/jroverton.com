import type { RouteRow, SessionState, TripRow } from './types';

export interface TimeBlock {
  key: string;
  label: string;
  startMinutes: number;
  endMinutes: number;
}

export interface YardTripRow {
  trip_id: string;
  route_id: string;
  yardDistanceMiles: number;
  travelTimeMinutes: number;
  isLate?: boolean;
  returnVarianceMinutes?: number;
}

export interface ClearcutMetrics {
  blocks: TimeBlock[];
  pickupsByBlock: number[];
  onBoardByBlock: number[];
  vehiclesByBlock: number[];
  vehiclesOnBreakByBlock: number[];
  deadheadByBlock: number[];
  otpByBlock: number[];
  pickupOtpByBlock: number[];
  dropoffOtpByBlock: number[];
  tripOtpByBlock: number[];
  productivityByBlock: number[];
  maxPickupsByBlock: number[];
  maxOnBoardByBlock: number[];
  maxVehiclesByBlock: number[];
  maxVehiclesOnBreakByBlock: number[];
  peakPickups: number;
  peakVehicles: number;
  peakOnBoard: number;
  avgOnBoard: number;
  maxPeakPickups: number;
  maxPeakOnBoardPassengers: number;
  avgPeakOnBoardPassengers: number;
  maxPeakVehicles: number;
  maxPeakPickupsDate: string | null;
  maxPeakOnBoardDate: string | null;
  maxPeakVehiclesDate: string | null;
  avgOtp: number;
  pickupOtpPct: number;
  dropoffOtpPct: number;
  tripOtpPct: number;
  blocksBelowOtp: number;
  avgProductivity: number;
  peakProductivity: number;
  totalTrips: number;
  totalPassengers: number;
  avgTripsPerDay: number;
  maxTripsPerDay: number;
  avgPassengersPerDay: number;
  maxPassengersPerDay: number;
  avgUtilizationPct: number;
  avgServiceHours: number;
  avgRevenueHours: number;
  currentRuns: number;
  optimizedRuns: number;
  importedServiceHours: number;
  optimizedServiceHours: number;
  avgOnBoardTimeMinutes: number;
  peakOnBoardTimeMinutes: number;
  avgTripMiles: number;
  avgStartDeadheadMinutes: number;
  avgEndDeadheadMinutes: number;
  avgDeadheadStartMiles: number;
  avgDeadheadEndMiles: number;
  highDeadheadTripsStart: TripRow[];
  highDeadheadTripsEnd: TripRow[];
  avgLeaveYardSlackMinutes: number;
  avgReturnYardSlackMinutes: number;
  lateReturnPct: number;
  yardStartTrips: YardTripRow[];
  yardEndTrips: YardTripRow[];
  derivedServiceWindow: {
    startLabel: string;
    endLabel: string;
    durationLabel: string;
    isTwentyFourHours: boolean;
    source: 'actual_preferred';
    earliestDataTime: string | null;
    latestDataTime: string | null;
  };
  pickupsByBlockByStatus: Record<string, number[]>;
  pickupsByBlockByPassengerType: Record<string, number[]>;
  onBoardByBlockByStatus: Record<string, number[]>;
  onBoardByBlockByPassengerType: Record<string, number[]>;
  productivityByBlockByStatus: Record<string, number[]>;
  productivityByBlockByPassengerType: Record<string, number[]>;
  maxPickupsByBlockByStatus: Record<string, number[]>;
  maxPickupsByBlockByPassengerType: Record<string, number[]>;
  maxOnBoardByBlockByStatus: Record<string, number[]>;
  maxOnBoardByBlockByPassengerType: Record<string, number[]>;
  avgNzPickupsByBlock: number[];
  avgNzOnBoardByBlock: number[];
  avgNzVehiclesByBlock: number[];
  avgNzVehiclesOnBreakByBlock: number[];
  avgNzPickupsByBlockByStatus: Record<string, number[]>;
  avgNzPickupsByBlockByPassengerType: Record<string, number[]>;
  avgNzOnBoardByBlockByStatus: Record<string, number[]>;
  avgNzOnBoardByBlockByPassengerType: Record<string, number[]>;
}

export interface PerRouteMetrics {
  routeName: string;
  trips: number;
  passengers: number;
  pickupOtpPct: number;
  dropoffOtpPct: number;
  productivity: number;
  serviceHours: number;
  revenueHours: number;
  occupiedMinutes: number;
  utilizationPct: number;
}

export interface ComputeMetricsOptions {
  selectedDays?: number[];
  specificDate?: string;
  timeRangeStart?: string | null;
  timeRangeEnd?: string | null;
  blockSizeMinutes?: number;
  selectedRouteIds?: string[];
  selectedZones?: string[];
  selectedStatuses?: string[];
  selectedPassengerTypes?: string[];
  selectedVehicleTypeIds?: string[];
}

function parseMinutes(value: string | null | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const [h, m] = value.split(':').map((part) => Number(part));
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    return fallback;
  }
  return h * 60 + m;
}

function asDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateToMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function formatClockLabel(date: Date): string {
  const h = `${date.getHours()}`.padStart(2, '0');
  const m = `${date.getMinutes()}`.padStart(2, '0');
  return `${h}:${m}`;
}

function formatDateTimeLabel(date: Date): string {
  const y = date.getFullYear();
  const mo = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  const hh = `${date.getHours()}`.padStart(2, '0');
  const mm = `${date.getMinutes()}`.padStart(2, '0');
  return `${y}-${mo}-${d} ${hh}:${mm}`;
}

function blockLabel(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${`${m}`.padStart(2, '0')} ${period}`;
}

/** Merge overlapping [start, end] intervals and return total covered duration in ms. */
function mergedIntervalDuration(intervals: [number, number][]): number {
  if (intervals.length === 0) return 0;
  intervals.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [curStart, curEnd] = intervals[0];
  for (let i = 1; i < intervals.length; i++) {
    const [s, e] = intervals[i];
    if (s <= curEnd) {
      curEnd = Math.max(curEnd, e);
    } else {
      total += curEnd - curStart;
      curStart = s;
      curEnd = e;
    }
  }
  total += curEnd - curStart;
  return total;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function parsePassengerCount(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }
  return Math.min(8, Math.round(parsed));
}

function sumServiceHours(routes: RouteRow[]): number {
  let minutes = 0;
  for (const route of routes) {
    const start = asDate(route.scheduled_start_time);
    const end = asDate(route.scheduled_end_time);
    if (!start || !end) {
      continue;
    }
    const diff = Math.max(0, (end.getTime() - start.getTime()) / 60_000);
    minutes += diff;
  }
  return Math.round((minutes / 60) * 10) / 10;
}

function pickBlockIndex(minutes: number, blocks: TimeBlock[]): number {
  return blocks.findIndex((block) => minutes >= block.startMinutes && minutes < block.endMinutes);
}

function routeStart(route: RouteRow): Date | null {
  return asDate(route.actual_start_time ?? '') ?? asDate(route.scheduled_start_time);
}

function routeEnd(route: RouteRow): Date | null {
  return asDate(route.actual_end_time ?? '') ?? asDate(route.scheduled_end_time);
}

function tripPickupTime(trip: TripRow): Date | null {
  return asDate(trip.pickup_leave_time ?? '') ?? asDate(trip.pickup_arrive_time ?? '') ?? asDate(trip.scheduled_pickup_time);
}

function tripDropoffTime(trip: TripRow): Date | null {
  return (
    asDate(trip.dropoff_leave_time ?? '') ??
    asDate(trip.dropoff_arrive_time ?? '') ??
    asDate(trip.scheduled_appointment_time)
  );
}

function resolveSelectedDays(
  session: SessionState,
  selectedDays: number[] | undefined,
): Set<number> {
  if (selectedDays) {
    return new Set(selectedDays.filter((day) => day >= 0 && day <= 6));
  }
  if (session.settings.day_type === 'weekday') {
    return new Set([1, 2, 3, 4, 5]);
  }
  if (session.settings.day_type === 'weekend') {
    return new Set([0, 6]);
  }
  return new Set([0, 1, 2, 3, 4, 5, 6]);
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function ensureDayBlockSets(
  map: Map<string, Array<Set<string>>>,
  key: string,
  blockCount: number,
): Array<Set<string>> {
  const existing = map.get(key);
  if (existing) {
    return existing;
  }
  const created = Array.from({ length: blockCount }).map(() => new Set<string>());
  map.set(key, created);
  return created;
}

function computeRideTimeStats(
  trips: TripRow[],
  selectedDays: Set<number> | null,
  filterDate: string | null,
): { avg: number | null; max: number | null } {
  const rideTimes: number[] = [];
  for (const trip of trips) {
    if (trip.status !== 'completed') continue;
    const pickup = asDate(trip.pickup_leave_time ?? '') ?? asDate(trip.pickup_arrive_time ?? '');
    const dropoff = asDate(trip.dropoff_leave_time ?? '') ?? asDate(trip.dropoff_arrive_time ?? '');
    if (!pickup || !dropoff) continue;
    if (filterDate ? dateKey(pickup) !== filterDate : !selectedDays!.has(pickup.getDay())) {
      continue;
    }
    const minutes = (dropoff.getTime() - pickup.getTime()) / 60_000;
    if (minutes > 0) {
      rideTimes.push(minutes);
    }
  }
  if (rideTimes.length === 0) return { avg: null, max: null };
  return {
    avg: rideTimes.reduce((a, b) => a + b, 0) / rideTimes.length,
    max: Math.max(...rideTimes),
  };
}

function pickMiles(trip: TripRow): number {
  const start = Number(trip.pick_odometer);
  const end = Number(trip.drop_odometer);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return 0;
  }
  return Math.max(0, end - start);
}

function minutesBetween(actual: Date, scheduled: Date): number {
  return (actual.getTime() - scheduled.getTime()) / 60_000;
}

function isOnTimeWithWindow(params: {
  actual: Date;
  scheduled: Date;
  beforeMin: number;
  afterMin: number;
}): boolean {
  const diff = minutesBetween(params.actual, params.scheduled);
  return diff >= -Math.max(0, params.beforeMin) && diff <= Math.max(0, params.afterMin);
}

function deriveServiceWindow(trips: TripRow[], routes: RouteRow[]): ClearcutMetrics['derivedServiceWindow'] {
  let earliest: Date | null = null;
  let latest: Date | null = null;
  let earliestTodMinutes = Infinity;
  let latestTodMinutes = -Infinity;

  function track(d: Date | null) {
    if (!d) return;
    if (!earliest || d.getTime() < earliest.getTime()) earliest = d;
    if (!latest || d.getTime() > latest.getTime()) latest = d;
    const m = d.getHours() * 60 + d.getMinutes();
    if (m < earliestTodMinutes) earliestTodMinutes = m;
    if (m > latestTodMinutes) latestTodMinutes = m;
  }

  for (const trip of trips) {
    track(
      asDate(trip.pickup_arrive_time ?? '') ??
      asDate(trip.pickup_leave_time ?? '') ??
      asDate(trip.scheduled_pickup_time),
    );
    track(
      asDate(trip.dropoff_leave_time ?? '') ??
      asDate(trip.dropoff_arrive_time ?? '') ??
      asDate(trip.scheduled_appointment_time),
    );
  }

  for (const route of routes) {
    track(routeStart(route));
    track(routeEnd(route));
  }

  if (!earliest || !latest || earliestTodMinutes === Infinity) {
    return {
      startLabel: '--:--',
      endLabel: '--:--',
      durationLabel: '--',
      isTwentyFourHours: false,
      source: 'actual_preferred',
      earliestDataTime: null,
      latestDataTime: null,
    };
  }

  const startMinutes = Math.max(0, Math.floor((earliestTodMinutes - 30) / 15) * 15);
  const endMinutes = Math.min(24 * 60, Math.ceil((latestTodMinutes + 30) / 15) * 15);
  const durationMinutes = endMinutes - startMinutes;

  const formatClock = (m: number) => {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };

  const hours = Math.floor(durationMinutes / 60);
  const mins = durationMinutes % 60;

  return {
    startLabel: formatClock(startMinutes),
    endLabel: formatClock(endMinutes),
    durationLabel: `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`,
    isTwentyFourHours: durationMinutes >= 24 * 60,
    source: 'actual_preferred',
    earliestDataTime: formatDateTimeLabel(earliest),
    latestDataTime: formatDateTimeLabel(latest),
  };
}

export function computeServiceDayWindow(
  trips: TripRow[],
  routes: RouteRow[],
): { start: string; end: string } | null {
  let earliestMinutes: number | null = null;
  let latestMinutes: number | null = null;

  function updateFromDate(d: Date | null) {
    if (!d) return;
    const minutes = d.getHours() * 60 + d.getMinutes();
    if (earliestMinutes === null || minutes < earliestMinutes) earliestMinutes = minutes;
    if (latestMinutes === null || minutes > latestMinutes) latestMinutes = minutes;
  }

  for (const trip of trips) {
    updateFromDate(
      asDate(trip.pickup_arrive_time ?? '') ??
      asDate(trip.pickup_leave_time ?? '') ??
      asDate(trip.scheduled_pickup_time),
    );
    updateFromDate(
      asDate(trip.dropoff_leave_time ?? '') ??
      asDate(trip.dropoff_arrive_time ?? '') ??
      asDate(trip.scheduled_appointment_time),
    );
  }

  for (const route of routes) {
    updateFromDate(routeStart(route));
    updateFromDate(routeEnd(route));
  }

  if (earliestMinutes === null || latestMinutes === null) return null;

  const startMinutes = Math.max(0, Math.floor((earliestMinutes - 30) / 15) * 15);
  const endMinutes = Math.min(24 * 60, Math.ceil((latestMinutes + 30) / 15) * 15);

  const formatClock = (m: number) => {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };

  return { start: formatClock(startMinutes), end: formatClock(endMinutes) };
}

export interface PerRouteMetricsOptions {
  selectedDays?: number[];
  specificDate?: string;
  selectedRouteIds?: string[];
  pickupOtpWindowBefore: number;
  pickupOtpWindowAfter: number;
  dropoffOtpWindowBefore: number;
  dropoffOtpWindowAfter: number;
}

export function computePerRouteMetrics(
  routes: RouteRow[],
  trips: TripRow[],
  options: PerRouteMetricsOptions,
): PerRouteMetrics[] {
  const optSpecificDate = options.specificDate ?? null;
  const selectedDaysSet = optSpecificDate
    ? null
    : options.selectedDays
      ? new Set(options.selectedDays)
      : null;

  // Group route instances by name, filtered by day
  const routesByName = new Map<string, RouteRow[]>();
  for (const route of routes) {
    const start = routeStart(route);
    if (!start) continue;
    if (optSpecificDate) {
      if (dateKey(start) !== optSpecificDate) continue;
    } else if (selectedDaysSet && !selectedDaysSet.has(start.getDay())) {
      continue;
    }
    if (options.selectedRouteIds?.length && !options.selectedRouteIds.includes(route.route_id)) {
      continue;
    }
    const name = route.route_name ?? route.route_id;
    if (!routesByName.has(name)) routesByName.set(name, []);
    routesByName.get(name)!.push(route);
  }

  // Group trips by route_id, filtered by day
  const tripsByRouteId = new Map<string, TripRow[]>();
  for (const trip of trips) {
    const pickup = tripPickupTime(trip);
    if (!pickup) continue;
    if (optSpecificDate) {
      if (dateKey(pickup) !== optSpecificDate) continue;
    } else if (selectedDaysSet && !selectedDaysSet.has(pickup.getDay())) {
      continue;
    }
    if (options.selectedRouteIds?.length && !options.selectedRouteIds.includes(trip.route_id)) {
      continue;
    }
    if (!tripsByRouteId.has(trip.route_id)) tripsByRouteId.set(trip.route_id, []);
    tripsByRouteId.get(trip.route_id)!.push(trip);
  }

  const results: PerRouteMetrics[] = [];

  for (const [routeName, routeInstances] of routesByName) {
    // Collect all route_ids for this name
    const routeIds = new Set(routeInstances.map((r) => r.route_id));
    const dayCount = Math.max(1, new Set(routeInstances.map((r) => {
      const s = routeStart(r);
      return s ? dateKey(s) : '';
    }).filter(Boolean)).size);

    // Aggregate trips across all route_ids for this name
    let totalTrips = 0;
    let totalPassengers = 0;
    let pickupEligible = 0;
    let pickupOnTime = 0;
    let dropoffEligible = 0;
    let dropoffOnTime = 0;

    // Per route-instance tracking: revenue span and trip intervals for occupied time
    const perInstance = new Map<string, {
      serviceMs: number;
      firstPickupMs: number;
      lastDropMs: number;
      tripIntervals: [number, number][];
    }>();

    // Initialize each route instance with service hours
    for (const r of routeInstances) {
      const s = asDate(r.scheduled_start_time);
      const e = asDate(r.scheduled_end_time);
      const serviceMs = s && e ? Math.max(0, e.getTime() - s.getTime()) : 0;
      perInstance.set(r.route_id, {
        serviceMs,
        firstPickupMs: Infinity,
        lastDropMs: -Infinity,
        tripIntervals: [],
      });
    }

    for (const routeId of routeIds) {
      const inst = perInstance.get(routeId);
      const routeTrips = tripsByRouteId.get(routeId) ?? [];
      for (const trip of routeTrips) {
        totalTrips += 1;
        totalPassengers += parsePassengerCount(trip.passenger_count);

        const pickupTime = tripPickupTime(trip);
        const dropoffTime = tripDropoffTime(trip);

        if (inst) {
          // Track first pickup and last drop per route instance
          if (pickupTime) {
            inst.firstPickupMs = Math.min(inst.firstPickupMs, pickupTime.getTime());
          }
          if (dropoffTime) {
            inst.lastDropMs = Math.max(inst.lastDropMs, dropoffTime.getTime());
          }
          // Collect trip interval for merged occupied time calculation
          // (handles shared rides — overlapping intervals are merged later)
          // Only completed trips count toward on-board / occupied time
          if (pickupTime && dropoffTime && trip.status === 'completed') {
            inst.tripIntervals.push([pickupTime.getTime(), dropoffTime.getTime()]);
          }
        }

        // Pickup OTP
        const scheduledPickup = asDate(trip.scheduled_pickup_time);
        const actualPickup = asDate(trip.pickup_arrive_time ?? '') ?? asDate(trip.pickup_leave_time ?? '');
        if (scheduledPickup && actualPickup) {
          pickupEligible += 1;
          if (isOnTimeWithWindow({
            actual: actualPickup,
            scheduled: scheduledPickup,
            beforeMin: options.pickupOtpWindowBefore,
            afterMin: options.pickupOtpWindowAfter,
          })) {
            pickupOnTime += 1;
          }
        }

        // Dropoff OTP
        const hasScheduledAppt = Boolean(trip.scheduled_appointment_time);
        const scheduledDropoff = hasScheduledAppt ? asDate(trip.scheduled_appointment_time) : null;
        const actualDropoff = asDate(trip.dropoff_arrive_time ?? '') ?? asDate(trip.dropoff_leave_time ?? '');
        if (scheduledDropoff && actualDropoff) {
          dropoffEligible += 1;
          if (isOnTimeWithWindow({
            actual: actualDropoff,
            scheduled: scheduledDropoff,
            beforeMin: options.dropoffOtpWindowBefore,
            afterMin: options.dropoffOtpWindowAfter,
          })) {
            dropoffOnTime += 1;
          }
        }
      }
    }

    // Aggregate per-instance metrics across days
    let totalServiceMs = 0;
    let totalRevenueMs = 0;
    let totalOccupiedMs = 0;
    for (const [, inst] of perInstance) {
      totalServiceMs += inst.serviceMs;
      if (inst.firstPickupMs < Infinity && inst.lastDropMs > -Infinity) {
        totalRevenueMs += Math.max(0, inst.lastDropMs - inst.firstPickupMs);
      }
      // Merge overlapping trip intervals so shared rides aren't double-counted
      totalOccupiedMs += mergedIntervalDuration(inst.tripIntervals);
    }

    const serviceHours = Math.round((totalServiceMs / dayCount / 3_600_000) * 10) / 10;
    const revenueHours = Math.round((totalRevenueMs / dayCount / 3_600_000) * 10) / 10;
    const occupiedMinutes = Math.round((totalOccupiedMs / dayCount / 60_000) * 10) / 10;

    // Utilization = time with passengers on board / total service time
    // Merged intervals ensure shared rides only count once
    const serviceMinutesTotal = serviceHours * 60;
    const utilizationPct = serviceMinutesTotal > 0
      ? Math.round(Math.min(100, (occupiedMinutes / serviceMinutesTotal) * 100) * 10) / 10
      : 0;

    // Productivity: avg trips per day / service hours
    const avgTripsPerDay = totalTrips / dayCount;
    const productivity = serviceHours > 0
      ? Math.round((avgTripsPerDay / serviceHours) * 100) / 100
      : 0;

    results.push({
      routeName,
      trips: Math.round((totalTrips / dayCount) * 10) / 10,
      passengers: Math.round((totalPassengers / dayCount) * 10) / 10,
      pickupOtpPct: pickupEligible > 0 ? Math.round((pickupOnTime / pickupEligible) * 1000) / 10 : 0,
      dropoffOtpPct: dropoffEligible > 0 ? Math.round((dropoffOnTime / dropoffEligible) * 1000) / 10 : 0,
      productivity,
      serviceHours,
      revenueHours,
      occupiedMinutes,
      utilizationPct,
    });
  }

  return results.sort((a, b) => a.routeName.localeCompare(b.routeName));
}

export function computeClearcutMetrics(
  session: SessionState,
  options: ComputeMetricsOptions = {},
): ClearcutMetrics {
  const baseStart = parseMinutes(session.settings.service_day_start, 240);
  const baseEnd = parseMinutes(session.settings.service_day_end, 1260);
  const startMinutes = parseMinutes(
    options.timeRangeStart !== undefined ? options.timeRangeStart : session.settings.time_range_start,
    baseStart,
  );
  const endMinutes = parseMinutes(
    options.timeRangeEnd !== undefined ? options.timeRangeEnd : session.settings.time_range_end,
    baseEnd,
  );
  const normalizedEnd = endMinutes > startMinutes ? endMinutes : startMinutes + 60;
  const blockSizeMinutes = options.blockSizeMinutes ?? 15;
  const blockCount = Math.max(4, Math.ceil((normalizedEnd - startMinutes) / blockSizeMinutes));
  const blocks: TimeBlock[] = Array.from({ length: blockCount }).map((_, index) => {
    const start = startMinutes + index * blockSizeMinutes;
    return {
      key: `block-${index}`,
      label: blockLabel(start),
      startMinutes: start,
      endMinutes: start + blockSizeMinutes,
    };
  });

  const pickupsByBlock = Array.from({ length: blockCount }).fill(0) as number[];
  const completedPickupsByBlock = Array.from({ length: blockCount }).fill(0) as number[];
  const pickupsPassengersByBlock = Array.from({ length: blockCount }).fill(0) as number[];
  const completedPassengersByBlock = Array.from({ length: blockCount }).fill(0) as number[];
  const onBoardByBlock = Array.from({ length: blockCount }).fill(0) as number[];
  const vehiclesByBlock = Array.from({ length: blockCount }).fill(0) as number[];
  const breaksByBlock = Array.from({ length: blockCount }).fill(0) as number[];
  const deadheadByBlock = Array.from({ length: blockCount }).fill(0) as number[];
  const otpByBlock = Array.from({ length: blockCount }).fill(0) as number[];
  const pickupOtpByBlock = Array.from({ length: blockCount }).fill(0) as number[];
  const dropoffOtpByBlock = Array.from({ length: blockCount }).fill(0) as number[];
  const tripOtpByBlock = Array.from({ length: blockCount }).fill(0) as number[];
  const productivityByBlock = Array.from({ length: blockCount }).fill(0) as number[];
  const blockTripCounts = Array.from({ length: blockCount }).fill(0) as number[];
  const pickupEligibleCounts = Array.from({ length: blockCount }).fill(0) as number[];
  const pickupOnTimeCounts = Array.from({ length: blockCount }).fill(0) as number[];
  const dropoffEligibleCounts = Array.from({ length: blockCount }).fill(0) as number[];
  const dropoffOnTimeCounts = Array.from({ length: blockCount }).fill(0) as number[];
  const tripEligibleCounts = Array.from({ length: blockCount }).fill(0) as number[];
  const tripOnTimeCounts = Array.from({ length: blockCount }).fill(0) as number[];
  const activeRouteIdsByDayBlock = new Map<string, Array<Set<string>>>();
  const occupiedRouteIdsByDayBlock = new Map<string, Array<Set<string>>>();
  const activeVehiclesRawByBlock = Array.from({ length: blockCount }).fill(0) as number[];
  const occupiedVehiclesRawByBlock = Array.from({ length: blockCount }).fill(0) as number[];
  const pickupsByDayBlock = new Map<string, number[]>();
  const completedPickupsByDayBlock = new Map<string, number[]>();
  const passengersByDayBlock = new Map<string, number[]>();
  const completedPassengersByDayBlock = new Map<string, number[]>();
  const vehiclesByDayBlock = new Map<string, number[]>();
  const breaksByDayBlock = new Map<string, number[]>();

  const pickupsByBlockByStatus: Record<string, number[]> = {};
  const pickupsByBlockByPassengerType: Record<string, number[]> = {};
  const completedPickupsByBlockByPassengerType: Record<string, number[]> = {};
  const pickupsByDayBlockByStatus: Record<string, Map<string, number[]>> = {};
  const pickupsByDayBlockByPassengerType: Record<string, Map<string, number[]>> = {};
  const completedPickupsByDayBlockByStatus: Record<string, Map<string, number[]>> = {};
  const completedPickupsByDayBlockByPassengerType: Record<string, Map<string, number[]>> = {};
  function ensureCatBlock(record: Record<string, number[]>, cat: string): number[] {
    if (!record[cat]) record[cat] = Array.from({ length: blockCount }).fill(0) as number[];
    return record[cat];
  }
  function ensureCatDayBlock(record: Record<string, Map<string, number[]>>, cat: string, dayKey: string): number[] {
    if (!record[cat]) record[cat] = new Map();
    let arr = record[cat].get(dayKey);
    if (!arr) { arr = Array.from({ length: blockCount }).fill(0) as number[]; record[cat].set(dayKey, arr); }
    return arr;
  }

  let totalPickupEligible = 0;
  let totalPickupOnTime = 0;
  let totalDropoffEligible = 0;
  let totalDropoffOnTime = 0;
  let totalTripEligible = 0;
  let totalTripOnTime = 0;
  const optSpecificDate = options.specificDate ?? null;
  const selectedDays = optSpecificDate ? null : resolveSelectedDays(session, options.selectedDays);
  const dayKeys = new Set<string>();

  for (const trip of session.trips) {
    const pickupTimestamp = tripPickupTime(trip);
    if (!pickupTimestamp) continue;
    const dk = dateKey(pickupTimestamp);
    if (optSpecificDate ? dk === optSpecificDate : selectedDays!.has(pickupTimestamp.getDay())) {
      dayKeys.add(dk);
    }
  }
  for (const route of session.routes) {
    const routeStartDate = routeStart(route);
    if (!routeStartDate) continue;
    const dk = dateKey(routeStartDate);
    if (optSpecificDate ? dk === optSpecificDate : selectedDays!.has(routeStartDate.getDay())) {
      dayKeys.add(dk);
    }
  }

  const dayCount = Math.max(dayKeys.size, 1);

  for (const trip of session.trips) {
    const pickupTimestamp = tripPickupTime(trip);
    if (!pickupTimestamp) continue;
    const tripDk = dateKey(pickupTimestamp);
    if (optSpecificDate ? tripDk !== optSpecificDate : !selectedDays!.has(pickupTimestamp.getDay())) {
      continue;
    }
    if (options.selectedRouteIds?.length && !options.selectedRouteIds.includes(trip.route_id)) {
      continue;
    }
    if (options.selectedZones?.length && (!trip.zone || !options.selectedZones.includes(trip.zone))) {
      continue;
    }

    if (options.selectedStatuses?.length && !options.selectedStatuses.includes(trip.status)) {
      continue;
    }
    if (options.selectedPassengerTypes?.length && !options.selectedPassengerTypes.includes(trip.passenger_type)) {
      continue;
    }

    const passengers = parsePassengerCount(trip.passenger_count);
    const tripDayKey = dateKey(pickupTimestamp);

    if (trip.status === 'completed') {
      const occupiedRouteBlocks = ensureDayBlockSets(occupiedRouteIdsByDayBlock, tripDayKey, blockCount);
      const onboardStart = pickupTimestamp;
      const onboardEnd = tripDropoffTime(trip) ?? pickupTimestamp;
      const onboardStartMinutes = dateToMinutes(onboardStart);
      const onboardEndMinutes = Math.max(onboardStartMinutes, dateToMinutes(onboardEnd));
      for (let blockIdx = 0; blockIdx < blocks.length; blockIdx += 1) {
        const block = blocks[blockIdx];
        if (onboardEndMinutes > block.startMinutes && onboardStartMinutes < block.endMinutes) {
          if (trip.route_id) {
            occupiedRouteBlocks[blockIdx].add(trip.route_id);
          }
        }
      }

      const compIdx = pickBlockIndex(dateToMinutes(pickupTimestamp), blocks);
      if (compIdx >= 0) {
        completedPickupsByBlock[compIdx] += 1;
        completedPassengersByBlock[compIdx] += passengers;
        ensureCatBlock(completedPickupsByBlockByPassengerType, trip.passenger_type)[compIdx] += 1;
        ensureCatDayBlock(completedPickupsByDayBlockByStatus, trip.status, tripDayKey)[compIdx] += 1;
        ensureCatDayBlock(completedPickupsByDayBlockByPassengerType, trip.passenger_type, tripDayKey)[compIdx] += 1;
        let dayCompleted = completedPickupsByDayBlock.get(tripDayKey);
        if (!dayCompleted) {
          dayCompleted = Array.from({ length: blockCount }).fill(0) as number[];
          completedPickupsByDayBlock.set(tripDayKey, dayCompleted);
        }
        dayCompleted[compIdx] += 1;
        let dayCompPax = completedPassengersByDayBlock.get(tripDayKey);
        if (!dayCompPax) {
          dayCompPax = Array.from({ length: blockCount }).fill(0) as number[];
          completedPassengersByDayBlock.set(tripDayKey, dayCompPax);
        }
        dayCompPax[compIdx] += passengers;
      }
    }

    // Skip pickup counting and OTP when pickup falls outside the visible time range
    const idx = pickBlockIndex(dateToMinutes(pickupTimestamp), blocks);
    if (idx < 0) {
      continue;
    }
    pickupsByBlock[idx] += 1;
    pickupsPassengersByBlock[idx] += passengers;
    blockTripCounts[idx] += 1;
    ensureCatBlock(pickupsByBlockByStatus, trip.status)[idx] += 1;
    ensureCatBlock(pickupsByBlockByPassengerType, trip.passenger_type)[idx] += 1;
    ensureCatDayBlock(pickupsByDayBlockByStatus, trip.status, tripDayKey)[idx] += 1;
    ensureCatDayBlock(pickupsByDayBlockByPassengerType, trip.passenger_type, tripDayKey)[idx] += 1;

    let dayPickups = pickupsByDayBlock.get(tripDayKey);
    if (!dayPickups) {
      dayPickups = Array.from({ length: blockCount }).fill(0) as number[];
      pickupsByDayBlock.set(tripDayKey, dayPickups);
    }
    dayPickups[idx] += 1;
    let dayPassengers = passengersByDayBlock.get(tripDayKey);
    if (!dayPassengers) {
      dayPassengers = Array.from({ length: blockCount }).fill(0) as number[];
      passengersByDayBlock.set(tripDayKey, dayPassengers);
    }
    dayPassengers[idx] += passengers;

    const scheduledPickup = asDate(trip.scheduled_pickup_time);
    const actualPickup = asDate(trip.pickup_arrive_time ?? '') ?? asDate(trip.pickup_leave_time ?? '');
    const hasPickupOtp = Boolean(scheduledPickup && actualPickup);
    let pickupOnTime = false;
    if (hasPickupOtp && scheduledPickup && actualPickup) {
      pickupOnTime = isOnTimeWithWindow({
        actual: actualPickup,
        scheduled: scheduledPickup,
        beforeMin: session.settings.pickup_otp_window_before_min,
        afterMin: session.settings.pickup_otp_window_after_min,
      });
      pickupEligibleCounts[idx] += 1;
      totalPickupEligible += 1;
      if (pickupOnTime) {
        pickupOnTimeCounts[idx] += 1;
        totalPickupOnTime += 1;
      }
    }

    const hasScheduledAppointment = Boolean(trip.scheduled_appointment_time);
    const scheduledDropoff = hasScheduledAppointment ? asDate(trip.scheduled_appointment_time) : null;
    const actualDropoff = asDate(trip.dropoff_arrive_time ?? '') ?? asDate(trip.dropoff_leave_time ?? '');
    const hasDropoffOtp = Boolean(hasScheduledAppointment && scheduledDropoff && actualDropoff);
    let dropoffOnTime = false;
    if (hasDropoffOtp && scheduledDropoff && actualDropoff) {
      dropoffOnTime = isOnTimeWithWindow({
        actual: actualDropoff,
        scheduled: scheduledDropoff,
        beforeMin: session.settings.dropoff_otp_window_before_min,
        afterMin: session.settings.dropoff_otp_window_after_min,
      });
      dropoffEligibleCounts[idx] += 1;
      totalDropoffEligible += 1;
      if (dropoffOnTime) {
        dropoffOnTimeCounts[idx] += 1;
        totalDropoffOnTime += 1;
      }
    }

    if (hasPickupOtp && hasDropoffOtp) {
      tripEligibleCounts[idx] += 1;
      totalTripEligible += 1;
      if (pickupOnTime && dropoffOnTime) {
        tripOnTimeCounts[idx] += 1;
        totalTripOnTime += 1;
      }
    }
  }

  for (const route of session.routes) {
    const start = routeStart(route);
    const end = routeEnd(route);
    if (!start || !end) continue;
    const routeDk = dateKey(start);
    if (optSpecificDate ? routeDk !== optSpecificDate : !selectedDays!.has(start.getDay())) {
      continue;
    }
    if (options.selectedRouteIds?.length && !options.selectedRouteIds.includes(route.route_id)) {
      continue;
    }
    if (options.selectedVehicleTypeIds?.length && !options.selectedVehicleTypeIds.includes(route.vehicle_type_id ?? '')) {
      continue;
    }
    const startM = dateToMinutes(start);
    const endM = Math.max(startM + 1, dateToMinutes(end));

    // Parse break windows so we can exclude them from vehicle counts
    const b1Start = asDate(route.break1_start);
    const b1End = asDate(route.break1_end);
    const b1StartM = b1Start ? dateToMinutes(b1Start) : null;
    const b1EndM = b1End ? dateToMinutes(b1End) : null;
    const b2Start = asDate(route.break2_start);
    const b2End = asDate(route.break2_end);
    const b2StartM = b2Start ? dateToMinutes(b2Start) : null;
    const b2EndM = b2End ? dateToMinutes(b2End) : null;

    const routeDayKey = dateKey(start);
    const activeRouteBlocks = ensureDayBlockSets(activeRouteIdsByDayBlock, routeDayKey, blockCount);
    for (let i = 0; i < blocks.length; i += 1) {
      const block = blocks[i];
      if (endM > block.startMinutes && startM < block.endMinutes) {
        // Skip blocks fully contained within a break window
        const inBreak1 = b1StartM != null && b1EndM != null
          && block.startMinutes >= b1StartM && block.endMinutes <= b1EndM;
        const inBreak2 = b2StartM != null && b2EndM != null
          && block.startMinutes >= b2StartM && block.endMinutes <= b2EndM;
        if (inBreak1 || inBreak2) {
          breaksByBlock[i] += 1;
          let dayBreaks = breaksByDayBlock.get(routeDayKey);
          if (!dayBreaks) {
            dayBreaks = Array.from({ length: blockCount }).fill(0) as number[];
            breaksByDayBlock.set(routeDayKey, dayBreaks);
          }
          dayBreaks[i] += 1;
          continue;
        }

        vehiclesByBlock[i] += 1;
        activeRouteBlocks[i].add(route.route_id);
        let dayVehicles = vehiclesByDayBlock.get(routeDayKey);
        if (!dayVehicles) {
          dayVehicles = Array.from({ length: blockCount }).fill(0) as number[];
          vehiclesByDayBlock.set(routeDayKey, dayVehicles);
        }
        dayVehicles[i] += 1;
      }
    }
  }

  for (const day of dayKeys) {
    const activeForDay = activeRouteIdsByDayBlock.get(day);
    const occupiedForDay = occupiedRouteIdsByDayBlock.get(day);
    for (let i = 0; i < blockCount; i += 1) {
      const activeSet = activeForDay?.[i] ?? new Set<string>();
      const occupiedSet = occupiedForDay?.[i] ?? new Set<string>();
      const activeCount = activeSet.size;
      let occupiedActiveCount = 0;
      for (const routeId of occupiedSet) {
        if (activeSet.has(routeId)) {
          occupiedActiveCount += 1;
        }
      }
      activeVehiclesRawByBlock[i] += activeCount;
      occupiedVehiclesRawByBlock[i] += occupiedActiveCount;
    }
  }

  const rideTimeStats = computeRideTimeStats(session.trips, selectedDays, optSpecificDate);
  const avgRideTimeMin = rideTimeStats.avg ?? session.settings.avg_ride_time_min;
  const peakRideTimeMin = rideTimeStats.max ?? 0;
  // <15 min: current block only; 15-30: current + 1 previous; 30-45: current + 2 previous; etc.
  const lookBackBlocks = Math.floor(avgRideTimeMin / blockSizeMinutes);

  for (let i = 0; i < blocks.length; i += 1) {
    pickupsByBlock[i] = Math.round((pickupsByBlock[i] / dayCount) * 10) / 10;
    pickupsPassengersByBlock[i] = Math.round((pickupsPassengersByBlock[i] / dayCount) * 10) / 10;
    completedPickupsByBlock[i] = Math.round((completedPickupsByBlock[i] / dayCount) * 10) / 10;
    completedPassengersByBlock[i] = Math.round((completedPassengersByBlock[i] / dayCount) * 10) / 10;
    // On-board = rolling sum of completed pickups from current + previous blocks based on avg ride time
    let onBoardSum = 0;
    for (let k = 0; k <= lookBackBlocks && i - k >= 0; k += 1) {
      onBoardSum += completedPickupsByBlock[i - k];
    }
    onBoardByBlock[i] = Math.round(onBoardSum * 10) / 10;
    vehiclesByBlock[i] = Math.round((vehiclesByBlock[i] / dayCount) * 10) / 10;
    breaksByBlock[i] = Math.round((breaksByBlock[i] / dayCount) * 10) / 10;
    const trips = blockTripCounts[i] / dayCount;
    pickupOtpByBlock[i] =
      pickupEligibleCounts[i] > 0 ? (pickupOnTimeCounts[i] / pickupEligibleCounts[i]) * 100 : 100;
    dropoffOtpByBlock[i] =
      dropoffEligibleCounts[i] > 0 ? (dropoffOnTimeCounts[i] / dropoffEligibleCounts[i]) * 100 : 100;
    tripOtpByBlock[i] = tripEligibleCounts[i] > 0 ? (tripOnTimeCounts[i] / tripEligibleCounts[i]) * 100 : 100;
    otpByBlock[i] = tripOtpByBlock[i];
    const vehicleHours = (vehiclesByBlock[i] * blockSizeMinutes) / 60;
    productivityByBlock[i] = vehicleHours > 0
      ? Math.round((trips / vehicleHours) * 100) / 100
      : 0;
    const activeVehiclesRaw = activeVehiclesRawByBlock[i];
    const occupiedVehiclesRaw = Math.min(occupiedVehiclesRawByBlock[i], activeVehiclesRaw);
    // Only show deadhead when there are meaningful active vehicles in this block (after averaging)
    deadheadByBlock[i] =
      activeVehiclesRaw > 0 && vehiclesByBlock[i] > 0
        ? Math.round((((activeVehiclesRaw - occupiedVehiclesRaw) / activeVehiclesRaw) * 100) * 10) / 10
        : 0;
  }

  // Average and derive onBoard/productivity per category
  const onBoardByBlockByStatus: Record<string, number[]> = {};
  const onBoardByBlockByPassengerType: Record<string, number[]> = {};
  const productivityByBlockByStatus: Record<string, number[]> = {};
  const productivityByBlockByPassengerType: Record<string, number[]> = {};

  for (const [cat, arr] of Object.entries(pickupsByBlockByStatus)) {
    const ob = Array.from({ length: blockCount }).fill(0) as number[];
    const prod = Array.from({ length: blockCount }).fill(0) as number[];
    const isCompleted = cat === 'completed';
    for (let i = 0; i < blockCount; i++) {
      arr[i] = Math.round((arr[i] / dayCount) * 10) / 10;
      if (isCompleted) {
        let sum = 0;
        for (let k = 0; k <= lookBackBlocks && i - k >= 0; k++) sum += arr[i - k];
        ob[i] = Math.round(sum * 10) / 10;
      }
      const vh = (vehiclesByBlock[i] * blockSizeMinutes) / 60;
      prod[i] = vh > 0 ? Math.round((arr[i] / vh) * 100) / 100 : 0;
    }
    onBoardByBlockByStatus[cat] = ob;
    productivityByBlockByStatus[cat] = prod;
  }
  for (const [cat, arr] of Object.entries(pickupsByBlockByPassengerType)) {
    const ob = Array.from({ length: blockCount }).fill(0) as number[];
    const prod = Array.from({ length: blockCount }).fill(0) as number[];
    const compArr = completedPickupsByBlockByPassengerType[cat];
    for (let i = 0; i < blockCount; i++) {
      arr[i] = Math.round((arr[i] / dayCount) * 10) / 10;
      if (compArr) {
        compArr[i] = Math.round((compArr[i] / dayCount) * 10) / 10;
        let sum = 0;
        for (let k = 0; k <= lookBackBlocks && i - k >= 0; k++) sum += compArr[i - k];
        ob[i] = Math.round(sum * 10) / 10;
      }
      const vh = (vehiclesByBlock[i] * blockSizeMinutes) / 60;
      prod[i] = vh > 0 ? Math.round((arr[i] / vh) * 100) / 100 : 0;
    }
    onBoardByBlockByPassengerType[cat] = ob;
    productivityByBlockByPassengerType[cat] = prod;
  }

  // Compute max-per-block across individual days
  const maxPickupsByBlock = Array.from({ length: blockCount }).fill(0) as number[];
  const maxOnBoardByBlock = Array.from({ length: blockCount }).fill(0) as number[];
  const maxVehiclesByBlock = Array.from({ length: blockCount }).fill(0) as number[];
  const maxBreaksByBlock = Array.from({ length: blockCount }).fill(0) as number[];

  for (const [, dayPickups] of pickupsByDayBlock) {
    for (let i = 0; i < blockCount; i += 1) {
      if (dayPickups[i] > maxPickupsByBlock[i]) {
        maxPickupsByBlock[i] = dayPickups[i];
      }
    }
  }
  for (const [, dayCompleted] of completedPickupsByDayBlock) {
    for (let i = 0; i < blockCount; i += 1) {
      let onBoardSum = 0;
      for (let k = 0; k <= lookBackBlocks && i - k >= 0; k += 1) {
        onBoardSum += dayCompleted[i - k];
      }
      if (onBoardSum > maxOnBoardByBlock[i]) {
        maxOnBoardByBlock[i] = onBoardSum;
      }
    }
  }

  for (const [, dayVehicles] of vehiclesByDayBlock) {
    for (let i = 0; i < blockCount; i += 1) {
      if (dayVehicles[i] > maxVehiclesByBlock[i]) {
        maxVehiclesByBlock[i] = dayVehicles[i];
      }
    }
  }

  for (const [, dayBreaks] of breaksByDayBlock) {
    for (let i = 0; i < blockCount; i += 1) {
      if (dayBreaks[i] > maxBreaksByBlock[i]) {
        maxBreaksByBlock[i] = dayBreaks[i];
      }
    }
  }

  // Max-per-block per category across individual days
  const maxPickupsByBlockByStatus: Record<string, number[]> = {};
  const maxPickupsByBlockByPassengerType: Record<string, number[]> = {};
  const maxOnBoardByBlockByStatus: Record<string, number[]> = {};
  const maxOnBoardByBlockByPassengerType: Record<string, number[]> = {};

  for (const [cat, dayMap] of Object.entries(pickupsByDayBlockByStatus)) {
    const maxArr = Array.from({ length: blockCount }).fill(0) as number[];
    for (const [, dayArr] of dayMap) {
      for (let i = 0; i < blockCount; i++) { if (dayArr[i] > maxArr[i]) maxArr[i] = dayArr[i]; }
    }
    maxPickupsByBlockByStatus[cat] = maxArr;
  }
  for (const [cat, dayMap] of Object.entries(pickupsByDayBlockByPassengerType)) {
    const maxArr = Array.from({ length: blockCount }).fill(0) as number[];
    for (const [, dayArr] of dayMap) {
      for (let i = 0; i < blockCount; i++) { if (dayArr[i] > maxArr[i]) maxArr[i] = dayArr[i]; }
    }
    maxPickupsByBlockByPassengerType[cat] = maxArr;
  }
  for (const [cat, dayMap] of Object.entries(completedPickupsByDayBlockByStatus)) {
    const maxArr = Array.from({ length: blockCount }).fill(0) as number[];
    for (const [, dayArr] of dayMap) {
      for (let i = 0; i < blockCount; i++) {
        let sum = 0;
        for (let k = 0; k <= lookBackBlocks && i - k >= 0; k++) sum += dayArr[i - k];
        if (sum > maxArr[i]) maxArr[i] = sum;
      }
    }
    maxOnBoardByBlockByStatus[cat] = maxArr;
  }
  for (const [cat, dayMap] of Object.entries(completedPickupsByDayBlockByPassengerType)) {
    const maxArr = Array.from({ length: blockCount }).fill(0) as number[];
    for (const [, dayArr] of dayMap) {
      for (let i = 0; i < blockCount; i++) {
        let sum = 0;
        for (let k = 0; k <= lookBackBlocks && i - k >= 0; k++) sum += dayArr[i - k];
        if (sum > maxArr[i]) maxArr[i] = sum;
      }
    }
    maxOnBoardByBlockByPassengerType[cat] = maxArr;
  }

  // Non-zero averages: for each block, average only across days that had >0 in that block
  function nonZeroAvgFromDayBlock(dayBlockMap: Map<string, number[]>, bc: number): number[] {
    const result = Array.from({ length: bc }).fill(0) as number[];
    for (let i = 0; i < bc; i++) {
      let sum = 0, count = 0;
      for (const [, dayArr] of dayBlockMap) {
        if (dayArr[i] > 0) { sum += dayArr[i]; count++; }
      }
      result[i] = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;
    }
    return result;
  }

  const avgNzPickupsByBlock = nonZeroAvgFromDayBlock(pickupsByDayBlock, blockCount);
  const avgNzVehiclesByBlock = nonZeroAvgFromDayBlock(vehiclesByDayBlock, blockCount);
  const avgNzBreaksByBlock = nonZeroAvgFromDayBlock(breaksByDayBlock, blockCount);

  // On-board non-zero avg: compute rolling sum per day, then average non-zero
  const avgNzOnBoardByBlock = (() => {
    const result = Array.from({ length: blockCount }).fill(0) as number[];
    for (let i = 0; i < blockCount; i++) {
      let sum = 0, count = 0;
      for (const [, dayCompleted] of completedPickupsByDayBlock) {
        let rollingSum = 0;
        for (let k = 0; k <= lookBackBlocks && i - k >= 0; k++) rollingSum += dayCompleted[i - k];
        if (rollingSum > 0) { sum += rollingSum; count++; }
      }
      result[i] = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;
    }
    return result;
  })();

  // Non-zero avg per category
  const avgNzPickupsByBlockByStatus: Record<string, number[]> = {};
  const avgNzPickupsByBlockByPassengerType: Record<string, number[]> = {};
  const avgNzOnBoardByBlockByStatus: Record<string, number[]> = {};
  const avgNzOnBoardByBlockByPassengerType: Record<string, number[]> = {};

  for (const [cat, dayMap] of Object.entries(pickupsByDayBlockByStatus)) {
    avgNzPickupsByBlockByStatus[cat] = nonZeroAvgFromDayBlock(dayMap, blockCount);
  }
  for (const [cat, dayMap] of Object.entries(pickupsByDayBlockByPassengerType)) {
    avgNzPickupsByBlockByPassengerType[cat] = nonZeroAvgFromDayBlock(dayMap, blockCount);
  }
  for (const [cat, dayMap] of Object.entries(completedPickupsByDayBlockByStatus)) {
    const result = Array.from({ length: blockCount }).fill(0) as number[];
    for (let i = 0; i < blockCount; i++) {
      let sum = 0, count = 0;
      for (const [, dayArr] of dayMap) {
        let rollingSum = 0;
        for (let k = 0; k <= lookBackBlocks && i - k >= 0; k++) rollingSum += dayArr[i - k];
        if (rollingSum > 0) { sum += rollingSum; count++; }
      }
      result[i] = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;
    }
    avgNzOnBoardByBlockByStatus[cat] = result;
  }
  for (const [cat, dayMap] of Object.entries(completedPickupsByDayBlockByPassengerType)) {
    const result = Array.from({ length: blockCount }).fill(0) as number[];
    for (let i = 0; i < blockCount; i++) {
      let sum = 0, count = 0;
      for (const [, dayArr] of dayMap) {
        let rollingSum = 0;
        for (let k = 0; k <= lookBackBlocks && i - k >= 0; k++) rollingSum += dayArr[i - k];
        if (rollingSum > 0) { sum += rollingSum; count++; }
      }
      result[i] = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;
    }
    avgNzOnBoardByBlockByPassengerType[cat] = result;
  }

  // Passenger-based on-board for cards — only completed trips
  const onBoardPassengersByBlock = Array.from({ length: blockCount }).fill(0) as number[];
  for (let i = 0; i < blockCount; i += 1) {
    let sum = 0;
    for (let k = 0; k <= lookBackBlocks && i - k >= 0; k += 1) {
      sum += completedPassengersByBlock[i - k];
    }
    onBoardPassengersByBlock[i] = Math.round(sum * 10) / 10;
  }
  const avgPeakOnBoardPassengers = Math.round(Math.max(...onBoardPassengersByBlock, 0) * 10) / 10;

  let maxPeakOnBoardPassengers = 0;
  let maxOnBoardPeakDate: string | null = null;
  for (const [dk, dayPassengers] of completedPassengersByDayBlock) {
    for (let i = 0; i < blockCount; i += 1) {
      let sum = 0;
      for (let k = 0; k <= lookBackBlocks && i - k >= 0; k += 1) {
        sum += dayPassengers[i - k];
      }
      if (sum > maxPeakOnBoardPassengers) {
        maxPeakOnBoardPassengers = sum;
        maxOnBoardPeakDate = dk;
      }
    }
  }

  function findPeakDate(byDayBlock: Map<string, number[]>): string | null {
    let bestDate: string | null = null;
    let bestVal = 0;
    for (const [dk, arr] of byDayBlock) {
      const dayMax = Math.max(...arr, 0);
      if (dayMax > bestVal) {
        bestVal = dayMax;
        bestDate = dk;
      }
    }
    return bestDate;
  }

  const tripMiles = session.trips.map(pickMiles).filter((m) => m > 0);
  const avgTripMiles = average(tripMiles);
  const deadheadThreshold = session.settings.deadhead_threshold_pct / 100;
  const enriched = session.trips.map((trip) => {
    const miles = pickMiles(trip);
    const deadheadMiles = miles * deadheadThreshold * 0.5;
    return { trip, miles, deadheadMiles };
  });
  const highDeadhead = enriched
    .filter((row) => row.miles > 0)
    .sort((a, b) => b.deadheadMiles - a.deadheadMiles);

  const splitIndex = Math.floor(highDeadhead.length / 2);
  const highDeadheadTripsStart = highDeadhead.slice(0, 6).map((row) => row.trip);
  const highDeadheadTripsEnd = highDeadhead.slice(splitIndex, splitIndex + 6).map((row) => row.trip);
  const derivedServiceWindow = deriveServiceWindow(session.trips, session.routes);

  // Compute average start/end deadhead from inter-trip odometer gaps, converted at 35mph.
  // Group trips by route + day so odometer gaps only compare same-day consecutive trips.
  const tripsByRouteDay = new Map<string, TripRow[]>();
  for (const trip of session.trips) {
    const pickup = tripPickupTime(trip);
    if (!pickup) continue;
    if (optSpecificDate ? dateKey(pickup) !== optSpecificDate : !selectedDays!.has(pickup.getDay())) continue;
    const key = `${trip.route_id}::${dateKey(pickup)}`;
    let arr = tripsByRouteDay.get(key);
    if (!arr) {
      arr = [];
      tripsByRouteDay.set(key, arr);
    }
    arr.push(trip);
  }
  const MAX_DEADHEAD_MILES = 30; // cap to filter erroneous data
  const startDeadheadMiles: number[] = [];
  const endDeadheadMiles: number[] = [];
  const allInterTripMiles: number[] = [];
  for (const dayTrips of tripsByRouteDay.values()) {
    if (dayTrips.length < 2) continue;
    // Sort trips by pickup time within this route-day
    dayTrips.sort((a, b) => {
      const aTime = tripPickupTime(a);
      const bTime = tripPickupTime(b);
      return (aTime?.getTime() ?? 0) - (bTime?.getTime() ?? 0);
    });
    // Compute inter-trip deadhead miles from odometer gaps
    for (let i = 0; i < dayTrips.length - 1; i++) {
      const dropOdo = Number(dayTrips[i].drop_odometer);
      const nextPickOdo = Number(dayTrips[i + 1].pick_odometer);
      if (Number.isFinite(dropOdo) && Number.isFinite(nextPickOdo)) {
        const gap = Math.max(0, nextPickOdo - dropOdo);
        if (gap > MAX_DEADHEAD_MILES) continue;
        allInterTripMiles.push(gap);
        if (i === 0) startDeadheadMiles.push(gap);
        if (i === dayTrips.length - 2) endDeadheadMiles.push(gap);
      }
    }
  }
  // Convert miles to minutes at 25mph
  const DEADHEAD_SPEED_MPH = 25;
  const milesToMinutes = (miles: number) => (miles / DEADHEAD_SPEED_MPH) * 60;
  const fallbackMiles = allInterTripMiles.length > 0 ? average(allInterTripMiles) : 0;
  const avgStartDeadheadMinutes = Math.round(
    milesToMinutes(startDeadheadMiles.length > 0 ? average(startDeadheadMiles) : fallbackMiles) * 10,
  ) / 10;
  const avgEndDeadheadMinutes = Math.round(
    milesToMinutes(endDeadheadMiles.length > 0 ? average(endDeadheadMiles) : fallbackMiles) * 10,
  ) / 10;

  // Yard slack and late return metrics
  const routeById = new Map<string, RouteRow>();
  for (const route of session.routes) {
    routeById.set(route.route_id, route);
  }

  const leaveYardSlacks: number[] = [];
  const returnYardSlacks: number[] = [];
  let lateReturnCount = 0;
  let totalRouteDaysForLate = 0;
  const allYardStartTrips: YardTripRow[] = [];
  const allYardEndTrips: YardTripRow[] = [];

  for (const [, dayTrips] of tripsByRouteDay) {
    if (dayTrips.length === 0) continue;
    const route = routeById.get(dayTrips[0].route_id);
    if (!route) continue;

    // Sort by pickup time (already sorted from earlier deadhead computation)
    const firstTrip = dayTrips[0];
    const lastTrip = dayTrips[dayTrips.length - 1];

    const rStart = routeStart(route);
    const rEnd = routeEnd(route);
    const schedEnd = asDate(route.scheduled_end_time);
    const firstPickup = tripPickupTime(firstTrip);
    const lastDropoff = tripDropoffTime(lastTrip);

    // Leave yard slack: (first pickup - route start) - travel time from depot
    const distToFirst = Number(route.distance_to_first_pick);
    const distFromLast = Number(route.distance_from_last_drop);
    const distToFirstValid = Number.isFinite(distToFirst) && distToFirst >= 0;
    const distFromLastValid = Number.isFinite(distFromLast) && distFromLast >= 0;

    if (rStart && firstPickup && distToFirstValid) {
      const gapMinutes = (firstPickup.getTime() - rStart.getTime()) / 60_000;
      const travelMin = milesToMinutes(distToFirst);
      leaveYardSlacks.push(Math.max(0, gapMinutes - travelMin));
      allYardStartTrips.push({
        trip_id: firstTrip.trip_id,
        route_id: firstTrip.route_id,
        yardDistanceMiles: Math.round(distToFirst * 10) / 10,
        travelTimeMinutes: Math.round(travelMin * 10) / 10,
      });
    }

    if (rEnd && lastDropoff && distFromLastValid) {
      const gapMinutes = (rEnd.getTime() - lastDropoff.getTime()) / 60_000;
      const travelMin = milesToMinutes(distFromLast);
      returnYardSlacks.push(Math.max(0, gapMinutes - travelMin));

      const isLate = schedEnd ? rEnd.getTime() > schedEnd.getTime() : false;
      const variance = schedEnd ? (rEnd.getTime() - schedEnd.getTime()) / 60_000 : 0;

      allYardEndTrips.push({
        trip_id: lastTrip.trip_id,
        route_id: lastTrip.route_id,
        yardDistanceMiles: Math.round(distFromLast * 10) / 10,
        travelTimeMinutes: Math.round(travelMin * 10) / 10,
        isLate,
        returnVarianceMinutes: Math.round(variance * 10) / 10,
      });
    }

    // Late return tracking
    if (rEnd && schedEnd) {
      totalRouteDaysForLate += 1;
      if (rEnd.getTime() > schedEnd.getTime()) {
        lateReturnCount += 1;
      }
    }
  }

  const avgLeaveYardSlackMinutes = Math.round(average(leaveYardSlacks) * 10) / 10;
  const avgReturnYardSlackMinutes = Math.round(average(returnYardSlacks) * 10) / 10;
  const lateReturnPct = totalRouteDaysForLate > 0
    ? Math.round((lateReturnCount / totalRouteDaysForLate) * 1000) / 10
    : 0;

  // Top 6 by distance descending
  const yardStartTrips = allYardStartTrips
    .sort((a, b) => b.yardDistanceMiles - a.yardDistanceMiles)
    .slice(0, 6);
  const yardEndTrips = allYardEndTrips
    .sort((a, b) => b.yardDistanceMiles - a.yardDistanceMiles)
    .slice(0, 6);

  const importedServiceHours = sumServiceHours(session.routes);
  const targetProductivity = session.optimization.target_productivity ?? 0;
  const optimizedServiceHours = Math.max(
    0,
    Math.round((importedServiceHours * 0.92 - targetProductivity) * 10) / 10,
  );

  return {
    blocks,
    pickupsByBlock,
    onBoardByBlock,
    vehiclesByBlock,
    vehiclesOnBreakByBlock: breaksByBlock,
    deadheadByBlock,
    otpByBlock,
    pickupOtpByBlock,
    dropoffOtpByBlock,
    tripOtpByBlock,
    productivityByBlock,
    maxPickupsByBlock,
    maxOnBoardByBlock,
    maxVehiclesByBlock,
    maxVehiclesOnBreakByBlock: maxBreaksByBlock,
    peakPickups: Math.max(...pickupsByBlock, 0),
    peakVehicles: Math.max(...vehiclesByBlock, 0),
    peakOnBoard: Math.round(Math.max(...onBoardByBlock, 0) * 10) / 10,
    avgOnBoard: Math.round(average(onBoardByBlock) * 10) / 10,
    maxPeakPickups: Math.max(...maxPickupsByBlock, 0),
    maxPeakOnBoardPassengers: Math.round(maxPeakOnBoardPassengers * 10) / 10,
    avgPeakOnBoardPassengers,
    maxPeakVehicles: Math.max(...maxVehiclesByBlock, 0),
    maxPeakPickupsDate: findPeakDate(pickupsByDayBlock),
    maxPeakOnBoardDate: maxOnBoardPeakDate,
    maxPeakVehiclesDate: findPeakDate(vehiclesByDayBlock),
    avgOtp: totalTripEligible > 0 ? Math.round((totalTripOnTime / totalTripEligible) * 1000) / 10 : 0,
    pickupOtpPct: totalPickupEligible > 0 ? Math.round((totalPickupOnTime / totalPickupEligible) * 1000) / 10 : 0,
    dropoffOtpPct:
      totalDropoffEligible > 0 ? Math.round((totalDropoffOnTime / totalDropoffEligible) * 1000) / 10 : 0,
    tripOtpPct: totalTripEligible > 0 ? Math.round((totalTripOnTime / totalTripEligible) * 1000) / 10 : 0,
    blocksBelowOtp: tripOtpByBlock.filter((value) => value < session.settings.otp_target_pct).length,
    avgProductivity: (() => {
      const totalTripsPerDay = pickupsByBlock.reduce((a, b) => a + b, 0);
      const totalVehicleBlocksPerDay = vehiclesByBlock.reduce((a, b) => a + b, 0);
      const totalVehicleHoursPerDay = (totalVehicleBlocksPerDay * blockSizeMinutes) / 60;
      return totalVehicleHoursPerDay > 0
        ? Math.round((totalTripsPerDay / totalVehicleHoursPerDay) * 100) / 100
        : 0;
    })(),
    peakProductivity: Math.round(Math.max(...productivityByBlock, 0) * 100) / 100,
    totalTrips: session.trips.length,
    totalPassengers: Math.round(pickupsPassengersByBlock.reduce((a, b) => a + b, 0) * dayCount),
    avgTripsPerDay: Math.round(pickupsByBlock.reduce((a, b) => a + b, 0) * 10) / 10,
    maxTripsPerDay: (() => {
      let max = 0;
      for (const [, dayPickups] of pickupsByDayBlock) {
        const dayTotal = dayPickups.reduce((a, b) => a + b, 0);
        if (dayTotal > max) max = dayTotal;
      }
      return max;
    })(),
    avgPassengersPerDay: Math.round(pickupsPassengersByBlock.reduce((a, b) => a + b, 0) * 10) / 10,
    maxPassengersPerDay: (() => {
      let max = 0;
      for (const [, dayPassengers] of passengersByDayBlock) {
        const dayTotal = dayPassengers.reduce((a, b) => a + b, 0);
        if (dayTotal > max) max = dayTotal;
      }
      return max;
    })(),
    ...(() => {
      const perRoute = computePerRouteMetrics(session.routes, session.trips, {
        selectedDays: options.selectedDays,
        specificDate: options.specificDate,
        selectedRouteIds: options.selectedRouteIds,
        pickupOtpWindowBefore: session.settings.pickup_otp_window_before_min,
        pickupOtpWindowAfter: session.settings.pickup_otp_window_after_min,
        dropoffOtpWindowBefore: session.settings.dropoff_otp_window_before_min,
        dropoffOtpWindowAfter: session.settings.dropoff_otp_window_after_min,
      });
      const count = perRoute.length || 1;
      return {
        avgUtilizationPct: Math.round((perRoute.reduce((s, r) => s + r.utilizationPct, 0) / count) * 10) / 10,
        // Sum across routes (each is already a per-day average) to get total per day
        avgServiceHours: Math.round(perRoute.reduce((s, r) => s + r.serviceHours, 0) * 10) / 10,
        avgRevenueHours: Math.round(perRoute.reduce((s, r) => s + r.revenueHours, 0) * 10) / 10,
      };
    })(),
    currentRuns: session.routes.length,
    optimizedRuns: Math.max(1, session.routes.length - Math.ceil(session.routes.length * 0.12)),
    importedServiceHours,
    optimizedServiceHours,
    avgOnBoardTimeMinutes: Math.round(avgRideTimeMin * 10) / 10,
    peakOnBoardTimeMinutes: Math.round(peakRideTimeMin * 10) / 10,
    avgTripMiles: Math.round(avgTripMiles * 10) / 10,
    avgStartDeadheadMinutes,
    avgEndDeadheadMinutes,
    avgDeadheadStartMiles: Math.round(average(deadheadByBlock.slice(0, 8)) * 10) / 10,
    avgDeadheadEndMiles: Math.round(average(deadheadByBlock.slice(-8)) * 10) / 10,
    highDeadheadTripsStart,
    highDeadheadTripsEnd,
    avgLeaveYardSlackMinutes,
    avgReturnYardSlackMinutes,
    lateReturnPct,
    yardStartTrips,
    yardEndTrips,
    derivedServiceWindow,
    pickupsByBlockByStatus,
    pickupsByBlockByPassengerType,
    onBoardByBlockByStatus,
    onBoardByBlockByPassengerType,
    productivityByBlockByStatus,
    productivityByBlockByPassengerType,
    maxPickupsByBlockByStatus,
    maxPickupsByBlockByPassengerType,
    maxOnBoardByBlockByStatus,
    maxOnBoardByBlockByPassengerType,
    avgNzPickupsByBlock,
    avgNzOnBoardByBlock,
    avgNzVehiclesByBlock,
    avgNzVehiclesOnBreakByBlock: avgNzBreaksByBlock,
    avgNzPickupsByBlockByStatus,
    avgNzPickupsByBlockByPassengerType,
    avgNzOnBoardByBlockByStatus,
    avgNzOnBoardByBlockByPassengerType,
  };
}
