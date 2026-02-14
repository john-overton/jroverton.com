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

export function buildDemoTripsAndRoutes(): { trips: TripRow[]; routes: RouteRow[] } {
  const serviceDate = new Date('2026-01-12T04:00:00');
  const trips: TripRow[] = [];
  const routes: RouteRow[] = [];

  for (let routeIndex = 1; routeIndex <= 12; routeIndex += 1) {
    const routeId = `R-${routeIndex.toString().padStart(3, '0')}`;
    const routeStart = withMinutes(serviceDate, routeIndex * 30);
    const routeEnd = withMinutes(routeStart, 360);

    routes.push({
      route_id: routeId,
      route_name: `Route ${routeIndex}`,
      scheduled_start_time: fmtDate(routeStart),
      scheduled_end_time: fmtDate(routeEnd),
      actual_start_time: null,
      actual_end_time: null,
      break1: null,
      break2: null,
    });

    for (let i = 0; i < 6; i += 1) {
      const pickup = withMinutes(routeStart, i * 50);
      const dropoff = withMinutes(pickup, 35);
      const tripId = `${routeId}-T-${(i + 1).toString().padStart(2, '0')}`;
      trips.push({
        trip_id: tripId,
        scheduled_pickup_time: fmtDate(pickup),
        scheduled_appointment_time: fmtDate(dropoff),
        pickup_arrive_time: null,
        pickup_leave_time: null,
        dropoff_arrive_time: null,
        dropoff_leave_time: null,
        route_id: routeId,
        pickup_address: `Pickup Zone ${routeIndex}`,
        pickup_lat: null,
        pickup_lon: null,
        dropoff_address: `Dropoff Zone ${routeIndex}`,
        dropoff_lat: null,
        dropoff_lon: null,
        status: i % 5 === 0 ? 'late' : 'completed',
        passenger_type: i % 8 === 0 ? 'extra_large' : i % 4 === 0 ? 'wheelchair' : 'ambulatory',
        passenger_count: String((i % 3) + 1),
        pick_odometer: String(1000 + routeIndex * 50 + i * 12),
        drop_odometer: String(1008 + routeIndex * 50 + i * 12),
      });
    }
  }

  return { trips, routes };
}
