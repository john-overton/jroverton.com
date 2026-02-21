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

import { Button } from '@/app/clearcut/components/shadcn/button';
import { Input } from '@/app/clearcut/components/shadcn/input';
import { Label } from '@/app/clearcut/components/shadcn/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/clearcut/components/shadcn/table';
import type { TripRow } from '@/lib/clearcut/types';
import { useClearcutTheme } from '@/app/clearcut/theme/ClearcutThemeProvider';

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

export function deriveSliderBoundsFromTrips(params: {
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
            contentStyle={{ borderRadius: 8, borderColor: 'var(--color-cc-border)' }}
          />
          <Bar dataKey="value" fill={chartColors[0]} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HeatStrip({ values, blocks }: { values: number[]; blocks?: Array<{ label: string }> }) {
  const max = Math.max(...values, 1);
  const data = values.map((value, index) => ({
    idx: index,
    value: Math.round(value * 10) / 10,
    unit: 1,
    label: blocks?.[index]?.label ?? `Block ${index + 1}`,
  }));
  return (
    <div className="h-[42px] rounded-md overflow-visible border border-cc-border">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barCategoryGap={0}>
          <XAxis dataKey="idx" hide />
          <YAxis hide domain={[0, 1]} />
          <Tooltip
            allowEscapeViewBox={{ x: true, y: true }}
            formatter={(_value: number | string | undefined, _name, item) => {
              const payload = item?.payload as { value?: number; label?: string } | undefined;
              return [`${payload?.value ?? 0}%`, 'Empty-time'];
            }}
            labelFormatter={(_label, payload) => {
              const first = payload?.[0]?.payload as { label?: string } | undefined;
              return first?.label ?? '';
            }}
            contentStyle={{ borderRadius: 8, borderColor: 'var(--color-cc-border)' }}
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

export function DemandCompositeChart({
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
  const { chartColors } = useClearcutTheme();
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
    <div className="h-[230px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-cc-border)" vertical={false} />
          <XAxis dataKey="label" hide />
          <YAxis allowDecimals={false} width={38} />
          <Tooltip
            formatter={(value: number | string | undefined, name: string | undefined) => {
              const normalizedValue = typeof value === 'number' ? value : Number(value ?? 0);
              if (name === 'vehicles') return [normalizedValue, 'Routes On Road'];
              if (name === 'onBoard') return [normalizedValue, 'Active Trips'];
              return [normalizedValue, 'Pickups'];
            }}
            labelFormatter={(label) => `Time: ${label}`}
            contentStyle={{ borderRadius: 8, borderColor: 'var(--color-cc-border)' }}
          />
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
    <div className="h-[460px]">
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
            contentStyle={{ borderRadius: 8, borderColor: 'var(--color-cc-border)' }}
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

export function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border border-cc-border rounded-[10px] bg-cc-surface-1 p-4 mb-4">
      <h3 className="text-[17px] font-semibold mb-3">{title}</h3>
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

export function RunStructureChart({
  pickups,
  onBoard,
  currentVehicles,
  optimizedVehicles,
  blocks,
}: {
  pickups: number[];
  onBoard: number[];
  currentVehicles: number[];
  optimizedVehicles: number[];
  blocks: Array<{ label: string }>;
}) {
  const { chartColors } = useClearcutTheme();
  const data = useMemo(
    () =>
      blocks.map((block, index) => ({
        label: block.label,
        pickups: Math.round((pickups[index] ?? 0) * 10) / 10,
        onBoard: Math.round((onBoard[index] ?? 0) * 10) / 10,
        currentVehicles: Math.round((currentVehicles[index] ?? 0) * 10) / 10,
        optimizedVehicles: Math.round((optimizedVehicles[index] ?? 0) * 10) / 10,
      })),
    [blocks, onBoard, pickups, currentVehicles, optimizedVehicles],
  );

  return (
    <div className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-cc-border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} width={38} />
          <Tooltip
            formatter={(value: number | string | undefined, name: string | undefined) => {
              const v = typeof value === 'number' ? value : Number(value ?? 0);
              if (name === 'currentVehicles') return [v, 'Current Vehicles'];
              if (name === 'optimizedVehicles') return [v, 'Optimized Vehicles'];
              if (name === 'onBoard') return [v, 'Active Trips'];
              return [v, 'Pickups'];
            }}
            labelFormatter={(label) => `Time: ${label}`}
            contentStyle={{ borderRadius: 8, borderColor: 'var(--color-cc-border)' }}
          />
          <Legend
            formatter={(value) => {
              if (value === 'currentVehicles') return 'Current Vehicles';
              if (value === 'optimizedVehicles') return 'Optimized Vehicles';
              if (value === 'onBoard') return 'Active Trips';
              return 'Pickups';
            }}
          />
          <Bar dataKey="onBoard" fill={`${chartColors[0]}40`} radius={[3, 3, 0, 0]} />
          <Bar dataKey="pickups" fill={chartColors[0]} radius={[3, 3, 0, 0]} />
          <Line type="monotone" dataKey="currentVehicles" stroke={chartColors[1]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          <Line type="monotone" dataKey="optimizedVehicles" stroke={chartColors[3]} strokeWidth={2} strokeDasharray="6 3" dot={false} activeDot={{ r: 4 }} />
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
