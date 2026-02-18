import type { TimeBlock } from './metrics';
import type { RouteRow } from './types';

export interface CurrentRunCutRow {
  routeName: string;
  shiftStart: string;
  shiftEnd: string;
  durationHours: number;
  activeBlockIndices: number[];
}

export interface OptimizedRouteRow {
  vehicleId: number;
  shiftStart: string;
  shiftEnd: string;
  durationHours: number;
  estimatedTrips: number;
  activeBlockIndices: number[];
}

function asDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateToMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function formatMinutes(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${`${m}`.padStart(2, '0')} ${period}`;
}

function routeStartDate(route: RouteRow): Date | null {
  return asDate(route.actual_start_time ?? '') ?? asDate(route.scheduled_start_time);
}

function routeEndDate(route: RouteRow): Date | null {
  return asDate(route.actual_end_time ?? '') ?? asDate(route.scheduled_end_time);
}

function roundUpToInterval(minutes: number, interval: number): number {
  return Math.ceil(minutes / interval) * interval;
}

/**
 * Filter routes to only those whose start day-of-week is in selectedDays.
 */
function filterRoutesByDay(routes: RouteRow[], selectedDays: number[]): RouteRow[] {
  if (selectedDays.length === 0) return routes;
  const daySet = new Set(selectedDays);
  return routes.filter((route) => {
    const start = routeStartDate(route);
    return start ? daySet.has(start.getDay()) : false;
  });
}

export function computeAvgShiftHours(routes: RouteRow[], selectedDays: number[]): number {
  const filtered = filterRoutesByDay(routes, selectedDays);
  if (filtered.length === 0) return 0;
  let totalMinutes = 0;
  let count = 0;
  for (const route of filtered) {
    const start = routeStartDate(route);
    const end = routeEndDate(route);
    if (!start || !end) continue;
    const diff = (end.getTime() - start.getTime()) / 60_000;
    if (diff > 0) {
      totalMinutes += diff;
      count += 1;
    }
  }
  return count > 0 ? Math.round((totalMinutes / count / 60) * 10) / 10 : 0;
}

/**
 * Build the average run cut grouped by route name.
 * For each unique route name, averages the start and end times across all
 * matching days in the selection, then rounds up to the interval boundary.
 */
export function buildCurrentRunCut(
  routes: RouteRow[],
  selectedDays: number[],
  blocks: TimeBlock[],
  intervalMinutes: number,
): CurrentRunCutRow[] {
  const filtered = filterRoutesByDay(routes, selectedDays);
  if (filtered.length === 0 || blocks.length === 0) return [];

  // Group by route name and collect start/end minutes
  const groups = new Map<string, { starts: number[]; ends: number[] }>();
  for (const route of filtered) {
    const start = routeStartDate(route);
    const end = routeEndDate(route);
    if (!start || !end) continue;
    const startMin = dateToMinutes(start);
    const endMin = dateToMinutes(end);
    if (endMin <= startMin) continue;

    const name = route.route_name ?? route.route_id;
    let group = groups.get(name);
    if (!group) {
      group = { starts: [], ends: [] };
      groups.set(name, group);
    }
    group.starts.push(startMin);
    group.ends.push(endMin);
  }

  const rows: CurrentRunCutRow[] = [];
  for (const [routeName, group] of groups) {
    const avgStart = group.starts.reduce((a, b) => a + b, 0) / group.starts.length;
    const avgEnd = group.ends.reduce((a, b) => a + b, 0) / group.ends.length;
    const roundedStart = roundUpToInterval(avgStart, intervalMinutes);
    const roundedEnd = roundUpToInterval(avgEnd, intervalMinutes);
    if (roundedEnd <= roundedStart) continue;

    const activeBlockIndices: number[] = [];
    for (let i = 0; i < blocks.length; i++) {
      if (roundedStart < blocks[i].endMinutes && roundedEnd > blocks[i].startMinutes) {
        activeBlockIndices.push(i);
      }
    }

    rows.push({
      routeName,
      shiftStart: formatMinutes(roundedStart),
      shiftEnd: formatMinutes(roundedEnd),
      durationHours: Math.round(((roundedEnd - roundedStart) / 60) * 10) / 10,
      activeBlockIndices,
    });
  }

  rows.sort((a, b) => {
    const aStart = a.activeBlockIndices[0] ?? 0;
    const bStart = b.activeBlockIndices[0] ?? 0;
    return aStart - bStart;
  });

  return rows;
}

export function buildOptimizedRoutes(params: {
  blocks: TimeBlock[];
  pickupsByBlock: number[];
  targetProductivity: number;
  maxShiftHours: number;
  minShiftHours: number;
  peakVehicles: number;
}): OptimizedRouteRow[] {
  const { blocks, pickupsByBlock, targetProductivity, maxShiftHours, minShiftHours, peakVehicles } = params;
  if (blocks.length === 0 || targetProductivity <= 0 || peakVehicles <= 0) return [];

  const blockSizeMinutes = blocks.length > 1 ? blocks[1].startMinutes - blocks[0].startMinutes : 15;
  const maxShiftBlocks = Math.max(1, Math.floor((maxShiftHours * 60) / blockSizeMinutes));
  const minShiftBlocks = Math.max(1, Math.floor((minShiftHours * 60) / blockSizeMinutes));

  // For each block, compute how many vehicles are needed
  const requiredByBlock = pickupsByBlock.map((pickups) =>
    Math.min(peakVehicles, Math.ceil(pickups / targetProductivity)),
  );

  const maxRequired = Math.max(...requiredByBlock, 0);
  if (maxRequired === 0) return [];

  const routes: OptimizedRouteRow[] = [];
  let vehicleId = 0;

  // Layer vehicles: vehicle layer N covers blocks needing >= N vehicles
  for (let layer = 1; layer <= Math.min(maxRequired, peakVehicles); layer++) {
    const activeIndices: number[] = [];
    for (let i = 0; i < blocks.length; i++) {
      if (requiredByBlock[i] >= layer) {
        activeIndices.push(i);
      }
    }
    if (activeIndices.length === 0) continue;

    // Group into contiguous spans
    const spans: number[][] = [];
    let currentSpan: number[] = [activeIndices[0]];
    for (let i = 1; i < activeIndices.length; i++) {
      if (activeIndices[i] === activeIndices[i - 1] + 1) {
        currentSpan.push(activeIndices[i]);
      } else {
        spans.push(currentSpan);
        currentSpan = [activeIndices[i]];
      }
    }
    spans.push(currentSpan);

    // Split spans that exceed max shift length, enforce min shift length
    for (const span of spans) {
      let offset = 0;
      while (offset < span.length) {
        let chunk = span.slice(offset, offset + maxShiftBlocks);
        // Pad short chunks to meet minimum shift length by extending into adjacent blocks
        if (chunk.length < minShiftBlocks) {
          const first = chunk[0];
          const padStart = Math.max(0, first - (minShiftBlocks - chunk.length));
          const padEnd = Math.min(blocks.length - 1, first + minShiftBlocks - 1);
          const extended: number[] = [];
          for (let b = padStart; b <= padEnd; b++) extended.push(b);
          chunk = extended;
        }
        vehicleId += 1;
        const startBlock = blocks[chunk[0]];
        const endBlock = blocks[chunk[chunk.length - 1]];
        const durationHours = Math.round(((endBlock.endMinutes - startBlock.startMinutes) / 60) * 10) / 10;

        routes.push({
          vehicleId,
          shiftStart: formatMinutes(startBlock.startMinutes),
          shiftEnd: formatMinutes(endBlock.endMinutes),
          durationHours,
          estimatedTrips: Math.round(durationHours * targetProductivity * 10) / 10,
          activeBlockIndices: chunk,
        });
        offset += maxShiftBlocks;
      }
    }
  }

  routes.sort((a, b) => {
    const aStart = a.activeBlockIndices[0] ?? 0;
    const bStart = b.activeBlockIndices[0] ?? 0;
    return aStart - bStart;
  });

  return routes;
}
