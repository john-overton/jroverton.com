'use client';

import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, CircleHelp, Copy, Plus, Redo2, SquareSplitHorizontal, Trash2, Undo2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/app/clearcut/components/shadcn/button';
import { Input } from '@/app/clearcut/components/shadcn/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/clearcut/components/shadcn/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/clearcut/components/shadcn/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/clearcut/components/shadcn/tabs';
import type { ClearcutMetrics } from '@/lib/clearcut/metrics';
import { estimateFtePtCounts } from '@/lib/clearcut/bid-algorithm';
import type { CurrentRunCutRow } from '@/lib/clearcut/run-structure';
import { buildRunCutForDate, getAvailableDates } from '@/lib/clearcut/run-structure';
import type { DepotRow, OptimizationRow, RouteRow, RunRow, ServiceDay } from '@/lib/clearcut/types';

import { Toast, ToastClose, ToastProvider, ToastTitle, ToastViewport } from '@/app/clearcut/components/shadcn/toast';
import { useToast } from '@/app/clearcut/hooks/useToast';
import { useUndoRedo } from '@/app/clearcut/hooks/useUndoRedo';

import ShiftBidsPanel from './ShiftBidsPanel';
import { RunStructureChart, SectionCard, parseClockToMinutes, formatMinutesToClock } from './shared';

const ALL_SERVICE_DAYS: ServiceDay[] = ['M', 'T', 'W', 'Th', 'F', 'Sa', 'Su'];
const SERVICE_DAY_TO_DOW: Record<ServiceDay, number> = { Su: 0, M: 1, T: 2, W: 3, Th: 4, F: 5, Sa: 6 };
const DOW_TO_SERVICE_DAY: Record<number, ServiceDay> = { 0: 'Su', 1: 'M', 2: 'T', 3: 'W', 4: 'Th', 5: 'F', 6: 'Sa' };
const SERVICE_DAY_FULL_NAME: Record<ServiceDay, string> = { M: 'Monday', T: 'Tuesday', W: 'Wednesday', Th: 'Thursday', F: 'Friday', Sa: 'Saturday', Su: 'Sunday' };

function parseServiceDays(json: string): ServiceDay[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((d: string) => ALL_SERVICE_DAYS.includes(d as ServiceDay)) as ServiceDay[] : [];
  } catch {
    return [];
  }
}

/** Service hours = (end - start) minus break durations */
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

/** Format a break's start/end as a compact duration string, e.g. "30m" */
function breakDurationLabel(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const s = parseClockToMinutes(start, -1);
  const e = parseClockToMinutes(end, -1);
  if (s < 0 || e < 0 || e <= s) return null;
  return `${e - s}m`;
}

/** Clamp a break time string to fall within the run's start/end window */
function clampBreakTime(time: string, runStart: string, runEnd: string): string {
  const t = parseClockToMinutes(time, -1);
  if (t < 0) return time;
  const s = parseClockToMinutes(runStart, 0);
  const e = parseClockToMinutes(runEnd, 1440);
  const clamped = Math.max(s, Math.min(e, t));
  return formatMinutesToClock(clamped);
}

/**
 * Detect split suffixes in route names.
 * Recognized patterns (case-insensitive):
 *   105a / 105p          → base "105"
 *   105-1 / 105-2        → base "105"
 *   105-am / 105-pm      → base "105"
 *   105_am / 105_pm      → base "105"
 *   R12A / R12P           → base "R12"
 * Returns the base name and the suffix found, or null if no split pattern.
 */
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

/** Ordering key for known split suffixes so "am" sorts before "pm", "a" before "p", etc. */
function splitSortKey(suffix: string): number {
  const lower = suffix.toLowerCase();
  if (lower === 'a' || lower === 'am') return 0;
  if (lower === 'p' || lower === 'pm') return 1;
  const num = parseInt(lower, 10);
  return Number.isNaN(num) ? 999 : num;
}

/**
 * Recompute split_number for all runs based on name patterns.
 * Runs whose names share a base (e.g. 106a, 106b) get split_number 1, 2, …
 * Runs with unique names (no matching sibling) get split_number 0.
 */
function applySplitDetection(runs: RunRow[]): RunRow[] {
  // Group indices by lowercase base name
  const groups = new Map<string, { suffix: string; index: number }[]>();
  for (let i = 0; i < runs.length; i++) {
    const parsed = parseSplitName(runs[i].run_name);
    if (parsed) {
      const key = parsed.baseName.toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({ suffix: parsed.suffix, index: i });
    }
  }

  // Build a map of index → new split_number
  const splitNumbers = new Map<number, number>();
  for (const [, members] of groups) {
    if (members.length < 2) continue;
    members.sort((a, b) => splitSortKey(a.suffix) - splitSortKey(b.suffix));
    for (let s = 0; s < members.length; s++) {
      splitNumbers.set(members[s].index, s + 1);
    }
  }

  // If nothing changed, return as-is to preserve reference equality
  let changed = false;
  for (let i = 0; i < runs.length; i++) {
    const expected = splitNumbers.get(i) ?? 0;
    if (runs[i].split_number !== expected) { changed = true; break; }
  }
  if (!changed) return runs;

  return runs.map((run, i) => {
    const expected = splitNumbers.get(i) ?? 0;
    return run.split_number === expected ? run : { ...run, split_number: expected };
  });
}

/** Parse a 12-hour "H:MM AM/PM" label back to minutes-of-day for sorting */
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

function dateToMinutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function asDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

// ── Day picker for copy-from-day dialog ──────────────────────────────

function CopyDaysPicker({
  selectedDays,
  onToggle,
}: {
  selectedDays: ServiceDay[];
  onToggle: (day: ServiceDay) => void;
}) {
  return (
    <div className="flex gap-1">
      {ALL_SERVICE_DAYS.map((day) => (
        <button
          key={day}
          className={`px-2 py-0.5 text-xs rounded ${
            selectedDays.includes(day)
              ? 'bg-cc-accent text-white'
              : 'bg-cc-surface-2 text-cc-text-muted'
          }`}
          onClick={() => onToggle(day)}
          type="button"
        >
          {day}
        </button>
      ))}
    </div>
  );
}

// ── Sortable table header ────────────────────────────────────────────

type SortColumn = 'run_name' | 'start_time' | 'end_time' | 'platform_hours' | 'split_number';

function SortableHead({
  column,
  label,
  className,
  sortKey,
  sortDir,
  onSort,
}: {
  column: SortColumn;
  label: string;
  className?: string;
  sortKey: SortColumn;
  sortDir: 'asc' | 'desc';
  onSort: (key: SortColumn) => void;
}) {
  const active = sortKey === column;
  return (
    <TableHead className={className}>
      <button
        className="inline-flex items-center gap-1 hover:text-cc-accent transition-colors"
        onClick={() => onSort(column)}
        type="button"
      >
        {label}
        {active ? (
          sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
        ) : (
          <span className="w-3" />
        )}
      </button>
    </TableHead>
  );
}

// ── Sortable header for imported runs table ─────────────────────────

type ImportedSortColumn = 'routeName' | 'shiftStart' | 'shiftEnd' | 'durationHours';

function ImportedSortableHead({
  column,
  label,
  className,
  sortKey,
  sortDir,
  onSort,
}: {
  column: ImportedSortColumn;
  label: string;
  className?: string;
  sortKey: ImportedSortColumn;
  sortDir: 'asc' | 'desc';
  onSort: (key: ImportedSortColumn) => void;
}) {
  const active = sortKey === column;
  return (
    <TableHead className={className}>
      <button
        className="inline-flex items-center gap-1 hover:text-cc-accent transition-colors"
        onClick={() => onSort(column)}
        type="button"
      >
        {label}
        {active ? (
          sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
        ) : (
          <span className="w-3" />
        )}
      </button>
    </TableHead>
  );
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
}: RunStructureTabProps) {
  const [demandMode, setDemandMode] = useState<'max' | 'avg'>('max');
  const [subTab, setSubTab] = useState<'imported' | 'bids' | 'runeditor'>('runeditor');
  const [localRuns, setLocalRuns] = useState<RunRow[]>(runs);
  const [draftRun, setDraftRun] = useState<RunRow | null>(null);
  const [selectedRunCutDate, setSelectedRunCutDate] = useState<string | null>(null);
  const [runDayFilter, setRunDayFilter] = useState<ServiceDay | 'all'>('all');
  const [depotFilter, setDepotFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortColumn>('run_name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [breaksExpanded, setBreaksExpanded] = useState(false);
  const [copyDaysSelection, setCopyDaysSelection] = useState<ServiceDay[]>([...ALL_SERVICE_DAYS]);
  const [importedSortKey, setImportedSortKey] = useState<ImportedSortColumn>('shiftStart');
  const [importedSortDir, setImportedSortDir] = useState<'asc' | 'desc'>('asc');
  const [importedBreaksExpanded, setImportedBreaksExpanded] = useState(false);
  const [frozenOrder, setFrozenOrder] = useState<string[] | null>(null);
  const [highlightedRunId, setHighlightedRunId] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ownPersistRef = useRef(false);
  const sortFreezeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEditedRunIdRef = useRef<string | null>(null);
  const { pushState, undo, redo, clearHistory, canUndo, canRedo } = useUndoRedo<RunRow[]>();
  const { toasts, showToast, dismissToast } = useToast();

  // Sync from server when runs prop changes (skip if it's our own save bouncing back)
  useEffect(() => {
    if (ownPersistRef.current) {
      ownPersistRef.current = false;
      return;
    }
    setLocalRuns(runs);
    clearHistory();
  }, [runs, clearHistory]);

  // Cleanup sort-freeze timer on unmount
  useEffect(() => {
    return () => {
      if (sortFreezeTimerRef.current) clearTimeout(sortFreezeTimerRef.current);
    };
  }, []);

  // Debounced save
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

  function updateLocalRuns(nextRuns: RunRow[]) {
    pushState(localRuns);
    const withSplits = applySplitDetection(nextRuns);
    setLocalRuns(withSplits);
    persistRuns(withSplits);
  }

  function handleUndo() {
    const previous = undo(localRuns);
    if (previous) { setLocalRuns(previous); persistRuns(previous); }
  }

  function handleRedo() {
    const next = redo(localRuns);
    if (next) { setLocalRuns(next); persistRuns(next); }
  }

  // ── Imported run cut data ────────────────────────────────────────

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

  const sortedRunCut = useMemo(() => {
    const dir = importedSortDir === 'asc' ? 1 : -1;
    return [...currentRunCut].sort((a, b) => {
      let cmp: number;
      switch (importedSortKey) {
        case 'shiftStart':
        case 'shiftEnd':
          cmp = parseClockFromLabel(a[importedSortKey]) - parseClockFromLabel(b[importedSortKey]);
          break;
        case 'durationHours':
          cmp = a.durationHours - b.durationHours;
          break;
        case 'routeName':
        default:
          cmp = a.routeName.localeCompare(b.routeName);
          break;
      }
      return cmp !== 0 ? cmp * dir : a.routeName.localeCompare(b.routeName);
    });
  }, [currentRunCut, importedSortKey, importedSortDir]);

  // ── Filtered runs for display + chart ────────────────────────────

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

  // ── Vehicle counts by block ──────────────────────────────────────

  // Current routes from imported data (date-specific, for imported-routes stats)
  const currentVehiclesByBlockFullDay = useMemo(() => {
    const counts = new Array(fullDayMetrics.blocks.length).fill(0) as number[];
    for (const row of currentRunCut) {
      for (const idx of row.activeBlockIndices) {
        if (idx >= 0 && idx < counts.length) counts[idx] += 1;
      }
    }
    return counts;
  }, [currentRunCut, fullDayMetrics.blocks.length]);

  // Current routes for the chart — derived from globally-filtered routes, averaged per date
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
      for (let i = 0; i < fullDayMetrics.blocks.length; i++) {
        if (startMin < fullDayMetrics.blocks[i].endMinutes && endMin > fullDayMetrics.blocks[i].startMinutes) {
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

  const selectedDaySet = useMemo(() => new Set(selectedDays), [selectedDays]);

  // New routes for the chart — from locally-filtered runs, checked against global day selection
  const runVehiclesByBlockFullDay = useMemo(() => {
    const counts = new Array(fullDayMetrics.blocks.length).fill(0) as number[];
    for (const run of filteredRuns) {
      const runDays = parseServiceDays(run.service_days);
      const matchesDays = selectedDays.length === 0 || runDays.some((d) => selectedDaySet.has(SERVICE_DAY_TO_DOW[d]));
      if (!matchesDays) continue;

      const startMin = parseClockToMinutes(run.start_time, 0);
      const endMin = parseClockToMinutes(run.end_time, 0);
      if (endMin <= startMin) continue;
      for (let i = 0; i < fullDayMetrics.blocks.length; i++) {
        if (startMin < fullDayMetrics.blocks[i].endMinutes && endMin > fullDayMetrics.blocks[i].startMinutes) {
          counts[i] += 1;
        }
      }
    }
    return counts;
  }, [filteredRuns, fullDayMetrics.blocks, selectedDays.length, selectedDaySet]);

  const runVehiclesByBlock = useMemo(() => {
    return metrics.blocks.map((viewBlock) => {
      const fullIdx = fullDayMetrics.blocks.findIndex(
        (b) => b.startMinutes === viewBlock.startMinutes,
      );
      return fullIdx >= 0 ? runVehiclesByBlockFullDay[fullIdx] : 0;
    });
  }, [metrics.blocks, fullDayMetrics.blocks, runVehiclesByBlockFullDay]);

  // ── Stats ────────────────────────────────────────────────────────

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

  // ── Split overlap detection ──────────────────────────────────────
  // Runs that share a base name (split siblings) should not have overlapping times.
  const splitOverlapIds = useMemo(() => {
    const overlapping = new Set<string>();
    // Group by base name
    const groups = new Map<string, RunRow[]>();
    for (const run of localRuns) {
      if (run.split_number === 0) continue;
      const parsed = parseSplitName(run.run_name);
      const key = parsed ? parsed.baseName.toLowerCase() : run.run_name.toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(run);
    }
    for (const [, siblings] of groups) {
      if (siblings.length < 2) continue;
      for (let i = 0; i < siblings.length; i++) {
        const aStart = parseClockToMinutes(siblings[i].start_time, 0);
        const aEnd = parseClockToMinutes(siblings[i].end_time, 0);
        for (let j = i + 1; j < siblings.length; j++) {
          const bStart = parseClockToMinutes(siblings[j].start_time, 0);
          const bEnd = parseClockToMinutes(siblings[j].end_time, 0);
          if (aStart < bEnd && bStart < aEnd) {
            overlapping.add(siblings[i].run_id);
            overlapping.add(siblings[j].run_id);
          }
        }
      }
    }
    return overlapping;
  }, [localRuns]);

  // ── Sorted runs for display ─────────────────────────────────────

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function toggleImportedSort(key: ImportedSortColumn) {
    if (importedSortKey === key) {
      setImportedSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setImportedSortKey(key);
      setImportedSortDir('asc');
    }
  }

  const sortedRuns = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filteredRuns].sort((a, b) => {
      let cmp: number;
      switch (sortKey) {
        case 'start_time':
        case 'end_time':
          cmp = a[sortKey].localeCompare(b[sortKey]);
          break;
        case 'platform_hours':
          cmp = (Number(a.platform_hours) || 0) - (Number(b.platform_hours) || 0);
          break;
        case 'split_number':
          cmp = a.split_number - b.split_number;
          break;
        case 'run_name':
        default:
          cmp = a.run_name.localeCompare(b.run_name);
          break;
      }
      if (cmp !== 0) return cmp * dir;
      // Secondary sort: name then split
      if (sortKey !== 'run_name') {
        const nameCmp = a.run_name.localeCompare(b.run_name);
        if (nameCmp !== 0) return nameCmp;
      }
      return a.split_number - b.split_number;
    });
  }, [filteredRuns, sortKey, sortDir]);

  // Display order: use frozen order during edits, otherwise follow sort
  const displayRuns = useMemo(() => {
    if (!frozenOrder) return sortedRuns;
    const runMap = new Map(filteredRuns.map((r) => [r.run_id, r]));
    const ordered: RunRow[] = [];
    for (const id of frozenOrder) {
      const run = runMap.get(id);
      if (run) {
        ordered.push(run);
        runMap.delete(id);
      }
    }
    // Append any runs not in frozen order (e.g., newly added via copy)
    for (const run of runMap.values()) {
      ordered.push(run);
    }
    return ordered;
  }, [frozenOrder, sortedRuns, filteredRuns]);

  // ── Actions ──────────────────────────────────────────────────────

  function addRun() {
    if (draftRun) return;
    const defaultDays = runDayFilter !== 'all'
      ? JSON.stringify([runDayFilter])
      : '["M","T","W","Th","F"]';
    setDraftRun({
      run_id: crypto.randomUUID(),
      run_name: `Route ${localRuns.length + 1}`,
      split_number: 0,
      depot: null,
      service_days: defaultDays,
      route_area: null,
      start_time: '06:00',
      end_time: '14:00',
      platform_hours: '8.0',
      pay_hours: '8.0',
      break_1_start: null,
      break_1_end: null,
      break_2_start: null,
      break_2_end: null,
      break_3_start: null,
      break_3_end: null,
    });
  }

  function updateDraft(field: keyof RunRow, value: string | number | null) {
    if (!draftRun) return;
    const next = { ...draftRun, [field]: value };
    if (field.startsWith('break_') && typeof value === 'string' && value) {
      next[field as keyof RunRow] = clampBreakTime(value, next.start_time, next.end_time) as never;
    }
    if (field === 'start_time' || field === 'end_time' || field.startsWith('break_')) {
      const svcHrs = computeServiceHours(next);
      next.platform_hours = String(svcHrs);
      next.pay_hours = String(svcHrs);
    }
    setDraftRun(next);
  }

  function toggleDraftServiceDay(day: ServiceDay) {
    if (!draftRun) return;
    const days = parseServiceDays(draftRun.service_days);
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
    const sorted = ALL_SERVICE_DAYS.filter((d) => next.includes(d));
    updateDraft('service_days', JSON.stringify(sorted));
  }

  function saveDraft() {
    if (!draftRun) return;
    updateLocalRuns([...localRuns, draftRun]);
    setDraftRun(null);
  }

  function cancelDraft() {
    setDraftRun(null);
  }

  function addSplit(run: RunRow) {
    const siblings = localRuns.filter((r) => r.run_name === run.run_name && r.split_number > 0);
    const nextSplitNumber = siblings.length > 0
      ? Math.max(...siblings.map((s) => s.split_number)) + 1
      : 2;

    let nextRuns = localRuns;
    if (run.split_number === 0) {
      nextRuns = nextRuns.map((r) =>
        r.run_id === run.run_id ? { ...r, split_number: 1 } : r,
      );
    }

    const newSplit: RunRow = {
      run_id: crypto.randomUUID(),
      run_name: run.run_name,
      split_number: nextSplitNumber,
      depot: run.depot,
      service_days: run.service_days,
      route_area: run.route_area,
      start_time: '14:00',
      end_time: '20:00',
      platform_hours: '6.0',
      pay_hours: '6.0',
      break_1_start: null,
      break_1_end: null,
      break_2_start: null,
      break_2_end: null,
      break_3_start: null,
      break_3_end: null,
    };
    updateLocalRuns([...nextRuns, newSplit]);
  }

  function deleteRun(runId: string) {
    updateLocalRuns(localRuns.filter((r) => r.run_id !== runId));
  }

  function duplicateRun(run: RunRow) {
    const copy: RunRow = {
      ...run,
      run_id: crypto.randomUUID(),
      run_name: `${run.run_name} copy`,
      split_number: 0,
    };
    updateLocalRuns([...localRuns, copy]);
  }

  function updateRun(runId: string, field: keyof RunRow, value: string | number | null) {
    // Freeze current display order on first edit so the row doesn't jump
    setFrozenOrder((prev) => prev ?? sortedRuns.map((r) => r.run_id));
    lastEditedRunIdRef.current = runId;

    // Reset the 5-second debounce before re-sorting
    if (sortFreezeTimerRef.current) clearTimeout(sortFreezeTimerRef.current);
    sortFreezeTimerRef.current = setTimeout(() => {
      setFrozenOrder(null);
      setHighlightedRunId(runId);
      setTimeout(() => setHighlightedRunId(null), 2000);
      sortFreezeTimerRef.current = null;
      lastEditedRunIdRef.current = null;
    }, 5000);

    updateLocalRuns(
      localRuns.map((r) => {
        if (r.run_id !== runId) return r;
        const next = { ...r, [field]: value };
        // Clamp break times to the run's start/end window
        if (field.startsWith('break_') && typeof value === 'string' && value) {
          next[field as keyof RunRow] = clampBreakTime(value, next.start_time, next.end_time) as never;
        }
        // Recalc service hours whenever times change
        if (field === 'start_time' || field === 'end_time' || field.startsWith('break_')) {
          const svcHrs = computeServiceHours(next);
          next.platform_hours = String(svcHrs);
          next.pay_hours = String(svcHrs);
        }
        return next;
      }),
    );
  }

  function toggleServiceDay(runId: string, day: ServiceDay) {
    const run = localRuns.find((r) => r.run_id === runId);
    if (!run) return;
    const days = parseServiceDays(run.service_days);
    const next = days.includes(day)
      ? days.filter((d) => d !== day)
      : [...days, day];
    const sorted = ALL_SERVICE_DAYS.filter((d) => next.includes(d));
    updateRun(runId, 'service_days', JSON.stringify(sorted));
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

    // Build raw run rows with original names first
    const rawRuns: (RunRow & { _originalName: string })[] = dateRoutes.map((route, idx) => {
      const start = asDate(route.actual_start_time) ?? asDate(route.scheduled_start_time);
      const end = asDate(route.actual_end_time) ?? asDate(route.scheduled_end_time);
      const startMin = start ? dateToMinutesOfDay(start) : 360;
      const endMin = end ? dateToMinutesOfDay(end) : 840;
      const durationHrs = Math.round(((endMin - startMin) / 60) * 10) / 10;
      const originalName = route.route_name ?? route.route_id ?? `Route ${localRuns.length + idx + 1}`;

      return {
        run_id: crypto.randomUUID(),
        run_name: originalName,
        _originalName: originalName,
        split_number: 0,
        depot: route.depot_address ?? null,
        service_days: serviceDaysJson,
        route_area: null,
        start_time: formatMinutesToClock(startMin),
        end_time: formatMinutesToClock(endMin),
        platform_hours: String(Math.max(0, durationHrs)),
        pay_hours: String(Math.max(0, durationHrs)),
        break_1_start: null,
        break_1_end: null,
        break_2_start: null,
        break_2_end: null,
        break_3_start: null,
        break_3_end: null,
      };
    });

    // Detect splits: group by base name, assign split_numbers if >1 route shares a base
    const splitGroups = new Map<string, { suffix: string; index: number }[]>();
    for (let i = 0; i < rawRuns.length; i++) {
      const parsed = parseSplitName(rawRuns[i]._originalName);
      if (parsed) {
        const key = parsed.baseName.toLowerCase();
        if (!splitGroups.has(key)) splitGroups.set(key, []);
        splitGroups.get(key)!.push({ suffix: parsed.suffix, index: i });
      }
    }

    // Apply split detection — only for groups with 2+ routes sharing the same base
    for (const [, members] of splitGroups) {
      if (members.length < 2) continue;
      // Sort members by suffix so am/a/1 comes first
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

    // Strip the internal _originalName field
    const newRuns: RunRow[] = rawRuns.map(({ _originalName, ...rest }) => rest);

    // Append to existing runs instead of replacing
    updateLocalRuns([...localRuns, ...newRuns]);
    showToast(`Day copied to ${copyDaysSelection.join(', ')}`);
  }

  function toggleCopyDay(day: ServiceDay) {
    setCopyDaysSelection((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : ALL_SERVICE_DAYS.filter((d) => [...prev, day].includes(d)),
    );
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

    const newRun: RunRow = {
      run_id: crypto.randomUUID(),
      run_name: row.routeName,
      split_number: 0,
      depot: matchedRoute?.depot_address ?? null,
      service_days: serviceDaysJson,
      route_area: null,
      start_time: formatMinutesToClock(startMin),
      end_time: formatMinutesToClock(endMin),
      platform_hours: String(row.durationHours),
      pay_hours: String(row.durationHours),
      break_1_start: null,
      break_1_end: null,
      break_2_start: null,
      break_2_end: null,
      break_3_start: null,
      break_3_end: null,
    };

    updateLocalRuns([...localRuns, newRun]);
    showToast(`Route copied to ${copyDaysSelection.join(', ')}`);
  }

  // ── Render ───────────────────────────────────────────────────────

  return (
    <ToastProvider>
      <style>{`
        @keyframes highlight-row {
          0% { background-color: color-mix(in srgb, var(--color-cc-accent) 25%, transparent); }
          100% { background-color: transparent; }
        }
        .animate-highlight-row > td {
          animation: highlight-row 2s ease-out;
        }
      `}</style>
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
          blocks={metrics.blocks}
        />
      </SectionCard>

      <SectionCard title="Route Structure" headerRight={!readonlyView ? (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={handleUndo} disabled={!canUndo} title="Undo" type="button">
            <Undo2 size={16} />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={handleRedo} disabled={!canRedo} title="Redo" type="button">
            <Redo2 size={16} />
          </Button>
        </div>
      ) : undefined}>
        <Tabs value={subTab} onValueChange={(v) => setSubTab(v as 'imported' | 'bids' | 'runeditor')}>
          <TabsList>
            <TabsTrigger value="runeditor">Route Editor</TabsTrigger>
            <TabsTrigger value="bids">Shift Bids</TabsTrigger>
            <TabsTrigger value="imported">Imported Routes</TabsTrigger>
          </TabsList>

          {/* ── Imported Routes sub-tab ───────────────────────────── */}
          <TabsContent value="imported">
            <div className="flex items-center gap-3 mb-3 mt-3">
              <Select
                value={selectedRunCutDate ?? ''}
                onValueChange={(v) => setSelectedRunCutDate(v || null)}
              >
                <SelectTrigger className="w-auto min-w-[200px]">
                  <SelectValue placeholder="No dates available" />
                </SelectTrigger>
                <SelectContent>
                  {availableDates.length === 0 && <SelectItem value="">No dates available</SelectItem>}
                  {availableDates.map((dateStr) => {
                    const d = new Date(dateStr + 'T00:00:00');
                    const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                    return <SelectItem key={dateStr} value={dateStr}>{label}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
              {!readonlyView && currentRunCut.length > 0 && (
                <Button variant="outline" size="sm" onClick={copyAllFromLiveDay} disabled={copyDaysSelection.length === 0} type="button">
                  <Copy size={14} className="mr-1.5" /> Copy Day to Route Editor
                </Button>
              )}
            </div>

            {!readonlyView && (
              <div className="flex gap-0.5 items-center mb-3">
                <span className="text-xs text-cc-text-muted mr-1">Copy to:</span>
                {ALL_SERVICE_DAYS.map((day) => (
                  <button
                    key={day}
                    className={`px-1.5 py-0.5 text-[10px] rounded ${copyDaysSelection.includes(day) ? 'bg-cc-accent text-white' : 'bg-cc-surface-2 text-cc-text-muted'}`}
                    onClick={() => toggleCopyDay(day)}
                    type="button"
                  >{day}</button>
                ))}
              </div>
            )}

            <div className="flex gap-4 mb-3 text-[13px] flex-wrap">
              <span>Avg Daily Trips: <strong>{avgDailyTrips}</strong></span>
              <span>Hours: <strong>{currentStats.totalHours}</strong></span>
              <span>Peak Vehicles: <strong>{currentStats.maxVehicles}</strong></span>
              <span>Productivity: <strong>{currentStats.productivity}</strong></span>
            </div>
            <div className="text-xs text-cc-text-muted mb-2">
              Imported routes for the selected date, rounded up to {intervalMinutes}-min blocks.
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <ImportedSortableHead column="routeName" label="Route" sortKey={importedSortKey} sortDir={importedSortDir} onSort={toggleImportedSort} />
                    <ImportedSortableHead column="shiftStart" label="Shift Start" sortKey={importedSortKey} sortDir={importedSortDir} onSort={toggleImportedSort} />
                    <ImportedSortableHead column="shiftEnd" label="Shift End" sortKey={importedSortKey} sortDir={importedSortDir} onSort={toggleImportedSort} />
                    <ImportedSortableHead column="durationHours" label="Duration" sortKey={importedSortKey} sortDir={importedSortDir} onSort={toggleImportedSort} />
                    {importedBreaksExpanded ? (
                      <>
                        <TableHead>
                          <button
                            className="inline-flex items-center gap-1 hover:text-cc-accent transition-colors"
                            onClick={() => setImportedBreaksExpanded(false)}
                            type="button"
                          >
                            <ChevronDown size={13} /> Break 1
                          </button>
                        </TableHead>
                        <TableHead>Break 2</TableHead>
                      </>
                    ) : (
                      <TableHead>
                        <button
                          className="inline-flex items-center gap-1 hover:text-cc-accent transition-colors"
                          onClick={() => setImportedBreaksExpanded(true)}
                          type="button"
                        >
                          <ChevronRight size={13} /> Breaks
                        </button>
                      </TableHead>
                    )}
                    {!readonlyView && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRunCut.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={importedBreaksExpanded ? (readonlyView ? 6 : 7) : (readonlyView ? 5 : 6)} className="text-cc-text-muted">
                        No routes for selected date
                      </TableCell>
                    </TableRow>
                  )}
                  {sortedRunCut.map((row, idx) => (
                    <TableRow key={`${row.routeName}-${idx}`}>
                      <TableCell>{row.routeName}</TableCell>
                      <TableCell>{row.shiftStart}</TableCell>
                      <TableCell>{row.shiftEnd}</TableCell>
                      <TableCell>{row.durationHours} hrs</TableCell>
                      {importedBreaksExpanded ? (
                        <>
                          <TableCell>
                            <span className="text-xs text-cc-text-muted">{row.break1 ?? '\u2014'}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-cc-text-muted">{row.break2 ?? '\u2014'}</span>
                          </TableCell>
                        </>
                      ) : (
                        <TableCell>
                          <span className="text-xs text-cc-text-muted">
                            {row.break1 && row.break2 ? `${row.break1}, ${row.break2}` : row.break1 ?? row.break2 ?? '\u2014'}
                          </span>
                        </TableCell>
                      )}
                      {!readonlyView && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => copySingleImportedRun(row)}
                            title="Copy to route editor"
                            type="button"
                          >
                            <Copy size={13} />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ── Shift Bids sub-tab ────────────────────────────────── */}
          <TabsContent value="bids">
            <ShiftBidsPanel runs={localRuns} depots={depots} readonlyView={readonlyView} />
          </TabsContent>

          {/* ── Route Editor sub-tab ──────────────────────────────── */}
          <TabsContent value="runeditor">
            <div className="flex items-center justify-between mb-3 mt-3 flex-wrap gap-2">
              <div className="flex gap-4 text-[13px] flex-wrap items-center">
                <span>Routes: <strong>{runStats.count}</strong></span>
                <span>Service Hrs: <strong>{runStats.totalServiceHours}</strong></span>
                <span>Peak Vehicles: <strong>{runStats.maxVehicles}</strong></span>
                <span>Productivity: <strong>{runStats.productivity}</strong></span>
                <span>Est. FTE: <strong>{runStats.estFTE}</strong></span>
                <span>Est. PT: <strong>{runStats.estPT}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                {/* Day filter */}
                <div className="flex gap-0.5 items-center">
                  <span className="text-xs text-cc-text-muted mr-1">Show:</span>
                  <button
                    className={`px-2 py-0.5 text-[10px] rounded ${runDayFilter === 'all' ? 'bg-cc-accent text-white' : 'bg-cc-surface-2 text-cc-text-muted'}`}
                    onClick={() => setRunDayFilter('all')}
                  >All</button>
                  {ALL_SERVICE_DAYS.map((day) => (
                    <button
                      key={day}
                      className={`px-1.5 py-0.5 text-[10px] rounded ${runDayFilter === day ? 'bg-cc-accent text-white' : 'bg-cc-surface-2 text-cc-text-muted'}`}
                      onClick={() => setRunDayFilter(day)}
                    >{day}</button>
                  ))}
                </div>
                {depots.length > 0 && (
                  <Select value={depotFilter} onValueChange={setDepotFilter}>
                    <SelectTrigger className="h-7 text-xs w-auto min-w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Depots</SelectItem>
                      {depots.map((d) => (
                        <SelectItem key={d.depot_id} value={d.depot_id}>{d.depot_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {!readonlyView && (
                  <Button size="sm" onClick={addRun} disabled={!!draftRun} type="button">
                    <Plus size={14} className="mr-1.5" /> Add Route
                  </Button>
                )}
              </div>
            </div>

            {runDayFilter !== 'all' && filteredRuns.length !== localRuns.length && (
              <div className="text-xs text-cc-text-muted mb-2">
                Showing {filteredRuns.length} of {localRuns.length} routes for {SERVICE_DAY_FULL_NAME[runDayFilter]}
              </div>
            )}

            {/* Split help tooltip — outside overflow container to avoid clipping */}
            <div className="flex items-center gap-1.5 mb-2 text-xs text-cc-text-muted">
              <span className="relative group inline-flex items-center gap-1 cursor-help">
                <CircleHelp size={13} />
                <span className="text-cc-text-secondary">Split routes</span>
                <span className="absolute z-50 top-full left-0 mt-1 w-60 p-2 rounded-md bg-cc-surface-1 border border-cc-border shadow-lg text-[11px] text-cc-text-secondary leading-snug hidden group-hover:block">
                  Splits are auto-detected from route names. Name two or more routes with the same base and a suffix:
                  <br /><strong>105a / 105b</strong>
                  <br /><strong>105-1 / 105-2</strong>
                  <br /><strong>105-am / 105-pm</strong>
                  <br />Or use the split button in Actions. Overlapping split times will show a warning.
                </span>
              </span>
            </div>

            {draftRun && (() => {
              const draftDays = parseServiceDays(draftRun.service_days);
              return (
                <div className="mb-3 border border-cc-accent/30 rounded-md bg-cc-accent/5 p-2">
                  <div className="text-xs font-medium text-cc-accent mb-1.5">New Route</div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[120px]">Route Name</TableHead>
                          {depots.length > 0 && <TableHead className="min-w-[100px]">Depot</TableHead>}
                          <TableHead className="min-w-[90px]">Start</TableHead>
                          <TableHead className="min-w-[90px]">End</TableHead>
                          <TableHead className="min-w-[70px]">Service Hrs</TableHead>
                          {breaksExpanded ? (
                            <>
                              <TableHead className="min-w-[140px]">Break 1</TableHead>
                              <TableHead className="min-w-[140px]">Break 2</TableHead>
                            </>
                          ) : (
                            <TableHead className="min-w-[80px]">Breaks</TableHead>
                          )}
                          <TableHead className="min-w-[160px]">Days</TableHead>
                          <TableHead className="min-w-[80px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>
                            <Input
                              value={draftRun.run_name}
                              className="h-7 text-xs"
                              onChange={(e) => updateDraft('run_name', e.target.value)}
                              autoFocus
                            />
                          </TableCell>
                          {depots.length > 0 && (
                            <TableCell>
                              <Select
                                value={draftRun.depot ?? 'none'}
                                onValueChange={(v) => updateDraft('depot', v === 'none' ? null : v)}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">{'\u2014'}</SelectItem>
                                  {depots.map((d) => (
                                    <SelectItem key={d.depot_id} value={d.depot_id}>{d.depot_name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          )}
                          <TableCell>
                            <Input
                              type="time"
                              value={draftRun.start_time}
                              className="h-7 text-xs"
                              onChange={(e) => updateDraft('start_time', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="time"
                              value={draftRun.end_time}
                              className="h-7 text-xs"
                              onChange={(e) => updateDraft('end_time', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <span className="text-xs">{draftRun.platform_hours}</span>
                          </TableCell>
                          {breaksExpanded ? (
                            <>
                              <TableCell>
                                <div className="flex gap-1 items-center">
                                  <Input
                                    type="time"
                                    value={draftRun.break_1_start ?? ''}
                                    className="h-7 text-xs"
                                    min={draftRun.start_time}
                                    max={draftRun.end_time}
                                    onChange={(e) => updateDraft('break_1_start', e.target.value || null)}
                                  />
                                  <span className="text-xs text-cc-text-muted">-</span>
                                  <Input
                                    type="time"
                                    value={draftRun.break_1_end ?? ''}
                                    className="h-7 text-xs"
                                    min={draftRun.break_1_start ?? draftRun.start_time}
                                    max={draftRun.end_time}
                                    onChange={(e) => updateDraft('break_1_end', e.target.value || null)}
                                  />
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1 items-center">
                                  <Input
                                    type="time"
                                    value={draftRun.break_2_start ?? ''}
                                    className="h-7 text-xs"
                                    min={draftRun.start_time}
                                    max={draftRun.end_time}
                                    onChange={(e) => updateDraft('break_2_start', e.target.value || null)}
                                  />
                                  <span className="text-xs text-cc-text-muted">-</span>
                                  <Input
                                    type="time"
                                    value={draftRun.break_2_end ?? ''}
                                    className="h-7 text-xs"
                                    min={draftRun.break_2_start ?? draftRun.start_time}
                                    max={draftRun.end_time}
                                    onChange={(e) => updateDraft('break_2_end', e.target.value || null)}
                                  />
                                </div>
                              </TableCell>
                            </>
                          ) : (
                            <TableCell>
                              <span className="text-xs text-cc-text-muted">
                                {(() => {
                                  const b1 = breakDurationLabel(draftRun.break_1_start, draftRun.break_1_end);
                                  const b2 = breakDurationLabel(draftRun.break_2_start, draftRun.break_2_end);
                                  if (b1 && b2) return `${b1}, ${b2}`;
                                  if (b1) return b1;
                                  if (b2) return b2;
                                  return '\u2014';
                                })()}
                              </span>
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex gap-0.5">
                              {ALL_SERVICE_DAYS.map((day) => (
                                <button
                                  key={day}
                                  className={`px-1 py-0 text-[10px] rounded ${
                                    draftDays.includes(day)
                                      ? 'bg-cc-accent text-white'
                                      : 'bg-cc-surface-2 text-cc-text-muted'
                                  }`}
                                  onClick={() => toggleDraftServiceDay(day)}
                                >
                                  {day}
                                </button>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-cc-success"
                                onClick={saveDraft}
                                title="Save route"
                                type="button"
                              >
                                <Check size={13} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-cc-danger"
                                onClick={cancelDraft}
                                title="Cancel"
                                type="button"
                              >
                                <X size={13} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              );
            })()}

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead column="run_name" label="Route Name" className="min-w-[120px]" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    {depots.length > 0 && <TableHead className="min-w-[100px]">Depot</TableHead>}
                    <SortableHead column="split_number" label="Split" className="min-w-[50px]" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableHead column="start_time" label="Start" className="min-w-[90px]" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableHead column="end_time" label="End" className="min-w-[90px]" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableHead column="platform_hours" label="Service Hrs" className="min-w-[70px]" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    {breaksExpanded ? (
                      <>
                        <TableHead className="min-w-[140px]">
                          <button
                            className="inline-flex items-center gap-1 hover:text-cc-accent transition-colors"
                            onClick={() => setBreaksExpanded(false)}
                            type="button"
                          >
                            <ChevronDown size={13} /> Break 1
                          </button>
                        </TableHead>
                        <TableHead className="min-w-[140px]">Break 2</TableHead>
                      </>
                    ) : (
                      <TableHead className="min-w-[80px]">
                        <button
                          className="inline-flex items-center gap-1 hover:text-cc-accent transition-colors"
                          onClick={() => setBreaksExpanded(true)}
                          type="button"
                        >
                          <ChevronRight size={13} /> Breaks
                        </button>
                      </TableHead>
                    )}
                    <TableHead className="min-w-[160px]">Days</TableHead>
                    <TableHead className="min-w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRuns.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={breaksExpanded ? 9 : 8} className="text-cc-text-muted">
                        {runDayFilter !== 'all'
                          ? `No routes for ${runDayFilter}. Add a route or copy from an imported day.`
                          : 'No routes defined. Add a route or copy from an imported day.'}
                      </TableCell>
                    </TableRow>
                  )}
                  {displayRuns.map((run) => {
                    const days = parseServiceDays(run.service_days);
                    const disabled = readonlyView;
                    const hasOverlap = splitOverlapIds.has(run.run_id);
                    return (
                      <TableRow key={run.run_id} className={run.run_id === highlightedRunId ? 'animate-highlight-row' : ''}>
                        <TableCell>
                          <Input
                            value={run.run_name}
                            disabled={disabled}
                            className="h-7 text-xs"
                            onChange={(e) => updateRun(run.run_id, 'run_name', e.target.value)}
                          />
                        </TableCell>
                        {depots.length > 0 && (
                          <TableCell>
                            <Select
                              value={run.depot ?? 'none'}
                              onValueChange={(v) => updateRun(run.run_id, 'depot', v === 'none' ? null : v)}
                              disabled={disabled}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">{'\u2014'}</SelectItem>
                                {depots.map((d) => (
                                  <SelectItem key={d.depot_id} value={d.depot_id}>{d.depot_name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-cc-text-muted">
                              {run.split_number === 0 ? '\u2014' : run.split_number}
                            </span>
                            {hasOverlap && (
                              <span className="text-[10px] text-cc-danger" title="Split times overlap">
                                overlap
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="time"
                            value={run.start_time}
                            disabled={disabled}
                            className="h-7 text-xs"
                            onChange={(e) => updateRun(run.run_id, 'start_time', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="time"
                            value={run.end_time}
                            disabled={disabled}
                            className="h-7 text-xs"
                            onChange={(e) => updateRun(run.run_id, 'end_time', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <span className="text-xs">{run.platform_hours}</span>
                        </TableCell>
                        {breaksExpanded ? (
                          <>
                            <TableCell>
                              <div className="flex gap-1 items-center">
                                <Input
                                  type="time"
                                  value={run.break_1_start ?? ''}
                                  disabled={disabled}
                                  className="h-7 text-xs"
                                  min={run.start_time}
                                  max={run.end_time}
                                  onChange={(e) => updateRun(run.run_id, 'break_1_start', e.target.value || null)}
                                />
                                <span className="text-xs text-cc-text-muted">-</span>
                                <Input
                                  type="time"
                                  value={run.break_1_end ?? ''}
                                  disabled={disabled}
                                  className="h-7 text-xs"
                                  min={run.break_1_start ?? run.start_time}
                                  max={run.end_time}
                                  onChange={(e) => updateRun(run.run_id, 'break_1_end', e.target.value || null)}
                                />
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1 items-center">
                                <Input
                                  type="time"
                                  value={run.break_2_start ?? ''}
                                  disabled={disabled}
                                  className="h-7 text-xs"
                                  min={run.start_time}
                                  max={run.end_time}
                                  onChange={(e) => updateRun(run.run_id, 'break_2_start', e.target.value || null)}
                                />
                                <span className="text-xs text-cc-text-muted">-</span>
                                <Input
                                  type="time"
                                  value={run.break_2_end ?? ''}
                                  disabled={disabled}
                                  className="h-7 text-xs"
                                  min={run.break_2_start ?? run.start_time}
                                  max={run.end_time}
                                  onChange={(e) => updateRun(run.run_id, 'break_2_end', e.target.value || null)}
                                />
                              </div>
                            </TableCell>
                          </>
                        ) : (
                          <TableCell>
                            <span className="text-xs text-cc-text-muted">
                              {(() => {
                                const b1 = breakDurationLabel(run.break_1_start, run.break_1_end);
                                const b2 = breakDurationLabel(run.break_2_start, run.break_2_end);
                                if (b1 && b2) return `${b1}, ${b2}`;
                                if (b1) return b1;
                                if (b2) return b2;
                                return '\u2014';
                              })()}
                            </span>
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex gap-0.5">
                            {ALL_SERVICE_DAYS.map((day) => (
                              <button
                                key={day}
                                className={`px-1 py-0 text-[10px] rounded ${
                                  days.includes(day)
                                    ? 'bg-cc-accent text-white'
                                    : 'bg-cc-surface-2 text-cc-text-muted'
                                }`}
                                onClick={() => toggleServiceDay(run.run_id, day)}
                                disabled={disabled}
                              >
                                {day}
                              </button>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {!disabled && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => addSplit(run)}
                                  title="Add split"
                                  type="button"
                                >
                                  <SquareSplitHorizontal size={13} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => duplicateRun(run)}
                                  title="Copy route"
                                  type="button"
                                >
                                  <Copy size={13} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-cc-danger"
                                  onClick={() => deleteRun(run.run_id)}
                                  title="Delete route"
                                  type="button"
                                >
                                  <Trash2 size={13} />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </SectionCard>
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
