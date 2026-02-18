'use client';

import { FormEvent, ReactNode, useMemo, useState } from 'react';
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

import type { TripRow } from '@/lib/clearcut/types';

export const CLEARCUT_FONT_STACK =
  '"Inter", "SF Pro Text", "Segoe UI", "Helvetica Neue", Arial, system-ui, sans-serif';
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
  columnClass,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  columnClass?: string;
}) {
  return (
    <div className={columnClass ?? 'col-md-3 col-sm-6 mb-3'}>
      <div style={{ border: '1px solid #dee5f0', borderRadius: 10, padding: '0.75rem', background: '#fff' }}>
        <div style={{ color: '#6b7280', fontSize: 13 }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: color ?? '#1f2937' }}>{value}</div>
        {sub && <div style={{ color: '#6b7280', fontSize: 12 }}>{sub}</div>}
      </div>
    </div>
  );
}

export function MiniBars({ values, max }: { values: number[]; max?: number }) {
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

export function HeatStrip({ values, blocks }: { values: number[]; blocks?: Array<{ label: string }> }) {
  const max = Math.max(...values, 1);
  const data = values.map((value, index) => ({
    idx: index,
    value: Math.round(value * 10) / 10,
    unit: 1,
    label: blocks?.[index]?.label ?? `Block ${index + 1}`,
  }));
  return (
    <div style={{ height: 42, borderRadius: 6, overflow: 'visible', border: '1px solid #dbe3ef' }}>
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

export function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ border: '1px solid #dee5f0', borderRadius: 10, background: '#fff', padding: '0.9rem', marginBottom: '0.9rem' }}>
      <h3 style={{ fontSize: 17, marginBottom: '0.75rem' }}>{title}</h3>
      {children}
    </section>
  );
}

export function TripTable({ title, trips }: { title: string; trips: Array<{ trip_id: string; route_id: string }> }) {
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
