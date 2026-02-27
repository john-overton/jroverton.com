'use client';

import { Check, Filter, Share, Share2 } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/app/clearcut/components/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/app/clearcut/components/shadcn/dropdown-menu';

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

interface FilterBarProps {
  intervalMinutes: 15 | 30 | 60;
  selectedDepot: string;
  depotName: string;
  dayMode: 'dow' | 'specific';
  selectedDayIds: number[];
  specificDate: string | null;
  timeStartLabel: string;
  timeEndLabel: string;
  readonlyView: boolean;
  onCopyReadonlyLink: () => void;
  onCopyEditLink: () => void;
  copiedLink: 'readonly' | 'edit' | null;
  detectedOS: string;
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
  readonlyView,
  onCopyReadonlyLink,
  onCopyEditLink,
  copiedLink,
  detectedOS,
  children,
}: FilterBarProps) {
  const [expanded, setExpanded] = useState(false);
  const dissolveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (dissolveTimer.current) {
      clearTimeout(dissolveTimer.current);
      dissolveTimer.current = null;
    }
  }, []);

  const startDissolveTimer = useCallback(() => {
    clearTimer();
    dissolveTimer.current = setTimeout(() => {
      setExpanded(false);
      dissolveTimer.current = null;
    }, DISSOLVE_DELAY_MS);
  }, [clearTimer]);

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  const onMouseEnterContainer = useCallback(() => {
    clearTimer();
    setExpanded(true);
  }, [clearTimer]);

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

  const ShareIcon = detectedOS === 'apple' ? Share : Share2;

  return (
    <div
      onMouseEnter={onMouseEnterContainer}
      onMouseLeave={onMouseLeaveContainer}
    >
      {/* Compact bar */}
      <div className="flex items-center gap-2 px-4 py-2 text-sm">
        <Filter size={14} className="text-cc-text-muted shrink-0" />
        <span className="text-cc-text-secondary truncate">
          {intervalMinutes}m
          <span className="text-cc-text-muted mx-1.5">&middot;</span>
          {depotName}
          <span className="text-cc-text-muted mx-1.5">&middot;</span>
          {daysSummary}
          <span className="text-cc-text-muted mx-1.5">&middot;</span>
          {timeStartLabel} – {timeEndLabel}
        </span>

        <div className="ml-auto shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs" aria-label="Share">
                <ShareIcon size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Share</DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                onClick={onCopyReadonlyLink}
              >
                {copiedLink === 'readonly' ? (
                  <span className="flex items-center gap-1.5 text-cc-success">
                    <Check size={14} /> Copied!
                  </span>
                ) : (
                  'Copy read-only link'
                )}
              </DropdownMenuItem>
              {!readonlyView && (
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  onClick={onCopyEditLink}
                >
                  {copiedLink === 'edit' ? (
                    <span className="flex items-center gap-1.5 text-cc-success">
                      <Check size={14} /> Copied!
                    </span>
                  ) : (
                    'Copy edit link'
                  )}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Popout filter panel */}
      {expanded && (
        <div className="border-t border-cc-border bg-cc-surface-1 px-4 py-3 animate-in fade-in slide-in-from-top-1 duration-150">
          {children}
        </div>
      )}
    </div>
  );
}
