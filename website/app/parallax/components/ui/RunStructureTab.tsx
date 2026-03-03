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
import type { BidResult, DepotRow, OptimizationRow, RouteRow, RunRow, ServiceDay } from '@/lib/parallax/types';

import HelpPanel from './HelpPanel';
import ImportedRoutesPanel from './ImportedRoutesPanel';
import RouteEditorPanel from './RouteEditorPanel';
import ShiftBidsPanel from './ShiftBidsPanel';
import { ALL_SERVICE_DAYS, SERVICE_DAY_TO_DOW, RunStructureChart, SectionCard, parseClockToMinutes, formatMinutesToClock, parseServiceDays } from './shared';

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
  runs: RunRow[];
  selectedDays: number[];
  readonlyView: boolean;
  intervalMinutes: number;
  onOptimizationChange: (
    key: 'target_productivity' | 'max_driver_spread_hrs' | 'peak_vehicles' | 'run_structure_json',
    value: number | string | null,
  ) => void;
  onRunsChange: (runs: RunRow[]) => void;
  depots: DepotRow[];
  filteredRoutes: RouteRow[];
  savedBidResult: BidResult | null;
  onBidResultChange: (result: BidResult | null) => void;
}

export default function RunStructureTab({
  metrics,
  fullDayMetrics,
  routes,
  runs,
  selectedDays,
  readonlyView,
  filteredRoutes,
  intervalMinutes,
  onRunsChange,
  depots,
  savedBidResult,
  onBidResultChange,
}: RunStructureTabProps) {
  const [demandMode, setDemandMode] = useState<'max' | 'avg'>('max');
  const [subTab, setSubTab] = useState<'imported' | 'bids' | 'runeditor' | 'help'>('runeditor');
  const [localRuns, setLocalRuns] = useState<RunRow[]>(runs);
  const [selectedRunCutDate, setSelectedRunCutDate] = useState<string | null>(null);
  const [runDayFilter, setRunDayFilter] = useState<ServiceDay | 'all'>('all');
  const [depotFilter, setDepotFilter] = useState<string>('all');
  const [copyDaysSelection, setCopyDaysSelection] = useState<ServiceDay[]>([...ALL_SERVICE_DAYS]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ownPersistRef = useRef(false);

  // ── Undo/Redo: runs ────────────────────────────────────────────────
  const { pushState: pushRunState, undo: undoRun, redo: redoRun, clearHistory: clearRunHistory, canUndo: canRunUndo, canRedo: canRunRedo } = useUndoRedo<RunRow[]>();

  // ── Undo/Redo: bids (lifted from ShiftBidsPanel) ──────────────────
  const { pushState: pushBidState, undo: undoBid, redo: redoBid, clearHistory: clearBidHistory, canUndo: canBidUndo, canRedo: canBidRedo } = useUndoRedo<BidResult>();
  const [bidResult, setBidResult] = useState<BidResult | null>(savedBidResult);
  const bidSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Toast ──────────────────────────────────────────────────────────
  const { toasts, showToast, dismissToast } = useToast();

  // Sync from server when runs prop changes (skip if it's our own save bouncing back)
  useEffect(() => {
    if (ownPersistRef.current) {
      ownPersistRef.current = false;
      return;
    }
    setLocalRuns(runs);
    clearRunHistory();
  }, [runs, clearRunHistory]);

  // Debounced save for runs
  const persistRuns = useCallback(
    (nextRuns: RunRow[]) => {
      if (readonlyView) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        ownPersistRef.current = true;
        onRunsChange(nextRuns);
      }, 500);
    },
    [readonlyView, onRunsChange],
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

  function updateLocalRuns(nextRuns: RunRow[]) {
    pushRunState(localRuns);
    setLocalRuns(nextRuns);
    persistRuns(nextRuns);
  }

  // ── Consolidated undo/redo ─────────────────────────────────────────

  const activeCanUndo = subTab === 'runeditor' ? canRunUndo : subTab === 'bids' ? canBidUndo : false;
  const activeCanRedo = subTab === 'runeditor' ? canRunRedo : subTab === 'bids' ? canBidRedo : false;

  function handleUndo() {
    if (subTab === 'runeditor') {
      const previous = undoRun(localRuns);
      if (previous) { setLocalRuns(previous); persistRuns(previous); }
    } else if (subTab === 'bids' && bidResult) {
      const previous = undoBid(bidResult);
      if (previous) { setBidResult(previous); persistBidResult(previous); }
    }
  }

  function handleRedo() {
    if (subTab === 'runeditor') {
      const next = redoRun(localRuns);
      if (next) { setLocalRuns(next); persistRuns(next); }
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
    () => getAvailableDates(routes, selectedDays),
    [routes, selectedDays],
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

  // ── Filtered runs for display + chart ─────────────────────────────

  const filteredRuns = useMemo(() => {
    let result = localRuns;
    if (runDayFilter !== 'all') {
      result = result.filter((run) => {
        const days = parseServiceDays(run.service_days);
        return days.includes(runDayFilter);
      });
    }
    if (depotFilter !== 'all') {
      result = result.filter((run) => run.depot === depotFilter);
    }
    return result;
  }, [localRuns, runDayFilter, depotFilter]);

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

  // Run vehicles by block (for chart)
  const { runVehiclesByBlockFullDay, nrOnBreakByBlockFullDay } = useMemo(() => {
    const counts = new Array(fullDayMetrics.blocks.length).fill(0) as number[];
    const breaks = new Array(fullDayMetrics.blocks.length).fill(0) as number[];
    for (const run of filteredRuns) {
      const runDays = parseServiceDays(run.service_days);
      const matchesDays = selectedDays.length === 0 || runDays.some((d) => selectedDaySet.has(SERVICE_DAY_TO_DOW[d]));
      if (!matchesDays) continue;

      const startMin = parseClockToMinutes(run.start_time, 0);
      const endMin = parseClockToMinutes(run.end_time, 0);
      if (endMin <= startMin) continue;
      const rb1S = parseClockToMinutes(run.break_1_start ?? '', -1);
      const rb1E = parseClockToMinutes(run.break_1_end ?? '', -1);
      const rb2S = parseClockToMinutes(run.break_2_start ?? '', -1);
      const rb2E = parseClockToMinutes(run.break_2_end ?? '', -1);
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
    return { runVehiclesByBlockFullDay: counts, nrOnBreakByBlockFullDay: breaks };
  }, [filteredRuns, fullDayMetrics.blocks, selectedDays.length, selectedDaySet]);

  const runVehiclesByBlock = useMemo(() => {
    return metrics.blocks.map((viewBlock) => {
      const fullIdx = fullDayMetrics.blocks.findIndex(
        (b) => b.startMinutes === viewBlock.startMinutes,
      );
      return fullIdx >= 0 ? runVehiclesByBlockFullDay[fullIdx] : 0;
    });
  }, [metrics.blocks, fullDayMetrics.blocks, runVehiclesByBlockFullDay]);

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

  const runStats = useMemo(() => {
    let totalServiceHours = 0;
    for (const run of filteredRuns) {
      totalServiceHours += Number(run.platform_hours) || 0;
    }
    const maxVehicles = Math.max(...runVehiclesByBlockFullDay, 0);
    const productivity = totalServiceHours > 0
      ? Math.round((avgDailyTrips / totalServiceHours) * 100) / 100
      : 0;
    const { fte: estFTE, pt: estPT } = estimateFtePtCounts(filteredRuns);
    return {
      count: filteredRuns.length,
      totalServiceHours: Math.round(totalServiceHours * 10) / 10,
      maxVehicles,
      productivity,
      estFTE,
      estPT,
    };
  }, [filteredRuns, runVehiclesByBlockFullDay, avgDailyTrips]);

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

    function computeServiceHours(run: RunRow): number {
      const startMin = parseClockToMinutes(run.start_time, 0);
      const endMin = parseClockToMinutes(run.end_time, 0);
      const spread = Math.max(0, endMin - startMin);
      let breakMin = 0;
      for (const breakNum of [1, 2, 3] as const) {
        const bStart = run[`break_${breakNum}_start`];
        const bEnd = run[`break_${breakNum}_end`];
        if (bStart && bEnd) {
          const bs = parseClockToMinutes(bStart, 0);
          const be = parseClockToMinutes(bEnd, 0);
          if (be > bs) breakMin += (be - bs);
        }
      }
      return Math.round(((spread - breakMin) / 60) * 10) / 10;
    }

    const rawRuns: (RunRow & { _originalName: string })[] = dateRoutes.map((route, idx) => {
      const start = asDate(route.scheduled_start_time) ?? asDate(route.actual_start_time);
      const end = asDate(route.scheduled_end_time) ?? asDate(route.actual_end_time);
      const startMin = start ? dateToMinutesOfDay(start) : 360;
      const endMin = end ? dateToMinutesOfDay(end) : 840;
      const originalName = route.route_name ?? route.route_id ?? `Route ${localRuns.length + idx + 1}`;

      const b1S = asDate(route.break1_start);
      const b1E = asDate(route.break1_end);
      const b2S = asDate(route.break2_start);
      const b2E = asDate(route.break2_end);
      const break1Start = b1S ? formatMinutesToClock(dateToMinutesOfDay(b1S)) : null;
      const break1End = b1E ? formatMinutesToClock(dateToMinutesOfDay(b1E)) : null;
      const break2Start = b2S ? formatMinutesToClock(dateToMinutesOfDay(b2S)) : null;
      const break2End = b2E ? formatMinutesToClock(dateToMinutesOfDay(b2E)) : null;

      const runRow = {
        run_id: crypto.randomUUID(),
        run_name: originalName,
        _originalName: originalName,
        split_number: 0,
        depot: (route.depot_address ? addressToDepotId.get(route.depot_address) : null) ?? null,
        service_days: serviceDaysJson,
        route_area: null,
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
      };
      const svcHrs = computeServiceHours(runRow);
      runRow.platform_hours = String(svcHrs);
      runRow.pay_hours = String(svcHrs);

      return runRow;
    });

    const splitGroups = new Map<string, { suffix: string; index: number }[]>();
    for (let i = 0; i < rawRuns.length; i++) {
      const parsed = parseSplitName(rawRuns[i]._originalName);
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
        const run = rawRuns[members[s].index];
        const parsed = parseSplitName(run._originalName);
        if (parsed) {
          run.run_name = parsed.baseName;
          run.split_number = s + 1;
        }
      }
    }

    const newRuns: RunRow[] = rawRuns.map(({ _originalName, ...rest }) => rest);
    updateLocalRuns([...localRuns, ...newRuns]);
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

    function computeServiceHours(run: RunRow): number {
      const sMin = parseClockToMinutes(run.start_time, 0);
      const eMin = parseClockToMinutes(run.end_time, 0);
      const spread = Math.max(0, eMin - sMin);
      let breakMin = 0;
      for (const breakNum of [1, 2, 3] as const) {
        const bStart = run[`break_${breakNum}_start`];
        const bEnd = run[`break_${breakNum}_end`];
        if (bStart && bEnd) {
          const bs = parseClockToMinutes(bStart, 0);
          const be = parseClockToMinutes(bEnd, 0);
          if (be > bs) breakMin += (be - bs);
        }
      }
      return Math.round(((spread - breakMin) / 60) * 10) / 10;
    }

    const newRun: RunRow = {
      run_id: crypto.randomUUID(),
      run_name: row.routeName,
      split_number: 0,
      depot: matchedDepotId,
      service_days: serviceDaysJson,
      route_area: null,
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
    };
    const svcHrs = computeServiceHours(newRun);
    newRun.platform_hours = String(svcHrs);
    newRun.pay_hours = String(svcHrs);

    updateLocalRuns([...localRuns, newRun]);
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
          <div className="flex gap-1 text-xs shrink-0 ml-3">
            <button
              className={`px-2 py-0.5 rounded ${demandMode === 'max' ? 'bg-cc-accent text-white' : 'bg-cc-surface-2 text-cc-text-muted'}`}
              onClick={() => setDemandMode('max')}
            >Max</button>
            <button
              className={`px-2 py-0.5 rounded ${demandMode === 'avg' ? 'bg-cc-accent text-white' : 'bg-cc-surface-2 text-cc-text-muted'}`}
              onClick={() => setDemandMode('avg')}
            >Avg</button>
          </div>
        </div>
        <RunStructureChart
          pickups={demandMode === 'max' ? metrics.maxPickupsByBlock : metrics.pickupsByBlock}
          onBoard={demandMode === 'max' ? metrics.maxOnBoardByBlock : metrics.onBoardByBlock}
          currentVehicles={chartCurrentVehiclesByBlock}
          runVehicles={runVehiclesByBlock}
          crOnBreak={demandMode === 'max' ? metrics.maxVehiclesOnBreakByBlock : metrics.vehiclesOnBreakByBlock}
          nrOnBreak={nrOnBreakByBlock}
          blocks={metrics.blocks}
          importedDateVehicles={subTab === 'imported' && selectedRunCutDate ? importedDateVehiclesByBlock : undefined}
          irOnBreak={subTab === 'imported' && selectedRunCutDate ? importedDateOnBreakByBlock : undefined}
          importedDateLabel={subTab === 'imported' && selectedRunCutDate ? (() => {
            const d = new Date(selectedRunCutDate + 'T00:00:00');
            return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
          })() : undefined}
        />
      </SectionCard>

      <section className="border border-cc-border rounded-[10px] bg-cc-surface-1 p-4 mb-4">
      <Tabs value={subTab} onValueChange={(v) => setSubTab(v as 'imported' | 'bids' | 'runeditor' | 'help')}>
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
            runs={localRuns}
            depots={depots}
            readonlyView={readonlyView}
            bidResult={bidResult}
            onBidResultChange={handleBidResultChange}
            pushBidUndoState={pushBidState}
            clearBidHistory={clearBidHistory}
            showToast={showToast}
          />
        </TabsContent>

        <TabsContent value="runeditor">
          <RouteEditorPanel
            localRuns={localRuns}
            filteredRuns={filteredRuns}
            depots={depots}
            readonlyView={readonlyView}
            runDayFilter={runDayFilter}
            onRunDayFilterChange={setRunDayFilter}
            depotFilter={depotFilter}
            onDepotFilterChange={setDepotFilter}
            runStats={runStats}
            onUpdateLocalRuns={updateLocalRuns}
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
