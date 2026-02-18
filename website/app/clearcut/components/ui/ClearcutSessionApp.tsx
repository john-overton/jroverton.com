'use client';

import Link from 'next/link';
import { Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dropdown } from 'react-bootstrap';

import { ClearcutClientError } from '@/lib/clearcut/client';
import { buildDemoTripsAndRoutes } from '@/lib/clearcut/demo-data';
import { computeClearcutMetrics } from '@/lib/clearcut/metrics';
import { useClearcutSession, type ClearcutMode } from '@/lib/clearcut/use-clearcut-session';

import DeadheadTab from './DeadheadTab';
import DemandTab from './DemandTab';
import ImportTab from './ImportTab';
import MapTab from './MapTab';
import OptimizeTab from './OptimizeTab';
import PerformanceTab from './PerformanceTab';
import RunsTab from './RunsTab';
import {
  CLEARCUT_FONT_STACK,
  DEMAND_BLOCK_MINUTES,
  PasswordPrompt,
  deriveSliderBoundsFromTrips,
  formatMinutesToClock,
  formatMinutesToLabel,
  parseClockToMinutes,
} from './shared';

type TabKey = 'import' | 'demand' | 'performance' | 'map' | 'runs' | 'optimize' | 'deadhead';

const TAB_ITEMS: Array<{ key: TabKey; label: string }> = [
  { key: 'import', label: 'Import' },
  { key: 'demand', label: 'Demand' },
  { key: 'performance', label: 'Performance' },
  { key: 'map', label: 'Trip Map' },
  { key: 'runs', label: 'Run Structure' },
  { key: 'optimize', label: 'Optimize' },
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
  const filterStateInitialized = useRef(false);
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

  const readonlyView = mode === 'readonly';

  const ready = session.loadState.status === 'ready' ? session.loadState : null;
  const fallbackServiceStartMinutes = parseClockToMinutes(ready?.state.settings.service_day_start, 4 * 60);
  const fallbackServiceEndMinutes = parseClockToMinutes(ready?.state.settings.service_day_end, 21 * 60);
  const sliderBounds = useMemo(
    () =>
      deriveSliderBoundsFromTrips({
        trips: ready?.state.trips ?? [],
        fallbackStartMinutes: fallbackServiceStartMinutes,
        fallbackEndMinutes: fallbackServiceEndMinutes,
      }),
    [fallbackServiceEndMinutes, fallbackServiceStartMinutes, ready?.state.trips],
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
  const metrics = useMemo(
    () =>
      ready
        ? computeClearcutMetrics(ready.state, {
            selectedDays: selectedDayIds,
            timeRangeStart: rangeStartClock,
            timeRangeEnd: rangeEndClock,
            blockSizeMinutes: intervalMinutes,
          })
        : null,
    [rangeEndClock, rangeStartClock, ready, selectedDayIds, intervalMinutes],
  );
  const hasData = ready ? ready.state.session.trip_count > 0 || ready.state.session.route_count > 0 : false;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

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
    if (!ready || readonlyView || !filterStateInitialized.current || allTimeBlocks.length === 0) {
      return;
    }
    const timer = window.setTimeout(() => {
      const dayType =
        selectedWeekdayDays.length > 0 && selectedWeekendDays.length === 0
          ? 'weekday'
          : selectedWeekendDays.length > 0 && selectedWeekdayDays.length === 0
            ? 'weekend'
            : 'custom';
      const currentSettings = ready.state.settings;
      if (
        currentSettings.day_type === dayType &&
        (currentSettings.time_range_start ?? null) === (rangeStartClock ?? null) &&
        (currentSettings.time_range_end ?? null) === (rangeEndClock ?? null)
      ) {
        return;
      }
      const nextSettings = {
        ...currentSettings,
        day_type: dayType,
        time_range_start: rangeStartClock,
        time_range_end: rangeEndClock,
      };
      session.saveState({ settings: nextSettings }).catch((saveError) => {
        setError(saveError instanceof Error ? saveError.message : 'Failed to persist demand filters.');
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    allTimeBlocks.length,
    rangeEndClock,
    rangeStartClock,
    ready,
    readonlyView,
    selectedWeekdayDays,
    selectedWeekendDays,
    session,
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
    key:
      | 'pickup_otp_window_before_min'
      | 'pickup_otp_window_after_min'
      | 'dropoff_otp_window_before_min'
      | 'dropoff_otp_window_after_min',
    value: number,
  ) {
    if (!ready || readonlyView) {
      return;
    }
    const sanitizedValue = Math.max(0, Math.min(180, Number.isFinite(value) ? value : 0));
    const nextSettings = {
      ...ready.state.settings,
      [key]: sanitizedValue,
    };
    session
      .saveState({ settings: nextSettings })
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

  if (session.loadState.status === 'loading') {
    return (
      <main
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '4rem 1.25rem 2rem',
          fontFamily: CLEARCUT_FONT_STACK,
        }}
      >
        <p>Loading session...</p>
      </main>
    );
  }

  if (session.loadState.status === 'not_found') {
    return (
      <main
        style={{
          maxWidth: 900,
          margin: '0 auto',
          padding: '4rem 1.25rem 2rem',
          fontFamily: CLEARCUT_FONT_STACK,
        }}
      >
        <h1>Session Not Found</h1>
        <p style={{ color: '#4b5563' }}>
          The session token is invalid or no longer exists.
        </p>
        <Link href="/clearcut">Create a new session</Link>
      </main>
    );
  }

  if (session.loadState.status === 'password_required') {
    return (
      <main
        style={{
          maxWidth: 560,
          margin: '0 auto',
          padding: '4rem 1.25rem 2rem',
          fontFamily: CLEARCUT_FONT_STACK,
        }}
      >
        <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>{session.loadState.name}</h1>
        <p style={{ color: '#4b5563', marginBottom: '1rem' }}>This edit session is password protected.</p>
        <PasswordPrompt onSubmit={onUnlock} />
        {session.loadState.retryAfterSeconds && (
          <p style={{ color: '#b45309', marginTop: '0.75rem' }}>
            Try again in {session.loadState.retryAfterSeconds} seconds.
          </p>
        )}
        {error && <p style={{ color: '#b91c1c', marginTop: '0.75rem' }}>{error}</p>}
      </main>
    );
  }

  if (session.loadState.status === 'error') {
    return (
      <main
        style={{
          maxWidth: 900,
          margin: '0 auto',
          padding: '4rem 1.25rem 2rem',
          fontFamily: CLEARCUT_FONT_STACK,
        }}
      >
        <h1>Unable to load session</h1>
        <p style={{ color: '#b91c1c' }}>{session.loadState.message}</p>
        <button className="btn btn-outline-secondary" onClick={() => session.loadSession()} type="button">
          Retry
        </button>
      </main>
    );
  }

  if (!ready || !metrics) {
    return null;
  }

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '3rem 1.25rem 2rem',
        fontFamily: CLEARCUT_FONT_STACK,
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'start' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.35rem' }}>{ready.state.session.name}</h1>
          <div style={{ color: '#4b5563', fontSize: 14 }}>
            Run Cutting &amp; Optimization Tool {readonlyView ? '• Read-only Mode' : ''}
          </div>
          <div style={{ color: '#4b5563', fontSize: 13, marginTop: 6 }}>
            Data loaded: {ready.state.session.trip_count} trips, {ready.state.session.route_count} routes
          </div>
          {!readonlyView && origin && (
            <div style={{ marginTop: 8, fontSize: 13 }}>
              Share link: <code>{`${origin}/clearcut/r/${ready.state.session.readonly_token}`}</code>{' '}
              <button
                className="btn btn-sm btn-outline-secondary"
                style={{ marginLeft: 8 }}
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(`${origin}/clearcut/r/${ready.state.session.readonly_token}`);
                  setStatus('Read-only link copied.');
                }}
              >
                Copy
              </button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'end', alignItems: 'center' }}>
          {!readonlyView && (
            <Dropdown>
              <Dropdown.Toggle
                variant="outline-secondary"
                id="session-options-dropdown"
                style={{ padding: '0.375rem 0.5rem' }}
                title="Session options"
                aria-label="Session options"
              >
                <Settings size={18} strokeWidth={2} aria-hidden />
              </Dropdown.Toggle>
              <Dropdown.Menu align="end">
                <Dropdown.Item onClick={onRename}>Rename</Dropdown.Item>
                <Dropdown.Item onClick={onSetPassword}>Set Password</Dropdown.Item>
                <Dropdown.Item onClick={onRemovePassword}>Remove Password</Dropdown.Item>
                {ready?.hasJwt && <Dropdown.Item onClick={onLogout}>Logout</Dropdown.Item>}
                <Dropdown.Divider />
                <Dropdown.Item onClick={onClone}>Save As New</Dropdown.Item>
                <Dropdown.Item onClick={onDelete} className="text-danger">
                  Delete
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          )}
          {!readonlyView && (
            <button className="btn btn-primary" disabled={saving} onClick={onSave} type="button">
              {saving ? 'Saving...' : 'Save Run Cut'}
            </button>
          )}
        </div>
      </header>

      {hasData && allTimeBlocks.length > 0 && (
        <section
          style={{
            marginTop: '0.8rem',
            marginBottom: '0.4rem',
            border: '1px solid #dee5f0',
            borderRadius: 10,
            background: '#fff',
            padding: '0.75rem',
          }}
        >
          <button
            type="button"
            onClick={() => setFiltersOpen((prev) => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              color: '#374151',
              marginBottom: filtersOpen ? '0.5rem' : 0,
              width: '100%',
            }}
          >
            <span style={{ transform: filtersOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', display: 'inline-block' }}>&#9654;</span>
            Filters
          </button>
          <div className="row g-3" style={{ display: filtersOpen ? undefined : 'none' }}>
            <div className="col-lg-6">
              <div className="d-flex flex-wrap align-items-center gap-3 mb-2">
                <div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Interval</div>
                  <div className="d-flex gap-1">
                    {([15, 30, 60] as const).map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        className={`btn btn-sm ${intervalMinutes === mins ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setIntervalMinutes(mins)}
                      >
                        {mins}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mb-2">
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Weekday</div>
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <button
                    className={`btn btn-sm ${selectedWeekdayDays.length === WEEKDAY_DAY_IDS.length ? 'btn-primary' : 'btn-outline-secondary'}`}
                    type="button"
                    onClick={() =>
                      setSelectedWeekdayDays((prev) =>
                        prev.length === WEEKDAY_DAY_IDS.length ? [] : [...WEEKDAY_DAY_IDS],
                      )
                    }
                  >
                    Weekday
                  </button>
                  {WEEKDAY_DAY_IDS.map((day) => (
                    <button
                      key={`weekday-pill-${day}`}
                      type="button"
                      className={`btn btn-sm ${selectedWeekdayDays.includes(day) ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => toggleWeekday(day)}
                    >
                      {DAY_LABELS[day]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Weekend</div>
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <button
                    className={`btn btn-sm ${selectedWeekendDays.length === WEEKEND_DAY_IDS.length ? 'btn-primary' : 'btn-outline-secondary'}`}
                    type="button"
                    onClick={() =>
                      setSelectedWeekendDays((prev) =>
                        prev.length === WEEKEND_DAY_IDS.length ? [] : [...WEEKEND_DAY_IDS],
                      )
                    }
                  >
                    Weekend
                  </button>
                  {WEEKEND_DAY_IDS.map((day) => (
                    <button
                      key={`weekend-pill-${day}`}
                      type="button"
                      className={`btn btn-sm ${selectedWeekendDays.includes(day) ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => toggleWeekend(day)}
                    >
                      {DAY_LABELS[day]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="col-lg-6">
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Service Hour Time Selector</div>
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
                    background: '#e5e7eb',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    height: 4,
                    transform: 'translateY(-50%)',
                    borderRadius: 4,
                    background: '#2563eb',
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
                    background: '#2563eb',
                    border: '2px solid #fff',
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
                    background: '#2563eb',
                    border: '2px solid #fff',
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
              <div className="d-flex justify-content-between" style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>
                <span>Start: {allTimeBlocks[timeStartIndex]?.label ?? '--'}</span>
                <span>End: {allTimeBlocks[timeEndIndex]?.label ?? '--'}</span>
              </div>
              <div style={{ fontSize: 12, color: '#2563eb' }}>
                {allTimeBlocks[timeStartIndex]?.label} - {allTimeBlocks[timeEndIndex]?.label}
                {' • '}
                {selectedDayIds.length > 0 ? `${selectedDayIds.length} day(s) selected` : 'No days selected'}
              </div>
            </div>
          </div>
        </section>
      )}

      <div style={{ marginTop: '0.9rem', marginBottom: '0.5rem' }}>
        <ul className="nav nav-tabs">
          {TAB_ITEMS.map((item) => {
            if (item.key === 'import' && readonlyView) return null;
            const disabled = item.key !== 'import' && !hasData;
            return (
              <li className="nav-item" key={item.key}>
                <button
                  type="button"
                  className={`nav-link ${tab === item.key ? 'active' : ''}`}
                  disabled={disabled}
                  onClick={() => {
                    setTab(item.key);
                    if (item.key === 'map') setHasVisitedMap(true);
                  }}
                >
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {status && <p style={{ color: '#065f46', marginBottom: '0.5rem' }}>{status}</p>}
      {error && <p style={{ color: '#b91c1c', marginBottom: '0.5rem' }}>{error}</p>}

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
        />
      )}
      {tab === 'demand' && <DemandTab metrics={metrics} intervalMinutes={intervalMinutes} />}
      {tab === 'performance' && (
        <PerformanceTab metrics={metrics} intervalMinutes={intervalMinutes} />
      )}
      {hasVisitedMap && (
        <div style={{ display: tab === 'map' ? undefined : 'none' }}>
          <MapTab metrics={metrics} trips={ready?.state.trips ?? []} selectedDays={selectedDayIds} />
        </div>
      )}
      {tab === 'runs' && <RunsTab metrics={metrics} />}
      {tab === 'optimize' && (
        <OptimizeTab
          metrics={metrics}
          optimization={ready.state.optimization}
          readonlyView={readonlyView}
          onOptimizationChange={onOptimizationChange}
        />
      )}
      {tab === 'deadhead' && <DeadheadTab metrics={metrics} />}
    </main>
  );
}
