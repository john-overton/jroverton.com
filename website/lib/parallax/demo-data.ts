import type { DemoLocationRow } from './demo-locations-db';
import {
  demoLocationsDbExists,
  getLocationsByCity,
  listCities,
  withDemoLocationsDb,
} from './demo-locations-db';
import type { DepotRow, RouteRow, TripRow } from './types';

// ── Demo Data Generation Configuration ──────────────────────────────

function firstDayOfPreviousMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

export const DEMO_CONFIG = {
  // Time period
  dayCount: 14,
  startDate: firstDayOfPreviousMonth(),

  // Service window
  serviceStartHour: 6,
  serviceEndHour: 19,

  // Routes
  routesPerDayMin: 8,
  routesPerDayMax: 15,
  routeStartWindowMinutes: 90,
  routeDurationMinHours: 6,
  routeDurationMaxHours: 10.5,
  routeActualStartVarianceMin: -5,
  routeActualStartVarianceMax: 10,
  routeActualEndVarianceMin: -15,
  routeActualEndVarianceMax: 5,
  breakMinRouteHours: 5,
  breakDurationMinMinutes: 25,
  breakDurationMaxMinutes: 45,
  breakMidpointVarianceMinutes: 20,

  // Trips
  productivityMin: 1.5,
  productivityMax: 2.2,
  speedMph: 15,
  roadFactorMultiplier: 1.3,
  demandBlockSizeMinutes: 15,

  // Passenger types (must sum to 1.0)
  passengerTypeAmbulatoryPct: 0.65,
  passengerTypeWheelchairPct: 0.25,
  passengerTypeExtraLargePct: 0.10,

  // Trip status distribution (must sum to 1.0)
  statusCompletedPct: 0.82,
  statusNoShowPct: 0.08,
  statusCancelledPct: 0.06,
  statusLateCancelPct: 0.04,

  // Dwell times (minutes at pickup)
  dwellTimeAmbulatoryMin: 1,
  dwellTimeAmbulatoryMax: 3,
  dwellTimeWheelchairMin: 3,
  dwellTimeWheelchairMax: 15,

  // Pickup/dropoff address weighting
  pickupResidentialWeight: 0.80,
  pickupDestinationWeight: 0.20,
  dropoffDestinationWeight: 0.70,
  dropoffResidentialWeight: 0.30,

  // OTP windows (match schema.ts defaults)
  pickupOtpWindowBeforeMin: 15,
  pickupOtpWindowAfterMin: 15,
  dropoffOtpWindowBeforeMin: 30,
  dropoffOtpWindowAfterMin: 1,

  // OTP target — each dataset picks a random seed biased toward 85%
  // 75% of datasets land in 80-90%, remaining 25% spread across 55-95%
  otpFloorPct: 55,
  otpCeilPct: 95,
  otpBiasCenterPct: 85,
  otpBiasWeight: 0.75,

  // Max gap between scheduled pickup and appointment (minutes)
  maxPickupToAppointmentMinutes: 60,

  // On-board time target (minutes) — dataset picks a random target biased toward 25-35
  obtFloorMin: 15,
  obtCeilMin: 45,
  obtBiasCenterMin: 30,
  obtBiasWeight: 0.75,
  obtBlendFactor: 0.7,

  // Shared rides — percentage of trips that generate a shared ride companion
  sharedRidePct: 0.20,

  // Odometer
  odometerBasePerRoute: 10000,
  odometerRouteSpacing: 500,

  // Weekend adjustments
  weekendRouteReduction: 0.6,
  weekendTripReduction: 0.65,

  // Random seed (8 digits, new each load)
  seed: Math.floor(10000000 + Math.random() * 90000000),
};

// ── Helpers (preserved from original) ───────────────────────────────

function fmtDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  const seconds = `${date.getSeconds()}`.padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function fmtDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function withMinutes(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60_000);
}

function seededRand(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) {
    state += 2147483646;
  }
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundTo15(minute: number): number {
  return Math.round(minute / 15) * 15;
}

function demandWeight(minutesFromMidnight: number): number {
  const hour = minutesFromMidnight / 60;
  const morningPeak = Math.exp(-((hour - 8) ** 2) / 1.1);
  const afternoonPeak = Math.exp(-((hour - 14.75) ** 2) / 1.8);
  return 0.55 + morningPeak * 2.4 + afternoonPeak * 2.9;
}

function atDayMinutes(baseDay: Date, minutesFromMidnight: number): Date {
  const date = new Date(baseDay);
  date.setHours(0, 0, 0, 0);
  return withMinutes(date, minutesFromMidnight);
}

function haversineDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Weighted Random Selection ───────────────────────────────────────

interface WeightedPool {
  items: DemoLocationRow[];
  cumulativeWeights: number[];
  totalWeight: number;
}

function buildWeightedPool(
  items: DemoLocationRow[],
  weights: number[],
): WeightedPool {
  const cumulativeWeights: number[] = [];
  let total = 0;
  for (let i = 0; i < items.length; i += 1) {
    total += weights[i] ?? 1;
    cumulativeWeights.push(total);
  }
  return { items, cumulativeWeights, totalWeight: total };
}

function pickFromPool(pool: WeightedPool, rand: () => number): DemoLocationRow {
  const target = rand() * pool.totalWeight;
  for (let i = 0; i < pool.cumulativeWeights.length; i += 1) {
    if (target <= pool.cumulativeWeights[i]) {
      return pool.items[i];
    }
  }
  return pool.items[pool.items.length - 1];
}

function buildPickupPool(
  residential: DemoLocationRow[],
  destinations: DemoLocationRow[],
): WeightedPool {
  const items = [...residential, ...destinations];
  const weights = [
    ...residential.map(() => DEMO_CONFIG.pickupResidentialWeight),
    ...destinations.map(() => DEMO_CONFIG.pickupDestinationWeight),
  ];
  return buildWeightedPool(items, weights);
}

function buildDropoffPool(
  residential: DemoLocationRow[],
  destinations: DemoLocationRow[],
): WeightedPool {
  const items = [...residential, ...destinations];
  const weights = [
    ...residential.map(() => DEMO_CONFIG.dropoffResidentialWeight),
    ...destinations.map(() => DEMO_CONFIG.dropoffDestinationWeight),
  ];
  return buildWeightedPool(items, weights);
}

// ── Address Parsing ─────────────────────────────────────────────────

function extractStreetName(address: string): string | null {
  // Take the first segment before comma: "123 Main Street, City, ST" → "123 Main Street"
  const firstPart = address.split(',')[0]?.trim();
  if (!firstPart) return null;
  // Remove leading house number(s) and whitespace: "123 Main Street" → "Main Street"
  const withoutNumber = firstPart.replace(/^\d+[\s-]*/, '').trim();
  return withoutNumber || null;
}

// ── Route State Tracker ─────────────────────────────────────────────

interface RouteState {
  route: RouteRow;
  depotLat: number;
  depotLon: number;
  currentLat: number;
  currentLon: number;
  startMinute: number;
  endMinute: number;
  odometer: number;
  firstPickupLat: number | null;
  firstPickupLon: number | null;
  lastDropoffLat: number | null;
  lastDropoffLon: number | null;
}

// ── Main Generator ──────────────────────────────────────────────────

export function buildDemoTripsAndRoutes(): {
  trips: TripRow[];
  routes: RouteRow[];
  depots: DepotRow[];
} {
  if (!demoLocationsDbExists()) {
    throw new Error(
      'Demo locations database not found. Run the population script first: ' +
      'npx tsx website/scripts/populate-demo-locations.ts',
    );
  }

  return withDemoLocationsDb((db) => {
    const cities = listCities(db);
    if (cities.length === 0) {
      throw new Error('Demo locations database is empty. Run the population script first.');
    }

    const rand = seededRand(DEMO_CONFIG.seed);
    const city = cities[Math.floor(rand() * cities.length)];
    const locations = getLocationsByCity(db, city.city_id);

    if (locations.depots.length === 0) {
      throw new Error(`No depot locations found for ${city.name}, ${city.state}.`);
    }
    if (locations.residential.length === 0 && locations.destinations.length === 0) {
      throw new Error(`No addresses found for ${city.name}, ${city.state}.`);
    }

    const C = DEMO_CONFIG;
    const startDate = new Date(`${C.startDate}T00:00:00`);
    const serviceStartMinutes = C.serviceStartHour * 60;
    const serviceEndMinutes = C.serviceEndHour * 60;

    // Build depots — 65% chance of 1 depot, 35% chance of 2
    const depotCount = rand() < 0.65 ? 1 : 2;
    const shuffledDepots = [...locations.depots];
    for (let i = shuffledDepots.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [shuffledDepots[i], shuffledDepots[j]] = [shuffledDepots[j], shuffledDepots[i]];
    }
    const depotLocations = shuffledDepots.slice(0, Math.min(depotCount, shuffledDepots.length));
    const depots: DepotRow[] = depotLocations.map((d, i) => ({
      depot_id: `DEPOT-${String(i + 1).padStart(3, '0')}`,
      depot_name: extractStreetName(d.address) ?? `${city.name} Depot ${i + 1}`,
      depot_address: d.address,
      depot_lat: String(d.lat),
      depot_lon: String(d.lon),
    }));

    // Build zones based on geographic quadrants
    const allLats = [...locations.residential, ...locations.destinations].map((l) => l.lat);
    const allLons = [...locations.residential, ...locations.destinations].map((l) => l.lon);
    const midLat = (Math.min(...allLats) + Math.max(...allLats)) / 2;
    const midLon = (Math.min(...allLons) + Math.max(...allLons)) / 2;
    function pickZone(lat: number, lon: number): string {
      const ns = lat >= midLat ? 'North' : 'South';
      const ew = lon >= midLon ? 'East' : 'West';
      return rand() < 0.6 ? ns : ew;
    }

    // Build address pools
    const pickupPool = buildPickupPool(locations.residential, locations.destinations);
    const dropoffPool = buildDropoffPool(locations.residential, locations.destinations);

    // Pre-compute average demand weight across service window (for normalization)
    let demandWeightSum = 0;
    let demandWeightBlocks = 0;
    for (let m = serviceStartMinutes; m < serviceEndMinutes; m += C.demandBlockSizeMinutes) {
      demandWeightSum += demandWeight(m);
      demandWeightBlocks += 1;
    }
    const avgDemandWeight = demandWeightSum / demandWeightBlocks;

    // Pick OTP targets for this dataset (biased toward 85%)
    const otpSeed = rand() < C.otpBiasWeight
      ? C.otpBiasCenterPct + (rand() * 10 - 5)
      : C.otpFloorPct + rand() * (C.otpCeilPct - C.otpFloorPct);
    const pickupOtpTarget = clamp(otpSeed, C.otpFloorPct, C.otpCeilPct) / 100;
    const dropoffOtpTarget = clamp(otpSeed + (rand() * 6 - 3), C.otpFloorPct, C.otpCeilPct) / 100;

    // Pick on-board time target for this dataset (biased toward 25-35 min)
    const obtSeed = rand() < C.obtBiasWeight
      ? C.obtBiasCenterMin + (rand() * 10 - 5)
      : C.obtFloorMin + rand() * (C.obtCeilMin - C.obtFloorMin);
    const targetObtMinutes = clamp(obtSeed, C.obtFloorMin, C.obtCeilMin);

    const trips: TripRow[] = [];
    const routes: RouteRow[] = [];
    let tripSequence = 1;

    for (let dayOffset = 0; dayOffset < C.dayCount; dayOffset += 1) {
      const dayDate = withMinutes(startDate, dayOffset * 24 * 60);
      const dayOfWeek = dayDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const dateStr = fmtDateOnly(dayDate);

      // Determine route count for this day
      const routeRange = C.routesPerDayMax - C.routesPerDayMin + 1;
      const effectiveRange = isWeekend
        ? Math.max(1, Math.round(routeRange * C.weekendRouteReduction))
        : routeRange;
      const effectiveMin = isWeekend
        ? Math.max(1, Math.round(C.routesPerDayMin * C.weekendRouteReduction))
        : C.routesPerDayMin;
      const routeCount = effectiveMin + Math.floor(rand() * effectiveRange);

      // Determine productivity for this day
      const dayProductivity =
        C.productivityMin + rand() * (C.productivityMax - C.productivityMin);

      const dayRouteStates: RouteState[] = [];

      // ── Generate routes ─────────────────────────────────────────
      const startSpacing =
        routeCount > 1 ? C.routeStartWindowMinutes / (routeCount - 1) : 0;

      for (let routeIndex = 0; routeIndex < routeCount; routeIndex += 1) {
        const depot = depotLocations[routeIndex % depotLocations.length];
        const depotRow = depots[routeIndex % depots.length];

        const routeStartMinute = roundTo15(clamp(
          serviceStartMinutes + Math.round(routeIndex * startSpacing),
          serviceStartMinutes,
          serviceEndMinutes - 120,
        ));
        const durationMinutes =
          C.routeDurationMinHours * 60 +
          Math.floor(rand() * (C.routeDurationMaxHours - C.routeDurationMinHours) * 60);
        const routeEndMinute = roundTo15(clamp(
          routeStartMinute + durationMinutes,
          routeStartMinute + 120,
          serviceEndMinutes,
        ));

        const routeStart = atDayMinutes(dayDate, routeStartMinute);
        const routeEnd = atDayMinutes(dayDate, routeEndMinute);

        const actualStartVariance =
          C.routeActualStartVarianceMin +
          Math.floor(rand() * (C.routeActualStartVarianceMax - C.routeActualStartVarianceMin + 1));
        const actualEndVariance =
          C.routeActualEndVarianceMin +
          Math.floor(rand() * (C.routeActualEndVarianceMax - C.routeActualEndVarianceMin + 1));

        // Generate break only for routes >= breakMinRouteHours
        const routeDurationHours = durationMinutes / 60;
        let break1StartStr: string | null = null;
        let break1EndStr: string | null = null;
        if (routeDurationHours >= C.breakMinRouteHours) {
          const breakDuration = C.breakDurationMinMinutes +
            Math.floor(rand() * (C.breakDurationMaxMinutes - C.breakDurationMinMinutes + 1));
          const midpoint = routeStartMinute + Math.round(durationMinutes / 2);
          const breakStartMinute = clamp(
            midpoint - Math.round(breakDuration / 2) +
              Math.round((rand() * 2 - 1) * C.breakMidpointVarianceMinutes),
            routeStartMinute + 60,
            routeEndMinute - breakDuration - 30,
          );
          const breakEndMinute = breakStartMinute + breakDuration;
          break1StartStr = fmtDate(atDayMinutes(dayDate, breakStartMinute));
          break1EndStr = fmtDate(atDayMinutes(dayDate, breakEndMinute));
        }

        const routeId = `R-${dateStr.replaceAll('-', '')}-${String(routeIndex + 1).padStart(2, '0')}`;

        const route: RouteRow = {
          route_id: routeId,
          route_date: dateStr,
          route_name: `${city.name} R${routeIndex + 1}`,
          scheduled_start_time: fmtDate(routeStart),
          scheduled_end_time: fmtDate(routeEnd),
          actual_start_time: fmtDate(withMinutes(routeStart, actualStartVariance)),
          actual_end_time: fmtDate(withMinutes(routeEnd, actualEndVariance)),
          break1_start: break1StartStr,
          break1_end: break1EndStr,
          break2_start: null,
          break2_end: null,
          depot_address: depotRow.depot_address,
          depot_lat: depotRow.depot_lat,
          depot_lon: depotRow.depot_lon,
          distance_to_first_pick: null,
          distance_from_last_drop: null,
          zone: pickZone(depot.lat, depot.lon),
        };

        routes.push(route);
        dayRouteStates.push({
          route,
          depotLat: depot.lat,
          depotLon: depot.lon,
          currentLat: depot.lat,
          currentLon: depot.lon,
          startMinute: routeStartMinute,
          endMinute: routeEndMinute,
          odometer: C.odometerBasePerRoute + routeIndex * C.odometerRouteSpacing + dayOffset * 80,
          firstPickupLat: null,
          firstPickupLon: null,
          lastDropoffLat: null,
          lastDropoffLon: null,
        });
      }

      // ── Generate trips per block (productivity-based per active routes) ──
      // Each block's trip count is based on how many routes are active in that
      // block × productivity × demand curve weight. Blocks with no active routes
      // produce 0 trips. This avoids cramming trips into end-of-day blocks
      // where routes have already ended.
      const weekendTripFactor = isWeekend ? C.weekendTripReduction : 1;

      for (
        let blockMinute = serviceStartMinutes;
        blockMinute < serviceEndMinutes;
        blockMinute += C.demandBlockSizeMinutes
      ) {
        // Count routes active during this block
        let activeRouteCount = 0;
        for (const rs of dayRouteStates) {
          if (blockMinute < rs.endMinute && blockMinute + C.demandBlockSizeMinutes > rs.startMinute) {
            activeRouteCount += 1;
          }
        }
        if (activeRouteCount === 0) continue;

        // Block's route-hours × productivity × demand shape = trip count
        const blockRouteHours = (activeRouteCount * C.demandBlockSizeMinutes) / 60;
        const weight = demandWeight(blockMinute);
        const blockTrips = Math.max(
          0,
          Math.round(blockRouteHours * dayProductivity * (weight / avgDemandWeight) * weekendTripFactor),
        );

        for (let t = 0; t < blockTrips; t += 1) {
          // Pick addresses
          let pickup = pickFromPool(pickupPool, rand);
          let dropoff = pickFromPool(dropoffPool, rand);
          // Ensure pickup != dropoff
          let attempts = 0;
          while (pickup.location_id === dropoff.location_id && attempts < 5) {
            dropoff = pickFromPool(dropoffPool, rand);
            attempts += 1;
          }

          // Determine passenger type
          const typeRoll = rand();
          const passengerType: TripRow['passenger_type'] =
            typeRoll < C.passengerTypeAmbulatoryPct
              ? 'ambulatory'
              : typeRoll < C.passengerTypeAmbulatoryPct + C.passengerTypeWheelchairPct
                ? 'wheelchair'
                : 'extra_large';

          const isWheelchair = passengerType === 'wheelchair' || passengerType === 'extra_large';

          // Determine trip status
          const statusRoll = rand();
          let status: string;
          if (statusRoll < C.statusCompletedPct) status = 'completed';
          else if (statusRoll < C.statusCompletedPct + C.statusNoShowPct) status = 'no-show';
          else if (statusRoll < C.statusCompletedPct + C.statusNoShowPct + C.statusCancelledPct) status = 'cancelled';
          else status = 'late-cancel';

          // Compute haversine distance and estimated ride time
          const straightDistance = haversineDistanceMiles(
            pickup.lat,
            pickup.lon,
            dropoff.lat,
            dropoff.lon,
          );
          const roadDistance = straightDistance * C.roadFactorMultiplier;
          const rawRideMinutes = Math.max(5, (roadDistance / C.speedMph) * 60);
          // Blend ride time toward target OBT — keeps variation while centering on target
          // Odometer stays based on actual distance; ride time drives scheduling/OBT
          const rideMinutes = rawRideMinutes + (targetObtMinutes - rawRideMinutes) * C.obtBlendFactor;

          // Average dwell time at pickup (fixed, not random)
          const avgDwellTime = isWheelchair
            ? Math.round((C.dwellTimeWheelchairMin + C.dwellTimeWheelchairMax) / 2)
            : Math.round((C.dwellTimeAmbulatoryMin + C.dwellTimeAmbulatoryMax) / 2);

          // ── Appointment-first scheduling ──────────────────────────
          // Appointment on 15-min step within the demand block
          const scheduledAppointmentMinute = clamp(
            roundTo15(blockMinute + Math.floor(rand() * C.demandBlockSizeMinutes)),
            roundTo15(serviceStartMinutes + 30),
            roundTo15(serviceEndMinutes),
          );

          // Pickup = appointment - ride - dwell, on 15-min step, within 60 min
          const rawPickupMinute = scheduledAppointmentMinute - Math.round(rideMinutes) - avgDwellTime;
          const scheduledPickupMinute = clamp(
            roundTo15(rawPickupMinute),
            Math.max(roundTo15(serviceStartMinutes), scheduledAppointmentMinute - C.maxPickupToAppointmentMinutes),
            scheduledAppointmentMinute - 15,
          );

          // Find best route (greedy nearest to pickup, among active routes)
          let bestRouteState: RouteState | null = null;
          let bestDistance = Infinity;
          for (const rs of dayRouteStates) {
            if (scheduledPickupMinute < rs.startMinute || scheduledPickupMinute > rs.endMinute) {
              continue;
            }
            const d = haversineDistanceMiles(
              rs.currentLat,
              rs.currentLon,
              pickup.lat,
              pickup.lon,
            );
            if (d < bestDistance) {
              bestDistance = d;
              bestRouteState = rs;
            }
          }
          // Skip trip if no route is active at this time
          if (!bestRouteState) continue;

          // ── OTP-driven actual times ───────────────────────────────
          let pickupArriveTime: string | null = null;
          let pickupLeaveTime: string | null = null;
          let dropoffArriveTime: string | null = null;
          let dropoffLeaveTime: string | null = null;

          // Pickup arrive: on-time or late based on OTP target
          let pickupArriveMinute: number;
          if (rand() < pickupOtpTarget) {
            // On-time: within [-windowBefore, +windowAfter] of scheduled pickup
            pickupArriveMinute = scheduledPickupMinute +
              Math.floor(rand() * (C.pickupOtpWindowBeforeMin + C.pickupOtpWindowAfterMin + 1)) -
              C.pickupOtpWindowBeforeMin;
          } else {
            // Late: beyond the window (16-30 min after scheduled)
            pickupArriveMinute = scheduledPickupMinute +
              C.pickupOtpWindowAfterMin + 1 +
              Math.floor(rand() * 15);
          }
          pickupArriveMinute = clamp(pickupArriveMinute, serviceStartMinutes, serviceEndMinutes - 5);
          pickupArriveTime = fmtDate(atDayMinutes(dayDate, pickupArriveMinute));

          if (status === 'cancelled') {
            // Cancelled: no actual times at all
            pickupArriveTime = null;
          } else if (status === 'no-show' || status === 'late-cancel') {
            // No-show / late-cancel: only pickup_arrive is populated
          } else {
            // Pickup leave = arrive + average dwell
            const pickupLeaveMinute = clamp(
              pickupArriveMinute + avgDwellTime,
              pickupArriveMinute + 1,
              serviceEndMinutes - 3,
            );
            pickupLeaveTime = fmtDate(atDayMinutes(dayDate, pickupLeaveMinute));

            // Dropoff arrive: on-time or late based on OTP target
            let dropoffArriveMinute: number;
            if (rand() < dropoffOtpTarget) {
              // On-time: within [-windowBefore, +windowAfter] of appointment
              dropoffArriveMinute = scheduledAppointmentMinute -
                Math.floor(rand() * (C.dropoffOtpWindowBeforeMin + 1));
            } else {
              // Late: beyond the window (2-20 min after appointment)
              dropoffArriveMinute = scheduledAppointmentMinute +
                C.dropoffOtpWindowAfterMin + 1 +
                Math.floor(rand() * 19);
            }
            dropoffArriveMinute = clamp(
              dropoffArriveMinute,
              pickupLeaveMinute + 2,
              serviceEndMinutes - 1,
            );

            // Dropoff leave = arrive + 1 min
            const dropoffLeaveMinute = clamp(
              dropoffArriveMinute + 1,
              dropoffArriveMinute + 1,
              serviceEndMinutes,
            );

            dropoffArriveTime = fmtDate(atDayMinutes(dayDate, dropoffArriveMinute));
            dropoffLeaveTime = fmtDate(atDayMinutes(dayDate, dropoffLeaveMinute));
          }

          // Update route state (position and odometer)
          const deadheadDistance = haversineDistanceMiles(
            bestRouteState.currentLat,
            bestRouteState.currentLon,
            pickup.lat,
            pickup.lon,
          );
          const pickOdometer = bestRouteState.odometer + deadheadDistance * C.roadFactorMultiplier;
          const dropOdometer = pickOdometer + roadDistance;
          bestRouteState.odometer = dropOdometer;
          bestRouteState.currentLat = dropoff.lat;
          bestRouteState.currentLon = dropoff.lon;
          if (bestRouteState.firstPickupLat === null) {
            bestRouteState.firstPickupLat = pickup.lat;
            bestRouteState.firstPickupLon = pickup.lon;
          }
          bestRouteState.lastDropoffLat = dropoff.lat;
          bestRouteState.lastDropoffLon = dropoff.lon;

          const passengerCount = 1 + Math.floor(rand() * 3);

          trips.push({
            trip_id: `TRIP-${String(tripSequence).padStart(6, '0')}`,
            trip_date: dateStr,
            scheduled_pickup_time: fmtDate(atDayMinutes(dayDate, scheduledPickupMinute)),
            scheduled_appointment_time: fmtDate(
              atDayMinutes(dayDate, scheduledAppointmentMinute),
            ),
            pickup_arrive_time: pickupArriveTime,
            pickup_leave_time: pickupLeaveTime,
            dropoff_arrive_time: dropoffArriveTime,
            dropoff_leave_time: dropoffLeaveTime,
            route_id: bestRouteState.route.route_id,
            pickup_address: pickup.address,
            pickup_lat: String(pickup.lat),
            pickup_lon: String(pickup.lon),
            dropoff_address: dropoff.address,
            dropoff_lat: String(dropoff.lat),
            dropoff_lon: String(dropoff.lon),
            status,
            passenger_type: passengerType,
            passenger_count: String(passengerCount),
            pick_odometer: String(Math.round(pickOdometer)),
            drop_odometer: String(Math.round(dropOdometer)),
            zone: pickZone(pickup.lat, pickup.lon),
          });
          tripSequence += 1;

          // ── Shared ride: generate companion trip on same route ────
          if (status === 'completed' && rand() < C.sharedRidePct) {
            const pickupB = pickFromPool(pickupPool, rand);
            let dropoffB = pickFromPool(dropoffPool, rand);
            let sharedAttempts = 0;
            while (pickupB.location_id === dropoffB.location_id && sharedAttempts < 5) {
              dropoffB = pickFromPool(dropoffPool, rand);
              sharedAttempts += 1;
            }

            const straightDistB = haversineDistanceMiles(
              pickupB.lat, pickupB.lon, dropoffB.lat, dropoffB.lon,
            );
            const roadDistB = straightDistB * C.roadFactorMultiplier;

            const isWheelchairB = rand() < (C.passengerTypeWheelchairPct + C.passengerTypeExtraLargePct);
            const passengerTypeB: TripRow['passenger_type'] = isWheelchairB
              ? (rand() < C.passengerTypeWheelchairPct / (C.passengerTypeWheelchairPct + C.passengerTypeExtraLargePct)
                ? 'wheelchair' : 'extra_large')
              : 'ambulatory';
            const avgDwellB = isWheelchairB
              ? Math.round((C.dwellTimeWheelchairMin + C.dwellTimeWheelchairMax) / 2)
              : Math.round((C.dwellTimeAmbulatoryMin + C.dwellTimeAmbulatoryMax) / 2);

            // Trip B scheduled: pickup a few minutes after A, appointment ~5-10 min after A
            const scheduledPickupB = clamp(
              roundTo15(scheduledPickupMinute + avgDwellTime),
              roundTo15(serviceStartMinutes),
              scheduledAppointmentMinute - 15,
            );
            const scheduledAppointmentB = clamp(
              roundTo15(scheduledAppointmentMinute + 5 + Math.floor(rand() * 6)),
              scheduledPickupB + 15,
              roundTo15(serviceEndMinutes),
            );

            // Trip B actual times (OTP-driven, same logic as primary trip)
            let pickupArriveB: number;
            if (rand() < pickupOtpTarget) {
              pickupArriveB = scheduledPickupB +
                Math.floor(rand() * (C.pickupOtpWindowBeforeMin + C.pickupOtpWindowAfterMin + 1)) -
                C.pickupOtpWindowBeforeMin;
            } else {
              pickupArriveB = scheduledPickupB + C.pickupOtpWindowAfterMin + 1 + Math.floor(rand() * 15);
            }
            pickupArriveB = clamp(pickupArriveB, serviceStartMinutes, serviceEndMinutes - 5);

            const pickupLeaveB = clamp(pickupArriveB + avgDwellB, pickupArriveB + 1, serviceEndMinutes - 3);

            let dropoffArriveB: number;
            if (rand() < dropoffOtpTarget) {
              dropoffArriveB = scheduledAppointmentB - Math.floor(rand() * (C.dropoffOtpWindowBeforeMin + 1));
            } else {
              dropoffArriveB = scheduledAppointmentB + C.dropoffOtpWindowAfterMin + 1 + Math.floor(rand() * 19);
            }
            dropoffArriveB = clamp(dropoffArriveB, pickupLeaveB + 2, serviceEndMinutes - 1);
            const dropoffLeaveB = clamp(dropoffArriveB + 1, dropoffArriveB + 1, serviceEndMinutes);

            // Odometer: route goes from A's dropoff → B's pickup → B's dropoff
            const legToPickupB = haversineDistanceMiles(
              bestRouteState.currentLat, bestRouteState.currentLon,
              pickupB.lat, pickupB.lon,
            ) * C.roadFactorMultiplier;
            const pickOdometerB = bestRouteState.odometer + legToPickupB;
            const dropOdometerB = pickOdometerB + roadDistB;
            bestRouteState.odometer = dropOdometerB;
            bestRouteState.currentLat = dropoffB.lat;
            bestRouteState.currentLon = dropoffB.lon;
            bestRouteState.lastDropoffLat = dropoffB.lat;
            bestRouteState.lastDropoffLon = dropoffB.lon;

            trips.push({
              trip_id: `TRIP-${String(tripSequence).padStart(6, '0')}`,
              trip_date: dateStr,
              scheduled_pickup_time: fmtDate(atDayMinutes(dayDate, scheduledPickupB)),
              scheduled_appointment_time: fmtDate(atDayMinutes(dayDate, scheduledAppointmentB)),
              pickup_arrive_time: fmtDate(atDayMinutes(dayDate, pickupArriveB)),
              pickup_leave_time: fmtDate(atDayMinutes(dayDate, pickupLeaveB)),
              dropoff_arrive_time: fmtDate(atDayMinutes(dayDate, dropoffArriveB)),
              dropoff_leave_time: fmtDate(atDayMinutes(dayDate, dropoffLeaveB)),
              route_id: bestRouteState.route.route_id,
              pickup_address: pickupB.address,
              pickup_lat: String(pickupB.lat),
              pickup_lon: String(pickupB.lon),
              dropoff_address: dropoffB.address,
              dropoff_lat: String(dropoffB.lat),
              dropoff_lon: String(dropoffB.lon),
              status: 'completed',
              passenger_type: passengerTypeB,
              passenger_count: '1',
              pick_odometer: String(Math.round(pickOdometerB)),
              drop_odometer: String(Math.round(dropOdometerB)),
              zone: pickZone(pickupB.lat, pickupB.lon),
            });
            tripSequence += 1;
          }
        }
      }

      // ── Post-process: compute route distance fields ─────────────
      for (const rs of dayRouteStates) {
        if (rs.firstPickupLat !== null && rs.firstPickupLon !== null) {
          const distToFirst =
            haversineDistanceMiles(
              rs.depotLat,
              rs.depotLon,
              rs.firstPickupLat,
              rs.firstPickupLon,
            ) * C.roadFactorMultiplier;
          rs.route.distance_to_first_pick = String(Math.round(distToFirst * 10) / 10);
        }
        if (rs.lastDropoffLat !== null && rs.lastDropoffLon !== null) {
          const distFromLast =
            haversineDistanceMiles(
              rs.lastDropoffLat,
              rs.lastDropoffLon,
              rs.depotLat,
              rs.depotLon,
            ) * C.roadFactorMultiplier;
          rs.route.distance_from_last_drop = String(Math.round(distFromLast * 10) / 10);
        }
      }
    }

    return { trips, routes, depots };
  });
}
