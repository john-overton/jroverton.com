'use client';

import { Filter } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

const DAY_LABELS: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

const DISSOLVE_DELAY_MS = 1000;
const EXPAND_DELAY_MS = 500;

interface FilterBarProps {
  intervalMinutes: 15 | 30 | 60;
  selectedDepot: string;
  depotName: string;
  dayMode: 'dow' | 'specific';
  selectedDayIds: number[];
  specificDate: string | null;
  timeStartLabel: string;
  timeEndLabel: string;
  zoneSummary?: string;
  statusSummary?: string;
  passengerTypeSummary?: string;
  vehicleTypeSummary?: string;
  onExpandedChange?: (expanded: boolean) => void;
  children: ReactNode;
}

export default function FilterBar({
  intervalMinutes,
  selectedDepot,
  depotName,
  dayMode,
  selectedDayIds,
  specificDate,
  timeStartLabel,
  timeEndLabel,
  zoneSummary,
  statusSummary,
  passengerTypeSummary,
  vehicleTypeSummary,
  onExpandedChange,
  children,
}: FilterBarProps) {
  const [expanded, setExpanded] = useState(false);
  const dissolveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (dissolveTimer.current) {
      clearTimeout(dissolveTimer.current);
      dissolveTimer.current = null;
    }
    if (expandTimer.current) {
      clearTimeout(expandTimer.current);
      expandTimer.current = null;
    }
  }, []);

  const startDissolveTimer = useCallback(() => {
    clearTimer();
    dissolveTimer.current = setTimeout(() => {
      setExpanded(false);
      onExpandedChange?.(false);
      dissolveTimer.current = null;
    }, DISSOLVE_DELAY_MS);
  }, [clearTimer, onExpandedChange]);

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  const onMouseEnterContainer = useCallback(() => {
    clearTimer();
    expandTimer.current = setTimeout(() => {
      setExpanded(true);
      onExpandedChange?.(true);
      expandTimer.current = null;
    }, EXPAND_DELAY_MS);
  }, [clearTimer, onExpandedChange]);

  const onMouseLeaveContainer = useCallback(() => {
    startDissolveTimer();
  }, [startDissolveTimer]);

  const daysSummary = useMemo(() => {
    if (dayMode === 'specific') {
      if (!specificDate) return 'No date';
      const d = new Date(specificDate + 'T12:00:00');
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
    if (selectedDayIds.length === 0) return 'No days';
    if (selectedDayIds.length === 7) return 'All days';
    const weekdayIds = [1, 2, 3, 4, 5];
    const weekendIds = [0, 6];
    const hasAllWeekdays = weekdayIds.every((d) => selectedDayIds.includes(d));
    const hasAllWeekend = weekendIds.every((d) => selectedDayIds.includes(d));
    if (hasAllWeekdays && !hasAllWeekend && selectedDayIds.length === 5) return 'Weekday';
    if (hasAllWeekend && !hasAllWeekdays && selectedDayIds.length === 2) return 'Weekend';
    return selectedDayIds.map((d) => DAY_LABELS[d]).join(', ');
  }, [dayMode, selectedDayIds, specificDate]);

  return (
    <div
      className="relative"
      onMouseEnter={onMouseEnterContainer}
      onMouseLeave={onMouseLeaveContainer}
    >
      {/* Compact bar */}
      <div className="flex items-center gap-2 px-4 py-2.25 text-sm shadow-[0_2px_4px_rgba(0,0,0,0.06)]">
        <Filter size={14} className="text-cc-text-muted shrink-0" />
        <span className="text-cc-text-secondary truncate">
          {intervalMinutes}m
          <span className="text-cc-text-muted mx-1.5">&middot;</span>
          {depotName}
          <span className="text-cc-text-muted mx-1.5">&middot;</span>
          {daysSummary}
          <span className="text-cc-text-muted mx-1.5">&middot;</span>
          {timeStartLabel} – {timeEndLabel}
          {zoneSummary && (
            <>
              <span className="text-cc-text-muted mx-1.5">&middot;</span>
              {zoneSummary}
            </>
          )}
          {statusSummary && (
            <>
              <span className="text-cc-text-muted mx-1.5">&middot;</span>
              {statusSummary}
            </>
          )}
          {passengerTypeSummary && (
            <>
              <span className="text-cc-text-muted mx-1.5">&middot;</span>
              {passengerTypeSummary}
            </>
          )}
          {vehicleTypeSummary && (
            <>
              <span className="text-cc-text-muted mx-1.5">&middot;</span>
              {vehicleTypeSummary}
            </>
          )}
        </span>
      </div>

      {/* Popout filter panel */}
      {expanded && (
        <div className="absolute left-0 right-0 top-full z-30 bg-cc-surface-1 border-b border-cc-border px-4 py-3 shadow-lg animate-in fade-in slide-in-from-top-1 duration-300">
          {children}
        </div>
      )}
    </div>
  );
}
