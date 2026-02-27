import type { TimeBlock } from './metrics';
import type { RouteRow } from './types';

export interface CurrentRunCutRow {
  routeName: string;
  shiftStart: string;
  shiftEnd: string;
  durationHours: number;
  activeBlockIndices: number[];
  break1Start: string | null;
  break1End: string | null;
  break2Start: string | null;
  break2End: string | null;
}

export interface OptimizedRouteRow {
  vehicleId: number;
  shiftStart: string;
  shiftEnd: string;
  durationHours: number;
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

function roundDownToInterval(minutes: number, interval: number): number {
  return Math.floor(minutes / interval) * interval;
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

function getRouteDateString(route: RouteRow): string | null {
  if (route.route_date) return route.route_date;
  const dt = routeStartDate(route);
  if (!dt) return null;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Get distinct calendar dates from routes matching the selected day-of-week filter.
 * Returns sorted YYYY-MM-DD strings.
 */
export function getAvailableDates(routes: RouteRow[], selectedDays: number[]): string[] {
  const filtered = filterRoutesByDay(routes, selectedDays);
  const seen = new Set<string>();
  for (const route of filtered) {
    const dateStr = getRouteDateString(route);
    if (dateStr) seen.add(dateStr);
  }
  return [...seen].sort();
}

/**
 * Build a run cut for a specific calendar date.
 * Shows each route's actual times for that day (no averaging).
 */
export function buildRunCutForDate(
  routes: RouteRow[],
  dateString: string,
  blocks: TimeBlock[],
  intervalMinutes: number,
): CurrentRunCutRow[] {
  if (blocks.length === 0) return [];

  const filtered = routes.filter((route) => getRouteDateString(route) === dateString);
  if (filtered.length === 0) return [];

  const rows: CurrentRunCutRow[] = [];
  for (const route of filtered) {
    const start = routeStartDate(route);
    const end = routeEndDate(route);
    if (!start || !end) continue;
    const startMin = dateToMinutes(start);
    const endMin = dateToMinutes(end);
    if (endMin <= startMin) continue;

    const roundedStart = roundUpToInterval(startMin, intervalMinutes);
    const roundedEnd = roundUpToInterval(endMin, intervalMinutes);
    if (roundedEnd <= roundedStart) continue;

    const name = route.route_name ?? route.route_id;
    const b1Start = asDate(route.break1_start);
    const b1End = asDate(route.break1_end);
    const b2Start = asDate(route.break2_start);
    const b2End = asDate(route.break2_end);
    const b1StartM = b1Start ? dateToMinutes(b1Start) : null;
    const b1EndM = b1End ? dateToMinutes(b1End) : null;
    const b2StartM = b2Start ? dateToMinutes(b2Start) : null;
    const b2EndM = b2End ? dateToMinutes(b2End) : null;

    const activeBlockIndices: number[] = [];
    for (let i = 0; i < blocks.length; i++) {
      if (roundedStart < blocks[i].endMinutes && roundedEnd > blocks[i].startMinutes) {
        const inBreak1 = b1StartM != null && b1EndM != null
          && blocks[i].startMinutes >= b1StartM && blocks[i].endMinutes <= b1EndM;
        const inBreak2 = b2StartM != null && b2EndM != null
          && blocks[i].startMinutes >= b2StartM && blocks[i].endMinutes <= b2EndM;
        if (!inBreak1 && !inBreak2) activeBlockIndices.push(i);
      }
    }
    rows.push({
      routeName: name,
      shiftStart: formatMinutes(roundedStart),
      shiftEnd: formatMinutes(roundedEnd),
      durationHours: Math.round(((roundedEnd - roundedStart) / 60) * 10) / 10,
      activeBlockIndices,
      break1Start: b1Start ? formatMinutes(dateToMinutes(b1Start)) : null,
      break1End: b1End ? formatMinutes(dateToMinutes(b1End)) : null,
      break2Start: b2Start ? formatMinutes(dateToMinutes(b2Start)) : null,
      break2End: b2End ? formatMinutes(dateToMinutes(b2End)) : null,
    });
  }

  rows.sort((a, b) => {
    const aStart = a.activeBlockIndices[0] ?? 0;
    const bStart = b.activeBlockIndices[0] ?? 0;
    return aStart - bStart;
  });

  return rows;
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
      break1Start: null,
      break1End: null,
      break2Start: null,
      break2End: null,
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
  activeTripsPerBlock: number[];
  targetProductivity: number;
  maxShiftHours: number;
  minShiftHours: number;
  startDeadheadMinutes: number;
  endDeadheadMinutes: number;
  routeLengthBias?: number;
}): OptimizedRouteRow[] {
  const { blocks, activeTripsPerBlock, targetProductivity, maxShiftHours, minShiftHours, startDeadheadMinutes, endDeadheadMinutes } = params;
  const routeLengthBias = Math.max(0, Math.min(1, params.routeLengthBias ?? 0.5));
  if (blocks.length === 0 || targetProductivity <= 0) return [];

  const blockSizeMinutes = blocks.length > 1 ? blocks[1].startMinutes - blocks[0].startMinutes : 15;
  const maxShiftBlocks = Math.max(1, Math.floor((maxShiftHours * 60) / blockSizeMinutes));
  const minShiftBlocks = Math.max(1, Math.floor((minShiftHours * 60) / blockSizeMinutes));
  const minShiftMin = minShiftHours * 60;

  // Preferred route length based on bias slider (0 = short routes, 1 = long routes)
  const preferredBlocks = Math.round(minShiftBlocks + routeLengthBias * (maxShiftBlocks - minShiftBlocks));

  // Target vehicles per block — this is the demand curve we want to hug
  const remainingByBlock = activeTripsPerBlock.map((activeTrips) =>
    Math.ceil(activeTrips / targetProductivity),
  );

  if (Math.max(...remainingByBlock, 0) === 0) return [];

  // Demand midpoint: block where cumulative volume reaches 50%
  // PM routes (after midpoint) extend backward instead of forward
  const totalVolume = activeTripsPerBlock.reduce((sum, v) => sum + v, 0);
  let midpointBlockIdx = blocks.length - 1;
  let cumVol = 0;
  for (let i = 0; i < activeTripsPerBlock.length; i++) {
    cumVol += activeTripsPerBlock[i];
    if (cumVol >= totalVolume / 2) { midpointBlockIdx = i; break; }
  }

  const routes: OptimizedRouteRow[] = [];
  let vehicleId = 0;

  // Demand-constrained placement: place routes that only cover blocks with remaining demand > 0
  for (;;) {
    // Find all contiguous spans with remaining demand > 0
    const spans: number[][] = [];
    let span: number[] = [];
    for (let i = 0; i < blocks.length; i++) {
      if (remainingByBlock[i] > 0) {
        span.push(i);
      } else if (span.length > 0) {
        spans.push(span);
        span = [];
      }
    }
    if (span.length > 0) spans.push(span);
    if (spans.length === 0) break;

    // Pick the span whose length is closest to preferredBlocks
    spans.sort((a, b) => {
      const diffA = Math.abs(a.length - preferredBlocks);
      const diffB = Math.abs(b.length - preferredBlocks);
      if (diffA !== diffB) return diffA - diffB;
      // Tie-break: prefer the earlier span
      return a[0] - b[0];
    });
    const chosen = spans[0];

    // Take a chunk from the span, capped at preferred length
    const chunkLen = Math.min(chosen.length, preferredBlocks);
    const chunk = chosen.slice(0, chunkLen);

    vehicleId += 1;
    const demandStartMin = blocks[chunk[0]].startMinutes;
    const demandEndMin = blocks[chunk[chunk.length - 1]].endMinutes;
    const chunkMidBlock = chunk[Math.floor(chunk.length / 2)];
    const isPmRoute = chunkMidBlock > midpointBlockIdx;

    let shiftStartMin: number;
    let shiftEndMin: number;

    if (isPmRoute) {
      // PM route: end stays tight to demand, extensions go BACKWARD
      shiftEndMin = roundUpToInterval(demandEndMin + endDeadheadMinutes, blockSizeMinutes);
      shiftStartMin = Math.max(0, roundDownToInterval(demandStartMin - startDeadheadMinutes, blockSizeMinutes));
      if (shiftEndMin - shiftStartMin < minShiftMin) {
        shiftStartMin = Math.max(0, roundDownToInterval(shiftEndMin - minShiftMin, blockSizeMinutes));
      }
    } else {
      // AM route: start stays tight to demand, extensions go FORWARD
      shiftStartMin = Math.max(0, roundDownToInterval(demandStartMin - startDeadheadMinutes, blockSizeMinutes));
      shiftEndMin = roundUpToInterval(demandEndMin + endDeadheadMinutes, blockSizeMinutes);
      if (shiftEndMin - shiftStartMin < minShiftMin) {
        shiftEndMin = roundUpToInterval(shiftStartMin + minShiftMin, blockSizeMinutes);
      }
    }

    // Compute full block indices for the entire shift window (including deadhead + extension)
    const fullBlockIndices: number[] = [];
    for (let i = 0; i < blocks.length; i++) {
      if (shiftStartMin < blocks[i].endMinutes && shiftEndMin > blocks[i].startMinutes) {
        fullBlockIndices.push(i);
      }
    }

    // Decrement remaining demand only for blocks in the demand chunk (not deadhead extensions)
    // This prevents over-supply: deadhead blocks don't consume demand from other routes
    for (const idx of chunk) {
      remainingByBlock[idx] = Math.max(0, remainingByBlock[idx] - 1);
    }

    const durationHours = Math.round(((shiftEndMin - shiftStartMin) / 60) * 10) / 10;

    routes.push({
      vehicleId,
      shiftStart: formatMinutes(shiftStartMin),
      shiftEnd: formatMinutes(shiftEndMin),
      durationHours,
      activeBlockIndices: fullBlockIndices,
    });
  }

  routes.sort((a, b) => {
    const aStart = a.activeBlockIndices[0] ?? 0;
    const bStart = b.activeBlockIndices[0] ?? 0;
    return aStart - bStart;
  });

  // Renumber vehicles sequentially after sorting
  for (let i = 0; i < routes.length; i++) {
    routes[i].vehicleId = i + 1;
  }

  return routes;
}
