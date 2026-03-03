'use client';

import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, CircleHelp, Copy, Plus, SquareSplitHorizontal, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/app/parallax/components/shadcn/button';
import { Input } from '@/app/parallax/components/shadcn/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/parallax/components/shadcn/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/parallax/components/shadcn/table';
import type { DepotRow, RunRow, ServiceDay } from '@/lib/parallax/types';

import { ALL_SERVICE_DAYS, SERVICE_DAY_FULL_NAME, parseClockToMinutes, formatMinutesToClock, parseServiceDays } from './shared';

// ── Helpers ─────────────────────────────────────────────────────────

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

function applySplitDetection(runs: RunRow[]): RunRow[] {
  const groups = new Map<string, { suffix: string; index: number }[]>();
  for (let i = 0; i < runs.length; i++) {
    const parsed = parseSplitName(runs[i].run_name);
    if (parsed) {
      const key = parsed.baseName.toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({ suffix: parsed.suffix, index: i });
    }
  }

  const splitNumbers = new Map<number, number>();
  for (const [, members] of groups) {
    if (members.length < 2) continue;
    members.sort((a, b) => splitSortKey(a.suffix) - splitSortKey(b.suffix));
    for (let s = 0; s < members.length; s++) {
      splitNumbers.set(members[s].index, s + 1);
    }
  }

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

// ── Sortable table header ───────────────────────────────────────────

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

// ── Main component ──────────────────────────────────────────────────

interface RouteEditorPanelProps {
  localRuns: RunRow[];
  filteredRuns: RunRow[];
  depots: DepotRow[];
  readonlyView: boolean;
  runDayFilter: ServiceDay | 'all';
  onRunDayFilterChange: (filter: ServiceDay | 'all') => void;
  depotFilter: string;
  onDepotFilterChange: (filter: string) => void;
  runStats: {
    count: number;
    totalServiceHours: number;
    maxVehicles: number;
    productivity: number;
    estFTE: number;
    estPT: number;
  };
  onUpdateLocalRuns: (nextRuns: RunRow[]) => void;
  showToast: (message: string) => void;
}

export default function RouteEditorPanel({
  localRuns,
  filteredRuns,
  depots,
  readonlyView,
  runDayFilter,
  onRunDayFilterChange,
  depotFilter,
  onDepotFilterChange,
  runStats,
  onUpdateLocalRuns,
}: RouteEditorPanelProps) {
  const [draftRun, setDraftRun] = useState<RunRow | null>(null);
  const [sortKey, setSortKey] = useState<SortColumn>('run_name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [breaksExpanded, setBreaksExpanded] = useState(false);
  const [frozenOrder, setFrozenOrder] = useState<string[] | null>(null);
  const [highlightedRunId, setHighlightedRunId] = useState<string | null>(null);
  const sortFreezeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEditedRunIdRef = useRef<string | null>(null);

  // Cleanup sort-freeze timer on unmount
  useEffect(() => {
    return () => {
      if (sortFreezeTimerRef.current) clearTimeout(sortFreezeTimerRef.current);
    };
  }, []);

  // ── Split overlap detection ──────────────────────────────────────
  const splitOverlapIds = useMemo(() => {
    const overlapping = new Set<string>();
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

  // ── Sorted runs for display ──────────────────────────────────────

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
    for (const run of runMap.values()) {
      ordered.push(run);
    }
    return ordered;
  }, [frozenOrder, sortedRuns, filteredRuns]);

  // ── Actions ──────────────────────────────────────────────────────

  function updateLocalRuns(nextRuns: RunRow[]) {
    const withSplits = applySplitDetection(nextRuns);
    onUpdateLocalRuns(withSplits);
  }

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
        if (field.startsWith('break_') && typeof value === 'string' && value) {
          next[field as keyof RunRow] = clampBreakTime(value, next.start_time, next.end_time) as never;
        }
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

  // ── Render ──────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes highlight-row {
          0% { background-color: color-mix(in srgb, var(--color-cc-accent) 25%, transparent); }
          100% { background-color: transparent; }
        }
        .animate-highlight-row > td {
          animation: highlight-row 2s ease-out;
        }
      `}</style>

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
              onClick={() => onRunDayFilterChange('all')}
            >All</button>
            {ALL_SERVICE_DAYS.map((day) => (
              <button
                key={day}
                className={`px-1.5 py-0.5 text-[10px] rounded ${runDayFilter === day ? 'bg-cc-accent text-white' : 'bg-cc-surface-2 text-cc-text-muted'}`}
                onClick={() => onRunDayFilterChange(day)}
              >{day}</button>
            ))}
          </div>
          {depots.length > 0 && (
            <Select value={depotFilter} onValueChange={onDepotFilterChange}>
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

      {/* Split help tooltip */}
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
    </>
  );
}
