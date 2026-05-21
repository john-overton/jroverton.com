'use client';

import { FormEvent, ReactNode, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Button } from '@/app/parallax/components/shadcn/button';
import { Input } from '@/app/parallax/components/shadcn/input';
import { Label } from '@/app/parallax/components/shadcn/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/parallax/components/shadcn/table';
import type { NewRouteRow, RouteRow, ServiceDay, TripRow } from '@/lib/parallax/types';
import type { YardTripRow } from '@/lib/parallax/metrics';
import { useClearcutTheme } from '@/app/parallax/theme/ClearcutThemeProvider';

export type BreakoutMode = 'total' | 'byStatus' | 'byPassengerType';

const STATUS_COLORS: Record<string, string> = {
  completed: '#059669',
  'no-show': '#DC2626',
  cancelled: '#D97706',
  scheduled: '#6366F1',
};

const PASSENGER_TYPE_COLORS: Record<string, string> = {
  ambulatory: '#2563EB',
  wheelchair: '#D97706',
  extra_large: '#7C3AED',
};

const FALLBACK_COLORS = ['#6366F1', '#EC4899', '#14B8A6', '#F59E0B', '#8B5CF6', '#EF4444'];

function getCategoryColor(category: string, mode: BreakoutMode, index: number): string {
  if (mode === 'byStatus') return STATUS_COLORS[category] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
  if (mode === 'byPassengerType') return PASSENGER_TYPE_COLORS[category] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
  return FALLBACK_COLORS[0];
}

export const DEMAND_BLOCK_MINUTES = 15;

export const ALL_SERVICE_DAYS: ServiceDay[] = ['M', 'T', 'W', 'Th', 'F', 'Sa', 'Su'];
export const SERVICE_DAY_TO_DOW: Record<ServiceDay, number> = { Su: 0, M: 1, T: 2, W: 3, Th: 4, F: 5, Sa: 6 };
export const SERVICE_DAY_FULL_NAME: Record<ServiceDay, string> = { M: 'Monday', T: 'Tuesday', W: 'Wednesday', Th: 'Thursday', F: 'Friday', Sa: 'Saturday', Su: 'Sunday' };

export function parseServiceDays(json: string): ServiceDay[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((d: string) => ALL_SERVICE_DAYS.includes(d as ServiceDay)) as ServiceDay[] : [];
  } catch {
    return [];
  }
}

export function parseClockToMinutes(value: string | null | undefined, fallback: number): number {
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

export function formatMinutesToClock(minutes: number): string {
  const safe = Math.max(0, minutes);
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return `${`${hours}`.padStart(2, '0')}:${`${mins}`.padStart(2, '0')}`;
}

export function formatMinutesToLabel(minutes: number): string {
  const hours24 = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${`${mins}`.padStart(2, '0')} ${period}`;
}

export function parseDateTime(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function deriveSliderBounds(params: {
  trips: TripRow[];
  routes: RouteRow[];
  newRoutes?: NewRouteRow[];
  fallbackStartMinutes: number;
  fallbackEndMinutes: number;
}): { startMinutes: number; endMinutes: number } {
  // Compute the time-of-day envelope across all dates
  let earliestMinutes = Infinity;
  let latestMinutes = -Infinity;

  function updateFromDate(d: Date | null) {
    if (!d) return;
    const m = d.getHours() * 60 + d.getMinutes();
    if (m < earliestMinutes) earliestMinutes = m;
    if (m > latestMinutes) latestMinutes = m;
  }

  function updateFromMinutes(m: number) {
    if (m < earliestMinutes) earliestMinutes = m;
    if (m > latestMinutes) latestMinutes = m;
  }

  for (const trip of params.trips) {
    updateFromDate(
      parseDateTime(trip.pickup_arrive_time) ??
      parseDateTime(trip.pickup_leave_time) ??
      parseDateTime(trip.scheduled_pickup_time),
    );
    updateFromDate(
      parseDateTime(trip.dropoff_leave_time) ??
      parseDateTime(trip.dropoff_arrive_time) ??
      parseDateTime(trip.scheduled_appointment_time),
    );
  }

  for (const route of params.routes) {
    updateFromDate(parseDateTime(route.actual_start_time) ?? parseDateTime(route.scheduled_start_time));
    updateFromDate(parseDateTime(route.actual_end_time) ?? parseDateTime(route.scheduled_end_time));
  }

  // New routes use HH:MM format, not datetime
  if (params.newRoutes) {
    for (const nr of params.newRoutes) {
      const startMin = parseClockToMinutes(nr.start_time, -1);
      const endMin = parseClockToMinutes(nr.end_time, -1);
      if (startMin >= 0) updateFromMinutes(startMin);
      if (endMin >= 0) updateFromMinutes(endMin);
    }
  }

  if (earliestMinutes === Infinity || latestMinutes === -Infinity) {
    return {
      startMinutes: params.fallbackStartMinutes,
      endMinutes: params.fallbackEndMinutes,
    };
  }

  const derivedStart = Math.max(0, Math.floor((earliestMinutes - 30) / 15) * 15);
  const derivedEnd = Math.min(24 * 60, Math.ceil((Math.max(derivedStart + 60, latestMinutes + 30)) / 15) * 15);

  return { startMinutes: derivedStart, endMinutes: derivedEnd };
}

export function MetricCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  columnClass?: string;
}) {
  return (
    <div className="bg-cc-surface-1 border border-cc-border rounded-[10px] p-3">
      <div className="text-cc-text-muted text-[13px]">{label}</div>
      <div className="text-2xl font-bold" style={{ color: color ?? undefined }}>
        {value}
      </div>
      {sub && <div className="text-cc-text-muted text-xs">{sub}</div>}
    </div>
  );
}

export function MiniBars({ values, max }: { values: number[]; max?: number }) {
  const { chartColors } = useClearcutTheme();
  const resolvedMax = max ?? Math.max(...values, 1);
  const data = values.map((value, index) => ({
    idx: index,
    value: Math.round(value * 100) / 100,
  }));
  return (
    <div className="h-[100px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 2 }}>
          <XAxis dataKey="idx" hide />
          <YAxis hide domain={[0, resolvedMax]} />
          <Tooltip
            formatter={(value: number | string | undefined) => [Number(value ?? 0), 'Value']}
            labelFormatter={(label) => `Block ${Number(label) + 1}`}
            contentStyle={{ borderRadius: 8, background: 'var(--color-cc-surface-1)', color: 'var(--color-cc-text)', borderColor: 'var(--color-cc-border)' }}
            labelStyle={{ color: 'var(--color-cc-text)' }}
            itemStyle={{ color: 'var(--color-cc-text-secondary)' }}
          />
          <Bar dataKey="value" fill={chartColors[0]} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

export function HeatStrip({ values, blocks, onBlockClick, activeIndex, valueLabel, valueSuffix }: { values: number[]; blocks?: Array<{ label: string }>; onBlockClick?: (index: number) => void; activeIndex?: number; valueLabel?: string; valueSuffix?: string }) {
  const { chartColors, palette } = useClearcutTheme();
  const max = Math.max(...values, 1);
  const [r, g, b] = hexToRgb(chartColors[0]);
  const emptyColor = palette.tokens['--color-cc-surface-2'];
  const data = values.map((value, index) => ({
    idx: index,
    value: Math.round(value * 10) / 10,
    unit: 1,
    label: blocks?.[index]?.label ?? `Block ${index + 1}`,
  }));
  return (
    <div className="h-[42px] rounded-md overflow-visible border border-cc-border" style={{ position: 'relative', zIndex: 10, cursor: onBlockClick ? 'pointer' : undefined }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
          barCategoryGap={0}
          onClick={onBlockClick ? (state) => {
            if (state?.activeTooltipIndex != null) onBlockClick(Number(state.activeTooltipIndex));
          } : undefined}
        >
          <XAxis dataKey="idx" hide />
          <YAxis hide domain={[0, 1]} />
          <Tooltip
            allowEscapeViewBox={{ x: true, y: true }}
            formatter={(_value: number | string | undefined, _name, item) => {
              const payload = item?.payload as { value?: number; label?: string } | undefined;
              return [`${payload?.value ?? 0}${valueSuffix ?? '%'}`, valueLabel ?? 'Empty-time'];
            }}
            labelFormatter={(_label, payload) => {
              const first = payload?.[0]?.payload as { label?: string } | undefined;
              return first?.label ?? '';
            }}
            wrapperStyle={{ zIndex: 50 }}
            contentStyle={{
              borderRadius: 8,
              background: 'var(--color-cc-surface-1)',
              color: 'var(--color-cc-text)',
              borderColor: 'var(--color-cc-border)',
            }}
            labelStyle={{ color: 'var(--color-cc-text)', fontWeight: 600 }}
            itemStyle={{ color: 'var(--color-cc-text-secondary)' }}
          />
          <Bar dataKey="unit" isAnimationActive={false}>
            {data.map((entry, index) => {
              const ratio = max > 0 ? entry.value / max : 0;
              const dimmed = activeIndex != null && index !== activeIndex;
              const opacity = (0.12 + ratio * 0.88) * (dimmed ? 0.4 : 1);
              const color = entry.value <= 0 ? emptyColor : `rgba(${r}, ${g}, ${b}, ${opacity})`;
              return <Cell key={`heat-cell-${index}`} fill={color} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const TOOLTIP_STYLE = {
  borderRadius: 8,
  background: 'var(--color-cc-surface-1)',
  color: 'var(--color-cc-text)',
  border: '1px solid var(--color-cc-border)',
  padding: '8px 12px',
  fontSize: 13,
} as const;

function ChartTooltip({ active, payload, label, nameMap, breakColors, showSlotUtil }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  nameMap: Record<string, string>;
  breakColors?: Record<string, string>;
  showSlotUtil?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const dataPoint = (payload[0] as unknown as { payload: Record<string, number> }).payload;
  const onBreak = dataPoint.onBreak ?? 0;
  const crOnBreak = dataPoint.crOnBreak ?? 0;
  const nrOnBreak = dataPoint.nrOnBreak ?? 0;
  const irOnBreak = dataPoint.irOnBreak ?? 0;
  const slotUtil = dataPoint.slotUtil ?? 0;
  const breakStyle = { color: 'var(--color-cc-text-muted)', lineHeight: 1.6 } as const;
  const visible = payload.filter((e) => e.value !== 0 && e.name !== 'slotUtil');
  if (visible.length === 0 && onBreak === 0 && crOnBreak === 0 && nrOnBreak === 0 && irOnBreak === 0) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <div style={{ color: 'var(--color-cc-text)', marginBottom: 4, fontWeight: 500 }}>Time: {label}</div>
      {showSlotUtil && slotUtil > 0 && (
        <div style={{ color: 'var(--color-cc-text-muted)', lineHeight: 1.6, marginBottom: 2 }}>
          Slot Utilization: {slotUtil}%
        </div>
      )}
      {visible.map((entry) => (
        <div key={entry.name} style={{ color: 'var(--color-cc-text-secondary)', lineHeight: 1.6 }}>
          <span style={{ color: entry.color }}>●</span>{' '}
          {nameMap[entry.name] ?? entry.name}: {entry.value}
        </div>
      ))}
      {onBreak > 0 && (
        <div style={breakStyle}>
          <span style={{ color: breakColors?.onBreak ?? 'var(--color-cc-warning)' }}>●</span> On Break: {onBreak}
        </div>
      )}
      {crOnBreak > 0 && (
        <div style={breakStyle}>
          <span style={{ color: breakColors?.crOnBreak ?? 'var(--color-cc-warning)' }}>●</span> CR On Break: {crOnBreak}
        </div>
      )}
      {nrOnBreak > 0 && (
        <div style={breakStyle}>
          <span style={{ color: breakColors?.nrOnBreak ?? 'var(--color-cc-warning)' }}>●</span> NR On Break: {nrOnBreak}
        </div>
      )}
      {irOnBreak > 0 && (
        <div style={breakStyle}>
          <span style={{ color: breakColors?.irOnBreak ?? 'var(--color-cc-warning)' }}>●</span> {nameMap.importedDateVehicles ? `${nameMap.importedDateVehicles} On Break` : 'IR On Break'}: {irOnBreak}
        </div>
      )}
    </div>
  );
}

function PerformanceTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: readonly { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const isOtp = (name: string) => name === 'pickupOtp' || name === 'dropoffOtp';
  const visible = payload.filter((e) => isOtp(e.name) || e.value !== 0);
  if (visible.length === 0) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <div style={{ color: 'var(--color-cc-text)', marginBottom: 4, fontWeight: 500 }}>Time: {label}</div>
      {visible.map((entry) => {
        let displayName: string;
        let displayValue: string;
        if (entry.name === 'pickupOtp') { displayName = 'Pickup OTP'; displayValue = `${entry.value}%`; }
        else if (entry.name === 'dropoffOtp') { displayName = 'Dropoff OTP'; displayValue = `${entry.value}%`; }
        else if (entry.name.startsWith('prod_')) { displayName = entry.name.replace('prod_', ''); displayValue = String(entry.value); }
        else { displayName = 'Productivity'; displayValue = String(entry.value); }
        return (
          <div key={entry.name} style={{ color: 'var(--color-cc-text-secondary)', lineHeight: 1.6 }}>
            <span style={{ color: entry.color }}>●</span> {displayName}: {displayValue}
          </div>
        );
      })}
    </div>
  );
}

export function DemandCompositeChart({
  pickups,
  onBoard,
  vehicles,
  maxPickups,
  maxOnBoard,
  maxVehicles,
  onBreak,
  maxOnBreak,
  blocks,
  mode,
  breakoutMode = 'total',
  pickupsByCategory,
  onBoardByCategory,
  maxPickupsByCategory,
  maxOnBoardByCategory,
  avgNzPickups,
  avgNzOnBoard,
  avgNzVehicles,
  avgNzOnBreak,
  avgNzPickupsByCategory,
  avgNzOnBoardByCategory,
  slotUtilization,
}: {
  pickups: number[];
  onBoard: number[];
  vehicles: number[];
  maxPickups?: number[];
  maxOnBoard?: number[];
  maxVehicles?: number[];
  onBreak?: number[];
  maxOnBreak?: number[];
  blocks: Array<{ label: string }>;
  mode?: 'avg' | 'max' | 'avgNz';
  breakoutMode?: BreakoutMode;
  pickupsByCategory?: Record<string, number[]>;
  onBoardByCategory?: Record<string, number[]>;
  maxPickupsByCategory?: Record<string, number[]>;
  maxOnBoardByCategory?: Record<string, number[]>;
  avgNzPickups?: number[];
  avgNzOnBoard?: number[];
  avgNzVehicles?: number[];
  avgNzOnBreak?: number[];
  avgNzPickupsByCategory?: Record<string, number[]>;
  avgNzOnBoardByCategory?: Record<string, number[]>;
  slotUtilization?: number[];
}) {
  const { chartColors } = useClearcutTheme();
  const activePickups = mode === 'max' && maxPickups ? maxPickups
    : mode === 'avgNz' && avgNzPickups ? avgNzPickups : pickups;
  const activeOnBoard = mode === 'max' && maxOnBoard ? maxOnBoard
    : mode === 'avgNz' && avgNzOnBoard ? avgNzOnBoard : onBoard;
  const activeVehicles = mode === 'max' && maxVehicles ? maxVehicles
    : mode === 'avgNz' && avgNzVehicles ? avgNzVehicles : vehicles;
  const activeOnBreak = mode === 'max' && maxOnBreak ? maxOnBreak
    : mode === 'avgNz' && avgNzOnBreak ? avgNzOnBreak : (onBreak ?? []);

  const categoryKeys = useMemo(
    () => (breakoutMode !== 'total' && pickupsByCategory ? Object.keys(pickupsByCategory).sort() : []),
    [breakoutMode, pickupsByCategory],
  );

  // Fix Y-axis to the max across all modes so the scale stays constant during transitions
  const yMax = useMemo(() => {
    const allValues = [
      ...pickups, ...onBoard, ...vehicles,
      ...(maxPickups ?? []), ...(maxOnBoard ?? []), ...(maxVehicles ?? []),
      ...(avgNzPickups ?? []), ...(avgNzOnBoard ?? []), ...(avgNzVehicles ?? []),
    ];
    return Math.ceil(Math.max(...allValues, 1));
  }, [pickups, onBoard, vehicles, maxPickups, maxOnBoard, maxVehicles, avgNzPickups, avgNzOnBoard, avgNzVehicles]);

  const data = useMemo(
    () =>
      blocks.map((block, index) => {
        const point: Record<string, string | number> = {
          label: block.label,
          vehicles: Math.round((activeVehicles[index] ?? 0) * 10) / 10,
          onBreak: Math.round((activeOnBreak[index] ?? 0) * 10) / 10,
          slotUtil: slotUtilization?.[index] ?? 0,
        };
        if (breakoutMode === 'total' || categoryKeys.length === 0) {
          point.pickups = Math.round((activePickups[index] ?? 0) * 10) / 10;
          point.onBoard = Math.round((activeOnBoard[index] ?? 0) * 10) / 10;
        } else {
          for (const cat of categoryKeys) {
            const pickSrc = mode === 'max' && maxPickupsByCategory?.[cat] ? maxPickupsByCategory[cat]
              : mode === 'avgNz' && avgNzPickupsByCategory?.[cat] ? avgNzPickupsByCategory[cat] : pickupsByCategory![cat];
            const obSrc = mode === 'max' && maxOnBoardByCategory?.[cat] ? maxOnBoardByCategory[cat]
              : mode === 'avgNz' && avgNzOnBoardByCategory?.[cat] ? avgNzOnBoardByCategory[cat] : onBoardByCategory?.[cat];
            point[`pick_${cat}`] = Math.round((pickSrc?.[index] ?? 0) * 10) / 10;
            point[`ob_${cat}`] = Math.round((obSrc?.[index] ?? 0) * 10) / 10;
          }
        }
        return point;
      }),
    [blocks, activeOnBoard, activePickups, activeVehicles, activeOnBreak, breakoutMode, pickupsByCategory, onBoardByCategory, maxPickupsByCategory, maxOnBoardByCategory, avgNzPickupsByCategory, avgNzOnBoardByCategory, mode, categoryKeys, slotUtilization],
  );

  const nameMap = useMemo(() => {
    const map: Record<string, string> = {
      vehicles: 'Routes On Road',
      onBoard: 'Active Trips',
      pickups: 'Pickups',
    };
    for (const cat of categoryKeys) {
      map[`pick_${cat}`] = `Pickups (${cat})`;
      map[`ob_${cat}`] = `On Board (${cat})`;
    }
    return map;
  }, [categoryKeys]);

  return (
    <div className="h-[230px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-cc-border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis yAxisId="left" allowDecimals={false} width={38} domain={[0, yMax]} />
          <Tooltip content={<ChartTooltip nameMap={nameMap} breakColors={{ onBreak: chartColors[1] }} showSlotUtil={mode === 'avgNz'} />} />
          {mode === 'avgNz' && data.map((entry, i) => {
            const util = (entry.slotUtil as number) ?? 0;
            return util > 0 ? (
              <ReferenceArea
                key={`util-${i}`}
                yAxisId="left"
                x1={entry.label as string}
                x2={entry.label as string}
                fill={chartColors[0]}
                fillOpacity={util / 100 * 0.25}
                ifOverflow="visible"
              />
            ) : null;
          })}
          {breakoutMode === 'total' || categoryKeys.length === 0 ? (
            <>
              <Bar yAxisId="left" dataKey="onBoard" fill={`${chartColors[0]}40`} radius={[3, 3, 0, 0]} />
              <Bar yAxisId="left" dataKey="pickups" fill={chartColors[0]} radius={[3, 3, 0, 0]} />
            </>
          ) : (
            <>
              {categoryKeys.map((cat, i) => (
                <Bar
                  yAxisId="left"
                  key={`ob_${cat}`}
                  dataKey={`ob_${cat}`}
                  stackId="onBoard"
                  fill={`${getCategoryColor(cat, breakoutMode, i)}66`}
                  radius={i === categoryKeys.length - 1 ? [3, 3, 0, 0] : undefined}
                />
              ))}
              {categoryKeys.map((cat, i) => (
                <Bar
                  yAxisId="left"
                  key={`pick_${cat}`}
                  dataKey={`pick_${cat}`}
                  stackId="pickups"
                  fill={getCategoryColor(cat, breakoutMode, i)}
                  radius={i === categoryKeys.length - 1 ? [3, 3, 0, 0] : undefined}
                />
              ))}
            </>
          )}
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="vehicles"
            stroke={chartColors[1]}
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

export function PerformanceCompositeChart({
  productivity,
  pickupOtp,
  dropoffOtp,
  blocks,
  breakoutMode = 'total',
  productivityByCategory,
}: {
  productivity: number[];
  pickupOtp: number[];
  dropoffOtp: number[];
  blocks: Array<{ label: string }>;
  breakoutMode?: BreakoutMode;
  productivityByCategory?: Record<string, number[]>;
}) {
  const { chartColors } = useClearcutTheme();
  const categoryKeys = useMemo(
    () => (breakoutMode !== 'total' && productivityByCategory ? Object.keys(productivityByCategory).sort() : []),
    [breakoutMode, productivityByCategory],
  );
  const data = useMemo(
    () =>
      blocks.map((block, index) => {
        const point: Record<string, string | number> = {
          label: block.label,
          pickupOtp: Math.round((pickupOtp[index] ?? 0) * 10) / 10,
          dropoffOtp: Math.round((dropoffOtp[index] ?? 0) * 10) / 10,
        };
        if (breakoutMode === 'total' || categoryKeys.length === 0) {
          point.productivity = Math.round((productivity[index] ?? 0) * 100) / 100;
        } else {
          for (const cat of categoryKeys) {
            point[`prod_${cat}`] = Math.round((productivityByCategory![cat][index] ?? 0) * 100) / 100;
          }
        }
        return point;
      }),
    [blocks, productivity, pickupOtp, dropoffOtp, breakoutMode, productivityByCategory, categoryKeys],
  );

  return (
    <div className="h-[345px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-cc-border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis yAxisId="left" allowDecimals width={38} />
          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} width={38} tickFormatter={(v) => `${v}%`} />
          <Tooltip content={<PerformanceTooltip />} />
          <Legend
            formatter={(value) => {
              if (value === 'pickupOtp') return 'Pickup OTP';
              if (value === 'dropoffOtp') return 'Dropoff OTP';
              if (value.startsWith('prod_')) return value.replace('prod_', '');
              return 'Productivity';
            }}
          />
          {breakoutMode === 'total' || categoryKeys.length === 0 ? (
            <Bar yAxisId="left" dataKey="productivity" fill={`${chartColors[0]}66`} radius={[3, 3, 0, 0]} />
          ) : (
            categoryKeys.map((cat, i) => (
              <Bar
                key={cat}
                yAxisId="left"
                dataKey={`prod_${cat}`}
                stackId="productivity"
                fill={getCategoryColor(cat, breakoutMode, i)}
                radius={i === categoryKeys.length - 1 ? [3, 3, 0, 0] : undefined}
              />
            ))
          )}
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="pickupOtp"
            stroke={chartColors[1]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="dropoffOtp"
            stroke={chartColors[3]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SectionCard({ title, headerRight, children }: { title: string; headerRight?: ReactNode; children: ReactNode }) {
  return (
    <section className="border border-cc-border rounded-[10px] bg-cc-surface-1 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[17px] font-semibold">{title}</h3>
        {headerRight}
      </div>
      {children}
    </section>
  );
}

export function TripTable({ title, trips }: { title: string; trips: Array<{ trip_id: string; route_id: string }> }) {
  return (
    <div className="border border-cc-border rounded-lg p-3 mb-3">
      <div className="font-semibold mb-2">{title}</div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Trip</TableHead>
            <TableHead>Route</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trips.length === 0 && (
            <TableRow>
              <TableCell colSpan={2} className="text-cc-text-muted">
                No trips available
              </TableCell>
            </TableRow>
          )}
          {trips.map((trip) => (
            <TableRow key={trip.trip_id}>
              <TableCell>{trip.trip_id}</TableCell>
              <TableCell>{trip.route_id}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function YardTripTable({
  title,
  trips,
  variant,
}: {
  title: string;
  trips: YardTripRow[];
  variant: 'start' | 'return';
}) {
  const isReturn = variant === 'return';
  const colSpan = isReturn ? 6 : 4;
  return (
    <div className="border border-cc-border rounded-lg p-3 mb-3">
      <div className="font-semibold mb-2">{title}</div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Trip</TableHead>
            <TableHead>Route</TableHead>
            <TableHead>Distance (mi)</TableHead>
            <TableHead>Travel (min)</TableHead>
            {isReturn && <TableHead>Late</TableHead>}
            {isReturn && <TableHead>Variance (min)</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {trips.length === 0 && (
            <TableRow>
              <TableCell colSpan={colSpan} className="text-cc-text-muted">
                No trips available
              </TableCell>
            </TableRow>
          )}
          {trips.map((trip) => (
            <TableRow key={trip.trip_id}>
              <TableCell>{trip.trip_id}</TableCell>
              <TableCell>{trip.route_id}</TableCell>
              <TableCell>{trip.yardDistanceMiles}</TableCell>
              <TableCell>{trip.travelTimeMinutes}</TableCell>
              {isReturn && (
                <TableCell className={trip.isLate ? 'text-red-400 font-medium' : ''}>
                  {trip.isLate ? 'Yes' : 'No'}
                </TableCell>
              )}
              {isReturn && (
                <TableCell className={trip.returnVarianceMinutes && trip.returnVarianceMinutes > 0 ? 'text-red-400' : ''}>
                  {trip.returnVarianceMinutes ?? '—'}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function RunStructureChart({
  pickups,
  onBoard,
  currentVehicles,
  runVehicles,
  crOnBreak,
  nrOnBreak,
  blocks,
  importedDateVehicles,
  irOnBreak,
  importedDateLabel,
  breakoutMode = 'total',
  pickupsByCategory,
  onBoardByCategory,
  slotUtilization,
  showSlotUtil = false,
}: {
  pickups: number[];
  onBoard: number[];
  currentVehicles: number[];
  runVehicles: number[];
  crOnBreak?: number[];
  nrOnBreak?: number[];
  blocks: Array<{ label: string }>;
  importedDateVehicles?: number[];
  irOnBreak?: number[];
  importedDateLabel?: string;
  breakoutMode?: BreakoutMode;
  pickupsByCategory?: Record<string, number[]>;
  onBoardByCategory?: Record<string, number[]>;
  slotUtilization?: number[];
  showSlotUtil?: boolean;
}) {
  const { chartColors } = useClearcutTheme();
  const showImportedDate = importedDateVehicles && importedDateVehicles.length > 0;
  const importedDateColor = chartColors[5];

  const categoryKeys = useMemo(
    () => (breakoutMode !== 'total' && pickupsByCategory ? Object.keys(pickupsByCategory).sort() : []),
    [breakoutMode, pickupsByCategory],
  );

  const data = useMemo(
    () =>
      blocks.map((block, index) => {
        const point: Record<string, string | number | undefined> = {
          label: block.label,
          currentVehicles: Math.round((currentVehicles[index] ?? 0) * 10) / 10,
          runVehicles: Math.round((runVehicles[index] ?? 0) * 10) / 10,
          crOnBreak: Math.round((crOnBreak?.[index] ?? 0) * 10) / 10,
          nrOnBreak: Math.round((nrOnBreak?.[index] ?? 0) * 10) / 10,
          slotUtil: slotUtilization?.[index] ?? 0,
          importedDateVehicles: showImportedDate ? Math.round((importedDateVehicles[index] ?? 0) * 10) / 10 : undefined,
          irOnBreak: showImportedDate ? Math.round((irOnBreak?.[index] ?? 0) * 10) / 10 : undefined,
        };
        if (breakoutMode === 'total' || categoryKeys.length === 0) {
          point.pickups = Math.round((pickups[index] ?? 0) * 10) / 10;
          point.onBoard = Math.round((onBoard[index] ?? 0) * 10) / 10;
        } else {
          for (const cat of categoryKeys) {
            point[`pick_${cat}`] = Math.round((pickupsByCategory![cat][index] ?? 0) * 10) / 10;
            point[`ob_${cat}`] = Math.round((onBoardByCategory?.[cat]?.[index] ?? 0) * 10) / 10;
          }
        }
        return point;
      }),
    [blocks, onBoard, pickups, currentVehicles, runVehicles, crOnBreak, nrOnBreak, importedDateVehicles, irOnBreak, showImportedDate, breakoutMode, pickupsByCategory, onBoardByCategory, categoryKeys, slotUtilization],
  );

  const nameMap = useMemo(() => {
    const map: Record<string, string> = {
      currentVehicles: 'Current Routes',
      runVehicles: 'New Routes',
      onBoard: 'Active Trips',
      pickups: 'Pickups',
      importedDateVehicles: importedDateLabel ?? 'Selected Date',
    };
    for (const cat of categoryKeys) {
      map[`pick_${cat}`] = `Pickups (${cat})`;
      map[`ob_${cat}`] = `On Board (${cat})`;
    }
    return map;
  }, [importedDateLabel, categoryKeys]);

  return (
    <div className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-cc-border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} width={38} />
          <Tooltip content={<ChartTooltip nameMap={nameMap} breakColors={{ crOnBreak: chartColors[1], nrOnBreak: chartColors[3], irOnBreak: importedDateColor }} showSlotUtil={showSlotUtil} />} />
          <Legend
            formatter={(value) => nameMap[value] ?? value}
          />
          {showSlotUtil && data.map((entry, i) => {
            const util = ((entry.slotUtil as number) ?? 0);
            return util > 0 ? (
              <ReferenceArea
                key={`util-${i}`}
                x1={entry.label as string}
                x2={entry.label as string}
                fill={chartColors[0]}
                fillOpacity={util / 100 * 0.25}
                ifOverflow="visible"
              />
            ) : null;
          })}
          {breakoutMode === 'total' || categoryKeys.length === 0 ? (
            <>
              <Bar dataKey="onBoard" fill={`${chartColors[0]}40`} radius={[3, 3, 0, 0]} />
              <Bar dataKey="pickups" fill={chartColors[0]} radius={[3, 3, 0, 0]} />
            </>
          ) : (
            <>
              {categoryKeys.map((cat, i) => (
                <Bar
                  key={`ob_${cat}`}
                  dataKey={`ob_${cat}`}
                  stackId="onBoard"
                  fill={`${getCategoryColor(cat, breakoutMode, i)}66`}
                  radius={i === categoryKeys.length - 1 ? [3, 3, 0, 0] : undefined}
                />
              ))}
              {categoryKeys.map((cat, i) => (
                <Bar
                  key={`pick_${cat}`}
                  dataKey={`pick_${cat}`}
                  stackId="pickups"
                  fill={getCategoryColor(cat, breakoutMode, i)}
                  radius={i === categoryKeys.length - 1 ? [3, 3, 0, 0] : undefined}
                />
              ))}
            </>
          )}
          <Line type="monotone" dataKey="currentVehicles" stroke={chartColors[1]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          <Line type="monotone" dataKey="runVehicles" stroke={chartColors[3]} strokeWidth={2} strokeDasharray="6 3" dot={false} activeDot={{ r: 4 }} />
          {showImportedDate && (
            <Line type="monotone" dataKey="importedDateVehicles" stroke={importedDateColor} strokeWidth={3} strokeDasharray="1 6" strokeLinecap="round" dot={false} activeDot={{ r: 4 }} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PasswordPrompt({ onSubmit }: { onSubmit: (password: string) => Promise<void> }) {
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
      <Label htmlFor="unlock-password">Password</Label>
      <Input
        id="unlock-password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className="mt-1"
      />
      <Button className="mt-3" type="submit" disabled={!password || submitting}>
        {submitting ? 'Unlocking...' : 'Unlock'}
      </Button>
    </form>
  );
}
