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
  peakPickups: number;
  peakVehicles: number;
  peakOnBoard: number;
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
  timeRangeStart?: string | null;
  timeRangeEnd?: string | null;
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
  const idx = blocks.findIndex((block) => minutes >= block.startMinutes && minutes < block.endMinutes);
  return idx >= 0 ? idx : Math.max(0, blocks.length - 1);
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

function deriveServiceWindow(trips: TripRow[]): ClearcutMetrics['derivedServiceWindow'] {
  let earliest: Date | null = null;
  let latest: Date | null = null;

  for (const trip of trips) {
    const startCandidate =
      asDate(trip.pickup_arrive_time ?? '') ??
      asDate(trip.pickup_leave_time ?? '') ??
      asDate(trip.scheduled_pickup_time);
    const endCandidate =
      asDate(trip.dropoff_leave_time ?? '') ??
      asDate(trip.dropoff_arrive_time ?? '') ??
      asDate(trip.scheduled_appointment_time);

    if (startCandidate && (!earliest || startCandidate.getTime() < earliest.getTime())) {
      earliest = startCandidate;
    }
    if (endCandidate && (!latest || endCandidate.getTime() > latest.getTime())) {
      latest = endCandidate;
    }
  }

  if (!earliest || !latest) {
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

  const derivedStart = new Date(earliest.getTime() - 60 * 60 * 1000);
  const derivedEnd = new Date(latest.getTime() + 60 * 60 * 1000);
  const rawDurationMinutes = Math.max(0, Math.round((derivedEnd.getTime() - derivedStart.getTime()) / 60000));
  const crossesMidnight =
    derivedStart.toDateString() !== derivedEnd.toDateString() || rawDurationMinutes >= 24 * 60;

  if (crossesMidnight) {
    return {
      startLabel: '00:00',
      endLabel: '24:00',
      durationLabel: '24:00',
      isTwentyFourHours: true,
      source: 'actual_preferred',
      earliestDataTime: formatDateTimeLabel(earliest),
      latestDataTime: formatDateTimeLabel(latest),
    };
  }

  const hours = Math.floor(rawDurationMinutes / 60);
  const minutes = rawDurationMinutes % 60;
  const durationLabel = `${`${hours}`.padStart(2, '0')}:${`${minutes}`.padStart(2, '0')}`;

  return {
    startLabel: formatClockLabel(derivedStart),
    endLabel: formatClockLabel(derivedEnd),
    durationLabel,
    isTwentyFourHours: false,
    source: 'actual_preferred',
    earliestDataTime: formatDateTimeLabel(earliest),
    latestDataTime: formatDateTimeLabel(latest),
  };
}

export function computeClearcutMetrics(
  session: SessionState,
  options: ComputeMetricsOptions = {},
): ClearcutMetrics {
  const baseStart = parseMinutes(session.settings.service_day_start, 240);
  const baseEnd = parseMinutes(session.settings.service_day_end, 1260);
  const startMinutes = parseMinutes(options.timeRangeStart ?? session.settings.time_range_start, baseStart);
  const endMinutes = parseMinutes(options.timeRangeEnd ?? session.settings.time_range_end, baseEnd);
  const normalizedEnd = endMinutes > startMinutes ? endMinutes : startMinutes + 60;
  const blockSizeMinutes = 15;
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

  let totalPickupEligible = 0;
  let totalPickupOnTime = 0;
  let totalDropoffEligible = 0;
  let totalDropoffOnTime = 0;
  let totalTripEligible = 0;
  let totalTripOnTime = 0;
  const selectedDays = resolveSelectedDays(session, options.selectedDays);
  const dayKeys = new Set<string>();

  for (const trip of session.trips) {
    const pickupTimestamp = tripPickupTime(trip);
    if (pickupTimestamp && selectedDays.has(pickupTimestamp.getDay())) {
      dayKeys.add(dateKey(pickupTimestamp));
    }
  }
  for (const route of session.routes) {
    const routeStartDate = routeStart(route);
    if (routeStartDate && selectedDays.has(routeStartDate.getDay())) {
      dayKeys.add(dateKey(routeStartDate));
    }
  }

  const dayCount = Math.max(dayKeys.size, 1);

  for (const trip of session.trips) {
    const pickupTimestamp = tripPickupTime(trip);
    if (!pickupTimestamp || !selectedDays.has(pickupTimestamp.getDay())) {
      continue;
    }

    const idx = pickBlockIndex(dateToMinutes(pickupTimestamp), blocks);
    pickupsByBlock[idx] += 1;
    blockTripCounts[idx] += 1;

    const onboardStart = pickupTimestamp;
    const onboardEnd = tripDropoffTime(trip) ?? pickupTimestamp;
    const onboardStartMinutes = dateToMinutes(onboardStart);
    const onboardEndMinutes = Math.max(onboardStartMinutes, dateToMinutes(onboardEnd));
    const passengers = parsePassengerCount(trip.passenger_count);
    const tripDayKey = dateKey(pickupTimestamp);
    const occupiedRouteBlocks = ensureDayBlockSets(occupiedRouteIdsByDayBlock, tripDayKey, blockCount);
    for (let blockIdx = 0; blockIdx < blocks.length; blockIdx += 1) {
      const block = blocks[blockIdx];
      if (onboardEndMinutes > block.startMinutes && onboardStartMinutes < block.endMinutes) {
        onBoardByBlock[blockIdx] += passengers;
        if (trip.route_id) {
          occupiedRouteBlocks[blockIdx].add(trip.route_id);
        }
      }
    }

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
    if (!start || !end || !selectedDays.has(start.getDay())) {
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

  for (let i = 0; i < blocks.length; i += 1) {
    pickupsByBlock[i] = Math.round((pickupsByBlock[i] / dayCount) * 10) / 10;
    onBoardByBlock[i] = Math.round((onBoardByBlock[i] / dayCount) * 10) / 10;
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
    deadheadByBlock[i] =
      activeVehiclesRaw > 0
        ? Math.round((((activeVehiclesRaw - occupiedVehiclesRaw) / activeVehiclesRaw) * 100) * 10) / 10
        : 0;
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
  const derivedServiceWindow = deriveServiceWindow(session.trips);

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
    peakPickups: Math.max(...pickupsByBlock, 0),
    peakVehicles: Math.max(...vehiclesByBlock, 0),
    peakOnBoard: Math.round(Math.max(...onBoardByBlock, 0) * 10) / 10,
    avgOtp: totalTripEligible > 0 ? Math.round((totalTripOnTime / totalTripEligible) * 1000) / 10 : 0,
    pickupOtpPct: totalPickupEligible > 0 ? Math.round((totalPickupOnTime / totalPickupEligible) * 1000) / 10 : 0,
    dropoffOtpPct:
      totalDropoffEligible > 0 ? Math.round((totalDropoffOnTime / totalDropoffEligible) * 1000) / 10 : 0,
    tripOtpPct: totalTripEligible > 0 ? Math.round((totalTripOnTime / totalTripEligible) * 1000) / 10 : 0,
    blocksBelowOtp: tripOtpByBlock.filter((value) => value < session.settings.otp_target_pct).length,
    avgProductivity: Math.round(average(productivityByBlock) * 100) / 100,
    peakProductivity: Math.round(Math.max(...productivityByBlock, 0) * 100) / 100,
    totalTrips: session.trips.length,
    currentRuns: session.routes.length,
    optimizedRuns: Math.max(1, session.routes.length - Math.ceil(session.routes.length * 0.12)),
    importedServiceHours,
    optimizedServiceHours,
    avgTripMiles: Math.round(avgTripMiles * 10) / 10,
    avgDeadheadStartMiles: Math.round(average(deadheadByBlock.slice(0, 8)) * 10) / 10,
    avgDeadheadEndMiles: Math.round(average(deadheadByBlock.slice(-8)) * 10) / 10,
    highDeadheadTripsStart,
    highDeadheadTripsEnd,
    derivedServiceWindow,
  };
}
