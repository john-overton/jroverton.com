'use client';

import Link from 'next/link';
import { Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dropdown } from 'react-bootstrap';
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import ImportMapperWizard from '@/app/clearcut/components/ui/ImportMapperWizard';
import { ClearcutClientError } from '@/lib/clearcut/client';
import { buildDemoTripsAndRoutes } from '@/lib/clearcut/demo-data';
import { computeClearcutMetrics } from '@/lib/clearcut/metrics';
import type { RouteRow, TripRow } from '@/lib/clearcut/types';
import { useClearcutSession, type ClearcutMode } from '@/lib/clearcut/use-clearcut-session';

type TabKey = 'import' | 'demand' | 'performance' | 'map' | 'runs' | 'optimize' | 'deadhead';
type ImportViewMode = 'main' | 'wizard' | 'flat';
type TripDataColumnKey =
  | 'trip_id'
  | 'route_id'
  | 'pickup_time'
  | 'dropoff_time'
  | 'status'
  | 'passenger_type';
type RouteDataColumnKey =
  | 'route_id'
  | 'route_name'
  | 'scheduled_start_time'
  | 'scheduled_end_time'
  | 'actual_start_time'
  | 'actual_end_time'
  | 'break1'
  | 'break2';

const TAB_ITEMS: Array<{ key: TabKey; label: string }> = [
  { key: 'import', label: 'Import' },
  { key: 'demand', label: 'Demand' },
  { key: 'performance', label: 'Performance' },
  { key: 'map', label: 'Trip Map' },
  { key: 'runs', label: 'Run Structure' },
  { key: 'optimize', label: 'Optimize' },
  { key: 'deadhead', label: 'Deadhead' },
];
const CLEARCUT_FONT_STACK =
  '"Inter", "SF Pro Text", "Segoe UI", "Helvetica Neue", Arial, system-ui, sans-serif';
const TRIP_DATA_PAGE_SIZE = 10;
const ROUTE_DATA_PAGE_SIZE = 10;
const DEMAND_BLOCK_MINUTES = 15;
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
const TRIP_DATA_COLUMNS: Array<{
  key: TripDataColumnKey;
  label: string;
  getValue: (trip: TripRow) => string | null;
}> = [
  { key: 'trip_id', label: 'Trip', getValue: (trip) => trip.trip_id },
  { key: 'route_id', label: 'Route', getValue: (trip) => trip.route_id },
  {
    key: 'pickup_time',
    label: 'Pickup',
    getValue: (trip) => trip.pickup_arrive_time ?? trip.scheduled_pickup_time,
  },
  {
    key: 'dropoff_time',
    label: 'Dropoff',
    getValue: (trip) => trip.dropoff_leave_time ?? trip.scheduled_appointment_time,
  },
  { key: 'status', label: 'Status', getValue: (trip) => trip.status },
  { key: 'passenger_type', label: 'Passenger Type', getValue: (trip) => trip.passenger_type },
];
const ROUTE_DATA_COLUMNS: Array<{
  key: RouteDataColumnKey;
  label: string;
  getValue: (route: RouteRow) => string | null;
}> = [
  { key: 'route_id', label: 'Route', getValue: (route) => route.route_id },
  { key: 'route_name', label: 'Route Name', getValue: (route) => route.route_name ?? '-' },
  {
    key: 'scheduled_start_time',
    label: 'Scheduled Start',
    getValue: (route) => route.scheduled_start_time,
  },
  {
    key: 'scheduled_end_time',
    label: 'Scheduled End',
    getValue: (route) => route.scheduled_end_time,
  },
  { key: 'actual_start_time', label: 'Actual Start', getValue: (route) => route.actual_start_time ?? '-' },
  { key: 'actual_end_time', label: 'Actual End', getValue: (route) => route.actual_end_time ?? '-' },
  { key: 'break1', label: 'Break 1', getValue: (route) => route.break1 ?? '-' },
  { key: 'break2', label: 'Break 2', getValue: (route) => route.break2 ?? '-' },
];

function parseClockToMinutes(value: string | null | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const [hoursRaw, minutesRaw] = value.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return fallback;
  }
  return hours * 60 + minutes;
}

function formatMinutesToClock(minutes: number): string {
  const safe = Math.max(0, minutes);
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return `${`${hours}`.padStart(2, '0')}:${`${mins}`.padStart(2, '0')}`;
}

function formatMinutesToLabel(minutes: number): string {
  const hours24 = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${`${mins}`.padStart(2, '0')} ${period}`;
}

function parseDateTime(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function deriveSliderBoundsFromTrips(params: {
  trips: TripRow[];
  fallbackStartMinutes: number;
  fallbackEndMinutes: number;
}): { startMinutes: number; endMinutes: number } {
  let earliest: Date | null = null;
  let latest: Date | null = null;

  for (const trip of params.trips) {
    const pickup =
      parseDateTime(trip.pickup_arrive_time) ??
      parseDateTime(trip.pickup_leave_time) ??
      parseDateTime(trip.scheduled_pickup_time);
    const dropoff =
      parseDateTime(trip.dropoff_leave_time) ??
      parseDateTime(trip.dropoff_arrive_time) ??
      parseDateTime(trip.scheduled_appointment_time);
    if (pickup && (!earliest || pickup.getTime() < earliest.getTime())) {
      earliest = pickup;
    }
    if (dropoff && (!latest || dropoff.getTime() > latest.getTime())) {
      latest = dropoff;
    }
  }

  if (!earliest || !latest) {
    return {
      startMinutes: params.fallbackStartMinutes,
      endMinutes: params.fallbackEndMinutes,
    };
  }

  if (earliest.toDateString() !== latest.toDateString()) {
    return {
      startMinutes: 0,
      endMinutes: 24 * 60,
    };
  }

  const earliestMinutes = earliest.getHours() * 60 + earliest.getMinutes();
  const latestMinutes = latest.getHours() * 60 + latest.getMinutes();
  const derivedStart = Math.max(0, earliestMinutes - 60);
  const derivedEnd = Math.min(24 * 60, Math.max(derivedStart + 60, latestMinutes + 60));
  return { startMinutes: derivedStart, endMinutes: derivedEnd };
}

interface Props {
  token: string;
  mode: ClearcutMode;
}

function MetricCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="col-md-3 col-sm-6 mb-3">
      <div style={{ border: '1px solid #dee5f0', borderRadius: 10, padding: '0.75rem', background: '#fff' }}>
        <div style={{ color: '#6b7280', fontSize: 13 }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: color ?? '#1f2937' }}>{value}</div>
        {sub && <div style={{ color: '#6b7280', fontSize: 12 }}>{sub}</div>}
      </div>
    </div>
  );
}

function MiniBars({ values, max }: { values: number[]; max?: number }) {
  const resolvedMax = max ?? Math.max(...values, 1);
  const data = values.map((value, index) => ({
    idx: index,
    value: Math.round(value * 100) / 100,
  }));
  return (
    <div style={{ height: 100 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 2 }}>
          <XAxis dataKey="idx" hide />
          <YAxis hide domain={[0, resolvedMax]} />
          <Tooltip
            formatter={(value: number | string | undefined) => [Number(value ?? 0), 'Value']}
            labelFormatter={(label) => `Block ${Number(label) + 1}`}
            contentStyle={{ borderRadius: 8, borderColor: '#dbe3ef' }}
          />
          <Bar dataKey="value" fill="#4f46e5" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function HeatStrip({ values, blocks }: { values: number[]; blocks?: Array<{ label: string }> }) {
  const max = Math.max(...values, 1);
  const data = values.map((value, index) => ({
    idx: index,
    value: Math.round(value * 10) / 10,
    unit: 1,
    label: blocks?.[index]?.label ?? `Block ${index + 1}`,
  }));
  return (
    <div style={{ height: 42, borderRadius: 6, overflow: 'hidden', border: '1px solid #dbe3ef' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barCategoryGap={0}>
          <XAxis dataKey="idx" hide />
          <YAxis hide domain={[0, 1]} />
          <Tooltip
            formatter={(_value: number | string | undefined, _name, item) => {
              const payload = item?.payload as { value?: number; label?: string } | undefined;
              return [`${payload?.value ?? 0}%`, 'Empty-time'];
            }}
            labelFormatter={(_label, payload) => {
              const first = payload?.[0]?.payload as { label?: string } | undefined;
              return first?.label ?? '';
            }}
            contentStyle={{ borderRadius: 8, borderColor: '#dbe3ef' }}
          />
          <Bar dataKey="unit" isAnimationActive={false}>
            {data.map((entry, index) => {
              const ratio = max > 0 ? entry.value / max : 0;
              const intensity = Math.round(220 - ratio * 140);
              const color = entry.value <= 0 ? '#eef2f7' : `rgb(${intensity}, ${intensity + 8}, 255)`;
              return <Cell key={`heat-cell-${index}`} fill={color} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DemandCompositeChart({
  pickups,
  onBoard,
  vehicles,
  blocks,
}: {
  pickups: number[];
  onBoard: number[];
  vehicles: number[];
  blocks: Array<{ label: string }>;
}) {
  const data = useMemo(
    () =>
      blocks.map((block, index) => ({
        label: block.label,
        pickups: Math.round((pickups[index] ?? 0) * 10) / 10,
        onBoard: Math.round((onBoard[index] ?? 0) * 10) / 10,
        vehicles: Math.round((vehicles[index] ?? 0) * 10) / 10,
      })),
    [blocks, onBoard, pickups, vehicles],
  );

  return (
    <div style={{ height: 230 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="label" hide />
          <YAxis allowDecimals={false} width={38} />
          <Tooltip
            formatter={(value: number | string | undefined, name: string | undefined) => {
              const normalizedValue = typeof value === 'number' ? value : Number(value ?? 0);
              if (name === 'vehicles') return [normalizedValue, 'Routes On Road'];
              if (name === 'onBoard') return [normalizedValue, 'On Board'];
              return [normalizedValue, 'Pickups'];
            }}
            labelFormatter={(label) => `Time: ${label}`}
            contentStyle={{ borderRadius: 8, borderColor: '#dbe3ef' }}
          />
          <Bar dataKey="onBoard" fill="rgba(99, 102, 241, 0.25)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="pickups" fill="#4f46e5" radius={[3, 3, 0, 0]} />
          <Line
            type="monotone"
            dataKey="vehicles"
            stroke="#0d9488"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            name="vehicles"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ border: '1px solid #dee5f0', borderRadius: 10, background: '#fff', padding: '0.9rem', marginBottom: '0.9rem' }}>
      <h3 style={{ fontSize: 17, marginBottom: '0.75rem' }}>{title}</h3>
      {children}
    </section>
  );
}

export default function ClearcutSessionApp({ token, mode }: Props) {
  const router = useRouter();
  const session = useClearcutSession(token, mode);
  const filterStateInitialized = useRef(false);
  const timeRangeTrackRef = useRef<HTMLDivElement | null>(null);
  const [tab, setTab] = useState<TabKey>('import');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mapBlockIdx, setMapBlockIdx] = useState(0);
  const [importViewMode, setImportViewMode] = useState<ImportViewMode>('main');
  const [wizardKey, setWizardKey] = useState(0);
  const [tripPage, setTripPage] = useState(1);
  const [routePage, setRoutePage] = useState(1);
  const [flatImportLog, setFlatImportLog] = useState<{
    trips: Array<{ row: number; reason: string }>;
    routes: Array<{ row: number; reason: string }>;
  } | null>(null);
  const [showFlatImportLog, setShowFlatImportLog] = useState(false);
  const [tripVisibleColumns, setTripVisibleColumns] = useState<Record<TripDataColumnKey, boolean>>({
    trip_id: true,
    route_id: true,
    pickup_time: true,
    dropoff_time: true,
    status: true,
    passenger_type: true,
  });
  const [routeVisibleColumns, setRouteVisibleColumns] = useState<Record<RouteDataColumnKey, boolean>>({
    route_id: true,
    route_name: true,
    scheduled_start_time: true,
    scheduled_end_time: true,
    actual_start_time: true,
    actual_end_time: true,
    break1: true,
    break2: true,
  });
  const [selectedWeekdayDays, setSelectedWeekdayDays] = useState<number[]>([]);
  const [selectedWeekendDays, setSelectedWeekendDays] = useState<number[]>([]);
  const [timeStartIndex, setTimeStartIndex] = useState(0);
  const [timeEndIndex, setTimeEndIndex] = useState(0);
  const [draggingTimeHandle, setDraggingTimeHandle] = useState<'start' | 'end' | null>(null);

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
          })
        : null,
    [rangeEndClock, rangeStartClock, ready, selectedDayIds],
  );
  const activeTripColumns = TRIP_DATA_COLUMNS.filter((column) => tripVisibleColumns[column.key]);
  const activeRouteColumns = ROUTE_DATA_COLUMNS.filter((column) => routeVisibleColumns[column.key]);
  const tripCount = ready?.state.trips.length ?? 0;
  const routeCount = ready?.state.routes.length ?? 0;
  const tripTotalPages = Math.max(1, Math.ceil(tripCount / TRIP_DATA_PAGE_SIZE));
  const routeTotalPages = Math.max(1, Math.ceil(routeCount / ROUTE_DATA_PAGE_SIZE));
  const currentTripPage = Math.min(tripPage, tripTotalPages);
  const currentRoutePage = Math.min(routePage, routeTotalPages);
  const tripRows = ready?.state.trips ?? [];
  const routeRows = ready?.state.routes ?? [];
  const tripPageRows = tripRows.slice(
    (currentTripPage - 1) * TRIP_DATA_PAGE_SIZE,
    currentTripPage * TRIP_DATA_PAGE_SIZE,
  );
  const routePageRows = routeRows.slice(
    (currentRoutePage - 1) * ROUTE_DATA_PAGE_SIZE,
    currentRoutePage * ROUTE_DATA_PAGE_SIZE,
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

  function downloadSampleCsv(kind: 'trips' | 'routes') {
    const tripSample = [
      'trip_id,trip_date,scheduled_pickup_time,scheduled_appointment_time,pickup_arrive_time,pickup_leave_time,dropoff_arrive_time,dropoff_leave_time,route_id,pickup_address,pickup_lat,pickup_lon,dropoff_address,dropoff_lat,dropoff_lon,status,passenger_type,passenger_count,pick_odometer,drop_odometer',
      'TRIP-001,2026-02-01,2026-02-01 08:00:00,2026-02-01 08:30:00,2026-02-01 07:58:00,2026-02-01 08:02:00,2026-02-01 08:27:00,2026-02-01 08:31:00,ROUTE-001,123 Main St,,,456 Oak St,,,completed,ambulatory,1,1000,1010',
    ].join('\n');
    const routeSample = [
      'route_id,route_date,route_name,scheduled_start_time,scheduled_end_time,actual_start_time,actual_end_time,break1,break2',
      'ROUTE-001,2026-02-01,North Loop,2026-02-01 07:30:00,2026-02-01 17:00:00,2026-02-01 07:35:00,2026-02-01 16:55:00,2026-02-01 11:00:00,2026-02-01 14:00:00',
    ].join('\n');

    const content = kind === 'trips' ? tripSample : routeSample;
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = kind === 'trips' ? 'clearcut-flat-trip-sample.csv' : 'clearcut-flat-route-sample.csv';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
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
          <button className="btn btn-primary" disabled={readonlyView || saving} onClick={onSave} type="button">
            {saving ? 'Saving...' : 'Save Run Cut'}
          </button>
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
          <div className="row g-3 align-items-center">
            <div className="col-lg-4">
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Weekday</div>
              <div className="d-flex flex-wrap align-items-center gap-2">
                <button
                  className={`btn btn-sm ${selectedWeekdayDays.length === WEEKDAY_DAY_IDS.length ? 'btn-primary' : 'btn-outline-secondary'}`}
                  type="button"
                  disabled={readonlyView}
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
                    disabled={readonlyView}
                    onClick={() => toggleWeekday(day)}
                  >
                    {DAY_LABELS[day]}
                  </button>
                ))}
              </div>
            </div>
            <div className="col-lg-3">
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Weekend</div>
              <div className="d-flex flex-wrap align-items-center gap-2">
                <button
                  className={`btn btn-sm ${selectedWeekendDays.length === WEEKEND_DAY_IDS.length ? 'btn-primary' : 'btn-outline-secondary'}`}
                  type="button"
                  disabled={readonlyView}
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
                    disabled={readonlyView}
                    onClick={() => toggleWeekend(day)}
                  >
                    {DAY_LABELS[day]}
                  </button>
                ))}
              </div>
            </div>
            <div className="col-lg-5">
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Service Hour Time Selector</div>
              <div
                ref={timeRangeTrackRef}
                style={{ position: 'relative', height: 30 }}
                onMouseDown={(event) => {
                  if (readonlyView || allTimeBlocks.length <= 1) {
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
                    pointerEvents: readonlyView ? 'none' : 'auto',
                    cursor: readonlyView ? 'default' : 'ew-resize',
                    zIndex: 4,
                  }}
                  onMouseDown={(event) => {
                    event.stopPropagation();
                    if (readonlyView) {
                      return;
                    }
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
                    pointerEvents: readonlyView ? 'none' : 'auto',
                    cursor: readonlyView ? 'default' : 'ew-resize',
                    zIndex: 4,
                  }}
                  onMouseDown={(event) => {
                    event.stopPropagation();
                    if (readonlyView) {
                      return;
                    }
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
            const disabled = item.key !== 'import' && !hasData;
            return (
              <li className="nav-item" key={item.key}>
                <button
                  type="button"
                  className={`nav-link ${tab === item.key ? 'active' : ''}`}
                  disabled={disabled}
                  onClick={() => setTab(item.key)}
                >
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {status && <p style={{ color: '#065f46', marginBottom: '0.5rem' }}>{status}</p>}
      {flatImportLog && (flatImportLog.trips.length > 0 || flatImportLog.routes.length > 0) && (
        <p style={{ marginTop: '-0.35rem', marginBottom: '0.75rem', fontSize: 13 }}>
          Some rows were skipped during flat file import.{' '}
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setShowFlatImportLog(true)}
          >
            View skipped row log
          </button>
        </p>
      )}
      {error && <p style={{ color: '#b91c1c', marginBottom: '0.5rem' }}>{error}</p>}

      {tab === 'import' && (
        <>
          <SectionCard title="Data Import">
            {importViewMode === 'main' && (
              <div className="row g-3">
                <div className="col-md-6">
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '0.9rem' }}>
                    <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
                      Event-based import with templates and field mapping.
                    </div>
                    <button
                      className="btn btn-outline-primary w-100"
                      type="button"
                      onClick={() => setImportViewMode('wizard')}
                    >
                      Trip Import Wizard
                    </button>
                  </div>
                </div>
                <div className="col-md-6">
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '0.9rem' }}>
                    <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
                      Direct trip/route file upload with CSV samples.
                    </div>
                    <button
                      className="btn btn-outline-secondary w-100"
                      type="button"
                      onClick={() => setImportViewMode('flat')}
                    >
                      Flat File Import
                    </button>
                  </div>
                </div>
              </div>
            )}

            {importViewMode === 'wizard' && (
              <div className="mt-2">
                <button
                  className="btn btn-sm btn-outline-secondary mb-3"
                  type="button"
                  onClick={() => {
                    setImportViewMode('main');
                    setWizardKey((prev) => prev + 1);
                    setStatus(null);
                    setError(null);
                  }}
                >
                  Back to Import Options
                </button>
                <ImportMapperWizard
                  key={`import-wizard-${wizardKey}`}
                  readonlyView={readonlyView}
                  onPreview={session.previewImport}
                  onValidate={session.validateImport}
                  onApply={session.applyImport}
                  onListTemplates={session.listTemplates}
                  onCreateTemplate={session.createTemplate}
                  onDeleteTemplate={session.deleteTemplate}
                />
              </div>
            )}

            {importViewMode === 'flat' && (
              <FlatFileImport
                readonlyView={readonlyView}
                onBack={() => {
                  setImportViewMode('main');
                  setStatus(null);
                  setError(null);
                }}
                onDownloadSample={downloadSampleCsv}
                onImport={async (tripFile, routeFile) => {
                  if (readonlyView) return;
                  setStatus('Importing routes and trips...');
                  setError(null);
                  setFlatImportLog(null);
                  try {
                    const skippedMessages: string[] = [];
                    let routeSkipped: Array<{ row: number; reason: string }> = [];
                    let tripSkipped: Array<{ row: number; reason: string }> = [];
                    if (routeFile) {
                      const routeResult = await session.uploadRoutes(routeFile);
                      if (routeResult?.skipped_rows?.length) {
                        skippedMessages.push(`${routeResult.skipped_rows.length} route row(s) skipped.`);
                        routeSkipped = routeResult.skipped_rows;
                      }
                    }
                    if (tripFile) {
                      const tripResult = await session.uploadTrips(tripFile);
                      if (tripResult?.skipped_rows?.length) {
                        skippedMessages.push(`${tripResult.skipped_rows.length} trip row(s) skipped.`);
                        tripSkipped = tripResult.skipped_rows;
                      }
                    }
                    if (routeSkipped.length > 0 || tripSkipped.length > 0) {
                      setFlatImportLog({ routes: routeSkipped, trips: tripSkipped });
                    }
                    const statusParts = ['Import complete.'];
                    if (skippedMessages.length > 0) {
                      statusParts.push(skippedMessages.join(' '));
                    }
                    setStatus(statusParts.join(' '));
                  } catch (uploadError) {
                    setStatus(null);
                    setError(uploadError instanceof Error ? uploadError.message : 'Import failed.');
                  }
                }}
              />
            )}
            {!readonlyView && (
              <button className="btn btn-outline-primary mt-3" onClick={onLoadDemo} type="button">
                Load Demo Dataset
              </button>
            )}
          </SectionCard>

          <SectionCard title="System Settings">
            <div className="row g-3">
              <div className="col-md-4">
                <div style={{ fontSize: 13, color: '#6b7280' }}>Derived Service Start</div>
                <div style={{ fontWeight: 600 }}>{metrics.derivedServiceWindow.startLabel}</div>
              </div>
              <div className="col-md-4">
                <div style={{ fontSize: 13, color: '#6b7280' }}>Derived Service End</div>
                <div style={{ fontWeight: 600 }}>{metrics.derivedServiceWindow.endLabel}</div>
              </div>
              <div className="col-md-4">
                <div style={{ fontSize: 13, color: '#6b7280' }}>Service Hours</div>
                <div style={{ fontWeight: 600 }}>
                  {metrics.derivedServiceWindow.isTwentyFourHours
                    ? '24:00'
                    : metrics.derivedServiceWindow.durationLabel}
                </div>
              </div>
              <div className="col-md-6">
                <div style={{ fontSize: 13, color: '#6b7280' }}>Earliest Data Time</div>
                <div style={{ fontWeight: 600 }}>
                  {metrics.derivedServiceWindow.earliestDataTime ?? 'No trip data'}
                </div>
              </div>
              <div className="col-md-6">
                <div style={{ fontSize: 13, color: '#6b7280' }}>Latest Data Time</div>
                <div style={{ fontWeight: 600 }}>
                  {metrics.derivedServiceWindow.latestDataTime ?? 'No trip data'}
                </div>
              </div>
              <div className="col-12">
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  Service window is auto-derived from imported data (actual times preferred, fallback to scheduled), with a 1-hour buffer before first pickup and after last dropoff.
                </div>
              </div>
              <div className="col-12">
                <hr style={{ margin: '0.5rem 0' }} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Pickup OTP: minutes before</label>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: '-2px', marginBottom: 6 }}>
                  Minutes before scheduled pickup that is on time.
                </div>
                <input
                  className="form-control"
                  type="number"
                  min={0}
                  max={180}
                  step={1}
                  disabled={readonlyView}
                  value={ready.state.settings.pickup_otp_window_before_min}
                  onChange={(event) =>
                    onOtpWindowChange('pickup_otp_window_before_min', Number(event.target.value))
                  }
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Pickup OTP: minutes after</label>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: '-2px', marginBottom: 6 }}>
                  Minutes after scheduled pickup that is on time.
                </div>
                <input
                  className="form-control"
                  type="number"
                  min={0}
                  max={180}
                  step={1}
                  disabled={readonlyView}
                  value={ready.state.settings.pickup_otp_window_after_min}
                  onChange={(event) =>
                    onOtpWindowChange('pickup_otp_window_after_min', Number(event.target.value))
                  }
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Dropoff OTP: minutes before</label>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: '-2px', marginBottom: 6 }}>
                  Minutes before dropoff that is on time.
                </div>
                <input
                  className="form-control"
                  type="number"
                  min={0}
                  max={180}
                  step={1}
                  disabled={readonlyView}
                  value={ready.state.settings.dropoff_otp_window_before_min}
                  onChange={(event) =>
                    onOtpWindowChange('dropoff_otp_window_before_min', Number(event.target.value))
                  }
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Dropoff OTP: minutes after</label>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: '-2px', marginBottom: 6 }}>
                  Minutes after dropoff that is on time.
                </div>
                <input
                  className="form-control"
                  type="number"
                  min={0}
                  max={180}
                  step={1}
                  disabled={readonlyView}
                  value={ready.state.settings.dropoff_otp_window_after_min}
                  onChange={(event) =>
                    onOtpWindowChange('dropoff_otp_window_after_min', Number(event.target.value))
                  }
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Data Views">
            <details style={{ marginBottom: 12 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                Trips ({ready.state.trips.length})
              </summary>
              <div style={{ overflowX: 'auto', marginTop: 8 }}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Columns</div>
                  <div className="d-flex flex-wrap gap-3">
                    {TRIP_DATA_COLUMNS.map((column) => (
                      <label key={`trip-col-toggle-${column.key}`} className="form-check-label" style={{ fontSize: 13 }}>
                        <input
                          type="checkbox"
                          className="form-check-input me-1"
                          checked={tripVisibleColumns[column.key]}
                          onChange={(event) =>
                            setTripVisibleColumns((prev) => ({
                              ...prev,
                              [column.key]: event.target.checked,
                            }))
                          }
                        />
                        {column.label}
                      </label>
                    ))}
                  </div>
                </div>
                <table className="table table-sm">
                  <thead>
                    <tr>
                      {activeTripColumns.map((column) => (
                        <th key={`trip-col-head-${column.key}`}>{column.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tripPageRows.map((trip) => (
                      <tr key={`trip-view-${trip.trip_id}-${trip.route_id}`}>
                        {activeTripColumns.map((column) => (
                          <td key={`trip-row-${trip.trip_id}-${column.key}`}>
                            {column.getValue(trip) ?? '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {ready.state.trips.length === 0 && (
                      <tr>
                        <td colSpan={Math.max(activeTripColumns.length, 1)} style={{ color: '#6b7280' }}>
                          No trips available.
                        </td>
                      </tr>
                    )}
                    {ready.state.trips.length > 0 && activeTripColumns.length === 0 && (
                      <tr>
                        <td style={{ color: '#6b7280' }}>Select at least one column.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {ready.state.trips.length > 0 && (
                  <div className="d-flex align-items-center justify-content-between">
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      type="button"
                      disabled={currentTripPage <= 1}
                      onClick={() => setTripPage((prev) => Math.max(1, prev - 1))}
                    >
                      Previous
                    </button>
                    <div style={{ fontSize: 13 }}>
                      Page {currentTripPage} of {tripTotalPages}
                    </div>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      type="button"
                      disabled={currentTripPage >= tripTotalPages}
                      onClick={() => setTripPage((prev) => Math.min(tripTotalPages, prev + 1))}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </details>

            <details>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                Routes ({ready.state.routes.length})
              </summary>
              <div style={{ overflowX: 'auto', marginTop: 8 }}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Columns</div>
                  <div className="d-flex flex-wrap gap-3">
                    {ROUTE_DATA_COLUMNS.map((column) => (
                      <label key={`route-col-toggle-${column.key}`} className="form-check-label" style={{ fontSize: 13 }}>
                        <input
                          type="checkbox"
                          className="form-check-input me-1"
                          checked={routeVisibleColumns[column.key]}
                          onChange={(event) =>
                            setRouteVisibleColumns((prev) => ({
                              ...prev,
                              [column.key]: event.target.checked,
                            }))
                          }
                        />
                        {column.label}
                      </label>
                    ))}
                  </div>
                </div>
                <table className="table table-sm">
                  <thead>
                    <tr>
                      {activeRouteColumns.map((column) => (
                        <th key={`route-col-head-${column.key}`}>{column.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {routePageRows.map((route) => (
                      <tr key={`route-view-${route.route_id}`}>
                        {activeRouteColumns.map((column) => (
                          <td key={`route-row-${route.route_id}-${column.key}`}>
                            {column.getValue(route) ?? '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {ready.state.routes.length === 0 && (
                      <tr>
                        <td colSpan={Math.max(activeRouteColumns.length, 1)} style={{ color: '#6b7280' }}>
                          No routes available.
                        </td>
                      </tr>
                    )}
                    {ready.state.routes.length > 0 && activeRouteColumns.length === 0 && (
                      <tr>
                        <td style={{ color: '#6b7280' }}>Select at least one column.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {ready.state.routes.length > 0 && (
                  <div className="d-flex align-items-center justify-content-between">
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      type="button"
                      disabled={currentRoutePage <= 1}
                      onClick={() => setRoutePage((prev) => Math.max(1, prev - 1))}
                    >
                      Previous
                    </button>
                    <div style={{ fontSize: 13 }}>
                      Page {currentRoutePage} of {routeTotalPages}
                    </div>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      type="button"
                      disabled={currentRoutePage >= routeTotalPages}
                      onClick={() => setRoutePage((prev) => Math.min(routeTotalPages, prev + 1))}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </details>
          </SectionCard>
        </>
      )}

      {tab === 'demand' && (
        <>
          <div className="row">
            <MetricCard label="Peak Pickups" value={`${metrics.peakPickups}`} />
            <MetricCard label="Peak On-Board" value={`${metrics.peakOnBoard}`} />
            <MetricCard label="Peak Vehicles" value={`${metrics.peakVehicles}`} />
            <MetricCard label="Total Trips" value={`${metrics.totalTrips}`} />
          </div>
          <SectionCard title="Demand and Active Vehicles (15-min)">
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
              Pickups and onboard demand are shown by 15-minute block with vehicles on road as a line overlay.
            </div>
            <DemandCompositeChart
              pickups={metrics.pickupsByBlock}
              onBoard={metrics.onBoardByBlock}
              vehicles={metrics.vehiclesByBlock}
              blocks={metrics.blocks}
            />
          </SectionCard>
          <SectionCard title="Deadhead Intensity (empty-time heatmap)">
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
              Darker cells indicate a higher share of active vehicle time with no passengers on board.
            </div>
            <HeatStrip values={metrics.deadheadByBlock} blocks={metrics.blocks} />
          </SectionCard>
        </>
      )}

      {tab === 'performance' && (
        <>
          <div className="row">
            <MetricCard label="Pickup OTP" value={`${metrics.pickupOtpPct}%`} />
            <MetricCard label="Dropoff OTP" value={`${metrics.dropoffOtpPct}%`} />
            <MetricCard label="Trip OTP" value={`${metrics.tripOtpPct}%`} />
            <MetricCard label="Blocks Below Target" value={`${metrics.blocksBelowOtp}`} />
          </div>
          <div className="row">
            <MetricCard label="Average Productivity" value={`${metrics.avgProductivity}`} />
            <MetricCard label="Peak Productivity" value={`${metrics.peakProductivity}`} />
            <MetricCard label="OTP Target" value={`${ready.state.settings.otp_target_pct}%`} />
            <MetricCard label="Total Trips" value={`${metrics.totalTrips}`} />
          </div>
          <SectionCard title="Pickup OTP (by block)">
            <MiniBars values={metrics.pickupOtpByBlock} max={100} />
          </SectionCard>
          <SectionCard title="Dropoff OTP (by block)">
            <MiniBars values={metrics.dropoffOtpByBlock} max={100} />
          </SectionCard>
          <SectionCard title="Trip OTP (by block)">
            <MiniBars values={metrics.tripOtpByBlock} max={100} />
          </SectionCard>
          <SectionCard title="Productivity (trips/vehicle)">
            <MiniBars values={metrics.productivityByBlock} />
          </SectionCard>
        </>
      )}

      {tab === 'map' && (
        <>
          <SectionCard title="Trip Heatmap">
            <div style={{ marginBottom: 10 }}>
              <label className="form-label">
                Time Block ({metrics.blocks[mapBlockIdx]?.label ?? 'N/A'})
              </label>
              <input
                className="form-range"
                type="range"
                min={0}
                max={Math.max(0, metrics.blocks.length - 1)}
                value={mapBlockIdx}
                onChange={(event) => setMapBlockIdx(Number(event.target.value))}
              />
            </div>
            <HeatStrip values={metrics.pickupsByBlock.map((value, idx) => (idx === mapBlockIdx ? value : value * 0.4))} />
          </SectionCard>
        </>
      )}

      {tab === 'runs' && (
        <>
          <div className="row">
            <MetricCard label="Current Runs" value={`${metrics.currentRuns}`} />
            <MetricCard label="Optimized Runs" value={`${metrics.optimizedRuns}`} />
            <MetricCard label="Imported Service Hours" value={`${metrics.importedServiceHours}`} />
            <MetricCard label="Optimized Service Hours" value={`${metrics.optimizedServiceHours}`} />
          </div>
          <SectionCard title="Current vs Optimized Vehicle Load">
            <div className="row">
              <div className="col-md-6 mb-3">
                <h4 style={{ fontSize: 15 }}>Current</h4>
                <MiniBars values={metrics.vehiclesByBlock} />
              </div>
              <div className="col-md-6 mb-3">
                <h4 style={{ fontSize: 15 }}>Optimized</h4>
                <MiniBars values={metrics.vehiclesByBlock.map((value) => Math.max(0, value - 1))} />
              </div>
            </div>
          </SectionCard>
        </>
      )}

      {tab === 'optimize' && (
        <>
          <SectionCard title="Optimization Parameters">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">
                  Target Productivity ({ready.state.optimization.target_productivity ?? 2.0})
                </label>
                <input
                  className="form-range"
                  disabled={readonlyView}
                  type="range"
                  min={1.0}
                  max={3.5}
                  step={0.1}
                  value={ready.state.optimization.target_productivity ?? 2.0}
                  onChange={(event) =>
                    onOptimizationChange('target_productivity', Number(event.target.value))
                  }
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">
                  Min OTP Target ({ready.state.optimization.min_otp_target ?? 85}%)
                </label>
                <input
                  className="form-range"
                  disabled={readonlyView}
                  type="range"
                  min={75}
                  max={98}
                  step={1}
                  value={ready.state.optimization.min_otp_target ?? 85}
                  onChange={(event) =>
                    onOptimizationChange('min_otp_target', Number(event.target.value))
                  }
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">
                  Max Driver Spread ({ready.state.optimization.max_driver_spread_hrs ?? 12} hrs)
                </label>
                <input
                  className="form-range"
                  disabled={readonlyView}
                  type="range"
                  min={8}
                  max={14}
                  step={0.5}
                  value={ready.state.optimization.max_driver_spread_hrs ?? 12}
                  onChange={(event) =>
                    onOptimizationChange('max_driver_spread_hrs', Number(event.target.value))
                  }
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">
                  Peak Vehicles ({ready.state.optimization.peak_vehicles ?? metrics.peakVehicles})
                </label>
                <input
                  className="form-range"
                  disabled={readonlyView}
                  type="range"
                  min={12}
                  max={36}
                  step={1}
                  value={ready.state.optimization.peak_vehicles ?? metrics.peakVehicles}
                  onChange={(event) =>
                    onOptimizationChange('peak_vehicles', Number(event.target.value))
                  }
                />
              </div>
            </div>
          </SectionCard>
          <div className="row">
            <MetricCard label="Est. Service Hours" value={`${metrics.optimizedServiceHours}`} />
            <MetricCard label="Est. OTP" value={`${Math.max(metrics.avgOtp, 85)}%`} />
            <MetricCard label="Est. Deadhead" value={`${Math.max(3, metrics.avgDeadheadStartMiles)}%`} />
            <MetricCard label="Est. Productivity" value={`${Math.max(1.2, metrics.avgProductivity)}`} />
          </div>
        </>
      )}

      {tab === 'deadhead' && (
        <>
          <div className="row">
            <MetricCard label="Avg Trip Miles" value={`${metrics.avgTripMiles}`} />
            <MetricCard label="Avg Empty-Time % (Start)" value={`${metrics.avgDeadheadStartMiles}%`} />
            <MetricCard label="Avg Empty-Time % (End)" value={`${metrics.avgDeadheadEndMiles}%`} />
            <MetricCard label="Total Trips" value={`${metrics.totalTrips}`} />
          </div>
          <SectionCard title="Deadhead Ratio by 15-min Block">
            <HeatStrip values={metrics.deadheadByBlock} blocks={metrics.blocks} />
          </SectionCard>
          <SectionCard title="High Deadhead Trips">
            <div className="row">
              <div className="col-md-6">
                <TripTable title="Start of Service" trips={metrics.highDeadheadTripsStart} />
              </div>
              <div className="col-md-6">
                <TripTable title="End of Service" trips={metrics.highDeadheadTripsEnd} />
              </div>
            </div>
          </SectionCard>
        </>
      )}

      {flatImportLog && (
        <FlatImportLogModal
          show={showFlatImportLog}
          onClose={() => setShowFlatImportLog(false)}
          log={flatImportLog}
        />
      )}
    </main>
  );
}

function PasswordPrompt({ onSubmit }: { onSubmit: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(password);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="unlock-password" className="form-label">
        Password
      </label>
      <input
        id="unlock-password"
        type="password"
        className="form-control"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <button className="btn btn-primary mt-3" type="submit" disabled={!password || submitting}>
        {submitting ? 'Unlocking...' : 'Unlock'}
      </button>
    </form>
  );
}

function FlatFileImport({
  readonlyView,
  onBack,
  onDownloadSample,
  onImport,
}: {
  readonlyView: boolean;
  onBack: () => void;
  onDownloadSample: (kind: 'trips' | 'routes') => void;
  onImport: (tripFile: File | null, routeFile: File | null) => Promise<void>;
}) {
  const [tripFile, setTripFile] = useState<File | null>(null);
  const [routeFile, setRouteFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  async function handleImport() {
    if (readonlyView || (!tripFile && !routeFile)) return;
    setImporting(true);
    try {
      await onImport(tripFile, routeFile);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        className="btn btn-sm btn-outline-secondary mb-3"
        type="button"
        onClick={onBack}
      >
        Back to Import Options
      </button>
      <div className="row">
        <div className="col-md-6 mb-3">
          <div className="d-flex gap-2 mb-2">
            <button
              className="btn btn-sm btn-outline-secondary"
              type="button"
              onClick={() => onDownloadSample('routes')}
            >
              Download Route Sample CSV
            </button>
          </div>
          <div
            style={{
              border: '1px dashed #94a3b8',
              borderRadius: 10,
              padding: '1rem',
              background: readonlyView ? '#f8fafc' : '#fff',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Route File (CSV/XLSX)</div>
            <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 8 }}>
              Select the route file to import.
            </div>
            <input
              type="file"
              className="form-control"
              accept=".csv,.xlsx,.xls"
              disabled={readonlyView}
              onChange={(event) => {
                setRouteFile(event.target.files?.[0] ?? null);
              }}
            />
            {routeFile && (
              <div style={{ fontSize: 13, color: '#065f46', marginTop: 6 }}>
                Selected: {routeFile.name}
              </div>
            )}
          </div>
        </div>
        <div className="col-md-6 mb-3">
          <div className="d-flex gap-2 mb-2">
            <button
              className="btn btn-sm btn-outline-secondary"
              type="button"
              onClick={() => onDownloadSample('trips')}
            >
              Download Trip Sample CSV
            </button>
          </div>
          <div
            style={{
              border: '1px dashed #94a3b8',
              borderRadius: 10,
              padding: '1rem',
              background: readonlyView ? '#f8fafc' : '#fff',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Trip File (CSV/XLSX)</div>
            <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 8 }}>
              Select the trip file to import.
            </div>
            <input
              type="file"
              className="form-control"
              accept=".csv,.xlsx,.xls"
              disabled={readonlyView}
              onChange={(event) => {
                setTripFile(event.target.files?.[0] ?? null);
              }}
            />
            {tripFile && (
              <div style={{ fontSize: 13, color: '#065f46', marginTop: 6 }}>
                Selected: {tripFile.name}
              </div>
            )}
          </div>
        </div>
      </div>
      <button
        className="btn btn-primary"
        type="button"
        disabled={readonlyView || importing || (!tripFile && !routeFile)}
        onClick={handleImport}
      >
        {importing ? 'Importing...' : 'Import Files'}
      </button>
      {!tripFile && !routeFile && (
        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>
          Select at least one file to import. Routes are imported first so trips can be validated against them.
        </div>
      )}
    </div>
  );
}

function TripTable({ title, trips }: { title: string; trips: Array<{ trip_id: string; route_id: string }> }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem', marginBottom: '0.75rem' }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{title}</div>
      <table className="table table-sm mb-0">
        <thead>
          <tr>
            <th>Trip</th>
            <th>Route</th>
          </tr>
        </thead>
        <tbody>
          {trips.length === 0 && (
            <tr>
              <td colSpan={2} style={{ color: '#6b7280' }}>
                No trips available
              </td>
            </tr>
          )}
          {trips.map((trip) => (
            <tr key={trip.trip_id}>
              <td>{trip.trip_id}</td>
              <td>{trip.route_id}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FlatImportLogModal(props: {
  show: boolean;
  onClose: () => void;
  log: {
    trips: Array<{ row: number; reason: string }>;
    routes: Array<{ row: number; reason: string }>;
  };
}) {
  if (!props.show) {
    return null;
  }

  const hasTrips = props.log.trips.length > 0;
  const hasRoutes = props.log.routes.length > 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 10,
          width: '100%',
          maxWidth: 780,
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #e5e7eb',
            padding: '0.75rem 1rem',
          }}
        >
          <h4 style={{ margin: 0, fontSize: 17 }}>Flat Import Skipped Rows</h4>
          <button className="btn btn-sm btn-outline-secondary" type="button" onClick={props.onClose}>
            Close
          </button>
        </div>
        <div style={{ padding: '0.9rem 1rem' }}>
          <p style={{ fontSize: 13, color: '#4b5563' }}>
            These rows were skipped during the most recent flat-file import. Row numbers correspond to the
            original CSV/XLSX (header is row 1).
          </p>
          {hasRoutes && (
            <div
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: '0.7rem',
                marginBottom: '0.75rem',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                Route file skipped rows ({props.log.routes.length})
              </div>
              <ul style={{ marginBottom: 0, maxHeight: 220, overflow: 'auto' }}>
                {props.log.routes.map((err, idx) => (
                  <li key={`flat-route-error-${idx}`} style={{ fontSize: 13 }}>
                    Row {err.row}: {err.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {hasTrips && (
            <div
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: '0.7rem',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                Trip file skipped rows ({props.log.trips.length})
              </div>
              <ul style={{ marginBottom: 0, maxHeight: 220, overflow: 'auto' }}>
                {props.log.trips.map((err, idx) => (
                  <li key={`flat-trip-error-${idx}`} style={{ fontSize: 13 }}>
                    Row {err.row}: {err.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!hasTrips && !hasRoutes && (
            <p style={{ fontSize: 13, color: '#6b7280' }}>No skipped rows were reported for the last import.</p>
          )}
        </div>
      </div>
    </div>
  );
}
