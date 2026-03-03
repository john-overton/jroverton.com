'use client';

import { DndContext, DragOverlay, useDraggable, useDroppable, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, CircleHelp, Download, GripVertical, Play, Save } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@/app/parallax/components/shadcn/badge';
import { Button } from '@/app/parallax/components/shadcn/button';
import { Checkbox } from '@/app/parallax/components/shadcn/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/app/parallax/components/shadcn/dialog';
import { Input } from '@/app/parallax/components/shadcn/input';
import { Label } from '@/app/parallax/components/shadcn/label';
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
import { DEFAULT_BID_CONFIG, collapseRoutes, computeMaxConsecutiveWork, generateBidPackages, rankPackages, recomputePackageMetrics } from '@/lib/parallax/bid-algorithm';
import { exportBidsToExcel } from '@/lib/parallax/bid-export';
import type { BidConfig, BidResult, BidType, CollapsedRoute, DailyBlock, DepotRow, NewRouteRow, ServiceDay } from '@/lib/parallax/types';

import { ALL_SERVICE_DAYS, formatMinutesToClock, parseServiceDays } from './shared';

function SettingLabel({ children, tip }: { children: React.ReactNode; tip: string }) {
  return (
    <Label className="text-xs text-cc-text-muted mb-1 inline-flex items-center gap-1">
      {children}
      <span className="relative group cursor-help">
        <CircleHelp size={12} className="text-cc-text-muted" />
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 p-1.5 rounded-md bg-cc-surface-1 border border-cc-border shadow-lg text-[11px] text-cc-text-secondary leading-snug hidden group-hover:block">
          {tip}
        </span>
      </span>
    </Label>
  );
}

// ── Sortable bid table header ────────────────────────────────────────

type BidSortColumn = 'bid_rank' | 'type' | 'routes' | 'weekly_pay_hours' | 'consecutive_days_off' | 'consistency_score' | 'depot';

function BidSortableHead({
  column,
  label,
  className,
  sortKey,
  sortDir,
  onSort,
}: {
  column: BidSortColumn;
  label: string;
  className?: string;
  sortKey: BidSortColumn;
  sortDir: 'asc' | 'desc';
  onSort: (key: BidSortColumn) => void;
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

// ── Drag-and-drop helper components ─────────────────────────────────

function DraggableRouteRow({
  packageId,
  route,
  blocks,
  readonlyView,
  children,
}: {
  packageId: string;
  route: CollapsedRoute;
  blocks: DailyBlock[];
  readonlyView: boolean;
  children: React.ReactNode;
}) {
  const id = `${packageId}::${route.new_route_name}::${route.start_time_minutes}::${route.days.join(',')}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { sourcePackageId: packageId, blocks, route },
    disabled: readonlyView,
  });
  return (
    <TableRow
      ref={setNodeRef}
      className={`bg-cc-surface-1/50 ${isDragging ? 'opacity-30' : ''}`}
    >
      <TableCell className="w-6 px-1">
        {!readonlyView && (
          <span {...attributes} {...listeners} className="cursor-grab inline-flex items-center text-cc-text-muted hover:text-cc-accent">
            <GripVertical size={12} />
          </span>
        )}
      </TableCell>
      {children}
    </TableRow>
  );
}

function DroppablePackageBody({
  packageId,
  children,
}: {
  packageId: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: packageId });
  return (
    <tbody ref={setNodeRef} className={isOver ? 'ring-2 ring-cc-accent/40 ring-inset' : ''}>
      {children}
    </tbody>
  );
}

// ── Validation ──────────────────────────────────────────────────────

interface PendingMove {
  sourcePackageId: string;
  blocks: DailyBlock[];
  targetPackageId: string;
  violations: string[];
}

function validateBlockMove(
  currentResult: BidResult,
  sourcePackageId: string,
  blocks: DailyBlock[],
  targetPackageId: string,
): string[] {
  if (targetPackageId === 'unassigned') return [];

  const targetPkg = currentResult.packages.find((p) => p.bid_id === targetPackageId);
  if (!targetPkg) return [];

  const violations: string[] = [];
  const config = currentResult.config;
  const existingBlocks = targetPkg.daily_blocks;
  const combined = [...existingBlocks, ...blocks];

  // 1. Day conflicts
  const existingDays = new Set(existingBlocks.map((b) => b.day));
  const conflictDays = blocks.filter((b) => existingDays.has(b.day)).map((b) => b.day);
  if (conflictDays.length > 0) {
    violations.push(`Day conflict: ${[...new Set(conflictDays)].join(', ')} already assigned`);
  }

  // 2. Depot mismatch
  if (config.depot_match_required) {
    const depotSet = new Set(combined.map((b) => b.depot).filter(Boolean));
    if (depotSet.size > 1) {
      violations.push('Depot mismatch: blocks are from different depots');
    }
  }

  // 3. Hours exceeded
  const totalHours = Math.round(combined.reduce((s, b) => s + b.pay_hours, 0) * 10) / 10;
  if (targetPkg.type === 'FTE' && totalHours > config.fte_max_hours) {
    violations.push(`Exceeds FTE max hours (${totalHours} > ${config.fte_max_hours})`);
  }

  // 4. Max consecutive days
  const allDays = [...new Set(combined.map((b) => b.day))];
  const maxConsec = computeMaxConsecutiveWork(allDays);
  if (maxConsec > config.max_consecutive_days) {
    violations.push(`Exceeds max consecutive days (${maxConsec} > ${config.max_consecutive_days})`);
  }

  // 5. Time overlap on same day
  const blocksByDay = new Map<ServiceDay, DailyBlock[]>();
  for (const b of combined) {
    if (!blocksByDay.has(b.day)) blocksByDay.set(b.day, []);
    blocksByDay.get(b.day)!.push(b);
  }
  for (const [day, dayBlocks] of blocksByDay) {
    if (dayBlocks.length < 2) continue;
    dayBlocks.sort((a, b) => a.start_time_minutes - b.start_time_minutes);
    for (let i = 1; i < dayBlocks.length; i++) {
      if (dayBlocks[i].start_time_minutes < dayBlocks[i - 1].end_time_minutes) {
        violations.push(`Time overlap on ${day}`);
        break;
      }
    }
  }

  return violations;
}

// ── Route info tooltip (fixed-position to escape overflow clipping) ──

function RouteInfoTip({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  function show() {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({ top: rect.top - 4, left: rect.right + 8 });
  }

  return (
    <>
      <span
        ref={ref}
        className="inline-flex items-center cursor-help text-cc-text-muted hover:text-cc-text-secondary transition-colors"
        onMouseEnter={show}
        onMouseLeave={() => setPos(null)}
      >
        <CircleHelp size={11} />
      </span>
      {pos && (
        <div
          className="fixed z-[100] w-48 p-2 rounded-md bg-cc-surface-1 border border-cc-border shadow-lg text-[11px] text-cc-text-secondary leading-snug pointer-events-none"
          style={{ top: pos.top, left: pos.left }}
        >
          {lines.map((line, i) => (
            <div key={i} className={i === 0 ? 'font-semibold mb-0.5' : ''}>{line}</div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Route Reference Panel ────────────────────────────────────────────

function RouteReferencePanel({
  newRoutes,
  depotNameMap,
  highlightFilter,
  onHighlightFilterChange,
}: {
  newRoutes: NewRouteRow[];
  depotNameMap: Map<string, string>;
  highlightFilter?: { routeName: string; days: ServiceDay[] } | null;
  onHighlightFilterChange?: (filter: { routeName: string; days: ServiceDay[] } | null) => void;
}) {
  const routeData = useMemo(() => {
    const map = new Map<string, {
      name: string;
      days: ServiceDay[];
      depot: string | null;
      start_time: string;
      end_time: string;
      breaks: string[];
    }>();

    for (const nr of newRoutes) {
      const key = nr.new_route_name;
      if (!map.has(key)) {
        const breaks: string[] = [];
        if (nr.break_1_start && nr.break_1_end) breaks.push(`${nr.break_1_start}\u2013${nr.break_1_end}`);
        if (nr.break_2_start && nr.break_2_end) breaks.push(`${nr.break_2_start}\u2013${nr.break_2_end}`);
        if (nr.break_3_start && nr.break_3_end) breaks.push(`${nr.break_3_start}\u2013${nr.break_3_end}`);
        map.set(key, {
          name: key,
          days: parseServiceDays(nr.service_days),
          depot: nr.depot,
          start_time: nr.start_time,
          end_time: nr.end_time,
          breaks,
        });
      } else {
        const existing = map.get(key)!;
        const moreDays = parseServiceDays(nr.service_days);
        for (const d of moreDays) {
          if (!existing.days.includes(d)) existing.days.push(d);
        }
      }
    }

    return [...map.values()]
      .map((r) => ({ ...r, days: ALL_SERVICE_DAYS.filter((d) => r.days.includes(d)) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [newRoutes]);

  if (newRoutes.length === 0) return null;

  return (
    <div className="shrink-0 overflow-y-auto p-1 pr-3">
      <div className="text-[10px] font-semibold text-cc-text-muted uppercase tracking-wide mb-1.5">Routes</div>
      <div className="space-y-0.5">
        {routeData.map((route) => {
          const isActive = highlightFilter?.routeName === route.name;
          const tipLines = [route.name];
          if (route.depot) tipLines.push(`Depot: ${depotNameMap.get(route.depot) ?? route.depot}`);
          tipLines.push(`Time: ${route.start_time} \u2013 ${route.end_time}`);
          if (route.breaks.length > 0) tipLines.push(`Breaks: ${route.breaks.join(', ')}`);
          tipLines.push(`Days: ${route.days.join(', ')}`);
          return (
            <div
              key={route.name}
              className={`rounded px-1.5 py-1 cursor-pointer transition-colors text-xs whitespace-nowrap ${isActive ? 'bg-cc-accent/15 ring-1 ring-cc-accent/40' : 'hover:bg-cc-surface-2'}`}
              onClick={() => onHighlightFilterChange?.(isActive ? null : { routeName: route.name, days: route.days })}
            >
              <div className="flex items-center gap-1">
                <RouteInfoTip lines={tipLines} />
                <span className="font-medium text-[11px] leading-tight">{route.name}</span>
              </div>
              <div className="flex gap-0.5 mt-0.5">
                {ALL_SERVICE_DAYS.map((day) => (
                  <span
                    key={day}
                    className={`px-0.5 text-[8px] rounded ${route.days.includes(day) ? 'bg-cc-accent text-white' : 'bg-cc-surface-2 text-cc-text-muted'}`}
                  >
                    {day}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {highlightFilter && (
        <button
          className="mt-1.5 text-[10px] text-cc-accent hover:underline"
          onClick={() => onHighlightFilterChange?.(null)}
          type="button"
        >
          Clear filter
        </button>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────

interface ShiftBidsPanelProps {
  newRoutes: NewRouteRow[];
  depots: DepotRow[];
  readonlyView: boolean;
  bidResult: BidResult | null;
  onBidResultChange: (result: BidResult | null) => void;
  pushBidUndoState: (state: BidResult) => void;
  clearBidHistory: () => void;
  showToast: (message: string) => void;
  highlightFilter?: { routeName: string; days: ServiceDay[] } | null;
  onHighlightFilterChange?: (filter: { routeName: string; days: ServiceDay[] } | null) => void;
}

export default function ShiftBidsPanel({ newRoutes, depots, readonlyView, bidResult, onBidResultChange, pushBidUndoState, clearBidHistory, showToast, highlightFilter, onHighlightFilterChange }: ShiftBidsPanelProps) {
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [settingsLocked, setSettingsLocked] = useState(false);
  const [config, setConfig] = useState<BidConfig>({ ...DEFAULT_BID_CONFIG });
  const [typeFilter, setTypeFilter] = useState<'all' | 'FTE' | 'PT'>('all');
  const [dayFilter, setDayFilter] = useState<Set<ServiceDay>>(new Set());
  const [depotFilter, setDepotFilter] = useState<string>('all');
  const [bidSortKey, setBidSortKey] = useState<BidSortColumn>('bid_rank');
  const [bidSortDir, setBidSortDir] = useState<'asc' | 'desc'>('asc');
  const [expandedBids, setExpandedBids] = useState<Set<string>>(new Set());
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'unsaved'>('idle');
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [activeDragRoute, setActiveDragRoute] = useState<CollapsedRoute | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);

  // Initialize config/settings from bidResult on mount
  useEffect(() => {
    if (initializedRef.current) return;
    if (bidResult) {
      initializedRef.current = true;
      setConfig(bidResult.config);
      setSettingsLocked(true);
      setSettingsOpen(false);
      setSaveStatus('saved');
    }
  }, [bidResult]);

  function updateConfig<K extends keyof BidConfig>(key: K, value: BidConfig[K]) {
    if (settingsLocked) return;
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  function toggleExpanded(bidId: string) {
    setExpandedBids((prev) => {
      const next = new Set(prev);
      if (next.has(bidId)) next.delete(bidId);
      else next.add(bidId);
      return next;
    });
  }

  // ── Save ────────────────────────────────────────────────────────────

  const updateBidResult = useCallback(
    (newResult: BidResult) => {
      setSaveStatus('saving');
      onBidResultChange(newResult);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => setSaveStatus('saved'), 600);
    },
    [onBidResultChange],
  );

  function handleSave() {
    if (!bidResult || readonlyView) return;
    updateBidResult(bidResult);
    showToast('Bids saved');
  }

  // ── Generate / Regenerate ─────────────────────────────────────────

  function handleGenerateClick() {
    if (bidResult) {
      setShowRegenerateDialog(true);
      return;
    }
    doGenerate();
  }

  function doGenerate() {
    const newResult = generateBidPackages(newRoutes, config);
    setExpandedBids(new Set());
    setSettingsLocked(true);
    setSettingsOpen(false);
    clearBidHistory();
    updateBidResult(newResult);
    setShowRegenerateDialog(false);
    showToast('Bids generated and saved');
  }

  // ── Export ────────────────────────────────────────────────────────

  const depotNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of depots) map.set(d.depot_id, d.depot_name);
    return map;
  }, [depots]);

  function handleExport() {
    if (!bidResult) return;
    exportBidsToExcel(bidResult, depots);
  }

  function toggleDayFilter(day: ServiceDay) {
    setDayFilter((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  const uniqueDepots = useMemo(() => {
    if (!bidResult) return [];
    const ids = new Set<string>();
    for (const pkg of bidResult.packages) {
      if (pkg.depot) ids.add(pkg.depot);
    }
    return [...ids].sort((a, b) => (depotNameMap.get(a) ?? a).localeCompare(depotNameMap.get(b) ?? b));
  }, [bidResult, depotNameMap]);

  function toggleBidSort(key: BidSortColumn) {
    if (bidSortKey === key) {
      setBidSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setBidSortKey(key);
      setBidSortDir('asc');
    }
  }

  const filteredPackages = useMemo(() => {
    if (!bidResult) return [];
    let filtered = typeFilter === 'all' ? bidResult.packages : bidResult.packages.filter((p) => p.type === typeFilter);
    if (dayFilter.size > 0) {
      filtered = filtered.filter((p) => p.days_on.some((d) => dayFilter.has(d)));
    }
    if (depotFilter !== 'all') {
      filtered = filtered.filter((p) => p.depot === depotFilter);
    }
    const dir = bidSortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let cmp: number;
      switch (bidSortKey) {
        case 'bid_rank':
          cmp = a.bid_rank - b.bid_rank;
          break;
        case 'type':
          cmp = a.type.localeCompare(b.type);
          break;
        case 'routes': {
          const aNames = [...new Set(a.daily_blocks.map((bl) => bl.new_route_name))].join(', ');
          const bNames = [...new Set(b.daily_blocks.map((bl) => bl.new_route_name))].join(', ');
          cmp = aNames.localeCompare(bNames);
          break;
        }
        case 'weekly_pay_hours':
          cmp = a.weekly_pay_hours - b.weekly_pay_hours;
          break;
        case 'consecutive_days_off':
          cmp = a.consecutive_days_off - b.consecutive_days_off;
          break;
        case 'consistency_score':
          cmp = a.consistency_score - b.consistency_score;
          break;
        case 'depot': {
          const aDepot = a.depot ? (depotNameMap.get(a.depot) ?? a.depot) : 'Mixed';
          const bDepot = b.depot ? (depotNameMap.get(b.depot) ?? b.depot) : 'Mixed';
          cmp = aDepot.localeCompare(bDepot);
          break;
        }
        default:
          cmp = 0;
      }
      if (cmp !== 0) return cmp * dir;
      return a.bid_rank - b.bid_rank;
    });
  }, [bidResult, typeFilter, dayFilter, depotFilter, bidSortKey, bidSortDir, depotNameMap]);

  // ── Drag and drop ─────────────────────────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    if (readonlyView) return;
    const data = event.active.data.current as { route: CollapsedRoute } | undefined;
    if (data?.route) setActiveDragRoute(data.route);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragRoute(null);
    if (readonlyView) return;
    const { active, over } = event;
    if (!over || !bidResult) return;

    const dragData = active.data.current as {
      sourcePackageId: string;
      blocks: DailyBlock[];
    };
    const targetPackageId = over.id as string;

    if (dragData.sourcePackageId === targetPackageId) return;

    const violations = validateBlockMove(bidResult, dragData.sourcePackageId, dragData.blocks, targetPackageId);
    if (violations.length > 0) {
      setPendingMove({
        sourcePackageId: dragData.sourcePackageId,
        blocks: dragData.blocks,
        targetPackageId,
        violations,
      });
      return;
    }

    executeBlockMove(dragData.sourcePackageId, dragData.blocks, targetPackageId);
  }

  function executeBlockMove(
    sourcePackageId: string,
    blocks: DailyBlock[],
    targetPackageId: string,
  ) {
    if (!bidResult) return;

    pushBidUndoState(bidResult);

    const movedBlockSet = new Set(blocks);

    let updatedPackages = bidResult.packages.map((pkg) => {
      if (pkg.bid_id === sourcePackageId) {
        const remainingBlocks = pkg.daily_blocks.filter((b) => !movedBlockSet.has(b));
        if (remainingBlocks.length === 0) return null;
        return recomputePackageMetrics(
          { ...pkg, daily_blocks: remainingBlocks },
          bidResult.config,
        );
      }
      if (pkg.bid_id === targetPackageId) {
        const combinedBlocks = [...pkg.daily_blocks, ...blocks];
        return recomputePackageMetrics(
          { ...pkg, daily_blocks: combinedBlocks },
          bidResult.config,
        );
      }
      return pkg;
    }).filter((pkg): pkg is NonNullable<typeof pkg> => pkg !== null);

    // Handle unassigned as source/target
    let unassignedBlocks = [...bidResult.unassigned_blocks];
    if (sourcePackageId === 'unassigned') {
      unassignedBlocks = unassignedBlocks.filter((b) => !movedBlockSet.has(b));
    }
    if (targetPackageId === 'unassigned') {
      unassignedBlocks = [...unassignedBlocks, ...blocks];
    }

    // Re-type packages based on new hours
    updatedPackages = updatedPackages.map((pkg) => ({
      ...pkg,
      type: (pkg.weekly_pay_hours >= bidResult.config.fte_min_hours ? 'FTE' : 'PT') as BidType,
    }));

    const reranked = rankPackages(updatedPackages, bidResult.config);

    const newResult: BidResult = {
      config: bidResult.config,
      packages: reranked,
      fte_count: reranked.filter((p) => p.type === 'FTE').length,
      pt_count: reranked.filter((p) => p.type === 'PT').length,
      unassigned_blocks: unassignedBlocks,
    };

    updateBidResult(newResult);
    showToast('Route moved, rankings updated');
  }

  // ── Collapsed routes with block mapping for DnD ───────────────────

  function getBlocksForCollapsedRoute(pkg: { daily_blocks: DailyBlock[] }, route: CollapsedRoute): DailyBlock[] {
    return pkg.daily_blocks.filter(
      (b) =>
        b.new_route_name === route.new_route_name &&
        b.start_time_minutes === route.start_time_minutes &&
        b.end_time_minutes === route.end_time_minutes &&
        route.days.includes(b.day),
    );
  }

  // ── Settings disabled state ───────────────────────────────────────

  const settingsDisabled = settingsLocked || readonlyView;

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="mt-3">
      {/* ── Status banner ─────────────────────────────────────────── */}
      {bidResult && (
        <div className={`text-xs mb-3 px-3 py-1.5 rounded border ${
          saveStatus === 'saved' ? 'border-cc-border text-cc-text-muted bg-cc-surface-1' :
          saveStatus === 'saving' ? 'border-cc-accent/30 text-cc-accent bg-cc-accent/5' :
          'border-cc-border text-cc-text-muted bg-cc-surface-1'
        }`}>
          {saveStatus === 'saving' && 'Saving changes...'}
          {saveStatus === 'saved' && 'All changes saved'}
          {saveStatus === 'unsaved' && 'You have unsaved changes'}
          {saveStatus === 'idle' && 'Bid packages loaded'}
        </div>
      )}

      {/* ── Settings ─────────────────────────────────────────────── */}
      <div className="mb-3 border border-cc-border rounded-lg">
        <button
          className="flex items-center gap-1.5 w-full px-3 py-2 text-sm font-medium text-cc-text-secondary hover:text-cc-accent transition-colors"
          onClick={() => setSettingsOpen((prev) => !prev)}
          type="button"
        >
          {settingsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Bid Settings
          {settingsLocked && <span className="text-[10px] text-cc-text-muted ml-2">(locked after generation)</span>}
        </button>

        {settingsOpen && (
          <div className="px-3 pb-3 space-y-3">
            {/* Row 1 */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <SettingLabel tip="Minimum weekly pay hours for a package to qualify as full-time.">FTE Min Hours</SettingLabel>
                <Input
                  type="number"
                  value={config.fte_min_hours || ''}
                  className="h-7 text-xs"
                  disabled={settingsDisabled}
                  onChange={(e) => updateConfig('fte_min_hours', e.target.value === '' ? 0 : Number(e.target.value))}
                />
              </div>
              <div>
                <SettingLabel tip="Maximum weekly pay hours for full-time packages. Packages approaching this limit may trigger overtime.">FTE Max Hours</SettingLabel>
                <Input
                  type="number"
                  value={config.fte_max_hours || ''}
                  className="h-7 text-xs"
                  disabled={settingsDisabled}
                  onChange={(e) => updateConfig('fte_max_hours', e.target.value === '' ? 0 : Number(e.target.value))}
                />
              </div>
              <div>
                <SettingLabel tip="Minimum hours between the end of one shift and the start of the next.">Min Rest Hours</SettingLabel>
                <Input
                  type="number"
                  value={config.min_rest_hours || ''}
                  className="h-7 text-xs"
                  disabled={settingsDisabled}
                  onChange={(e) => updateConfig('min_rest_hours', e.target.value === '' ? 0 : Number(e.target.value))}
                />
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <SettingLabel tip="Maximum number of consecutive work days allowed in a single bid package.">Max Consecutive Days</SettingLabel>
                <Input
                  type="number"
                  value={config.max_consecutive_days || ''}
                  className="h-7 text-xs"
                  disabled={settingsDisabled}
                  onChange={(e) => updateConfig('max_consecutive_days', e.target.value === '' ? 0 : Number(e.target.value))}
                />
              </div>
              <div>
                <SettingLabel tip="Maximum acceptable start time variance in minutes. Used to calculate consistency scores.">Max Variance (min)</SettingLabel>
                <Input
                  type="number"
                  value={config.max_allowable_variance || ''}
                  className="h-7 text-xs"
                  disabled={settingsDisabled}
                  onChange={(e) => updateConfig('max_allowable_variance', e.target.value === '' ? 0 : Number(e.target.value))}
                />
              </div>
              <div className="flex items-end gap-2 pb-0.5">
                <Checkbox
                  id="depot-match"
                  checked={config.depot_match_required}
                  disabled={settingsDisabled}
                  onCheckedChange={(checked) => updateConfig('depot_match_required', checked === true)}
                />
                <SettingLabel tip="When enabled, all routes in a bid package must share the same depot.">Depot Match Required</SettingLabel>
              </div>
            </div>

            {/* Row 3 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <SettingLabel tip="How heavily start/end time consistency is weighted when grouping routes. Higher values favor predictable schedules.">Consistency Weight</SettingLabel>
                <Select
                  value={config.consistency_weight}
                  disabled={settingsDisabled}
                  onValueChange={(v) => updateConfig('consistency_weight', v as BidConfig['consistency_weight'])}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <SettingLabel tip="Primary sort criteria for bid ranking. Higher-ranked bids are picked first by senior drivers.">Rank Priority</SettingLabel>
                <Select
                  value={config.rank_priority}
                  disabled={settingsDisabled}
                  onValueChange={(v) => updateConfig('rank_priority', v as BidConfig['rank_priority'])}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hours">Weekly Hours</SelectItem>
                    <SelectItem value="consistency">Consistency</SelectItem>
                    <SelectItem value="days_off">Days Off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Action bar ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleGenerateClick} disabled={newRoutes.length === 0 || readonlyView} type="button">
            <Play size={14} className="mr-1.5" />
            {bidResult ? 'Regenerate Bids' : 'Generate Bids'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={!bidResult || readonlyView || saveStatus === 'saving'}
            type="button"
          >
            <Save size={14} className="mr-1.5" />
            {saveStatus === 'saving' ? 'Saving...' : 'Save'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={!bidResult || bidResult.packages.length === 0}
            type="button"
          >
            <Download size={14} className="mr-1.5" /> Export Excel
          </Button>
        </div>

        {bidResult && (
          <div className="flex gap-3 items-center flex-wrap">
            <div className="flex gap-0.5 items-center">
              <span className="text-xs text-cc-text-muted mr-1">Type:</span>
              {(['all', 'FTE', 'PT'] as const).map((t) => (
                <button
                  key={t}
                  className={`px-2 py-0.5 text-[10px] rounded ${typeFilter === t ? 'bg-cc-accent text-white' : 'bg-cc-surface-2 text-cc-text-muted'}`}
                  onClick={() => setTypeFilter(t)}
                  type="button"
                >
                  {t === 'all' ? 'All' : t}
                </button>
              ))}
            </div>
            <div className="flex gap-0.5 items-center">
              <span className="text-xs text-cc-text-muted mr-1">Days:</span>
              {ALL_SERVICE_DAYS.map((day) => (
                <button
                  key={day}
                  className={`px-1 py-0.5 text-[10px] rounded ${dayFilter.has(day) ? 'bg-cc-accent text-white' : 'bg-cc-surface-2 text-cc-text-muted'}`}
                  onClick={() => toggleDayFilter(day)}
                  type="button"
                >
                  {day}
                </button>
              ))}
            </div>
            {uniqueDepots.length > 1 && (
              <Select value={depotFilter} onValueChange={setDepotFilter}>
                <SelectTrigger className="h-7 text-xs w-auto min-w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Depots</SelectItem>
                  {uniqueDepots.map((id) => (
                    <SelectItem key={id} value={id}>{depotNameMap.get(id) ?? id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </div>

      {/* ── Results summary ──────────────────────────────────────── */}
      {bidResult && (
        <div className="flex gap-4 mb-3 text-[13px] flex-wrap">
          <span>FTE Packages: <strong>{bidResult.fte_count}</strong></span>
          <span>PT Packages: <strong>{bidResult.pt_count}</strong></span>
          {bidResult.unassigned_blocks.length > 0 && (
            <span className="text-cc-danger">
              Unassigned Blocks: <strong>{bidResult.unassigned_blocks.length}</strong>
            </span>
          )}
        </div>
      )}

      {/* ── Bid table with DnD ───────────────────────────────────── */}
      {bidResult && (
        <div className="flex items-stretch">
          <RouteReferencePanel
            newRoutes={newRoutes}
            depotNameMap={depotNameMap}
            highlightFilter={highlightFilter}
            onHighlightFilterChange={onHighlightFilterChange}
          />
          <div className="w-px bg-cc-border shrink-0" />
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex-1 min-w-0 overflow-x-auto pl-3">
            <div className="text-[10px] font-semibold text-cc-text-muted uppercase tracking-wide mb-1.5">Bid Packages</div>
            <table className="w-full caption-bottom text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-6" />
                  <BidSortableHead column="bid_rank" label="Rank" className="min-w-[50px]" sortKey={bidSortKey} sortDir={bidSortDir} onSort={toggleBidSort} />
                  <BidSortableHead column="type" label="Type" className="min-w-[50px]" sortKey={bidSortKey} sortDir={bidSortDir} onSort={toggleBidSort} />
                  <BidSortableHead column="routes" label="Routes" className="min-w-[150px]" sortKey={bidSortKey} sortDir={bidSortDir} onSort={toggleBidSort} />
                  <TableHead className="min-w-[160px]">Days On</TableHead>
                  <TableHead className="min-w-[100px]">Days Off</TableHead>
                  <BidSortableHead column="weekly_pay_hours" label="Weekly Hrs" className="min-w-[90px]" sortKey={bidSortKey} sortDir={bidSortDir} onSort={toggleBidSort} />
                  <BidSortableHead column="consecutive_days_off" label="Consec. Off" className="min-w-[80px]" sortKey={bidSortKey} sortDir={bidSortDir} onSort={toggleBidSort} />
                  <BidSortableHead column="consistency_score" label="Consistency" className="min-w-[90px]" sortKey={bidSortKey} sortDir={bidSortDir} onSort={toggleBidSort} />
                  <BidSortableHead column="depot" label="Depot" className="min-w-[80px]" sortKey={bidSortKey} sortDir={bidSortDir} onSort={toggleBidSort} />
                </TableRow>
              </TableHeader>
              {filteredPackages.length === 0 && (
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={10} className="text-cc-text-muted">
                      {bidResult.packages.length === 0
                        ? 'No bid packages generated. Add routes and click Generate Bids.'
                        : `No ${typeFilter} packages found.`}
                    </TableCell>
                  </TableRow>
                </TableBody>
              )}
              {filteredPackages.map((pkg) => {
                const isExpanded = expandedBids.has(pkg.bid_id);
                const routeNames = [...new Set(pkg.daily_blocks.map((b) => b.new_route_name))].join(', ');
                const collapsed = isExpanded ? collapseRoutes(pkg.daily_blocks) : [];
                const isHighlighted = highlightFilter != null && pkg.daily_blocks.some(
                  (b) => b.new_route_name === highlightFilter.routeName && highlightFilter.days.includes(b.day),
                );
                const isDimmed = highlightFilter != null && !isHighlighted;
                return (
                  <DroppablePackageBody key={pkg.bid_id} packageId={pkg.bid_id}>
                    <TableRow className={`cursor-pointer transition-opacity ${isHighlighted ? 'ring-2 ring-cc-accent/30 ring-inset' : ''} ${isDimmed ? 'opacity-40' : ''}`} onClick={() => toggleExpanded(pkg.bid_id)}>
                      <TableCell className="w-6" />
                      <TableCell className="text-xs font-medium">
                        <span className="inline-flex items-center gap-1">
                          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          {pkg.bid_rank}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={pkg.type === 'FTE' ? 'default' : 'secondary'} className="text-[10px]">
                          {pkg.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{routeNames}</TableCell>
                      <TableCell>
                        <div className="flex gap-0.5">
                          {ALL_SERVICE_DAYS.map((day) => (
                            <span
                              key={day}
                              className={`px-1 py-0 text-[10px] rounded ${
                                pkg.days_on.includes(day)
                                  ? 'bg-cc-accent text-white'
                                  : 'bg-cc-surface-2 text-cc-text-muted'
                              }`}
                            >
                              {day}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-cc-text-muted">
                        {pkg.days_off.join(', ') || '\u2014'}
                      </TableCell>
                      <TableCell className="text-xs">{pkg.weekly_pay_hours}</TableCell>
                      <TableCell className="text-xs">{pkg.consecutive_days_off}</TableCell>
                      <TableCell className="text-xs">{pkg.consistency_score}%</TableCell>
                      <TableCell className="text-xs text-cc-text-muted">
                        {pkg.depot ? (depotNameMap.get(pkg.depot) ?? pkg.depot) : 'Mixed'}
                      </TableCell>
                    </TableRow>
                    {isExpanded && collapsed.map((route, idx) => {
                      const routeBlocks = getBlocksForCollapsedRoute(pkg, route);
                      const breaks = [
                        route.break_1_start && route.break_1_end ? `${route.break_1_start}-${route.break_1_end}` : null,
                        route.break_2_start && route.break_2_end ? `${route.break_2_start}-${route.break_2_end}` : null,
                        route.break_3_start && route.break_3_end ? `${route.break_3_start}-${route.break_3_end}` : null,
                      ].filter(Boolean).join(', ') || '\u2014';
                      return (
                        <DraggableRouteRow
                          key={`${pkg.bid_id}-route-${idx}`}
                          packageId={pkg.bid_id}
                          route={route}
                          blocks={routeBlocks}
                          readonlyView={readonlyView}
                        >
                          <TableCell />
                          <TableCell />
                          <TableCell className="text-xs pl-6 text-cc-text-secondary">{route.new_route_name}</TableCell>
                          <TableCell>
                            <div className="flex gap-0.5">
                              {ALL_SERVICE_DAYS.map((day) => (
                                <span
                                  key={day}
                                  className={`px-1 py-0 text-[10px] rounded ${
                                    route.days.includes(day)
                                      ? 'bg-cc-accent/60 text-white'
                                      : 'bg-cc-surface-2 text-cc-text-muted'
                                  }`}
                                >
                                  {day}
                                </span>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-cc-text-muted">
                            {formatMinutesToClock(route.start_time_minutes)} - {formatMinutesToClock(route.end_time_minutes)}
                          </TableCell>
                          <TableCell className="text-xs">{Math.round(route.pay_hours * 10) / 10}</TableCell>
                          <TableCell className="text-xs text-cc-text-muted" colSpan={2}>{breaks}</TableCell>
                          <TableCell className="text-xs text-cc-text-muted">
                            {route.depot ? (depotNameMap.get(route.depot) ?? route.depot) : '\u2014'}
                          </TableCell>
                        </DraggableRouteRow>
                      );
                    })}
                  </DroppablePackageBody>
                );
              })}

              {/* Unassigned blocks droppable */}
              {bidResult.unassigned_blocks.length > 0 && (
                <DroppablePackageBody packageId="unassigned">
                  <TableRow>
                    <TableCell className="w-6" />
                    <TableCell colSpan={9} className="text-xs font-medium text-cc-danger">
                      Unassigned Blocks ({bidResult.unassigned_blocks.length})
                    </TableCell>
                  </TableRow>
                  {collapseRoutes(bidResult.unassigned_blocks).map((route, idx) => {
                    const routeBlocks = getBlocksForCollapsedRoute({ daily_blocks: bidResult.unassigned_blocks }, route);
                    return (
                      <DraggableRouteRow
                        key={`unassigned-route-${idx}`}
                        packageId="unassigned"
                        route={route}
                        blocks={routeBlocks}
                        readonlyView={readonlyView}
                      >
                        <TableCell />
                        <TableCell />
                        <TableCell className="text-xs pl-6 text-cc-text-secondary">{route.new_route_name}</TableCell>
                        <TableCell>
                          <div className="flex gap-0.5">
                            {ALL_SERVICE_DAYS.map((day) => (
                              <span
                                key={day}
                                className={`px-1 py-0 text-[10px] rounded ${
                                  route.days.includes(day)
                                    ? 'bg-cc-accent/60 text-white'
                                    : 'bg-cc-surface-2 text-cc-text-muted'
                                }`}
                              >
                                {day}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-cc-text-muted">
                          {formatMinutesToClock(route.start_time_minutes)} - {formatMinutesToClock(route.end_time_minutes)}
                        </TableCell>
                        <TableCell className="text-xs">{Math.round(route.pay_hours * 10) / 10}</TableCell>
                        <TableCell className="text-xs text-cc-text-muted" colSpan={2}>{'\u2014'}</TableCell>
                        <TableCell className="text-xs text-cc-text-muted">
                          {route.depot ? (depotNameMap.get(route.depot) ?? route.depot) : '\u2014'}
                        </TableCell>
                      </DraggableRouteRow>
                    );
                  })}
                </DroppablePackageBody>
              )}
            </table>
          </div>

          {/* Drag overlay */}
          <DragOverlay>
            {activeDragRoute && (
              <div className="bg-cc-surface-1 border border-cc-accent rounded px-3 py-1.5 shadow-lg text-xs">
                <strong>{activeDragRoute.new_route_name}</strong>
                <span className="text-cc-text-muted ml-2">
                  {activeDragRoute.days.join(', ')} &middot; {formatMinutesToClock(activeDragRoute.start_time_minutes)} - {formatMinutesToClock(activeDragRoute.end_time_minutes)}
                </span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────── */}
      {!bidResult && (
        <div className="text-xs text-cc-text-muted py-6 text-center">
          Configure settings above and click Generate Bids to create shift bid packages from your routes.
        </div>
      )}

      {/* ── Regenerate confirmation dialog ────────────────────────── */}
      <Dialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate Bid Packages?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-cc-text-secondary">
            This will discard all current bid packages and any manual adjustments you have made.
            This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegenerateDialog(false)} type="button">
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => { setSettingsLocked(false); setSettingsOpen(true); setShowRegenerateDialog(false); }} type="button">
              Unlock Settings
            </Button>
            <Button variant="destructive" onClick={doGenerate} type="button">
              Regenerate Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Violation dialog ──────────────────────────────────────── */}
      <Dialog open={!!pendingMove} onOpenChange={(open) => { if (!open) setPendingMove(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rule Violations Detected</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-cc-text-secondary">
              Moving this route would cause the following violations:
            </p>
            <ul className="list-disc pl-5 text-sm text-cc-danger space-y-1">
              {pendingMove?.violations.map((v, i) => <li key={i}>{v}</li>)}
            </ul>
            <p className="text-sm text-cc-text-secondary">
              Do you want to proceed anyway?
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingMove(null)} type="button">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingMove) {
                  executeBlockMove(pendingMove.sourcePackageId, pendingMove.blocks, pendingMove.targetPackageId);
                }
                setPendingMove(null);
              }}
              type="button"
            >
              Move Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
