import { NextResponse } from 'next/server';

import { buildDemoTripsAndRoutes, DEMO_CONFIG } from '@/lib/parallax/demo-data';
import type { TripRow } from '@/lib/parallax/types';

export const dynamic = 'force-dynamic';

interface GeoPoint {
  lon: number;
  lat: number;
  pointType: 'pickup' | 'dropoff';
}

const BLOCK_SIZE = DEMO_CONFIG.demandBlockSizeMinutes; // 15 min
const SERVICE_START = DEMO_CONFIG.serviceStartHour * 60;
const SERVICE_END = DEMO_CONFIG.serviceEndHour * 60;

/** Parse a datetime string like "2025-01-15 08:30:00" to minutes-from-midnight. */
function toMinutes(dt: string | null): number | null {
  if (!dt) return null;
  const timePart = dt.split(' ')[1];
  if (!timePart) return null;
  const [h, m] = timePart.split(':').map(Number);
  return h * 60 + m;
}

/** Map minutes-from-midnight to a block index. */
function blockIndex(minutes: number): number {
  return Math.floor((minutes - SERVICE_START) / BLOCK_SIZE);
}

export async function GET() {
  try {
    // Fresh random seed each request so each page load picks a different city
    DEMO_CONFIG.seed = Math.floor(10000000 + Math.random() * 90000000);
    const { trips } = buildDemoTripsAndRoutes();

    const blockCount = Math.ceil((SERVICE_END - SERVICE_START) / BLOCK_SIZE);

    // Bucket trips by time block using pickup time.
    // Each bucket stores the full trip so we can extract geo points later.
    const buckets: TripRow[][] = Array.from({ length: blockCount }, () => []);

    for (const trip of trips) {
      const minutes =
        toMinutes(trip.pickup_leave_time) ??
        toMinutes(trip.pickup_arrive_time) ??
        toMinutes(trip.scheduled_pickup_time);
      if (minutes === null) continue;
      const idx = blockIndex(minutes);
      if (idx >= 0 && idx < blockCount) {
        buckets[idx].push(trip);
      }
    }

    // Pick the block with the most trips for a dense-looking heatmap
    let bestIdx = 0;
    let bestCount = 0;
    for (let i = 0; i < blockCount; i++) {
      if (buckets[i].length > bestCount) {
        bestCount = buckets[i].length;
        bestIdx = i;
      }
    }

    const selectedTrips = buckets[bestIdx];
    const blockStartMin = SERVICE_START + bestIdx * BLOCK_SIZE;
    const blockLabel = `${String(Math.floor(blockStartMin / 60)).padStart(2, '0')}:${String(blockStartMin % 60).padStart(2, '0')}`;

    // Extract geo points from selected time block
    const points: GeoPoint[] = [];
    let latSum = 0;
    let lonSum = 0;
    let pointCount = 0;

    for (const trip of selectedTrips) {
      const pickLat = parseFloat(trip.pickup_lat ?? '');
      const pickLon = parseFloat(trip.pickup_lon ?? '');
      if (Number.isFinite(pickLat) && Number.isFinite(pickLon)) {
        points.push({ lon: pickLon, lat: pickLat, pointType: 'pickup' });
        latSum += pickLat;
        lonSum += pickLon;
        pointCount += 1;
      }

      const dropLat = parseFloat(trip.dropoff_lat ?? '');
      const dropLon = parseFloat(trip.dropoff_lon ?? '');
      if (Number.isFinite(dropLat) && Number.isFinite(dropLon)) {
        points.push({ lon: dropLon, lat: dropLat, pointType: 'dropoff' });
        latSum += dropLat;
        lonSum += dropLon;
        pointCount += 1;
      }
    }

    const center =
      pointCount > 0
        ? { lat: latSum / pointCount, lon: lonSum / pointCount }
        : { lat: 39.8, lon: -98.5 };

    return NextResponse.json({
      ok: true,
      data: {
        center,
        points,
        tripCount: selectedTrips.length,
        timeBlock: blockLabel,
        seed: DEMO_CONFIG.seed,
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'demo_unavailable', message: 'Demo data not available.' } },
      { status: 500 },
    );
  }
}
