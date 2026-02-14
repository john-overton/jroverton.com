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
  vehiclesByBlock: number[];
  deadheadByBlock: number[];
  otpByBlock: number[];
  productivityByBlock: number[];
  peakPickups: number;
  peakVehicles: number;
  peakOnBoard: number;
  avgOtp: number;
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

function asDate(value: string): Date | null {
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

function pickMiles(trip: TripRow): number {
  const start = Number(trip.pick_odometer);
  const end = Number(trip.drop_odometer);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return 0;
  }
  return Math.max(0, end - start);
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

export function computeClearcutMetrics(session: SessionState): ClearcutMetrics {
  const startMinutes = parseMinutes(session.settings.time_range_start, parseMinutes(session.settings.service_day_start, 240));
  const endMinutes = parseMinutes(session.settings.time_range_end, parseMinutes(session.settings.service_day_end, 1260));
  const normalizedEnd = endMinutes > startMinutes ? endMinutes : startMinutes + 60;
  const blockCount = Math.max(4, Math.ceil((normalizedEnd - startMinutes) / 60));
  const blocks: TimeBlock[] = Array.from({ length: blockCount }).map((_, index) => {
    const start = startMinutes + index * 60;
    return {
      key: `block-${index}`,
      label: `${blockLabel(start)} - ${blockLabel(start + 60)}`,
      startMinutes: start,
      endMinutes: start + 60,
    };
  });

  const pickupsByBlock = Array.from({ length: blockCount }).fill(0) as number[];
  const vehiclesByBlock = Array.from({ length: blockCount }).fill(0) as number[];
  const deadheadByBlock = Array.from({ length: blockCount }).fill(0) as number[];
  const otpByBlock = Array.from({ length: blockCount }).fill(0) as number[];
  const productivityByBlock = Array.from({ length: blockCount }).fill(0) as number[];
  const blockTripCounts = Array.from({ length: blockCount }).fill(0) as number[];
  const blockOntimeCounts = Array.from({ length: blockCount }).fill(0) as number[];

  for (const trip of session.trips) {
    const pickupDate = asDate(trip.scheduled_pickup_time);
    if (!pickupDate) {
      continue;
    }
    const idx = pickBlockIndex(dateToMinutes(pickupDate), blocks);
    pickupsByBlock[idx] += 1;
    blockTripCounts[idx] += 1;
    const onTime = !trip.status.toLowerCase().includes('late');
    if (onTime) {
      blockOntimeCounts[idx] += 1;
    }
    const miles = pickMiles(trip);
    deadheadByBlock[idx] += miles > 0 ? Math.max(0, miles * 0.18) : 0;
  }

  for (const route of session.routes) {
    const start = asDate(route.scheduled_start_time);
    const end = asDate(route.scheduled_end_time);
    if (!start || !end) {
      continue;
    }
    const startM = dateToMinutes(start);
    const endM = dateToMinutes(end);
    for (let i = 0; i < blocks.length; i += 1) {
      const block = blocks[i];
      if (endM > block.startMinutes && startM < block.endMinutes) {
        vehiclesByBlock[i] += 1;
      }
    }
  }

  for (let i = 0; i < blocks.length; i += 1) {
    const trips = blockTripCounts[i];
    otpByBlock[i] = trips > 0 ? (blockOntimeCounts[i] / trips) * 100 : 100;
    productivityByBlock[i] = vehiclesByBlock[i] > 0 ? trips / vehiclesByBlock[i] : 0;
    deadheadByBlock[i] = trips > 0 ? (deadheadByBlock[i] / trips) * 10 : 0;
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
    vehiclesByBlock,
    deadheadByBlock,
    otpByBlock,
    productivityByBlock,
    peakPickups: Math.max(...pickupsByBlock, 0),
    peakVehicles: Math.max(...vehiclesByBlock, 0),
    peakOnBoard: Math.round(Math.max(...pickupsByBlock, 0) * 1.15),
    avgOtp: Math.round(average(otpByBlock) * 10) / 10,
    blocksBelowOtp: otpByBlock.filter((value) => value < session.settings.otp_target_pct).length,
    avgProductivity: Math.round(average(productivityByBlock) * 100) / 100,
    peakProductivity: Math.round(Math.max(...productivityByBlock, 0) * 100) / 100,
    totalTrips: session.trips.length,
    currentRuns: session.routes.length,
    optimizedRuns: Math.max(1, session.routes.length - Math.ceil(session.routes.length * 0.12)),
    importedServiceHours,
    optimizedServiceHours,
    avgTripMiles: Math.round(avgTripMiles * 10) / 10,
    avgDeadheadStartMiles: Math.round(average(deadheadByBlock.slice(0, 2)) * 10) / 10,
    avgDeadheadEndMiles: Math.round(average(deadheadByBlock.slice(-2)) * 10) / 10,
    highDeadheadTripsStart,
    highDeadheadTripsEnd,
    derivedServiceWindow,
  };
}
