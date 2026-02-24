'use client';

import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, CircleHelp, Copy, Plus, Trash2 } from 'lucide-react';
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
import { buildRunCutForDate, getAvailableDates } from '@/lib/clearcut/run-structure';
import type { OptimizationRow, RouteRow, RunRow, ServiceDay } from '@/lib/clearcut/types';

import { RunStructureChart, SectionCard, parseClockToMinutes, formatMinutesToClock } from './shared';

const ALL_SERVICE_DAYS: ServiceDay[] = ['M', 'T', 'W', 'Th', 'F', 'Sa', 'Su'];
const SERVICE_DAY_TO_DOW: Record<ServiceDay, number> = { Su: 0, M: 1, T: 2, W: 3, Th: 4, F: 5, Sa: 6 };
const DOW_TO_SERVICE_DAY: Record<number, ServiceDay> = { 0: 'Su', 1: 'M', 2: 'T', 3: 'W', 4: 'Th', 5: 'F', 6: 'Sa' };

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
const SPLIT_SUFFIX_RE = /[-_]?(am|pm|a|p|\d+)$/i;

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
}

export default function RunStructureTab({
  metrics,
  fullDayMetrics,
  routes,
  runs,
  selectedDays,
  readonlyView,
  intervalMinutes,
  onRunsChange,
}: RunStructureTabProps) {
  const [demandMode, setDemandMode] = useState<'max' | 'avg'>('max');
  const [subTab, setSubTab] = useState<'imported' | 'runeditor'>('runeditor');
  const [localRuns, setLocalRuns] = useState<RunRow[]>(runs);
  const [selectedRunCutDate, setSelectedRunCutDate] = useState<string | null>(null);
  const [runDayFilter, setRunDayFilter] = useState<ServiceDay | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortColumn>('run_name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [breaksExpanded, setBreaksExpanded] = useState(false);
  const [copyDaysSelection, setCopyDaysSelection] = useState<ServiceDay[]>([...ALL_SERVICE_DAYS.slice(0, 5)]);
  const [showCopyDays, setShowCopyDays] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync from server when runs prop changes
  useEffect(() => {
    setLocalRuns(runs);
  }, [runs]);

  // Debounced save
  const persistRuns = useCallback(
    (nextRuns: RunRow[]) => {
      if (readonlyView) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        onRunsChange(nextRuns);
      }, 500);
    },
    [readonlyView, onRunsChange],
  );

  function updateLocalRuns(nextRuns: RunRow[]) {
    const withSplits = applySplitDetection(nextRuns);
    setLocalRuns(withSplits);
    persistRuns(withSplits);
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

  // ── Vehicle counts by block ──────────────────────────────────────

  const currentVehiclesByBlockFullDay = useMemo(() => {
    const counts = new Array(fullDayMetrics.blocks.length).fill(0) as number[];
    for (const row of currentRunCut) {
      for (const idx of row.activeBlockIndices) {
        if (idx >= 0 && idx < counts.length) counts[idx] += 1;
      }
    }
    return counts;
  }, [currentRunCut, fullDayMetrics.blocks.length]);

  const currentVehiclesByBlock = useMemo(() => {
    return metrics.blocks.map((viewBlock) => {
      const fullIdx = fullDayMetrics.blocks.findIndex(
        (b) => b.startMinutes === viewBlock.startMinutes,
      );
      return fullIdx >= 0 ? currentVehiclesByBlockFullDay[fullIdx] : 0;
    });
  }, [metrics.blocks, fullDayMetrics.blocks, currentVehiclesByBlockFullDay]);

  const selectedDaySet = useMemo(() => new Set(selectedDays), [selectedDays]);

  const runVehiclesByBlockFullDay = useMemo(() => {
    const counts = new Array(fullDayMetrics.blocks.length).fill(0) as number[];
    for (const run of localRuns) {
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
  }, [localRuns, fullDayMetrics.blocks, selectedDays.length, selectedDaySet]);

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
    for (const run of localRuns) {
      totalServiceHours += Number(run.platform_hours) || 0;
    }
    const maxVehicles = Math.max(...runVehiclesByBlockFullDay, 0);
    const productivity = totalServiceHours > 0
      ? Math.round((avgDailyTrips / totalServiceHours) * 100) / 100
      : 0;
    return {
      count: localRuns.length,
      totalServiceHours: Math.round(totalServiceHours * 10) / 10,
      maxVehicles,
      productivity,
    };
  }, [localRuns, runVehiclesByBlockFullDay, avgDailyTrips]);

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

  // ── Filtered + sorted runs for display ───────────────────────────

  const filteredRuns = useMemo(() => {
    if (runDayFilter === 'all') return localRuns;
    return localRuns.filter((run) => {
      const days = parseServiceDays(run.service_days);
      return days.includes(runDayFilter);
    });
  }, [localRuns, runDayFilter]);

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
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

  // ── Actions ──────────────────────────────────────────────────────

  function addRun() {
    const defaultDays = runDayFilter !== 'all'
      ? JSON.stringify([runDayFilter])
      : '["M","T","W","Th","F"]';
    const id = crypto.randomUUID();
    const newRun: RunRow = {
      run_id: id,
      run_name: `Run ${localRuns.length + 1}`,
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
    };
    updateLocalRuns([...localRuns, newRun]);
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

  function updateRun(runId: string, field: keyof RunRow, value: string | number | null) {
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

  // Copy from live day — opens day picker, then appends
  function startCopyFromLiveDay() {
    if (!selectedRunCutDate) return;
    // Default the copy days to the DOW of the selected date
    const d = new Date(selectedRunCutDate + 'T12:00:00');
    const dow = d.getDay();
    const sd = DOW_TO_SERVICE_DAY[dow];
    setCopyDaysSelection(sd ? [sd] : [...ALL_SERVICE_DAYS.slice(0, 5)]);
    setShowCopyDays(true);
  }

  function confirmCopyFromLiveDay() {
    if (!selectedRunCutDate || copyDaysSelection.length === 0) return;
    setShowCopyDays(false);

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
      const originalName = route.route_name ?? route.route_id ?? `Run ${localRuns.length + idx + 1}`;

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
  }

  function toggleCopyDay(day: ServiceDay) {
    setCopyDaysSelection((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : ALL_SERVICE_DAYS.filter((d) => [...prev, day].includes(d)),
    );
  }

  // ── Render ───────────────────────────────────────────────────────

  return (
    <>
      <SectionCard title="Demand & Vehicle Coverage">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-cc-text-muted">
            Demand shown as bars. Current vehicles (solid line) and run vehicles (dashed line) as overlays.
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
          currentVehicles={currentVehiclesByBlock}
          runVehicles={runVehiclesByBlock}
          blocks={metrics.blocks}
        />
      </SectionCard>

      <SectionCard title="Run Structure">
        <Tabs value={subTab} onValueChange={(v) => setSubTab(v as 'imported' | 'runeditor')}>
          <TabsList>
            <TabsTrigger value="runeditor">Run Editor</TabsTrigger>
            <TabsTrigger value="imported">Imported Runs</TabsTrigger>
          </TabsList>

          {/* ── Imported Runs sub-tab ─────────────────────────────── */}
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
                <Button variant="outline" size="sm" onClick={startCopyFromLiveDay} type="button">
                  <Copy size={14} className="mr-1.5" /> Copy to Runs
                </Button>
              )}
            </div>

            {/* Copy days picker — shown inline after clicking "Copy to Runs" */}
            {showCopyDays && (
              <div className="flex items-center gap-3 mb-3 p-2 border border-cc-border rounded-lg bg-cc-surface-2">
                <span className="text-xs text-cc-text-secondary shrink-0">Apply to days:</span>
                <CopyDaysPicker selectedDays={copyDaysSelection} onToggle={toggleCopyDay} />
                <Button size="sm" onClick={confirmCopyFromLiveDay} disabled={copyDaysSelection.length === 0} type="button">
                  Confirm
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowCopyDays(false)} type="button">
                  Cancel
                </Button>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Route</TableHead>
                  <TableHead>Shift Start</TableHead>
                  <TableHead>Shift End</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentRunCut.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-cc-text-muted">
                      No routes for selected date
                    </TableCell>
                  </TableRow>
                )}
                {currentRunCut.map((row, idx) => (
                  <TableRow key={`${row.routeName}-${idx}`}>
                    <TableCell>{row.routeName}</TableCell>
                    <TableCell>{row.shiftStart}</TableCell>
                    <TableCell>{row.shiftEnd}</TableCell>
                    <TableCell>{row.durationHours} hrs</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          {/* ── Run Editor sub-tab ────────────────────────────────── */}
          <TabsContent value="runeditor">
            <div className="flex items-center justify-between mb-3 mt-3 flex-wrap gap-2">
              <div className="flex gap-4 text-[13px] flex-wrap items-center">
                <span>Runs: <strong>{runStats.count}</strong></span>
                <span>Service Hrs: <strong>{runStats.totalServiceHours}</strong></span>
                <span>Peak Vehicles: <strong>{runStats.maxVehicles}</strong></span>
                <span>Productivity: <strong>{runStats.productivity}</strong></span>
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
                {!readonlyView && (
                  <Button size="sm" onClick={addRun} type="button">
                    <Plus size={14} className="mr-1.5" /> Add Run
                  </Button>
                )}
              </div>
            </div>

            {runDayFilter !== 'all' && filteredRuns.length !== localRuns.length && (
              <div className="text-xs text-cc-text-muted mb-2">
                Showing {filteredRuns.length} of {localRuns.length} runs for {runDayFilter}
              </div>
            )}

            {/* Split help tooltip — outside overflow container to avoid clipping */}
            <div className="flex items-center gap-1.5 mb-2 text-xs text-cc-text-muted">
              <span className="relative group inline-flex items-center gap-1 cursor-help">
                <CircleHelp size={13} />
                <span className="text-cc-text-secondary">Split runs</span>
                <span className="absolute z-50 top-full left-0 mt-1 w-60 p-2 rounded-md bg-cc-surface-1 border border-cc-border shadow-lg text-[11px] text-cc-text-secondary leading-snug hidden group-hover:block">
                  Splits are auto-detected from run names. Name two or more runs with the same base and a suffix:
                  <br /><strong>105a / 105b</strong>
                  <br /><strong>105-1 / 105-2</strong>
                  <br /><strong>105-am / 105-pm</strong>
                  <br />Or use the split button in Actions. Overlapping split times will show a warning.
                </span>
              </span>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead column="run_name" label="Run Name" className="min-w-[120px]" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
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
                          ? `No runs for ${runDayFilter}. Add a run or copy from an imported day.`
                          : 'No runs defined. Add a run or copy from an imported day.'}
                      </TableCell>
                    </TableRow>
                  )}
                  {sortedRuns.map((run) => {
                    const days = parseServiceDays(run.service_days);
                    const disabled = readonlyView;
                    const hasOverlap = splitOverlapIds.has(run.run_id);
                    return (
                      <TableRow key={run.run_id}>
                        <TableCell>
                          <Input
                            value={run.run_name}
                            disabled={disabled}
                            className="h-7 text-xs"
                            onChange={(e) => updateRun(run.run_id, 'run_name', e.target.value)}
                          />
                        </TableCell>
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
                                  <Copy size={13} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-cc-danger"
                                  onClick={() => deleteRun(run.run_id)}
                                  title="Delete run"
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
    </>
  );
}
