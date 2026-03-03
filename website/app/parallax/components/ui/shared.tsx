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
import type { RouteRow, TripRow } from '@/lib/parallax/types';
import type { YardTripRow } from '@/lib/parallax/metrics';
import { useClearcutTheme } from '@/app/parallax/theme/ClearcutThemeProvider';

export const DEMAND_BLOCK_MINUTES = 15;

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

function ChartTooltip({ active, payload, label, nameMap, breakColors }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  nameMap: Record<string, string>;
  breakColors?: Record<string, string>;
}) {
  if (!active || !payload?.length) return null;
  const dataPoint = (payload[0] as unknown as { payload: Record<string, number> }).payload;
  const onBreak = dataPoint.onBreak ?? 0;
  const crOnBreak = dataPoint.crOnBreak ?? 0;
  const nrOnBreak = dataPoint.nrOnBreak ?? 0;
  const irOnBreak = dataPoint.irOnBreak ?? 0;
  const breakStyle = { color: 'var(--color-cc-text-muted)', lineHeight: 1.6 } as const;
  return (
    <div style={{
      borderRadius: 8,
      background: 'var(--color-cc-surface-1)',
      color: 'var(--color-cc-text)',
      border: '1px solid var(--color-cc-border)',
      padding: '8px 12px',
      fontSize: 13,
    }}>
      <div style={{ color: 'var(--color-cc-text)', marginBottom: 4, fontWeight: 500 }}>Time: {label}</div>
      {payload.map((entry) => (
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
  mode?: 'avg' | 'max';
}) {
  const { chartColors } = useClearcutTheme();
  const activePickups = mode === 'max' && maxPickups ? maxPickups : pickups;
  const activeOnBoard = mode === 'max' && maxOnBoard ? maxOnBoard : onBoard;
  const activeVehicles = mode === 'max' && maxVehicles ? maxVehicles : vehicles;
  const activeOnBreak = mode === 'max' && maxOnBreak ? maxOnBreak : (onBreak ?? []);

  // Fix Y-axis to the max across both modes so the scale stays constant during transitions
  const yMax = useMemo(() => {
    const allValues = [
      ...pickups, ...onBoard, ...vehicles,
      ...(maxPickups ?? []), ...(maxOnBoard ?? []), ...(maxVehicles ?? []),
    ];
    return Math.ceil(Math.max(...allValues, 1));
  }, [pickups, onBoard, vehicles, maxPickups, maxOnBoard, maxVehicles]);

  const data = useMemo(
    () =>
      blocks.map((block, index) => ({
        label: block.label,
        pickups: Math.round((activePickups[index] ?? 0) * 10) / 10,
        onBoard: Math.round((activeOnBoard[index] ?? 0) * 10) / 10,
        vehicles: Math.round((activeVehicles[index] ?? 0) * 10) / 10,
        onBreak: Math.round((activeOnBreak[index] ?? 0) * 10) / 10,
      })),
    [blocks, activeOnBoard, activePickups, activeVehicles, activeOnBreak],
  );

  const nameMap = useMemo(() => ({
    vehicles: 'Routes On Road',
    onBoard: 'Active Trips',
    pickups: 'Pickups',
  }), []);

  return (
    <div className="h-[230px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-cc-border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} width={38} domain={[0, yMax]} />
          <Tooltip content={<ChartTooltip nameMap={nameMap} breakColors={{ onBreak: chartColors[1] }} />} />
          <Bar dataKey="onBoard" fill={`${chartColors[0]}40`} radius={[3, 3, 0, 0]} />
          <Bar dataKey="pickups" fill={chartColors[0]} radius={[3, 3, 0, 0]} />
          <Line
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
}: {
  productivity: number[];
  pickupOtp: number[];
  dropoffOtp: number[];
  blocks: Array<{ label: string }>;
}) {
  const { chartColors } = useClearcutTheme();
  const data = useMemo(
    () =>
      blocks.map((block, index) => ({
        label: block.label,
        productivity: Math.round((productivity[index] ?? 0) * 100) / 100,
        pickupOtp: Math.round((pickupOtp[index] ?? 0) * 10) / 10,
        dropoffOtp: Math.round((dropoffOtp[index] ?? 0) * 10) / 10,
      })),
    [blocks, productivity, pickupOtp, dropoffOtp],
  );

  return (
    <div className="h-[345px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-cc-border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis yAxisId="left" allowDecimals width={38} />
          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} width={38} tickFormatter={(v) => `${v}%`} />
          <Tooltip
            formatter={(value: number | string | undefined, name: string | undefined) => {
              const v = typeof value === 'number' ? value : Number(value ?? 0);
              if (name === 'pickupOtp') return [`${v}%`, 'Pickup OTP'];
              if (name === 'dropoffOtp') return [`${v}%`, 'Dropoff OTP'];
              return [v, 'Productivity'];
            }}
            labelFormatter={(label) => `Time: ${label}`}
            contentStyle={{ borderRadius: 8, background: 'var(--color-cc-surface-1)', color: 'var(--color-cc-text)', borderColor: 'var(--color-cc-border)' }}
            labelStyle={{ color: 'var(--color-cc-text)' }}
            itemStyle={{ color: 'var(--color-cc-text-secondary)' }}
          />
          <Legend
            formatter={(value) => {
              if (value === 'pickupOtp') return 'Pickup OTP';
              if (value === 'dropoffOtp') return 'Dropoff OTP';
              return 'Productivity';
            }}
          />
          <Bar yAxisId="left" dataKey="productivity" fill={`${chartColors[0]}66`} radius={[3, 3, 0, 0]} />
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
}) {
  const { chartColors } = useClearcutTheme();
  const showImportedDate = importedDateVehicles && importedDateVehicles.length > 0;

  const importedDateColor = chartColors[5];
  const data = useMemo(
    () =>
      blocks.map((block, index) => ({
        label: block.label,
        pickups: Math.round((pickups[index] ?? 0) * 10) / 10,
        onBoard: Math.round((onBoard[index] ?? 0) * 10) / 10,
        currentVehicles: Math.round((currentVehicles[index] ?? 0) * 10) / 10,
        runVehicles: Math.round((runVehicles[index] ?? 0) * 10) / 10,
        crOnBreak: Math.round((crOnBreak?.[index] ?? 0) * 10) / 10,
        nrOnBreak: Math.round((nrOnBreak?.[index] ?? 0) * 10) / 10,
        importedDateVehicles: showImportedDate ? Math.round((importedDateVehicles[index] ?? 0) * 10) / 10 : undefined,
        irOnBreak: showImportedDate ? Math.round((irOnBreak?.[index] ?? 0) * 10) / 10 : undefined,
      })),
    [blocks, onBoard, pickups, currentVehicles, runVehicles, crOnBreak, nrOnBreak, importedDateVehicles, irOnBreak, showImportedDate],
  );

  const nameMap = useMemo(() => ({
    currentVehicles: 'Current Routes',
    runVehicles: 'New Routes',
    onBoard: 'Active Trips',
    pickups: 'Pickups',
    importedDateVehicles: importedDateLabel ?? 'Selected Date',
  }), [importedDateLabel]);

  return (
    <div className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-cc-border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} width={38} />
          <Tooltip content={<ChartTooltip nameMap={nameMap} breakColors={{ crOnBreak: chartColors[1], nrOnBreak: chartColors[3], irOnBreak: importedDateColor }} />} />
          <Legend
            formatter={(value) => {
              if (value === 'currentVehicles') return 'Current Routes';
              if (value === 'runVehicles') return 'New Routes';
              if (value === 'onBoard') return 'Active Trips';
              if (value === 'importedDateVehicles') return importedDateLabel ?? 'Selected Date';
              return 'Pickups';
            }}
          />
          <Bar dataKey="onBoard" fill={`${chartColors[0]}40`} radius={[3, 3, 0, 0]} />
          <Bar dataKey="pickups" fill={chartColors[0]} radius={[3, 3, 0, 0]} />
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
