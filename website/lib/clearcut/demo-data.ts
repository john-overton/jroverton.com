import type { RouteRow, TripRow } from './types';

function fmtDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  const seconds = `${date.getSeconds()}`.padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
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

export function buildDemoTripsAndRoutes(): { trips: TripRow[]; routes: RouteRow[] } {
  const startDate = new Date('2026-01-05T00:00:00');
  const dayCount = 28;
  const serviceStartMinutes = 4 * 60;
  const serviceEndMinutes = 20 * 60;
  const blockSizeMinutes = 15;
  const rand = seededRand(20260213);
  const trips: TripRow[] = [];
  const routes: RouteRow[] = [];
  let tripSequence = 1;

  for (let dayOffset = 0; dayOffset < dayCount; dayOffset += 1) {
    const dayDate = withMinutes(startDate, dayOffset * 24 * 60);
    const dayOfWeek = dayDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const routeCount = isWeekend ? 14 : 26;
    const dayRoutes: RouteRow[] = [];

    for (let routeIndex = 0; routeIndex < routeCount; routeIndex += 1) {
      const routeStartMinute = serviceStartMinutes + routeIndex * 18;
      const serviceDuration = 360 + Math.floor(rand() * 180);
      const routeEndMinute = clamp(routeStartMinute + serviceDuration, routeStartMinute + 120, serviceEndMinutes);
      const routeStart = atDayMinutes(dayDate, routeStartMinute);
      const routeEnd = atDayMinutes(dayDate, routeEndMinute);
      const actualStart = withMinutes(routeStart, Math.round(rand() * 8) - 4);
      const actualEnd = withMinutes(routeEnd, Math.round(rand() * 8) - 4);
      const routeId = `R-${fmtDate(dayDate).slice(0, 10).replaceAll('-', '')}-${`${routeIndex + 1}`.padStart(2, '0')}`;
      const break1Minute = clamp(routeStartMinute + 150, serviceStartMinutes, serviceEndMinutes);
      const break2Minute = clamp(routeStartMinute + 300, serviceStartMinutes, serviceEndMinutes);
      const route: RouteRow = {
        route_id: routeId,
        route_name: isWeekend ? `Weekend Route ${routeIndex + 1}` : `Weekday Route ${routeIndex + 1}`,
        scheduled_start_time: fmtDate(routeStart),
        scheduled_end_time: fmtDate(routeEnd),
        actual_start_time: fmtDate(actualStart),
        actual_end_time: fmtDate(actualEnd),
        break1: fmtDate(atDayMinutes(dayDate, break1Minute)),
        break2: fmtDate(atDayMinutes(dayDate, break2Minute)),
        depot_address: null,
        depot_lat: null,
        depot_lon: null,
        distance_to_first_pick: null,
        distance_from_last_drop: null,
      };
      dayRoutes.push(route);
      routes.push(route);
    }

    for (let blockMinute = serviceStartMinutes; blockMinute < serviceEndMinutes; blockMinute += blockSizeMinutes) {
      const weight = demandWeight(blockMinute);
      const dayScale = isWeekend ? 0.62 : 1;
      const expectedTrips = weight * dayScale + rand() * 1.4;
      const tripCountInBlock = Math.max(0, Math.floor(expectedTrips));

      for (let tripIndex = 0; tripIndex < tripCountInBlock; tripIndex += 1) {
        const route = dayRoutes[Math.floor(rand() * dayRoutes.length)];
        const scheduledPickupMinute = clamp(
          blockMinute + Math.floor(rand() * blockSizeMinutes),
          serviceStartMinutes,
          serviceEndMinutes - 10,
        );
        const rideMinutes = 20 + Math.floor(rand() * 28);
        const scheduledDropoffMinute = clamp(
          scheduledPickupMinute + rideMinutes,
          scheduledPickupMinute + 10,
          serviceEndMinutes,
        );
        const actualPickupLeaveMinute = clamp(
          scheduledPickupMinute + Math.round(rand() * 8) - 3,
          serviceStartMinutes,
          serviceEndMinutes - 6,
        );
        const actualDropoffLeaveMinute = clamp(
          scheduledDropoffMinute + Math.round(rand() * 10) - 4,
          actualPickupLeaveMinute + 8,
          serviceEndMinutes,
        );
        const pickupArriveMinute = clamp(actualPickupLeaveMinute - 2, serviceStartMinutes, serviceEndMinutes - 8);
        const dropoffArriveMinute = clamp(
          actualDropoffLeaveMinute - 2,
          actualPickupLeaveMinute + 6,
          serviceEndMinutes - 2,
        );
        const passengerCount = 1 + Math.floor(rand() * 3);
        const passengerTypeRoll = rand();
        const passengerType: TripRow['passenger_type'] =
          passengerTypeRoll > 0.9 ? 'extra_large' : passengerTypeRoll > 0.7 ? 'wheelchair' : 'ambulatory';
        const mileageBase = 1200 + dayOffset * 40 + (tripSequence % 120) * 2;
        const tripMiles = 4 + Math.round(rand() * 10);
        const statusRoll = rand();
        const status = statusRoll > 0.93 ? 'late' : statusRoll > 0.975 ? 'cancelled' : 'completed';

        trips.push({
          trip_id: `TRIP-${`${tripSequence}`.padStart(6, '0')}`,
          scheduled_pickup_time: fmtDate(atDayMinutes(dayDate, scheduledPickupMinute)),
          scheduled_appointment_time: fmtDate(atDayMinutes(dayDate, scheduledDropoffMinute)),
          pickup_arrive_time: fmtDate(atDayMinutes(dayDate, pickupArriveMinute)),
          pickup_leave_time: fmtDate(atDayMinutes(dayDate, actualPickupLeaveMinute)),
          dropoff_arrive_time: fmtDate(atDayMinutes(dayDate, dropoffArriveMinute)),
          dropoff_leave_time: fmtDate(atDayMinutes(dayDate, actualDropoffLeaveMinute)),
          route_id: route.route_id,
          pickup_address: `Pickup Zone ${1 + Math.floor(rand() * 18)}`,
          pickup_lat: null,
          pickup_lon: null,
          dropoff_address: `Dropoff Zone ${1 + Math.floor(rand() * 18)}`,
          dropoff_lat: null,
          dropoff_lon: null,
          status,
          passenger_type: passengerType,
          passenger_count: String(passengerCount),
          pick_odometer: String(mileageBase),
          drop_odometer: String(mileageBase + tripMiles),
        });
        tripSequence += 1;
      }
    }
  }

  return { trips, routes };
}
