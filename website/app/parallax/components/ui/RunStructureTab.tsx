'use client';

import { Redo2, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/app/parallax/components/shadcn/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/parallax/components/shadcn/tabs';
import { Toast, ToastClose, ToastProvider, ToastTitle, ToastViewport } from '@/app/parallax/components/shadcn/toast';
import { useToast } from '@/app/parallax/hooks/useToast';
import { useUndoRedo } from '@/app/parallax/hooks/useUndoRedo';
import type { ClearcutMetrics } from '@/lib/parallax/metrics';
import { estimateFtePtCounts } from '@/lib/parallax/bid-algorithm';
import type { CurrentRunCutRow } from '@/lib/parallax/run-structure';
import { buildRunCutForDate, getAvailableDates } from '@/lib/parallax/run-structure';
import type { BidResult, DepotRow, NewRouteRow, OptimizationRow, RouteRow, ServiceDay, VehicleTypeRow } from '@/lib/parallax/types';

import HelpPanel from './HelpPanel';
import ImportedRoutesPanel from './ImportedRoutesPanel';
import RouteEditorPanel from './RouteEditorPanel';
import ShiftBidsPanel from './ShiftBidsPanel';
import { type BreakoutMode, ALL_SERVICE_DAYS, SERVICE_DAY_TO_DOW, RunStructureChart, SectionCard, parseClockToMinutes, formatMinutesToClock, parseServiceDays } from './shared';

function dateToMinutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function asDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Parse a 12-hour "H:MM AM/PM" label back to minutes-of-day */
function parseClockFromLabel(label: string): number {
  const match = label.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

// ── Main component ───────────────────────────────────────────────────

interface RunStructureTabProps {
  metrics: ClearcutMetrics;
  fullDayMetrics: ClearcutMetrics;
  optimization: OptimizationRow;
  routes: RouteRow[];
  newRoutes: NewRouteRow[];
  selectedDays: number[];
  readonlyView: boolean;
  intervalMinutes: number;
  onOptimizationChange: (
    key: 'target_productivity' | 'max_driver_spread_hrs' | 'peak_vehicles' | 'run_structure_json',
    value: number | string | null,
  ) => void;
  onNewRoutesChange: (newRoutes: NewRouteRow[]) => void;
  depots: DepotRow[];
  vehicleTypes: VehicleTypeRow[];
  selectedVehicleTypes: string[];
  selectedZones: string[];
  availableZones: string[];
  filteredRoutes: RouteRow[];
  savedBidResult: BidResult | null;
  onBidResultChange: (result: BidResult | null) => void;
}

export default function RunStructureTab({
  metrics,
  fullDayMetrics,
  routes,
  newRoutes,
  selectedDays,
  readonlyView,
  filteredRoutes,
  intervalMinutes,
  onNewRoutesChange,
  depots,
  vehicleTypes,
  selectedVehicleTypes,
  selectedZones,
  availableZones,
  savedBidResult,
  onBidResultChange,
}: RunStructureTabProps) {
  const [demandMode, setDemandMode] = useState<'max' | 'avg' | 'avgNz'>('max');
  const [breakoutMode, setBreakoutMode] = useState<BreakoutMode>('total');
  const [subTab, setSubTab] = useState<'imported' | 'bids' | 'runeditor' | 'help'>('runeditor');
  const [localNewRoutes, setLocalNewRoutes] = useState<NewRouteRow[]>(newRoutes);
  const [selectedRunCutDate, setSelectedRunCutDate] = useState<string | null>(null);
  const [newRouteDayFilter, setNewRouteDayFilter] = useState<ServiceDay | 'all'>('all');
  const [depotFilter, setDepotFilter] = useState<string>('all');
  const [copyDaysSelection, setCopyDaysSelection] = useState<ServiceDay[]>([...ALL_SERVICE_DAYS]);
  const [highlightFilter, setHighlightFilter] = useState<{ routeName: string; days: ServiceDay[] } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ownPersistRef = useRef(false);

  // ── Undo/Redo: new routes ──────────────────────────────────────────
  const { pushState: pushNewRouteState, undo: undoNewRoute, redo: redoNewRoute, clearHistory: clearNewRouteHistory, canUndo: canNewRouteUndo, canRedo: canNewRouteRedo } = useUndoRedo<NewRouteRow[]>();

  // ── Undo/Redo: bids (lifted from ShiftBidsPanel) ──────────────────
  const { pushState: pushBidState, undo: undoBid, redo: redoBid, clearHistory: clearBidHistory, canUndo: canBidUndo, canRedo: canBidRedo } = useUndoRedo<BidResult>();
  const [bidResult, setBidResult] = useState<BidResult | null>(savedBidResult);
  const bidSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Toast ──────────────────────────────────────────────────────────
  const { toasts, showToast, dismissToast } = useToast();

  // Sync from server when newRoutes prop changes (skip if it's our own save bouncing back)
  useEffect(() => {
    if (ownPersistRef.current) {
      ownPersistRef.current = false;
      return;
    }
    setLocalNewRoutes(newRoutes);
    clearNewRouteHistory();
  }, [newRoutes, clearNewRouteHistory]);

  // Debounced save for new routes
  const persistNewRoutes = useCallback(
    (nextNewRoutes: NewRouteRow[]) => {
      if (readonlyView) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        ownPersistRef.current = true;
        onNewRoutesChange(nextNewRoutes);
      }, 500);
    },
    [readonlyView, onNewRoutesChange],
  );

  // Debounced save for bids
  const persistBidResult = useCallback(
    (result: BidResult) => {
      if (readonlyView) return;
      if (bidSaveTimerRef.current) clearTimeout(bidSaveTimerRef.current);
      bidSaveTimerRef.current = setTimeout(() => {
        onBidResultChange(result);
      }, 500);
    },
    [readonlyView, onBidResultChange],
  );

  function updateLocalNewRoutes(nextNewRoutes: NewRouteRow[]) {
    pushNewRouteState(localNewRoutes);
    setLocalNewRoutes(nextNewRoutes);
    persistNewRoutes(nextNewRoutes);
  }

  // ── Consolidated undo/redo ─────────────────────────────────────────

  const activeCanUndo = subTab === 'runeditor' ? canNewRouteUndo : subTab === 'bids' ? canBidUndo : false;
  const activeCanRedo = subTab === 'runeditor' ? canNewRouteRedo : subTab === 'bids' ? canBidRedo : false;

  function handleUndo() {
    if (subTab === 'runeditor') {
      const previous = undoNewRoute(localNewRoutes);
      if (previous) { setLocalNewRoutes(previous); persistNewRoutes(previous); }
    } else if (subTab === 'bids' && bidResult) {
      const previous = undoBid(bidResult);
      if (previous) { setBidResult(previous); persistBidResult(previous); }
    }
  }

  function handleRedo() {
    if (subTab === 'runeditor') {
      const next = redoNewRoute(localNewRoutes);
      if (next) { setLocalNewRoutes(next); persistNewRoutes(next); }
    } else if (subTab === 'bids' && bidResult) {
      const next = redoBid(bidResult);
      if (next) { setBidResult(next); persistBidResult(next); }
    }
  }

  // ── Bid result change handler (from ShiftBidsPanel) ────────────────

  function handleBidResultChange(result: BidResult | null) {
    setBidResult(result);
    if (result) persistBidResult(result);
  }

  // ── Imported run cut data ─────────────────────────────────────────

  const availableDates = useMemo(
    () => getAvailableDates(routes, []),
    [routes],
  );

  useEffect(() => {
    if (availableDates.length > 0 && (!selectedRunCutDate || !availableDates.includes(selectedRunCutDate))) {
      setSelectedRunCutDate(availableDates[0]);
    } else if (availableDates.length === 0) {
      setSelectedRunCutDate(null);
    }
  }, [availableDates, selectedRunCutDate]);

  const currentRunCut = useMemo(
    () => selectedRunCutDate ? buildRunCutForDate(routes, selectedRunCutDate, fullDayMetrics.blocks, intervalMinutes) : [],
    [routes, selectedRunCutDate, fullDayMetrics.blocks, intervalMinutes],
  );

  // ── Filtered new routes for display + chart ──────────────────────

  const filteredNewRoutes = useMemo(() => {
    let result = localNewRoutes;
    if (newRouteDayFilter !== 'all') {
      result = result.filter((newRoute) => {
        const days = parseServiceDays(newRoute.service_days);
        return days.includes(newRouteDayFilter);
      });
    }
    if (depotFilter !== 'all') {
      result = result.filter((newRoute) => newRoute.depot === depotFilter);
    }
    if (selectedVehicleTypes.length > 0) {
      const vtSet = new Set(selectedVehicleTypes);
      result = result.filter((newRoute) => newRoute.vehicle_type_id && vtSet.has(newRoute.vehicle_type_id));
    }
    if (selectedZones.length > 0) {
      const zoneSet = new Set(selectedZones);
      result = result.filter((newRoute) => newRoute.route_area && zoneSet.has(newRoute.route_area));
    }
    return result;
  }, [localNewRoutes, newRouteDayFilter, depotFilter, selectedVehicleTypes, selectedZones]);

  // ── Vehicle counts by block ───────────────────────────────────────

  const currentVehiclesByBlockFullDay = useMemo(() => {
    const counts = new Array(fullDayMetrics.blocks.length).fill(0) as number[];
    for (const row of currentRunCut) {
      for (const idx of row.activeBlockIndices) {
        if (idx >= 0 && idx < counts.length) counts[idx] += 1;
      }
    }
    return counts;
  }, [currentRunCut, fullDayMetrics.blocks.length]);

  const chartCurrentVehiclesByBlockFullDay = useMemo(() => {
    const counts = new Array(fullDayMetrics.blocks.length).fill(0) as number[];
    const dateSet = new Set<string>();
    for (const route of filteredRoutes) {
      const startDt = asDate(route.actual_start_time) ?? asDate(route.scheduled_start_time);
      const endDt = asDate(route.actual_end_time) ?? asDate(route.scheduled_end_time);
      if (!startDt || !endDt) continue;
      const y = startDt.getFullYear();
      const m = `${startDt.getMonth() + 1}`.padStart(2, '0');
      const d = `${startDt.getDate()}`.padStart(2, '0');
      dateSet.add(`${y}-${m}-${d}`);
      const startMin = dateToMinutesOfDay(startDt);
      const endMin = dateToMinutesOfDay(endDt);
      if (endMin <= startMin) continue;
      const b1S = asDate(route.break1_start);
      const b1E = asDate(route.break1_end);
      const b1SM = b1S ? dateToMinutesOfDay(b1S) : null;
      const b1EM = b1E ? dateToMinutesOfDay(b1E) : null;
      const b2S = asDate(route.break2_start);
      const b2E = asDate(route.break2_end);
      const b2SM = b2S ? dateToMinutesOfDay(b2S) : null;
      const b2EM = b2E ? dateToMinutesOfDay(b2E) : null;
      for (let i = 0; i < fullDayMetrics.blocks.length; i++) {
        const block = fullDayMetrics.blocks[i];
        if (startMin < block.endMinutes && endMin > block.startMinutes) {
          const inBreak1 = b1SM != null && b1EM != null && block.startMinutes >= b1SM && block.endMinutes <= b1EM;
          const inBreak2 = b2SM != null && b2EM != null && block.startMinutes >= b2SM && block.endMinutes <= b2EM;
          if (inBreak1 || inBreak2) continue;
          counts[i] += 1;
        }
      }
    }
    const numDates = Math.max(1, dateSet.size);
    return counts.map((c) => Math.round((c / numDates) * 10) / 10);
  }, [filteredRoutes, fullDayMetrics.blocks]);

  const chartCurrentVehiclesByBlock = useMemo(() => {
    return metrics.blocks.map((viewBlock) => {
      const fullIdx = fullDayMetrics.blocks.findIndex(
        (b) => b.startMinutes === viewBlock.startMinutes,
      );
      return fullIdx >= 0 ? chartCurrentVehiclesByBlockFullDay[fullIdx] : 0;
    });
  }, [metrics.blocks, fullDayMetrics.blocks, chartCurrentVehiclesByBlockFullDay]);

  // Date-specific imported routes for the chart
  const { importedDateVehiclesFullDay, importedDateOnBreakFullDay } = useMemo(() => {
    const counts = new Array(fullDayMetrics.blocks.length).fill(0) as number[];
    const breaks = new Array(fullDayMetrics.blocks.length).fill(0) as number[];
    for (const row of currentRunCut) {
      const startMin = parseClockFromLabel(row.shiftStart);
      const endMin = parseClockFromLabel(row.shiftEnd);
      if (endMin <= startMin) continue;
      const b1S = row.break1Start ? parseClockFromLabel(row.break1Start) : -1;
      const b1E = row.break1End ? parseClockFromLabel(row.break1End) : -1;
      const b2S = row.break2Start ? parseClockFromLabel(row.break2Start) : -1;
      const b2E = row.break2End ? parseClockFromLabel(row.break2End) : -1;
      for (let i = 0; i < fullDayMetrics.blocks.length; i++) {
        const block = fullDayMetrics.blocks[i];
        if (startMin < block.endMinutes && endMin > block.startMinutes) {
          const inBreak1 = b1S >= 0 && b1E > b1S && block.startMinutes >= b1S && block.endMinutes <= b1E;
          const inBreak2 = b2S >= 0 && b2E > b2S && block.startMinutes >= b2S && block.endMinutes <= b2E;
          if (inBreak1 || inBreak2) { breaks[i] += 1; } else { counts[i] += 1; }
        }
      }
    }
    return { importedDateVehiclesFullDay: counts, importedDateOnBreakFullDay: breaks };
  }, [currentRunCut, fullDayMetrics.blocks]);

  const importedDateVehiclesByBlock = useMemo(() => {
    return metrics.blocks.map((viewBlock) => {
      const fullIdx = fullDayMetrics.blocks.findIndex(
        (b) => b.startMinutes === viewBlock.startMinutes,
      );
      return fullIdx >= 0 ? importedDateVehiclesFullDay[fullIdx] : 0;
    });
  }, [metrics.blocks, fullDayMetrics.blocks, importedDateVehiclesFullDay]);

  const importedDateOnBreakByBlock = useMemo(() => {
    return metrics.blocks.map((viewBlock) => {
      const fullIdx = fullDayMetrics.blocks.findIndex(
        (b) => b.startMinutes === viewBlock.startMinutes,
      );
      return fullIdx >= 0 ? importedDateOnBreakFullDay[fullIdx] : 0;
    });
  }, [metrics.blocks, fullDayMetrics.blocks, importedDateOnBreakFullDay]);

  const selectedDaySet = useMemo(() => new Set(selectedDays), [selectedDays]);

  // Depot lookup maps
  const depotAddressToName = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of depots) {
      if (d.depot_address) map.set(d.depot_address, d.depot_name);
    }
    return map;
  }, [depots]);

  // New route vehicles by block (for chart)
  const { newRouteVehiclesByBlockFullDay, nrOnBreakByBlockFullDay } = useMemo(() => {
    const counts = new Array(fullDayMetrics.blocks.length).fill(0) as number[];
    const breaks = new Array(fullDayMetrics.blocks.length).fill(0) as number[];
    for (const newRoute of filteredNewRoutes) {
      const routeDays = parseServiceDays(newRoute.service_days);
      const matchesDays = selectedDays.length === 0 || routeDays.some((d) => selectedDaySet.has(SERVICE_DAY_TO_DOW[d]));
      if (!matchesDays) continue;

      const startMin = parseClockToMinutes(newRoute.start_time, 0);
      const endMin = parseClockToMinutes(newRoute.end_time, 0);
      if (endMin <= startMin) continue;
      const rb1S = parseClockToMinutes(newRoute.break_1_start ?? '', -1);
      const rb1E = parseClockToMinutes(newRoute.break_1_end ?? '', -1);
      const rb2S = parseClockToMinutes(newRoute.break_2_start ?? '', -1);
      const rb2E = parseClockToMinutes(newRoute.break_2_end ?? '', -1);
      for (let i = 0; i < fullDayMetrics.blocks.length; i++) {
        const block = fullDayMetrics.blocks[i];
        if (startMin < block.endMinutes && endMin > block.startMinutes) {
          const inBreak1 = rb1S >= 0 && rb1E > rb1S && block.startMinutes >= rb1S && block.endMinutes <= rb1E;
          const inBreak2 = rb2S >= 0 && rb2E > rb2S && block.startMinutes >= rb2S && block.endMinutes <= rb2E;
          if (inBreak1 || inBreak2) { breaks[i] += 1; continue; }
          counts[i] += 1;
        }
      }
    }
    return { newRouteVehiclesByBlockFullDay: counts, nrOnBreakByBlockFullDay: breaks };
  }, [filteredNewRoutes, fullDayMetrics.blocks, selectedDays.length, selectedDaySet]);

  const newRouteVehiclesByBlock = useMemo(() => {
    return metrics.blocks.map((viewBlock) => {
      const fullIdx = fullDayMetrics.blocks.findIndex(
        (b) => b.startMinutes === viewBlock.startMinutes,
      );
      return fullIdx >= 0 ? newRouteVehiclesByBlockFullDay[fullIdx] : 0;
    });
  }, [metrics.blocks, fullDayMetrics.blocks, newRouteVehiclesByBlockFullDay]);

  const nrOnBreakByBlock = useMemo(() => {
    return metrics.blocks.map((viewBlock) => {
      const fullIdx = fullDayMetrics.blocks.findIndex(
        (b) => b.startMinutes === viewBlock.startMinutes,
      );
      return fullIdx >= 0 ? nrOnBreakByBlockFullDay[fullIdx] : 0;
    });
  }, [metrics.blocks, fullDayMetrics.blocks, nrOnBreakByBlockFullDay]);

  // ── Stats ─────────────────────────────────────────────────────────

  const activePickups = demandMode === 'max' ? fullDayMetrics.maxPickupsByBlock : fullDayMetrics.pickupsByBlock;
  const avgDailyTrips = useMemo(
    () => Math.round(activePickups.reduce((sum, v) => sum + v, 0) * 10) / 10,
    [activePickups],
  );

  const currentStats = useMemo(() => {
    const totalHours = currentRunCut.reduce((sum, r) => sum + r.durationHours, 0);
    const maxVehicles = Math.max(...currentVehiclesByBlockFullDay, 0);
    const productivity = totalHours > 0
      ? Math.round((avgDailyTrips / totalHours) * 100) / 100
      : 0;
    return { totalHours: Math.round(totalHours * 10) / 10, maxVehicles, productivity };
  }, [currentRunCut, currentVehiclesByBlockFullDay, avgDailyTrips]);

  const newRouteStats = useMemo(() => {
    let totalServiceHours = 0;
    for (const newRoute of filteredNewRoutes) {
      totalServiceHours += Number(newRoute.platform_hours) || 0;
    }
    const maxVehicles = Math.max(...newRouteVehiclesByBlockFullDay, 0);
    const productivity = totalServiceHours > 0
      ? Math.round((avgDailyTrips / totalServiceHours) * 100) / 100
      : 0;
    const { fte: estFTE, pt: estPT } = estimateFtePtCounts(filteredNewRoutes);
    return {
      count: filteredNewRoutes.length,
      totalServiceHours: Math.round(totalServiceHours * 10) / 10,
      maxVehicles,
      productivity,
      estFTE,
      estPT,
    };
  }, [filteredNewRoutes, newRouteVehiclesByBlockFullDay, avgDailyTrips]);

  // ── Copy functions ────────────────────────────────────────────────

  function toggleCopyDay(day: ServiceDay) {
    setCopyDaysSelection((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : ALL_SERVICE_DAYS.filter((d) => [...prev, day].includes(d)),
    );
  }

  function copyAllFromLiveDay() {
    if (!selectedRunCutDate || copyDaysSelection.length === 0) return;

    const dateRoutes = routes.filter((r) => {
      const dateStr = r.route_date ?? (() => {
        const dt = asDate(r.actual_start_time) ?? asDate(r.scheduled_start_time);
        if (!dt) return null;
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      })();
      return dateStr === selectedRunCutDate;
    });

    const serviceDaysJson = JSON.stringify(ALL_SERVICE_DAYS.filter((d) => copyDaysSelection.includes(d)));

    const addressToDepotId = new Map<string, string>();
    for (const d of depots) {
      if (d.depot_address) addressToDepotId.set(d.depot_address, d.depot_id);
    }

    const SPLIT_SUFFIX_RE = /(?:[-_](?:am|pm|a|p|\d+)|(?:am|pm|a|p))$/i;

    function parseSplitName(name: string): { baseName: string; suffix: string } | null {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const match = trimmed.match(SPLIT_SUFFIX_RE);
      if (!match) return null;
      const suffix = match[0];
      const baseName = trimmed.slice(0, trimmed.length - suffix.length);
      if (!baseName) return null;
      return { baseName, suffix: suffix.replace(/^[-_]/, '') };
    }

    function splitSortKey(suffix: string): number {
      const lower = suffix.toLowerCase();
      if (lower === 'a' || lower === 'am') return 0;
      if (lower === 'p' || lower === 'pm') return 1;
      const num = parseInt(lower, 10);
      return Number.isNaN(num) ? 999 : num;
    }

    function computeServiceHours(newRoute: NewRouteRow): number {
      const startMin = parseClockToMinutes(newRoute.start_time, 0);
      const endMin = parseClockToMinutes(newRoute.end_time, 0);
      const spread = Math.max(0, endMin - startMin);
      let breakMin = 0;
      for (const breakNum of [1, 2, 3] as const) {
        const bStart = newRoute[`break_${breakNum}_start`];
        const bEnd = newRoute[`break_${breakNum}_end`];
        if (bStart && bEnd) {
          const bs = parseClockToMinutes(bStart, 0);
          const be = parseClockToMinutes(bEnd, 0);
          if (be > bs) breakMin += (be - bs);
        }
      }
      return Math.round(((spread - breakMin) / 60) * 10) / 10;
    }

    const rawNewRoutes: (NewRouteRow & { _originalName: string })[] = dateRoutes.map((route, idx) => {
      const start = asDate(route.scheduled_start_time) ?? asDate(route.actual_start_time);
      const end = asDate(route.scheduled_end_time) ?? asDate(route.actual_end_time);
      const startMin = start ? dateToMinutesOfDay(start) : 360;
      const endMin = end ? dateToMinutesOfDay(end) : 840;
      const originalName = route.route_name ?? route.route_id ?? `Route ${localNewRoutes.length + idx + 1}`;

      const b1S = asDate(route.break1_start);
      const b1E = asDate(route.break1_end);
      const b2S = asDate(route.break2_start);
      const b2E = asDate(route.break2_end);
      const break1Start = b1S ? formatMinutesToClock(dateToMinutesOfDay(b1S)) : null;
      const break1End = b1E ? formatMinutesToClock(dateToMinutesOfDay(b1E)) : null;
      const break2Start = b2S ? formatMinutesToClock(dateToMinutesOfDay(b2S)) : null;
      const break2End = b2E ? formatMinutesToClock(dateToMinutesOfDay(b2E)) : null;

      const newRouteRow = {
        new_route_id: crypto.randomUUID(),
        new_route_name: originalName,
        _originalName: originalName,
        split_number: 0,
        depot: (route.depot_address ? addressToDepotId.get(route.depot_address) : null) ?? null,
        service_days: serviceDaysJson,
        route_area: route.zone ?? null,
        start_time: formatMinutesToClock(startMin),
        end_time: formatMinutesToClock(endMin),
        platform_hours: '0',
        pay_hours: '0',
        break_1_start: break1Start,
        break_1_end: break1End,
        break_2_start: break2Start,
        break_2_end: break2End,
        break_3_start: null,
        break_3_end: null,
        vehicle_type_id: route.vehicle_type_id ?? null,
      };
      const svcHrs = computeServiceHours(newRouteRow);
      newRouteRow.platform_hours = String(svcHrs);
      newRouteRow.pay_hours = String(svcHrs);

      return newRouteRow;
    });

    const splitGroups = new Map<string, { suffix: string; index: number }[]>();
    for (let i = 0; i < rawNewRoutes.length; i++) {
      const parsed = parseSplitName(rawNewRoutes[i]._originalName);
      if (parsed) {
        const key = parsed.baseName.toLowerCase();
        if (!splitGroups.has(key)) splitGroups.set(key, []);
        splitGroups.get(key)!.push({ suffix: parsed.suffix, index: i });
      }
    }

    for (const [, members] of splitGroups) {
      if (members.length < 2) continue;
      members.sort((a, b) => splitSortKey(a.suffix) - splitSortKey(b.suffix));
      for (let s = 0; s < members.length; s++) {
        const newRoute = rawNewRoutes[members[s].index];
        const parsed = parseSplitName(newRoute._originalName);
        if (parsed) {
          newRoute.new_route_name = parsed.baseName;
          newRoute.split_number = s + 1;
        }
      }
    }

    const copiedNewRoutes: NewRouteRow[] = rawNewRoutes.map(({ _originalName, ...rest }) => rest);
    updateLocalNewRoutes([...localNewRoutes, ...copiedNewRoutes]);
    showToast(`Day copied to ${copyDaysSelection.join(', ')}`);
  }

  function copySingleImportedRun(row: CurrentRunCutRow) {
    if (!selectedRunCutDate || copyDaysSelection.length === 0) return;

    const dateRoutes = routes.filter((r) => {
      const dateStr = r.route_date ?? (() => {
        const dt = asDate(r.actual_start_time) ?? asDate(r.scheduled_start_time);
        if (!dt) return null;
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      })();
      return dateStr === selectedRunCutDate;
    });

    const matchedRoute = dateRoutes.find((r) => (r.route_name ?? r.route_id) === row.routeName);

    const startMin = parseClockFromLabel(row.shiftStart);
    const endMin = parseClockFromLabel(row.shiftEnd);

    const serviceDaysJson = JSON.stringify(ALL_SERVICE_DAYS.filter((d) => copyDaysSelection.includes(d)));

    const b1Start = row.break1Start ? formatMinutesToClock(parseClockFromLabel(row.break1Start)) : null;
    const b1End = row.break1End ? formatMinutesToClock(parseClockFromLabel(row.break1End)) : null;
    const b2Start = row.break2Start ? formatMinutesToClock(parseClockFromLabel(row.break2Start)) : null;
    const b2End = row.break2End ? formatMinutesToClock(parseClockFromLabel(row.break2End)) : null;

    const matchedDepotId = matchedRoute?.depot_address
      ? depots.find((d) => d.depot_address === matchedRoute.depot_address)?.depot_id ?? null
      : null;

    function computeServiceHours(newRoute: NewRouteRow): number {
      const sMin = parseClockToMinutes(newRoute.start_time, 0);
      const eMin = parseClockToMinutes(newRoute.end_time, 0);
      const spread = Math.max(0, eMin - sMin);
      let breakMin = 0;
      for (const breakNum of [1, 2, 3] as const) {
        const bStart = newRoute[`break_${breakNum}_start`];
        const bEnd = newRoute[`break_${breakNum}_end`];
        if (bStart && bEnd) {
          const bs = parseClockToMinutes(bStart, 0);
          const be = parseClockToMinutes(bEnd, 0);
          if (be > bs) breakMin += (be - bs);
        }
      }
      return Math.round(((spread - breakMin) / 60) * 10) / 10;
    }

    const copiedNewRoute: NewRouteRow = {
      new_route_id: crypto.randomUUID(),
      new_route_name: row.routeName,
      split_number: 0,
      depot: matchedDepotId,
      service_days: serviceDaysJson,
      route_area: matchedRoute?.zone ?? null,
      start_time: formatMinutesToClock(startMin),
      end_time: formatMinutesToClock(endMin),
      platform_hours: '0',
      pay_hours: '0',
      break_1_start: b1Start,
      break_1_end: b1End,
      break_2_start: b2Start,
      break_2_end: b2End,
      break_3_start: null,
      break_3_end: null,
      vehicle_type_id: matchedRoute?.vehicle_type_id ?? null,
    };
    const svcHrs = computeServiceHours(copiedNewRoute);
    copiedNewRoute.platform_hours = String(svcHrs);
    copiedNewRoute.pay_hours = String(svcHrs);

    updateLocalNewRoutes([...localNewRoutes, copiedNewRoute]);
    showToast(`Route copied to ${copyDaysSelection.join(', ')}`);
  }

  // ── Render ────────────────────────────────────────────────────────

  return (
    <ToastProvider>
      <SectionCard title="Demand & Vehicle Coverage">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-cc-text-muted">
            Demand shown as bars. Current routes (solid line) and new routes (dashed line) as overlays.
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-3">
            <div className="flex gap-1 text-xs">
              <button
                className={`px-2 py-0.5 rounded ${breakoutMode === 'total' ? 'bg-cc-accent text-white' : 'bg-cc-surface-2 text-cc-text-muted'}`}
                onClick={() => setBreakoutMode('total')}
              >Total</button>
              <button
                className={`px-2 py-0.5 rounded ${breakoutMode === 'byStatus' ? 'bg-cc-accent text-white' : 'bg-cc-surface-2 text-cc-text-muted'}`}
                onClick={() => setBreakoutMode('byStatus')}
              >By Status</button>
              <button
                className={`px-2 py-0.5 rounded ${breakoutMode === 'byPassengerType' ? 'bg-cc-accent text-white' : 'bg-cc-surface-2 text-cc-text-muted'}`}
                onClick={() => setBreakoutMode('byPassengerType')}
              >By Mode</button>
            </div>
            <div className="flex gap-1 text-xs">
              <button
                className={`px-2 py-0.5 rounded ${demandMode === 'max' ? 'bg-cc-accent text-white' : 'bg-cc-surface-2 text-cc-text-muted'}`}
                onClick={() => setDemandMode('max')}
              >Max</button>
              <button
                className={`px-2 py-0.5 rounded ${demandMode === 'avg' ? 'bg-cc-accent text-white' : 'bg-cc-surface-2 text-cc-text-muted'}`}
                onClick={() => setDemandMode('avg')}
              >Avg</button>
              <button
                className={`px-2 py-0.5 rounded ${demandMode === 'avgNz' ? 'bg-cc-accent text-white' : 'bg-cc-surface-2 text-cc-text-muted'}`}
                onClick={() => setDemandMode('avgNz')}
              >Avg (Non-Zero)</button>
            </div>
          </div>
        </div>
        <RunStructureChart
          pickups={demandMode === 'max' ? metrics.maxPickupsByBlock : demandMode === 'avgNz' ? metrics.avgNzPickupsByBlock : metrics.pickupsByBlock}
          onBoard={demandMode === 'max' ? metrics.maxOnBoardByBlock : demandMode === 'avgNz' ? metrics.avgNzOnBoardByBlock : metrics.onBoardByBlock}
          currentVehicles={chartCurrentVehiclesByBlock}
          runVehicles={newRouteVehiclesByBlock}
          crOnBreak={demandMode === 'max' ? metrics.maxVehiclesOnBreakByBlock : demandMode === 'avgNz' ? metrics.avgNzVehiclesOnBreakByBlock : metrics.vehiclesOnBreakByBlock}
          nrOnBreak={nrOnBreakByBlock}
          blocks={metrics.blocks}
          importedDateVehicles={subTab === 'imported' && selectedRunCutDate ? importedDateVehiclesByBlock : undefined}
          irOnBreak={subTab === 'imported' && selectedRunCutDate ? importedDateOnBreakByBlock : undefined}
          importedDateLabel={subTab === 'imported' && selectedRunCutDate ? (() => {
            const d = new Date(selectedRunCutDate + 'T00:00:00');
            return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
          })() : undefined}
          breakoutMode={breakoutMode}
          pickupsByCategory={
            breakoutMode === 'byStatus'
              ? (demandMode === 'max' ? metrics.maxPickupsByBlockByStatus : demandMode === 'avgNz' ? metrics.avgNzPickupsByBlockByStatus : metrics.pickupsByBlockByStatus)
              : breakoutMode === 'byPassengerType'
              ? (demandMode === 'max' ? metrics.maxPickupsByBlockByPassengerType : demandMode === 'avgNz' ? metrics.avgNzPickupsByBlockByPassengerType : metrics.pickupsByBlockByPassengerType)
              : undefined
          }
          onBoardByCategory={
            breakoutMode === 'byStatus'
              ? (demandMode === 'max' ? metrics.maxOnBoardByBlockByStatus : demandMode === 'avgNz' ? metrics.avgNzOnBoardByBlockByStatus : metrics.onBoardByBlockByStatus)
              : breakoutMode === 'byPassengerType'
              ? (demandMode === 'max' ? metrics.maxOnBoardByBlockByPassengerType : demandMode === 'avgNz' ? metrics.avgNzOnBoardByBlockByPassengerType : metrics.onBoardByBlockByPassengerType)
              : undefined
          }
        />
      </SectionCard>

      <section className="border border-cc-border rounded-[10px] bg-cc-surface-1 p-4 mb-4">
      <Tabs value={subTab} onValueChange={(v) => { setSubTab(v as 'imported' | 'bids' | 'runeditor' | 'help'); if (v !== 'bids') setHighlightFilter(null); }}>
        <div className="flex items-center gap-2 mb-3">
          <TabsList>
            <TabsTrigger value="runeditor">Route Editor</TabsTrigger>
            <TabsTrigger value="bids">Shift Bids</TabsTrigger>
            <TabsTrigger value="imported">Imported Routes</TabsTrigger>
            <TabsTrigger value="help">Help</TabsTrigger>
          </TabsList>
          {!readonlyView && subTab !== 'imported' && subTab !== 'help' && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" onClick={handleUndo} disabled={!activeCanUndo} title="Undo" type="button">
                <Undo2 size={16} />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={handleRedo} disabled={!activeCanRedo} title="Redo" type="button">
                <Redo2 size={16} />
              </Button>
            </div>
          )}
        </div>

        <TabsContent value="imported">
          <ImportedRoutesPanel
            currentRunCut={currentRunCut}
            depots={depots}
            vehicleTypes={vehicleTypes}
            readonlyView={readonlyView}
            intervalMinutes={intervalMinutes}
            avgDailyTrips={avgDailyTrips}
            currentStats={currentStats}
            availableDates={availableDates}
            selectedRunCutDate={selectedRunCutDate}
            onSelectedRunCutDateChange={setSelectedRunCutDate}
            copyDaysSelection={copyDaysSelection}
            onToggleCopyDay={toggleCopyDay}
            onCopyAllFromLiveDay={copyAllFromLiveDay}
            onCopySingleRun={copySingleImportedRun}
          />
        </TabsContent>

        <TabsContent value="bids">
          <ShiftBidsPanel
            newRoutes={localNewRoutes}
            depots={depots}
            readonlyView={readonlyView}
            bidResult={bidResult}
            onBidResultChange={handleBidResultChange}
            pushBidUndoState={pushBidState}
            clearBidHistory={clearBidHistory}
            showToast={showToast}
            highlightFilter={highlightFilter}
            onHighlightFilterChange={setHighlightFilter}
          />
        </TabsContent>

        <TabsContent value="runeditor">
          <RouteEditorPanel
            localNewRoutes={localNewRoutes}
            filteredNewRoutes={filteredNewRoutes}
            depots={depots}
            vehicleTypes={vehicleTypes}
            availableZones={availableZones}
            readonlyView={readonlyView}
            newRouteDayFilter={newRouteDayFilter}
            onNewRouteDayFilterChange={setNewRouteDayFilter}
            depotFilter={depotFilter}
            onDepotFilterChange={setDepotFilter}
            newRouteStats={newRouteStats}
            onUpdateLocalNewRoutes={updateLocalNewRoutes}
            showToast={showToast}
          />
        </TabsContent>

        <TabsContent value="help">
          <HelpPanel />
        </TabsContent>
      </Tabs>
      </section>

      {toasts.map((t) => (
        <Toast key={t.id} onOpenChange={(open) => { if (!open) dismissToast(t.id); }}>
          <ToastTitle>{t.message}</ToastTitle>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
