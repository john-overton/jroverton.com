import type { RouteRow, SessionState, TripRow } from './types';

export interface TimeBlock {
  key: string;
  label: string;
  startMinutes: number;
  endMinutes: number;
}

export interface ClearcutMetrics {
  blocks: TimeBlock[];
  pickupsByBlock: number[];
  onBoardByBlock: number[];
  vehiclesByBlock: number[];
  deadheadByBlock: number[];
  otpByBlock: number[];
  pickupOtpByBlock: number[];
  dropoffOtpByBlock: number[];
  tripOtpByBlock: number[];
  productivityByBlock: number[];
  maxPickupsByBlock: number[];
  maxOnBoardByBlock: number[];
  maxVehiclesByBlock: number[];
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
  currentRuns: number;
  optimizedRuns: number;
  importedServiceHours: number;
  optimizedServiceHours: number;
  avgTripMiles: number;
  avgStartDeadheadMinutes: number;
  avgEndDeadheadMinutes: number;
  avgDeadheadStartMiles: number;
  avgDeadheadEndMiles: number;
  highDeadheadTripsStart: TripRow[];
  highDeadheadTripsEnd: TripRow[];
  derivedServiceWindow: {
    startLabel: string;
    endLabel: string;
    durationLabel: string;
    isTwentyFourHours: boolean;
    source: 'actual_preferred';
    earliestDataTime: string | null;
    latestDataTime: string | null;
  };
}

interface ComputeMetricsOptions {
  selectedDays?: number[];
  specificDate?: string;
  timeRangeStart?: string | null;
  timeRangeEnd?: string | null;
  blockSizeMinutes?: number;
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

function computeActualAvgRideTime(
  trips: TripRow[],
  selectedDays: Set<number> | null,
  filterDate: string | null,
): number | null {
  const rideTimes: number[] = [];
  for (const trip of trips) {
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
  return rideTimes.length > 0 ? rideTimes.reduce((a, b) => a + b, 0) / rideTimes.length : null;
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
  const pickupsPassengersByBlock = Array.from({ length: blockCount }).fill(0) as number[];
  const onBoardByBlock = Array.from({ length: blockCount }).fill(0) as number[];
  const vehiclesByBlock = Array.from({ length: blockCount }).fill(0) as number[];
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
  const passengersByDayBlock = new Map<string, number[]>();
  const vehiclesByDayBlock = new Map<string, number[]>();

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

    const passengers = parsePassengerCount(trip.passenger_count);
    const tripDayKey = dateKey(pickupTimestamp);
    const occupiedRouteBlocks = ensureDayBlockSets(occupiedRouteIdsByDayBlock, tripDayKey, blockCount);
    // Occupied routes for deadhead: which blocks does this trip overlap (pickup to dropoff)
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

    // Skip pickup counting and OTP when pickup falls outside the visible time range
    const idx = pickBlockIndex(dateToMinutes(pickupTimestamp), blocks);
    if (idx < 0) {
      continue;
    }
    pickupsByBlock[idx] += 1;
    pickupsPassengersByBlock[idx] += passengers;
    blockTripCounts[idx] += 1;

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
    const startM = dateToMinutes(start);
    const endM = Math.max(startM + 1, dateToMinutes(end));
    const routeDayKey = dateKey(start);
    const activeRouteBlocks = ensureDayBlockSets(activeRouteIdsByDayBlock, routeDayKey, blockCount);
    for (let i = 0; i < blocks.length; i += 1) {
      const block = blocks[i];
      if (endM > block.startMinutes && startM < block.endMinutes) {
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

  const avgRideTimeMin =
    computeActualAvgRideTime(session.trips, selectedDays, optSpecificDate) ?? session.settings.avg_ride_time_min;
  // <15 min: current block only; 15-30: current + 1 previous; 30-45: current + 2 previous; etc.
  const lookBackBlocks = Math.floor(avgRideTimeMin / blockSizeMinutes);

  for (let i = 0; i < blocks.length; i += 1) {
    pickupsByBlock[i] = Math.round((pickupsByBlock[i] / dayCount) * 10) / 10;
    pickupsPassengersByBlock[i] = Math.round((pickupsPassengersByBlock[i] / dayCount) * 10) / 10;
    // On-board = rolling sum of pickups (passengers) from current + previous blocks based on avg ride time
    let onBoardSum = 0;
    for (let k = 0; k <= lookBackBlocks && i - k >= 0; k += 1) {
      onBoardSum += pickupsByBlock[i - k];
    }
    onBoardByBlock[i] = Math.round(onBoardSum * 10) / 10;
    vehiclesByBlock[i] = Math.round((vehiclesByBlock[i] / dayCount) * 10) / 10;
    const trips = blockTripCounts[i] / dayCount;
    pickupOtpByBlock[i] =
      pickupEligibleCounts[i] > 0 ? (pickupOnTimeCounts[i] / pickupEligibleCounts[i]) * 100 : 0;
    dropoffOtpByBlock[i] =
      dropoffEligibleCounts[i] > 0 ? (dropoffOnTimeCounts[i] / dropoffEligibleCounts[i]) * 100 : 0;
    tripOtpByBlock[i] = tripEligibleCounts[i] > 0 ? (tripOnTimeCounts[i] / tripEligibleCounts[i]) * 100 : 0;
    otpByBlock[i] = tripOtpByBlock[i];
    productivityByBlock[i] = vehiclesByBlock[i] > 0 ? trips / vehiclesByBlock[i] : 0;
    const activeVehiclesRaw = activeVehiclesRawByBlock[i];
    const occupiedVehiclesRaw = Math.min(occupiedVehiclesRawByBlock[i], activeVehiclesRaw);
    // Only show deadhead when there are meaningful active vehicles in this block (after averaging)
    deadheadByBlock[i] =
      activeVehiclesRaw > 0 && vehiclesByBlock[i] > 0
        ? Math.round((((activeVehiclesRaw - occupiedVehiclesRaw) / activeVehiclesRaw) * 100) * 10) / 10
        : 0;
  }

  // Compute max-per-block across individual days
  const maxPickupsByBlock = Array.from({ length: blockCount }).fill(0) as number[];
  const maxOnBoardByBlock = Array.from({ length: blockCount }).fill(0) as number[];
  const maxVehiclesByBlock = Array.from({ length: blockCount }).fill(0) as number[];

  for (const [, dayPickups] of pickupsByDayBlock) {
    for (let i = 0; i < blockCount; i += 1) {
      if (dayPickups[i] > maxPickupsByBlock[i]) {
        maxPickupsByBlock[i] = dayPickups[i];
      }
    }
    for (let i = 0; i < blockCount; i += 1) {
      let onBoardSum = 0;
      for (let k = 0; k <= lookBackBlocks && i - k >= 0; k += 1) {
        onBoardSum += dayPickups[i - k];
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

  // Passenger-based on-board for cards (separate from trip-count chart)
  const onBoardPassengersByBlock = Array.from({ length: blockCount }).fill(0) as number[];
  for (let i = 0; i < blockCount; i += 1) {
    let sum = 0;
    for (let k = 0; k <= lookBackBlocks && i - k >= 0; k += 1) {
      sum += pickupsPassengersByBlock[i - k];
    }
    onBoardPassengersByBlock[i] = Math.round(sum * 10) / 10;
  }
  const avgPeakOnBoardPassengers = Math.round(Math.max(...onBoardPassengersByBlock, 0) * 10) / 10;

  let maxPeakOnBoardPassengers = 0;
  let maxOnBoardPeakDate: string | null = null;
  for (const [dk, dayPassengers] of passengersByDayBlock) {
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
    deadheadByBlock,
    otpByBlock,
    pickupOtpByBlock,
    dropoffOtpByBlock,
    tripOtpByBlock,
    productivityByBlock,
    maxPickupsByBlock,
    maxOnBoardByBlock,
    maxVehiclesByBlock,
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
    currentRuns: session.routes.length,
    optimizedRuns: Math.max(1, session.routes.length - Math.ceil(session.routes.length * 0.12)),
    importedServiceHours,
    optimizedServiceHours,
    avgTripMiles: Math.round(avgTripMiles * 10) / 10,
    avgStartDeadheadMinutes,
    avgEndDeadheadMinutes,
    avgDeadheadStartMiles: Math.round(average(deadheadByBlock.slice(0, 8)) * 10) / 10,
    avgDeadheadEndMiles: Math.round(average(deadheadByBlock.slice(-8)) * 10) / 10,
    highDeadheadTripsStart,
    highDeadheadTripsEnd,
    derivedServiceWindow,
  };
}
