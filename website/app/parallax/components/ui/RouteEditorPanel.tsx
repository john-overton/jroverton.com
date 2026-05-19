'use client';

import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, CircleHelp, Copy, Download, Plus, SquareSplitHorizontal, Trash2, X } from 'lucide-react';
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
import { exportRoutesToExcel } from '@/lib/parallax/bid-export';
import type { DepotRow, NewRouteRow, ServiceDay, VehicleTypeRow } from '@/lib/parallax/types';

import { ALL_SERVICE_DAYS, SERVICE_DAY_FULL_NAME, parseClockToMinutes, formatMinutesToClock, parseServiceDays } from './shared';

// ── Helpers ─────────────────────────────────────────────────────────

/** Service hours = (end - start) minus break durations */
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

/** Format a break's start/end as a compact duration string, e.g. "30m" */
function breakDurationLabel(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const s = parseClockToMinutes(start, -1);
  const e = parseClockToMinutes(end, -1);
  if (s < 0 || e < 0 || e <= s) return null;
  return `${e - s}m`;
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

function applySplitDetection(newRoutes: NewRouteRow[]): NewRouteRow[] {
  const groups = new Map<string, { suffix: string; index: number }[]>();
  for (let i = 0; i < newRoutes.length; i++) {
    const parsed = parseSplitName(newRoutes[i].new_route_name);
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
  for (let i = 0; i < newRoutes.length; i++) {
    const expected = splitNumbers.get(i) ?? 0;
    if (newRoutes[i].split_number !== expected) { changed = true; break; }
  }
  if (!changed) return newRoutes;

  return newRoutes.map((newRoute, i) => {
    const expected = splitNumbers.get(i) ?? 0;
    return newRoute.split_number === expected ? newRoute : { ...newRoute, split_number: expected };
  });
}

// ── Sortable table header ───────────────────────────────────────────

type SortColumn = 'new_route_name' | 'start_time' | 'end_time' | 'platform_hours' | 'split_number';

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
  localNewRoutes: NewRouteRow[];
  filteredNewRoutes: NewRouteRow[];
  depots: DepotRow[];
  vehicleTypes: VehicleTypeRow[];
  readonlyView: boolean;
  newRouteDayFilter: ServiceDay | 'all';
  onNewRouteDayFilterChange: (filter: ServiceDay | 'all') => void;
  depotFilter: string;
  onDepotFilterChange: (filter: string) => void;
  newRouteStats: {
    count: number;
    totalServiceHours: number;
    maxVehicles: number;
    productivity: number;
    estFTE: number;
    estPT: number;
  };
  onUpdateLocalNewRoutes: (nextNewRoutes: NewRouteRow[]) => void;
  showToast: (message: string) => void;
}

export default function RouteEditorPanel({
  localNewRoutes,
  filteredNewRoutes,
  depots,
  vehicleTypes,
  readonlyView,
  newRouteDayFilter,
  onNewRouteDayFilterChange,
  depotFilter,
  onDepotFilterChange,
  newRouteStats,
  onUpdateLocalNewRoutes,
}: RouteEditorPanelProps) {
  const [draftNewRoute, setDraftNewRoute] = useState<NewRouteRow | null>(null);
  const [draftBreakCount, setDraftBreakCount] = useState(0);
  const [sortKey, setSortKey] = useState<SortColumn>('new_route_name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [breaksExpanded, setBreaksExpanded] = useState(false);
  const [frozenOrder, setFrozenOrder] = useState<string[] | null>(null);
  const [highlightedNewRouteId, setHighlightedNewRouteId] = useState<string | null>(null);
  const sortFreezeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEditedNewRouteIdRef = useRef<string | null>(null);

  // Cleanup sort-freeze timer on unmount
  useEffect(() => {
    return () => {
      if (sortFreezeTimerRef.current) clearTimeout(sortFreezeTimerRef.current);
    };
  }, []);

  // ── Split overlap detection ──────────────────────────────────────
  const splitOverlapIds = useMemo(() => {
    const overlapping = new Set<string>();
    const groups = new Map<string, NewRouteRow[]>();
    for (const newRoute of localNewRoutes) {
      if (newRoute.split_number === 0) continue;
      const parsed = parseSplitName(newRoute.new_route_name);
      const key = parsed ? parsed.baseName.toLowerCase() : newRoute.new_route_name.toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(newRoute);
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
            overlapping.add(siblings[i].new_route_id);
            overlapping.add(siblings[j].new_route_id);
          }
        }
      }
    }
    return overlapping;
  }, [localNewRoutes]);

  // ── Sorted new routes for display ──────────────────────────────────────

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sortedNewRoutes = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filteredNewRoutes].sort((a, b) => {
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
        case 'new_route_name':
        default:
          cmp = a.new_route_name.localeCompare(b.new_route_name);
          break;
      }
      if (cmp !== 0) return cmp * dir;
      if (sortKey !== 'new_route_name') {
        const nameCmp = a.new_route_name.localeCompare(b.new_route_name);
        if (nameCmp !== 0) return nameCmp;
      }
      return a.split_number - b.split_number;
    });
  }, [filteredNewRoutes, sortKey, sortDir]);

  // Display order: use frozen order during edits, otherwise follow sort
  const displayNewRoutes = useMemo(() => {
    if (!frozenOrder) return sortedNewRoutes;
    const routeMap = new Map(filteredNewRoutes.map((r) => [r.new_route_id, r]));
    const ordered: NewRouteRow[] = [];
    for (const id of frozenOrder) {
      const newRoute = routeMap.get(id);
      if (newRoute) {
        ordered.push(newRoute);
        routeMap.delete(id);
      }
    }
    for (const newRoute of routeMap.values()) {
      ordered.push(newRoute);
    }
    return ordered;
  }, [frozenOrder, sortedNewRoutes, filteredNewRoutes]);

  // ── Actions ──────────────────────────────────────────────────────

  function updateLocalNewRoutes(nextNewRoutes: NewRouteRow[]) {
    const withSplits = applySplitDetection(nextNewRoutes);
    onUpdateLocalNewRoutes(withSplits);
  }

  function addNewRoute() {
    if (draftNewRoute) return;
    const defaultDays = newRouteDayFilter !== 'all'
      ? JSON.stringify([newRouteDayFilter])
      : '["M","T","W","Th","F"]';
    setDraftNewRoute({
      new_route_id: crypto.randomUUID(),
      new_route_name: `Route ${localNewRoutes.length + 1}`,
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
      vehicle_type_id: null,
    });
    setDraftBreakCount(0);
  }

  function updateDraft(field: keyof NewRouteRow, value: string | number | null) {
    if (!draftNewRoute) return;
    const next = { ...draftNewRoute, [field]: value };
    if (field === 'start_time' || field === 'end_time' || field.startsWith('break_')) {
      const svcHrs = computeServiceHours(next);
      next.platform_hours = String(svcHrs);
      next.pay_hours = String(svcHrs);
    }
    setDraftNewRoute(next);
  }

  function toggleDraftServiceDay(day: ServiceDay) {
    if (!draftNewRoute) return;
    const days = parseServiceDays(draftNewRoute.service_days);
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
    const sorted = ALL_SERVICE_DAYS.filter((d) => next.includes(d));
    updateDraft('service_days', JSON.stringify(sorted));
  }

  function saveDraft() {
    if (!draftNewRoute) return;
    updateLocalNewRoutes([...localNewRoutes, draftNewRoute]);
    setDraftNewRoute(null);
    setDraftBreakCount(0);
  }

  function cancelDraft() {
    setDraftNewRoute(null);
    setDraftBreakCount(0);
  }

  function addDraftBreak() {
    if (!draftNewRoute || draftBreakCount >= 2) return;
    const nextBreak = draftBreakCount + 1;
    const next = { ...draftNewRoute };
    if (nextBreak === 1) {
      next.break_1_start = next.start_time;
      next.break_1_end = next.end_time;
    } else {
      next.break_2_start = next.start_time;
      next.break_2_end = next.end_time;
    }
    const svcHrs = computeServiceHours(next);
    next.platform_hours = String(svcHrs);
    next.pay_hours = String(svcHrs);
    setDraftNewRoute(next);
    setDraftBreakCount(nextBreak);
  }

  function removeDraftBreak(breakNum: 1 | 2) {
    if (!draftNewRoute) return;
    const next = { ...draftNewRoute };
    if (breakNum === 1 && draftBreakCount === 2) {
      next.break_1_start = next.break_2_start;
      next.break_1_end = next.break_2_end;
      next.break_2_start = null;
      next.break_2_end = null;
    } else if (breakNum === 1) {
      next.break_1_start = null;
      next.break_1_end = null;
    } else {
      next.break_2_start = null;
      next.break_2_end = null;
    }
    const svcHrs = computeServiceHours(next);
    next.platform_hours = String(svcHrs);
    next.pay_hours = String(svcHrs);
    setDraftNewRoute(next);
    setDraftBreakCount((prev) => prev - 1);
  }

  function addSplit(newRoute: NewRouteRow) {
    const siblings = localNewRoutes.filter((r) => r.new_route_name === newRoute.new_route_name && r.split_number > 0);
    const nextSplitNumber = siblings.length > 0
      ? Math.max(...siblings.map((s) => s.split_number)) + 1
      : 2;

    let nextNewRoutes = localNewRoutes;
    if (newRoute.split_number === 0) {
      nextNewRoutes = nextNewRoutes.map((r) =>
        r.new_route_id === newRoute.new_route_id ? { ...r, split_number: 1 } : r,
      );
    }

    const newSplit: NewRouteRow = {
      new_route_id: crypto.randomUUID(),
      new_route_name: newRoute.new_route_name,
      split_number: nextSplitNumber,
      depot: newRoute.depot,
      service_days: newRoute.service_days,
      route_area: newRoute.route_area,
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
      vehicle_type_id: newRoute.vehicle_type_id,
    };
    updateLocalNewRoutes([...nextNewRoutes, newSplit]);
  }

  function deleteNewRoute(newRouteId: string) {
    updateLocalNewRoutes(localNewRoutes.filter((r) => r.new_route_id !== newRouteId));
  }

  function duplicateNewRoute(newRoute: NewRouteRow) {
    const copy: NewRouteRow = {
      ...newRoute,
      new_route_id: crypto.randomUUID(),
      new_route_name: `${newRoute.new_route_name} copy`,
      split_number: 0,
    };
    updateLocalNewRoutes([...localNewRoutes, copy]);
  }

  function updateNewRoute(newRouteId: string, field: keyof NewRouteRow, value: string | number | null) {
    // Freeze current display order on first edit so the row doesn't jump
    setFrozenOrder((prev) => prev ?? sortedNewRoutes.map((r) => r.new_route_id));
    lastEditedNewRouteIdRef.current = newRouteId;

    // Reset the 5-second debounce before re-sorting
    if (sortFreezeTimerRef.current) clearTimeout(sortFreezeTimerRef.current);
    sortFreezeTimerRef.current = setTimeout(() => {
      setFrozenOrder(null);
      setHighlightedNewRouteId(newRouteId);
      setTimeout(() => setHighlightedNewRouteId(null), 2000);
      sortFreezeTimerRef.current = null;
      lastEditedNewRouteIdRef.current = null;
    }, 5000);

    updateLocalNewRoutes(
      localNewRoutes.map((r) => {
        if (r.new_route_id !== newRouteId) return r;
        const next = { ...r, [field]: value };
        if (field === 'start_time' || field === 'end_time' || field.startsWith('break_')) {
          const svcHrs = computeServiceHours(next);
          next.platform_hours = String(svcHrs);
          next.pay_hours = String(svcHrs);
        }
        return next;
      }),
    );
  }

  function toggleServiceDay(newRouteId: string, day: ServiceDay) {
    const newRoute = localNewRoutes.find((r) => r.new_route_id === newRouteId);
    if (!newRoute) return;
    const days = parseServiceDays(newRoute.service_days);
    const next = days.includes(day)
      ? days.filter((d) => d !== day)
      : [...days, day];
    const sorted = ALL_SERVICE_DAYS.filter((d) => next.includes(d));
    updateNewRoute(newRouteId, 'service_days', JSON.stringify(sorted));
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
          <span>Routes: <strong>{newRouteStats.count}</strong></span>
          <span>Service Hrs: <strong>{newRouteStats.totalServiceHours}</strong></span>
          <span>Peak Vehicles: <strong>{newRouteStats.maxVehicles}</strong></span>
          <span>Productivity: <strong>{newRouteStats.productivity}</strong></span>
          <span>Est. FTE: <strong>{newRouteStats.estFTE}</strong></span>
          <span>Est. PT: <strong>{newRouteStats.estPT}</strong></span>
        </div>
        <div className="flex items-center gap-2">
          {/* Day filter */}
          <div className="flex gap-0.5 items-center">
            <span className="text-xs text-cc-text-muted mr-1">Show:</span>
            <button
              className={`px-2 py-0.5 text-[10px] rounded ${newRouteDayFilter === 'all' ? 'bg-cc-accent text-white' : 'bg-cc-surface-2 text-cc-text-muted'}`}
              onClick={() => onNewRouteDayFilterChange('all')}
            >All</button>
            {ALL_SERVICE_DAYS.map((day) => (
              <button
                key={day}
                className={`px-1.5 py-0.5 text-[10px] rounded ${newRouteDayFilter === day ? 'bg-cc-accent text-white' : 'bg-cc-surface-2 text-cc-text-muted'}`}
                onClick={() => onNewRouteDayFilterChange(day)}
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportRoutesToExcel(localNewRoutes, depots)}
            disabled={localNewRoutes.length === 0}
            type="button"
          >
            <Download size={14} className="mr-1.5" /> Export Excel
          </Button>
          {!readonlyView && (
            <Button size="sm" onClick={addNewRoute} disabled={!!draftNewRoute} type="button">
              <Plus size={14} className="mr-1.5" /> Add Route
            </Button>
          )}
        </div>
      </div>

      {newRouteDayFilter !== 'all' && filteredNewRoutes.length !== localNewRoutes.length && (
        <div className="text-xs text-cc-text-muted mb-2">
          Showing {filteredNewRoutes.length} of {localNewRoutes.length} routes for {SERVICE_DAY_FULL_NAME[newRouteDayFilter]}
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

      {draftNewRoute && (() => {
        const draftDays = parseServiceDays(draftNewRoute.service_days);
        return (
          <div className="mb-3 border border-cc-accent/30 rounded-md bg-cc-accent/5 p-2">
            <div className="text-xs font-medium text-cc-accent mb-1.5">New Route</div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">Route Name</TableHead>
                    {depots.length > 0 && <TableHead className="min-w-[100px]">Depot</TableHead>}
                    {vehicleTypes.length > 0 && <TableHead className="min-w-[100px]">Vehicle</TableHead>}
                    <TableHead className="min-w-[80px]">Zone</TableHead>
                    <TableHead className="min-w-[90px]">Start</TableHead>
                    <TableHead className="min-w-[90px]">End</TableHead>
                    <TableHead className="min-w-[70px]">Service Hrs</TableHead>
                    <TableHead className="min-w-[160px]">Breaks</TableHead>
                    <TableHead className="min-w-[160px]">Days</TableHead>
                    <TableHead className="min-w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>
                      <Input
                        value={draftNewRoute.new_route_name}
                        className="h-7 text-xs"
                        onChange={(e) => updateDraft('new_route_name', e.target.value)}
                        autoFocus
                      />
                    </TableCell>
                    {depots.length > 0 && (
                      <TableCell>
                        <Select
                          value={draftNewRoute.depot ?? 'none'}
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
                    {vehicleTypes.length > 0 && (
                      <TableCell>
                        <Select
                          value={draftNewRoute.vehicle_type_id ?? 'none'}
                          onValueChange={(v) => updateDraft('vehicle_type_id', v === 'none' ? null : v)}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{'\u2014'}</SelectItem>
                            {vehicleTypes.map((vt) => (
                              <SelectItem key={vt.vehicle_type_id} value={vt.vehicle_type_id}>{vt.vehicle_type_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    )}
                    <TableCell>
                      <Input
                        value={draftNewRoute.route_area ?? ''}
                        className="h-7 text-xs"
                        placeholder="Zone"
                        onChange={(e) => updateDraft('route_area', e.target.value || null)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        value={draftNewRoute.start_time}
                        className="h-7 text-xs"
                        onChange={(e) => updateDraft('start_time', e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        value={draftNewRoute.end_time}
                        className="h-7 text-xs"
                        onChange={(e) => updateDraft('end_time', e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">{draftNewRoute.platform_hours}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {draftBreakCount >= 1 && (
                          <div className="flex gap-1 items-center">
                            <Input
                              type="time"
                              value={draftNewRoute.break_1_start ?? ''}
                              className="h-7 text-xs"
                              min={draftNewRoute.start_time}
                              max={draftNewRoute.end_time}
                              onChange={(e) => updateDraft('break_1_start', e.target.value || null)}
                            />
                            <span className="text-xs text-cc-text-muted">-</span>
                            <Input
                              type="time"
                              value={draftNewRoute.break_1_end ?? ''}
                              className="h-7 text-xs"
                              min={draftNewRoute.break_1_start ?? draftNewRoute.start_time}
                              max={draftNewRoute.end_time}
                              onChange={(e) => updateDraft('break_1_end', e.target.value || null)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              onClick={() => removeDraftBreak(1)}
                              title="Remove break"
                              type="button"
                            >
                              <X size={11} />
                            </Button>
                          </div>
                        )}
                        {draftBreakCount >= 2 && (
                          <div className="flex gap-1 items-center">
                            <Input
                              type="time"
                              value={draftNewRoute.break_2_start ?? ''}
                              className="h-7 text-xs"
                              min={draftNewRoute.start_time}
                              max={draftNewRoute.end_time}
                              onChange={(e) => updateDraft('break_2_start', e.target.value || null)}
                            />
                            <span className="text-xs text-cc-text-muted">-</span>
                            <Input
                              type="time"
                              value={draftNewRoute.break_2_end ?? ''}
                              className="h-7 text-xs"
                              min={draftNewRoute.break_2_start ?? draftNewRoute.start_time}
                              max={draftNewRoute.end_time}
                              onChange={(e) => updateDraft('break_2_end', e.target.value || null)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              onClick={() => removeDraftBreak(2)}
                              title="Remove break"
                              type="button"
                            >
                              <X size={11} />
                            </Button>
                          </div>
                        )}
                        {draftBreakCount < 2 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs w-fit"
                            onClick={addDraftBreak}
                            type="button"
                          >
                            <Plus size={11} className="mr-1" /> Break
                          </Button>
                        )}
                      </div>
                    </TableCell>
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
              <SortableHead column="new_route_name" label="Route Name" className="min-w-[120px]" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              {depots.length > 0 && <TableHead className="min-w-[100px]">Depot</TableHead>}
              {vehicleTypes.length > 0 && <TableHead className="min-w-[100px]">Vehicle</TableHead>}
              <TableHead className="min-w-[80px]">Zone</TableHead>
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
            {sortedNewRoutes.length === 0 && (
              <TableRow>
                <TableCell colSpan={breaksExpanded ? 10 : 9} className="text-cc-text-muted">
                  {newRouteDayFilter !== 'all'
                    ? `No routes for ${newRouteDayFilter}. Add a route or copy from an imported day.`
                    : 'No routes defined. Add a route or copy from an imported day.'}
                </TableCell>
              </TableRow>
            )}
            {displayNewRoutes.map((newRoute) => {
              const days = parseServiceDays(newRoute.service_days);
              const disabled = readonlyView;
              const hasOverlap = splitOverlapIds.has(newRoute.new_route_id);
              return (
                <TableRow key={newRoute.new_route_id} className={newRoute.new_route_id === highlightedNewRouteId ? 'animate-highlight-row' : ''}>
                  <TableCell>
                    <Input
                      value={newRoute.new_route_name}
                      disabled={disabled}
                      className="h-7 text-xs"
                      onChange={(e) => updateNewRoute(newRoute.new_route_id, 'new_route_name', e.target.value)}
                    />
                  </TableCell>
                  {depots.length > 0 && (
                    <TableCell>
                      <Select
                        value={newRoute.depot ?? 'none'}
                        onValueChange={(v) => updateNewRoute(newRoute.new_route_id, 'depot', v === 'none' ? null : v)}
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
                  {vehicleTypes.length > 0 && (
                    <TableCell>
                      <Select
                        value={newRoute.vehicle_type_id ?? 'none'}
                        onValueChange={(v) => updateNewRoute(newRoute.new_route_id, 'vehicle_type_id', v === 'none' ? null : v)}
                        disabled={disabled}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{'\u2014'}</SelectItem>
                          {vehicleTypes.map((vt) => (
                            <SelectItem key={vt.vehicle_type_id} value={vt.vehicle_type_id}>{vt.vehicle_type_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  )}
                  <TableCell>
                    <Input
                      value={newRoute.route_area ?? ''}
                      disabled={disabled}
                      className="h-7 text-xs"
                      placeholder="Zone"
                      onChange={(e) => updateNewRoute(newRoute.new_route_id, 'route_area', e.target.value || null)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-cc-text-muted">
                        {newRoute.split_number === 0 ? '\u2014' : newRoute.split_number}
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
                      value={newRoute.start_time}
                      disabled={disabled}
                      className="h-7 text-xs"
                      onChange={(e) => updateNewRoute(newRoute.new_route_id, 'start_time', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="time"
                      value={newRoute.end_time}
                      disabled={disabled}
                      className="h-7 text-xs"
                      onChange={(e) => updateNewRoute(newRoute.new_route_id, 'end_time', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <span className="text-xs">{newRoute.platform_hours}</span>
                  </TableCell>
                  {breaksExpanded ? (
                    <>
                      <TableCell>
                        <div className="flex gap-1 items-center">
                          <Input
                            type="time"
                            value={newRoute.break_1_start ?? ''}
                            disabled={disabled}
                            className="h-7 text-xs"
                            min={newRoute.start_time}
                            max={newRoute.end_time}
                            onChange={(e) => updateNewRoute(newRoute.new_route_id, 'break_1_start', e.target.value || null)}
                          />
                          <span className="text-xs text-cc-text-muted">-</span>
                          <Input
                            type="time"
                            value={newRoute.break_1_end ?? ''}
                            disabled={disabled}
                            className="h-7 text-xs"
                            min={newRoute.break_1_start ?? newRoute.start_time}
                            max={newRoute.end_time}
                            onChange={(e) => updateNewRoute(newRoute.new_route_id, 'break_1_end', e.target.value || null)}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 items-center">
                          <Input
                            type="time"
                            value={newRoute.break_2_start ?? ''}
                            disabled={disabled}
                            className="h-7 text-xs"
                            min={newRoute.start_time}
                            max={newRoute.end_time}
                            onChange={(e) => updateNewRoute(newRoute.new_route_id, 'break_2_start', e.target.value || null)}
                          />
                          <span className="text-xs text-cc-text-muted">-</span>
                          <Input
                            type="time"
                            value={newRoute.break_2_end ?? ''}
                            disabled={disabled}
                            className="h-7 text-xs"
                            min={newRoute.break_2_start ?? newRoute.start_time}
                            max={newRoute.end_time}
                            onChange={(e) => updateNewRoute(newRoute.new_route_id, 'break_2_end', e.target.value || null)}
                          />
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <TableCell>
                      <span className="text-xs text-cc-text-muted">
                        {(() => {
                          const b1 = breakDurationLabel(newRoute.break_1_start, newRoute.break_1_end);
                          const b2 = breakDurationLabel(newRoute.break_2_start, newRoute.break_2_end);
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
                          onClick={() => toggleServiceDay(newRoute.new_route_id, day)}
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
                            onClick={() => addSplit(newRoute)}
                            title="Add split"
                            type="button"
                          >
                            <SquareSplitHorizontal size={13} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => duplicateNewRoute(newRoute)}
                            title="Copy route"
                            type="button"
                          >
                            <Copy size={13} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-cc-danger"
                            onClick={() => deleteNewRoute(newRoute.new_route_id)}
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
