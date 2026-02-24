'use client';

import Link from 'next/link';
import { ChevronRight, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/app/clearcut/components/shadcn/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/clearcut/components/shadcn/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/clearcut/components/shadcn/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/app/clearcut/components/shadcn/collapsible';
import { Tabs, TabsList, TabsTrigger } from '@/app/clearcut/components/shadcn/tabs';
import { ClearcutClientError } from '@/lib/clearcut/client';
import { buildDemoTripsAndRoutes } from '@/lib/clearcut/demo-data';
import { extractNewDepotsFromRoutes } from '@/lib/clearcut/depot-utils';
import { computeClearcutMetrics } from '@/lib/clearcut/metrics';
import type { DepotRow, RunRow } from '@/lib/clearcut/types';
import { useClearcutSession, type ClearcutMode } from '@/lib/clearcut/use-clearcut-session';
import { useClearcutTheme } from '@/app/clearcut/theme/ClearcutThemeProvider';
import { palettes, type PaletteId } from '@/app/clearcut/theme/palettes';

import DeadheadTab from './DeadheadTab';
import DemandTab from './DemandTab';
import ImportTab from './ImportTab';
import MapTab from './MapTab';
import PerformanceTab from './PerformanceTab';
import RunStructureTab from './RunStructureTab';
import {
  DEMAND_BLOCK_MINUTES,
  PasswordPrompt,
  deriveSliderBounds,
  formatMinutesToClock,
  formatMinutesToLabel,
  parseClockToMinutes,
  parseDateTime,
} from './shared';

type TabKey = 'import' | 'demand' | 'performance' | 'map' | 'runstructure' | 'deadhead';

const TAB_ITEMS: Array<{ key: TabKey; label: string }> = [
  { key: 'import', label: 'Import' },
  { key: 'demand', label: 'Demand' },
  { key: 'performance', label: 'Performance' },
  { key: 'map', label: 'Trip Map' },
  { key: 'runstructure', label: 'Route Structure' },
  { key: 'deadhead', label: 'Deadhead' },
];
const WEEKDAY_DAY_IDS = [1, 2, 3, 4, 5] as const;
const WEEKEND_DAY_IDS = [0, 6] as const;
const DAY_LABELS: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

interface Props {
  token: string;
  mode: ClearcutMode;
}

export default function ClearcutSessionApp({ token, mode }: Props) {
  const router = useRouter();
  const session = useClearcutSession(token, mode);
  const saveStateRef = useRef(session.saveState);
  saveStateRef.current = session.saveState;
  const readyRef = useRef(session.loadState.status === 'ready' ? session.loadState : null);
  const { paletteId, setPaletteId } = useClearcutTheme();
  const filterStateInitialized = useRef(false);
  const prevDataCountsRef = useRef<{ trips: number; routes: number } | null>(null);
  const timeRangeTrackRef = useRef<HTMLDivElement | null>(null);
  const [tab, setTab] = useState<TabKey>(mode === 'readonly' ? 'demand' : 'import');
  const [hasVisitedMap, setHasVisitedMap] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedWeekdayDays, setSelectedWeekdayDays] = useState<number[]>([]);
  const [selectedWeekendDays, setSelectedWeekendDays] = useState<number[]>([]);
  const [timeStartIndex, setTimeStartIndex] = useState(0);
  const [timeEndIndex, setTimeEndIndex] = useState(0);
  const [draggingTimeHandle, setDraggingTimeHandle] = useState<'start' | 'end' | null>(null);
  const [intervalMinutes, setIntervalMinutes] = useState<15 | 30 | 60>(15);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [dayMode, setDayMode] = useState<'dow' | 'specific'>('dow');
  const [specificDate, setSpecificDate] = useState<string | null>(null);

  const readonlyView = mode === 'readonly';

  const ready = session.loadState.status === 'ready' ? session.loadState : null;
  readyRef.current = ready;
  const fallbackServiceStartMinutes = parseClockToMinutes(ready?.state.settings.service_day_start, 4 * 60);
  const fallbackServiceEndMinutes = parseClockToMinutes(ready?.state.settings.service_day_end, 21 * 60);
  const sliderBounds = useMemo(
    () =>
      deriveSliderBounds({
        trips: ready?.state.trips ?? [],
        routes: ready?.state.routes ?? [],
        fallbackStartMinutes: fallbackServiceStartMinutes,
        fallbackEndMinutes: fallbackServiceEndMinutes,
      }),
    [fallbackServiceEndMinutes, fallbackServiceStartMinutes, ready?.state.trips, ready?.state.routes],
  );
  const serviceStartMinutes = sliderBounds.startMinutes;
  const serviceEndMinutes = sliderBounds.endMinutes;
  const allTimeBlocks = useMemo(() => {
    const output: Array<{ index: number; minutes: number; label: string }> = [];
    for (
      let minutes = serviceStartMinutes, index = 0;
      minutes <= serviceEndMinutes;
      minutes += DEMAND_BLOCK_MINUTES, index += 1
    ) {
      output.push({ index, minutes, label: formatMinutesToLabel(minutes) });
    }
    return output;
  }, [serviceStartMinutes, serviceEndMinutes]);
  const availableDates = useMemo(() => {
    if (!ready) return [];
    const dates = new Set<string>();
    for (const trip of ready.state.trips) {
      const t =
        parseDateTime(trip.pickup_arrive_time) ??
        parseDateTime(trip.pickup_leave_time) ??
        parseDateTime(trip.scheduled_pickup_time);
      if (t) {
        const y = t.getFullYear();
        const m = `${t.getMonth() + 1}`.padStart(2, '0');
        const d = `${t.getDate()}`.padStart(2, '0');
        dates.add(`${y}-${m}-${d}`);
      }
    }
    for (const route of ready.state.routes) {
      const t = parseDateTime(route.actual_start_time) ?? parseDateTime(route.scheduled_start_time);
      if (t) {
        const y = t.getFullYear();
        const m = `${t.getMonth() + 1}`.padStart(2, '0');
        const d = `${t.getDate()}`.padStart(2, '0');
        dates.add(`${y}-${m}-${d}`);
      }
    }
    return [...dates].sort();
  }, [ready]);
  const selectedDayIds = useMemo(
    () => [...selectedWeekdayDays, ...selectedWeekendDays].sort((a, b) => a - b),
    [selectedWeekdayDays, selectedWeekendDays],
  );
  const minGapBlocks = Math.ceil(60 / DEMAND_BLOCK_MINUTES);
  const rangeStartClock = allTimeBlocks[timeStartIndex]
    ? formatMinutesToClock(allTimeBlocks[timeStartIndex].minutes)
    : null;
  const rangeEndClock = allTimeBlocks[timeEndIndex]
    ? formatMinutesToClock(allTimeBlocks[timeEndIndex].minutes)
    : null;
  const metricsOptions = useMemo(
    () => ({
      selectedDays: dayMode === 'dow' ? selectedDayIds : undefined,
      specificDate: dayMode === 'specific' && specificDate ? specificDate : undefined,
    }),
    [dayMode, selectedDayIds, specificDate],
  );
  const filteredRoutes = useMemo(() => {
    if (!ready) return [];
    return ready.state.routes.filter((route) => {
      const t = parseDateTime(route.actual_start_time) ?? parseDateTime(route.scheduled_start_time);
      if (!t) return false;
      if (metricsOptions.specificDate) {
        const y = t.getFullYear();
        const m = `${t.getMonth() + 1}`.padStart(2, '0');
        const d = `${t.getDate()}`.padStart(2, '0');
        return `${y}-${m}-${d}` === metricsOptions.specificDate;
      }
      if (metricsOptions.selectedDays) {
        return metricsOptions.selectedDays.includes(t.getDay());
      }
      return true;
    });
  }, [ready, metricsOptions]);
  const metrics = useMemo(
    () =>
      ready
        ? computeClearcutMetrics(ready.state, {
            ...metricsOptions,
            timeRangeStart: rangeStartClock,
            timeRangeEnd: rangeEndClock,
            blockSizeMinutes: intervalMinutes,
          })
        : null,
    [rangeEndClock, rangeStartClock, ready, metricsOptions, intervalMinutes],
  );
  const fullDayMetrics = useMemo(
    () =>
      ready
        ? computeClearcutMetrics(ready.state, {
            ...metricsOptions,
            timeRangeStart: null,
            timeRangeEnd: null,
            blockSizeMinutes: intervalMinutes,
          })
        : null,
    [ready, metricsOptions, intervalMinutes],
  );
  const hasData = ready ? ready.state.session.trip_count > 0 || ready.state.session.route_count > 0 : false;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    if (!ready) return;
    const currentCounts = { trips: ready.state.session.trip_count, routes: ready.state.session.route_count };
    const prev = prevDataCountsRef.current;
    if (prev !== null && (prev.trips !== currentCounts.trips || prev.routes !== currentCounts.routes)) {
      filterStateInitialized.current = false;
    }
    prevDataCountsRef.current = currentCounts;
  }, [ready]);

  // Auto-extract new depots when routes change (e.g. after import)
  const prevRouteCountRef = useRef<number | null>(null);
  useEffect(() => {
    if (!ready || readonlyView) return;
    const routeCount = ready.state.routes.length;
    const prev = prevRouteCountRef.current;
    prevRouteCountRef.current = routeCount;
    // Only run when route count actually increases (new import)
    if (prev === null || routeCount <= prev) return;
    const newDepots = extractNewDepotsFromRoutes(ready.state.routes, ready.state.depots);
    if (newDepots.length === 0) return;
    const merged = [...ready.state.depots, ...newDepots];
    session.saveState({ depots: merged }).catch(() => {
      // silent — manual extraction is still available as fallback
    });
  }, [ready, readonlyView, session]);

  useEffect(() => {
    if (!ready || filterStateInitialized.current) {
      return;
    }
    const dayType = ready.state.settings.day_type;
    if (dayType === 'weekday') {
      setSelectedWeekdayDays([...WEEKDAY_DAY_IDS]);
      setSelectedWeekendDays([]);
    } else if (dayType === 'weekend') {
      setSelectedWeekdayDays([]);
      setSelectedWeekendDays([...WEEKEND_DAY_IDS]);
    } else {
      setSelectedWeekdayDays([...WEEKDAY_DAY_IDS]);
      setSelectedWeekendDays([...WEEKEND_DAY_IDS]);
    }

    const start = parseClockToMinutes(ready.state.settings.time_range_start, serviceStartMinutes);
    const end = parseClockToMinutes(ready.state.settings.time_range_end, serviceEndMinutes);
    const initialStartIndex = Math.max(
      0,
      Math.min(allTimeBlocks.length - 1, Math.round((start - serviceStartMinutes) / DEMAND_BLOCK_MINUTES)),
    );
    const initialEndIndex = Math.max(
      0,
      Math.min(allTimeBlocks.length - 1, Math.round((end - serviceStartMinutes) / DEMAND_BLOCK_MINUTES)),
    );
    const minGap = Math.ceil(60 / DEMAND_BLOCK_MINUTES);
    if (initialEndIndex - initialStartIndex >= minGap) {
      setTimeStartIndex(initialStartIndex);
      setTimeEndIndex(initialEndIndex);
    } else {
      setTimeStartIndex(0);
      setTimeEndIndex(Math.min(allTimeBlocks.length - 1, Math.max(minGap, allTimeBlocks.length - 1)));
    }
    filterStateInitialized.current = true;
  }, [allTimeBlocks.length, ready, serviceEndMinutes, serviceStartMinutes]);

  useEffect(() => {
    if (allTimeBlocks.length === 0) {
      return;
    }
    const maxIndex = allTimeBlocks.length - 1;
    setTimeStartIndex((prev) => Math.max(0, Math.min(prev, Math.max(0, maxIndex - minGapBlocks))));
    setTimeEndIndex((prev) => Math.max(minGapBlocks, Math.min(prev, maxIndex)));
  }, [allTimeBlocks.length, minGapBlocks]);

  const updateTimeHandleFromClientX = useCallback(
    (clientX: number, handle: 'start' | 'end') => {
      const track = timeRangeTrackRef.current;
      if (!track || allTimeBlocks.length <= 1) {
        return;
      }
      const rect = track.getBoundingClientRect();
      const rawRatio = (clientX - rect.left) / rect.width;
      const ratio = Math.max(0, Math.min(1, rawRatio));
      const rawIndex = Math.round(ratio * (allTimeBlocks.length - 1));
      if (handle === 'start') {
        const capped = Math.min(rawIndex, Math.max(0, timeEndIndex - minGapBlocks));
        setTimeStartIndex(Math.max(0, capped));
      } else {
        const floored = Math.max(rawIndex, Math.min(allTimeBlocks.length - 1, timeStartIndex + minGapBlocks));
        setTimeEndIndex(Math.min(allTimeBlocks.length - 1, floored));
      }
    },
    [allTimeBlocks.length, minGapBlocks, timeEndIndex, timeStartIndex],
  );

  useEffect(() => {
    if (!draggingTimeHandle) {
      return;
    }
    const activeHandle = draggingTimeHandle;
    function onMouseMove(event: MouseEvent) {
      event.preventDefault();
      updateTimeHandleFromClientX(event.clientX, activeHandle);
    }
    function onMouseUp() {
      setDraggingTimeHandle(null);
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [draggingTimeHandle, updateTimeHandleFromClientX]);

  useEffect(() => {
    if (!readyRef.current || readonlyView || !filterStateInitialized.current || allTimeBlocks.length === 0) {
      return;
    }
    const timer = window.setTimeout(() => {
      const currentReady = readyRef.current;
      if (!currentReady) return;
      const dayType =
        selectedWeekdayDays.length > 0 && selectedWeekendDays.length === 0
          ? 'weekday'
          : selectedWeekendDays.length > 0 && selectedWeekdayDays.length === 0
            ? 'weekend'
            : 'custom';
      const currentSettings = currentReady.state.settings;
      if (
        currentSettings.day_type === dayType &&
        (currentSettings.time_range_start ?? null) === (rangeStartClock ?? null) &&
        (currentSettings.time_range_end ?? null) === (rangeEndClock ?? null)
      ) {
        return;
      }
      saveStateRef.current({
        settings: {
          day_type: dayType,
          time_range_start: rangeStartClock,
          time_range_end: rangeEndClock,
        },
      }).catch((saveError) => {
        setError(saveError instanceof Error ? saveError.message : 'Failed to persist demand filters.');
      });
    }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    allTimeBlocks.length,
    rangeEndClock,
    rangeStartClock,
    readonlyView,
    selectedWeekdayDays,
    selectedWeekendDays,
  ]);

  function toggleWeekday(day: number) {
    setSelectedWeekdayDays((prev) =>
      prev.includes(day) ? prev.filter((value) => value !== day) : [...prev, day].sort((a, b) => a - b),
    );
  }

  function toggleWeekend(day: number) {
    setSelectedWeekendDays((prev) =>
      prev.includes(day) ? prev.filter((value) => value !== day) : [...prev, day].sort((a, b) => a - b),
    );
  }

  async function onLoadDemo() {
    if (readonlyView || !ready) {
      return;
    }
    setStatus('Loading demo dataset...');
    setError(null);
    try {
      const payload = buildDemoTripsAndRoutes();
      await session.saveState({ trips: payload.trips, routes: payload.routes });
      setStatus('Demo dataset loaded.');
    } catch (demoError) {
      setStatus(null);
      setError(demoError instanceof Error ? demoError.message : 'Failed to load demo data.');
    }
  }

  async function onSave() {
    if (!ready || readonlyView) {
      return;
    }
    setSaving(true);
    setError(null);
    setStatus('Saving session...');
    try {
      await session.saveState({
        settings: ready.state.settings,
        optimization: ready.state.optimization,
      });
      setStatus('Session saved.');
    } catch (saveError) {
      setStatus(null);
      setError(saveError instanceof Error ? saveError.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function onRename() {
    if (readonlyView || !ready) {
      return;
    }
    const nextName = window.prompt('Rename session', ready.state.session.name)?.trim();
    if (!nextName) {
      return;
    }
    try {
      await session.rename(nextName);
      setStatus('Session renamed.');
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : 'Rename failed.');
    }
  }

  async function onClone() {
    if (readonlyView) {
      return;
    }
    try {
      const clone = await session.clone();
      router.push(`/clearcut/s/${clone.session.edit_token}`);
    } catch (cloneError) {
      setError(cloneError instanceof Error ? cloneError.message : 'Clone failed.');
    }
  }

  async function onDelete() {
    if (readonlyView) {
      return;
    }
    const confirmed = window.confirm('Delete this session permanently?');
    if (!confirmed) {
      return;
    }
    try {
      await session.remove();
      router.push('/clearcut');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Delete failed.');
    }
  }

  async function onSetPassword() {
    if (readonlyView) {
      return;
    }
    const newPassword = window.prompt('Set a new password (minimum 6 characters)')?.trim();
    if (!newPassword) {
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    const currentPassword = window.prompt('Enter current password if one exists (leave empty if none).');
    try {
      await session.setPassword(newPassword, currentPassword || undefined);
      setStatus('Password updated.');
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : 'Password update failed.');
    }
  }

  async function onRemovePassword() {
    if (readonlyView) {
      return;
    }
    const currentPassword = window.prompt('Enter current password to remove protection.');
    try {
      await session.removePassword(currentPassword || undefined);
      setStatus('Password protection removed.');
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : 'Could not remove password.');
    }
  }

  function onLogout() {
    session.clearAuth();
    void session.loadSession({ forceNoJwt: true });
  }

  async function onUnlock(password: string) {
    setStatus('Unlocking session...');
    setError(null);
    try {
      await session.unlock(password);
      setStatus('Session unlocked.');
    } catch (unlockError) {
      if (unlockError instanceof ClearcutClientError && unlockError.status === 429) {
        const wait = unlockError.retryAfterSeconds ?? 60;
        setError(`Too many attempts. Try again in ${wait} seconds.`);
        return;
      }
      setError(unlockError instanceof Error ? unlockError.message : 'Unlock failed.');
    }
  }

  function onOtpWindowChange(
    changes: Partial<Record<
      | 'pickup_otp_window_before_min'
      | 'pickup_otp_window_after_min'
      | 'dropoff_otp_window_before_min'
      | 'dropoff_otp_window_after_min',
      number
    >>,
  ) {
    if (!ready || readonlyView) {
      return;
    }
    const partialSettings: Record<string, number> = {};
    for (const [key, value] of Object.entries(changes) as [keyof typeof changes, number | undefined][]) {
      partialSettings[key] = Math.max(0, Math.min(180, Number.isFinite(value) ? value! : 0));
    }
    session
      .saveState({ settings: partialSettings })
      .catch((saveError) => {
        setError(saveError instanceof Error ? saveError.message : 'Failed to update OTP windows.');
      });
  }

  function onOptimizationChange(
    key:
      | 'target_productivity'
      | 'min_otp_target'
      | 'max_driver_spread_hrs'
      | 'peak_vehicles'
      | 'run_structure_json',
    value: number | string | null,
  ) {
    if (!ready || readonlyView) {
      return;
    }
    const current = ready.state.optimization;
    const next = { ...current, [key]: value };
    session.saveState({ optimization: next }).catch((saveError) => {
      setError(saveError instanceof Error ? saveError.message : 'Failed to persist optimization setting.');
    });
  }

  function onRunsChange(runs: RunRow[]) {
    if (!ready || readonlyView) {
      return;
    }
    session.saveState({ runs }).catch((saveError) => {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save runs.');
    });
  }

  function onDepotsChange(depots: DepotRow[]) {
    if (!ready || readonlyView) {
      return;
    }
    session.saveState({ depots }).catch((saveError) => {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save depots.');
    });
  }

  if (session.loadState.status === 'loading') {
    return (
      <main className="max-w-[1100px] mx-auto px-5 pt-16 pb-8">
        <p>Loading session...</p>
      </main>
    );
  }

  if (session.loadState.status === 'not_found') {
    return (
      <main className="max-w-[900px] mx-auto px-5 pt-16 pb-8">
        <h1 className="text-2xl font-bold">Session Not Found</h1>
        <p className="text-cc-text-secondary">
          The session token is invalid or no longer exists.
        </p>
        <Link href="/clearcut">Create a new session</Link>
      </main>
    );
  }

  if (session.loadState.status === 'password_required') {
    return (
      <main className="max-w-[560px] mx-auto px-5 pt-16 pb-8">
        <h1 className="text-3xl font-bold mb-2">{session.loadState.name}</h1>
        <p className="text-cc-text-secondary mb-4">This edit session is password protected.</p>
        <PasswordPrompt onSubmit={onUnlock} />
        {session.loadState.retryAfterSeconds && (
          <p className="text-cc-warning mt-3">
            Try again in {session.loadState.retryAfterSeconds} seconds.
          </p>
        )}
        {error && <p className="text-cc-danger mt-3">{error}</p>}
      </main>
    );
  }

  if (session.loadState.status === 'error') {
    return (
      <main className="max-w-[900px] mx-auto px-5 pt-16 pb-8">
        <h1 className="text-2xl font-bold">Unable to load session</h1>
        <p className="text-cc-danger">{session.loadState.message}</p>
        <Button variant="outline" onClick={() => session.loadSession()} type="button">
          Retry
        </Button>
      </main>
    );
  }

  if (!ready || !metrics) {
    return null;
  }

  return (
    <main className="max-w-[1200px] mx-auto px-5 pt-12 pb-8">
      <header className="flex justify-between gap-3 items-start">
        <div>
          <h1 className="text-3xl font-bold mb-1">{ready.state.session.name}</h1>
          <div className="text-cc-text-secondary text-sm">
            Run Cutting &amp; Optimization Tool {readonlyView ? '- Read-only Mode' : ''}
          </div>
          <div className="text-cc-text-secondary text-[13px] mt-1.5">
            Data loaded: {ready.state.session.trip_count} trips, {ready.state.session.route_count} routes
          </div>
          {!readonlyView && origin && (
            <div className="mt-2 text-[13px]">
              Share link: <code>{`${origin}/clearcut/r/${ready.state.session.readonly_token}`}</code>{' '}
              <Button
                variant="outline"
                size="sm"
                className="ml-2"
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(`${origin}/clearcut/r/${ready.state.session.readonly_token}`);
                  setStatus('Read-only link copied.');
                }}
              >
                Copy
              </Button>
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap justify-end items-center">
          {!readonlyView && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Session options">
                  <Settings size={18} strokeWidth={2} aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onRename}>Rename</DropdownMenuItem>
                <DropdownMenuItem onClick={onSetPassword}>Set Password</DropdownMenuItem>
                {ready.state.session.has_password && (
                  <>
                    <DropdownMenuItem onClick={onRemovePassword}>Remove Password</DropdownMenuItem>
                    <DropdownMenuItem onClick={onLogout}>Logout</DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                {palettes.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => setPaletteId(p.id as PaletteId)}
                  >
                    {paletteId === p.id ? `\u2713 ${p.name}` : `  ${p.name}`}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onClone}>Save As New</DropdownMenuItem>
                <DropdownMenuItem className="text-cc-danger" onClick={onDelete}>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {!readonlyView && (
            <Button disabled={saving} onClick={onSave} type="button">
              {saving ? 'Saving...' : 'Save Run Cut'}
            </Button>
          )}
        </div>
      </header>

      {hasData && allTimeBlocks.length > 0 && (
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen} asChild>
          <section className="mt-3 mb-1 border border-cc-border rounded-[10px] bg-cc-surface-1 p-3">
            <CollapsibleTrigger className="flex items-center gap-1.5 bg-transparent border-none p-0 cursor-pointer text-sm font-semibold w-full">
              <ChevronRight
                size={14}
                className="transition-transform duration-150 data-[state=open]:rotate-90"
                data-state={filtersOpen ? 'open' : 'closed'}
              />
              Filters
            </CollapsibleTrigger>
            <CollapsibleContent className="grid grid-cols-1 lg:grid-cols-[1fr_1px_1fr_1px_1fr] gap-4 mt-2">
            {/* Column 1: Interval */}
            <div>
              <div className="text-xs text-cc-text-muted mb-1">Interval</div>
              <div className="flex gap-1 text-xs">
                {([15, 30, 60] as const).map((mins) => (
                  <button
                    key={mins}
                    className={`px-2 py-0.5 rounded ${intervalMinutes === mins ? 'bg-cc-accent text-white' : 'bg-cc-surface-2 text-cc-text-muted'}`}
                    onClick={() => setIntervalMinutes(mins)}
                  >{mins}m</button>
                ))}
              </div>
            </div>

            <div className="hidden lg:block bg-cc-border" />
            {/* Column 2: Day Selection */}
            <div>
              <div className="flex items-center gap-1 mb-1.5">
                <div className="text-xs text-cc-text-muted mr-1">Days</div>
                <div className="flex gap-1 text-xs">
                  <button
                    className={`px-2 py-0.5 rounded ${dayMode === 'dow' ? 'bg-cc-accent text-white' : 'bg-cc-surface-2 text-cc-text-muted'}`}
                    onClick={() => setDayMode('dow')}
                  >Day of Week</button>
                  <button
                    className={`px-2 py-0.5 rounded ${dayMode === 'specific' ? 'bg-cc-accent text-white' : 'bg-cc-surface-2 text-cc-text-muted'}`}
                    onClick={() => {
                      setDayMode('specific');
                      if (!specificDate && availableDates.length > 0) {
                        setSpecificDate(availableDates[0]);
                      }
                    }}
                  >Specific Day</button>
                </div>
              </div>
              {dayMode === 'dow' ? (
                <>
                  <div className="flex flex-wrap items-center gap-1 mb-1.5 text-xs">
                    <button
                      className={`px-2 py-0.5 rounded ${selectedWeekdayDays.length === WEEKDAY_DAY_IDS.length ? 'bg-cc-accent text-white' : 'bg-cc-surface-2 text-cc-text-muted'}`}
                      onClick={() =>
                        setSelectedWeekdayDays((prev) =>
                          prev.length === WEEKDAY_DAY_IDS.length ? [] : [...WEEKDAY_DAY_IDS],
                        )
                      }
                    >Weekday</button>
                    {WEEKDAY_DAY_IDS.map((day) => (
                      <button
                        key={`weekday-pill-${day}`}
                        className={`px-2 py-0.5 rounded ${selectedWeekdayDays.includes(day) ? 'bg-cc-accent text-white' : 'bg-cc-surface-2 text-cc-text-muted'}`}
                        onClick={() => toggleWeekday(day)}
                      >{DAY_LABELS[day]}</button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-1 text-xs">
                    <button
                      className={`px-2 py-0.5 rounded ${selectedWeekendDays.length === WEEKEND_DAY_IDS.length ? 'bg-cc-accent text-white' : 'bg-cc-surface-2 text-cc-text-muted'}`}
                      onClick={() =>
                        setSelectedWeekendDays((prev) =>
                          prev.length === WEEKEND_DAY_IDS.length ? [] : [...WEEKEND_DAY_IDS],
                        )
                      }
                    >Weekend</button>
                    {WEEKEND_DAY_IDS.map((day) => (
                      <button
                        key={`weekend-pill-${day}`}
                        className={`px-2 py-0.5 rounded ${selectedWeekendDays.includes(day) ? 'bg-cc-accent text-white' : 'bg-cc-surface-2 text-cc-text-muted'}`}
                        onClick={() => toggleWeekend(day)}
                      >{DAY_LABELS[day]}</button>
                    ))}
                  </div>
                </>
              ) : (
                <Select
                  value={specificDate ?? ''}
                  onValueChange={(v) => setSpecificDate(v || null)}
                >
                  <SelectTrigger className="w-auto min-w-[200px]">
                    <SelectValue placeholder="Select a date" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDates.length === 0 && (
                      <SelectItem value="">No dates available</SelectItem>
                    )}
                    {availableDates.map((dateStr) => {
                      const d = new Date(dateStr + 'T12:00:00');
                      const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                      return <SelectItem key={dateStr} value={dateStr}>{label}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="hidden lg:block bg-cc-border" />
            {/* Column 3: Time Range */}
            <div>
              <div className="text-xs text-cc-text-muted mb-1">Time Range</div>
              <div
                ref={timeRangeTrackRef}
                style={{ position: 'relative', height: 30 }}
                onMouseDown={(event) => {
                  if (allTimeBlocks.length <= 1) {
                    return;
                  }
                  const track = timeRangeTrackRef.current;
                  if (!track) {
                    return;
                  }
                  const rect = track.getBoundingClientRect();
                  const startX = (timeStartIndex / Math.max(1, allTimeBlocks.length - 1)) * rect.width;
                  const endX = (timeEndIndex / Math.max(1, allTimeBlocks.length - 1)) * rect.width;
                  const cursorX = event.clientX - rect.left;
                  const handle = Math.abs(cursorX - startX) <= Math.abs(cursorX - endX) ? 'start' : 'end';
                  setDraggingTimeHandle(handle);
                  updateTimeHandleFromClientX(event.clientX, handle);
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: '50%',
                    height: 4,
                    transform: 'translateY(-50%)',
                    borderRadius: 4,
                    background: 'var(--color-cc-surface-3)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    height: 4,
                    transform: 'translateY(-50%)',
                    borderRadius: 4,
                    background: 'var(--color-cc-accent)',
                    left: `${(timeStartIndex / Math.max(1, allTimeBlocks.length - 1)) * 100}%`,
                    width: `${((timeEndIndex - timeStartIndex) / Math.max(1, allTimeBlocks.length - 1)) * 100}%`,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: `${(timeStartIndex / Math.max(1, allTimeBlocks.length - 1)) * 100}%`,
                    top: '50%',
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: 'var(--color-cc-accent)',
                    border: '2px solid var(--color-cc-surface-1)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'auto',
                    cursor: 'ew-resize',
                    zIndex: 4,
                  }}
                  onMouseDown={(event) => {
                    event.stopPropagation();
                    setDraggingTimeHandle('start');
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: `${(timeEndIndex / Math.max(1, allTimeBlocks.length - 1)) * 100}%`,
                    top: '50%',
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: 'var(--color-cc-accent)',
                    border: '2px solid var(--color-cc-surface-1)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'auto',
                    cursor: 'ew-resize',
                    zIndex: 4,
                  }}
                  onMouseDown={(event) => {
                    event.stopPropagation();
                    setDraggingTimeHandle('end');
                  }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-cc-text-muted mt-1">
                <span>Start: {allTimeBlocks[timeStartIndex]?.label ?? '--'}</span>
                <span>End: {allTimeBlocks[timeEndIndex]?.label ?? '--'}</span>
              </div>
              <div className="text-xs text-cc-accent">
                {allTimeBlocks[timeStartIndex]?.label} - {allTimeBlocks[timeEndIndex]?.label}
                {' - '}
                {dayMode === 'specific'
                  ? specificDate ?? 'No date selected'
                  : selectedDayIds.length > 0 ? `${selectedDayIds.length} day(s) selected` : 'No days selected'}
              </div>
            </div>
          </CollapsibleContent>
        </section>
      </Collapsible>
      )}

      <div className="mt-4 mb-2">
        <Tabs value={tab} onValueChange={(v) => {
          setTab(v as TabKey);
          if (v === 'map') setHasVisitedMap(true);
        }}>
          <TabsList>
            {TAB_ITEMS.map((item) => {
              if (item.key === 'import' && readonlyView) return null;
              const disabled = item.key !== 'import' && !hasData;
              return (
                <TabsTrigger key={item.key} value={item.key} disabled={disabled}>
                  {item.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>

      {status && <p className="text-cc-success mb-2">{status}</p>}
      {error && <p className="text-cc-danger mb-2">{error}</p>}

      {tab === 'import' && (
        <ImportTab
          readonlyView={readonlyView}
          state={ready.state}
          metrics={metrics}
          session={{
            uploadTrips: session.uploadTrips,
            uploadRoutes: session.uploadRoutes,
            previewImport: session.previewImport,
            validateImport: session.validateImport,
            applyImport: session.applyImport,
            listTemplates: session.listTemplates,
            createTemplate: session.createTemplate,
            deleteTemplate: session.deleteTemplate,
          }}
          setStatus={setStatus}
          setError={setError}
          onLoadDemo={onLoadDemo}
          onOtpWindowChange={onOtpWindowChange}
          depots={ready.state.depots}
          onDepotsChange={onDepotsChange}
        />
      )}
      {tab === 'demand' && <DemandTab metrics={metrics} intervalMinutes={intervalMinutes} />}
      {tab === 'performance' && (
        <PerformanceTab
          metrics={metrics}
          intervalMinutes={intervalMinutes}
          routes={filteredRoutes}
          trips={ready?.state.trips ?? []}
          sessionState={ready?.state ?? null}
          metricsOptions={{
            ...metricsOptions,
            timeRangeStart: rangeStartClock,
            timeRangeEnd: rangeEndClock,
            blockSizeMinutes: intervalMinutes,
          }}
        />
      )}
      {hasVisitedMap && (
        <div style={{ display: tab === 'map' ? undefined : 'none' }}>
          <MapTab metrics={metrics} trips={ready?.state.trips ?? []} selectedDays={selectedDayIds} specificDate={dayMode === 'specific' ? specificDate : null} />
        </div>
      )}
      {tab === 'runstructure' && (
        <RunStructureTab
          metrics={metrics}
          fullDayMetrics={fullDayMetrics!}
          optimization={ready.state.optimization}
          routes={ready.state.routes}
          runs={ready.state.runs}
          selectedDays={selectedDayIds}
          readonlyView={readonlyView}
          intervalMinutes={intervalMinutes}
          onOptimizationChange={onOptimizationChange}
          onRunsChange={onRunsChange}
          depots={ready.state.depots}
          filteredRoutes={filteredRoutes}
        />
      )}
      {tab === 'deadhead' && <DeadheadTab metrics={metrics} />}
    </main>
  );
}
