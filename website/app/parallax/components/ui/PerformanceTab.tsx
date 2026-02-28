'use client';

import { ArrowDown, ArrowUp, Download } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';

import { Button } from '@/app/parallax/components/shadcn/button';
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
import type { ClearcutMetrics, ComputeMetricsOptions, PerRouteMetrics } from '@/lib/parallax/metrics';
import { computeClearcutMetrics, computePerRouteMetrics } from '@/lib/parallax/metrics';
import type { RouteRow, SessionState, TripRow } from '@/lib/parallax/types';

import { MetricCard, PerformanceCompositeChart, SectionCard } from './shared';

// ── Sortable column header ────────────────────────────────────────────

type SortColumn = keyof PerRouteMetrics;

function SortableHead({
  column,
  label,
  className,
  sortKey,
  sortDir,
  onSort,
}: {
  column: SortColumn;
  label: string;
  className?: string;
  sortKey: SortColumn;
  sortDir: 'asc' | 'desc';
  onSort: (key: SortColumn) => void;
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

// ── Excel export ──────────────────────────────────────────────────────

function toExcelRow(r: PerRouteMetrics) {
  return {
    Route: r.routeName,
    Trips: r.trips,
    Passengers: r.passengers,
    'Pickup OTP %': r.pickupOtpPct,
    'Dropoff OTP %': r.dropoffOtpPct,
    Productivity: r.productivity,
    'Service Hrs': r.serviceHours,
    'Revenue Hrs': r.revenueHours,
    'Utilization %': r.utilizationPct,
  };
}

function exportPerRouteToExcel(rows: PerRouteMetrics[], totals: PerRouteMetrics | null) {
  const data = rows.map(toExcelRow);
  if (totals && rows.length > 1) {
    data.push(toExcelRow(totals));
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data.length > 0 ? data : [{}]);
  ws['!cols'] = [
    { wch: 20 }, { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Route Performance');
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `route-performance-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main component ────────────────────────────────────────────────────

interface PerformanceTabProps {
  metrics: ClearcutMetrics;
  intervalMinutes: number;
  routes: RouteRow[];
  trips: TripRow[];
  sessionState: SessionState | null;
  metricsOptions: ComputeMetricsOptions;
}

export default function PerformanceTab({
  metrics,
  intervalMinutes,
  routes,
  trips,
  sessionState,
  metricsOptions,
}: PerformanceTabProps) {
  const uniqueRouteNames = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const r of routes) {
      const name = r.route_name ?? r.route_id;
      if (!seen.has(name)) {
        seen.add(name);
        result.push(name);
      }
    }
    return result.sort((a, b) => a.localeCompare(b));
  }, [routes]);

  const [selectedRouteName, setSelectedRouteName] = useState('all');

  useEffect(() => {
    if (selectedRouteName !== 'all' && !uniqueRouteNames.includes(selectedRouteName)) {
      setSelectedRouteName('all');
    }
  }, [uniqueRouteNames, selectedRouteName]);

  const displayMetrics = useMemo(() => {
    if (selectedRouteName === 'all' || !sessionState) return metrics;
    const matchingIds = routes
      .filter((r) => (r.route_name ?? r.route_id) === selectedRouteName)
      .map((r) => r.route_id);
    return computeClearcutMetrics(sessionState, {
      ...metricsOptions,
      selectedRouteIds: matchingIds,
    });
  }, [selectedRouteName, sessionState, metricsOptions, metrics, routes]);

  // ── Per-route metrics table ───────────────────────────────────────

  const perRouteRows = useMemo(() => {
    if (!sessionState) return [];
    const selectedRouteIds = selectedRouteName !== 'all'
      ? routes
          .filter((r) => (r.route_name ?? r.route_id) === selectedRouteName)
          .map((r) => r.route_id)
      : undefined;
    return computePerRouteMetrics(routes, trips, {
      selectedDays: metricsOptions.selectedDays,
      specificDate: metricsOptions.specificDate,
      selectedRouteIds,
      pickupOtpWindowBefore: sessionState.settings.pickup_otp_window_before_min,
      pickupOtpWindowAfter: sessionState.settings.pickup_otp_window_after_min,
      dropoffOtpWindowBefore: sessionState.settings.dropoff_otp_window_before_min,
      dropoffOtpWindowAfter: sessionState.settings.dropoff_otp_window_after_min,
    });
  }, [routes, trips, metricsOptions, sessionState, selectedRouteName]);

  const [sortKey, setSortKey] = useState<SortColumn>('routeName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function toggleSort(key: SortColumn) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const totalsRow = useMemo((): PerRouteMetrics | null => {
    if (perRouteRows.length === 0) return null;
    const count = perRouteRows.length;
    const trips = Math.round(perRouteRows.reduce((s, r) => s + r.trips, 0) * 10) / 10;
    const passengers = Math.round(perRouteRows.reduce((s, r) => s + r.passengers, 0) * 10) / 10;
    const serviceHours = Math.round(perRouteRows.reduce((s, r) => s + r.serviceHours, 0) * 10) / 10;
    const revenueHours = Math.round(perRouteRows.reduce((s, r) => s + r.revenueHours, 0) * 10) / 10;
    const occupiedMinutes = Math.round(perRouteRows.reduce((s, r) => s + r.occupiedMinutes, 0) * 10) / 10;
    const pickupEligibleWeighted = perRouteRows.reduce((s, r) => s + r.pickupOtpPct * r.trips, 0);
    const dropoffEligibleWeighted = perRouteRows.reduce((s, r) => s + r.dropoffOtpPct * r.trips, 0);
    return {
      routeName: 'Total',
      trips,
      passengers,
      pickupOtpPct: trips > 0 ? Math.round((pickupEligibleWeighted / trips) * 10) / 10 : 0,
      dropoffOtpPct: trips > 0 ? Math.round((dropoffEligibleWeighted / trips) * 10) / 10 : 0,
      productivity: serviceHours > 0 ? Math.round((trips / serviceHours) * 100) / 100 : 0,
      serviceHours,
      revenueHours,
      occupiedMinutes,
      utilizationPct: Math.round((perRouteRows.reduce((s, r) => s + r.utilizationPct, 0) / count) * 10) / 10,
    };
  }, [perRouteRows]);

  const sortedRows = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...perRouteRows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string' && typeof bv === 'string') {
        return av.localeCompare(bv) * dir;
      }
      return ((av as number) - (bv as number)) * dir;
    });
  }, [perRouteRows, sortKey, sortDir]);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-3">
        <MetricCard label="Pickup OTP" value={`${displayMetrics.pickupOtpPct}%`} />
        <MetricCard label="Dropoff OTP" value={`${displayMetrics.dropoffOtpPct}%`} />
        <MetricCard
          label="Trips"
          value={`${displayMetrics.avgTripsPerDay}`}
          sub={`Peak: ${displayMetrics.maxTripsPerDay}`}
        />
        <MetricCard
          label="Passengers"
          value={`${displayMetrics.avgPassengersPerDay}`}
          sub={`Peak: ${displayMetrics.maxPassengersPerDay}`}
        />
        <MetricCard
          label="Productivity"
          value={`${displayMetrics.avgProductivity}`}
          sub={`Peak: ${displayMetrics.peakProductivity}`}
        />
        <MetricCard
          label="Utilization"
          value={`${displayMetrics.avgUtilizationPct}%`}
          sub={`Svc: ${displayMetrics.avgServiceHours}h / Rev: ${displayMetrics.avgRevenueHours}h`}
        />
      </div>

      <SectionCard title={`Productivity & OTP (${intervalMinutes}-min)`}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-cc-text-muted">
            Productivity shown as bars (left axis). Pickup and dropoff OTP shown as lines (right axis, %).
          </div>
          {uniqueRouteNames.length > 1 && (
            <Select value={selectedRouteName} onValueChange={setSelectedRouteName}>
              <SelectTrigger className="h-7 text-xs w-auto min-w-[140px] ml-3 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Routes</SelectItem>
                {uniqueRouteNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <PerformanceCompositeChart
          productivity={displayMetrics.productivityByBlock}
          pickupOtp={displayMetrics.pickupOtpByBlock}
          dropoffOtp={displayMetrics.dropoffOtpByBlock}
          blocks={displayMetrics.blocks}
        />
      </SectionCard>

      <SectionCard title="Route Performance">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-cc-text-muted">
            Per-route metrics averaged across service days.
          </div>
          {sortedRows.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportPerRouteToExcel(sortedRows, totalsRow)}
              type="button"
            >
              <Download size={14} className="mr-1.5" /> Export
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead column="routeName" label="Route" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableHead column="trips" label="Trips" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableHead column="passengers" label="Passengers" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableHead column="pickupOtpPct" label="Pickup OTP" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableHead column="dropoffOtpPct" label="Dropoff OTP" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableHead column="productivity" label="Productivity" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableHead column="serviceHours" label="Svc Hrs" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableHead column="revenueHours" label="Rev Hrs" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableHead column="utilizationPct" label="Utilization" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-cc-text-muted">
                    No route data available
                  </TableCell>
                </TableRow>
              )}
              {totalsRow && sortedRows.length > 1 && (
                <TableRow className="border-b-2 border-cc-border font-semibold bg-cc-surface-2">
                  <TableCell>{totalsRow.routeName}</TableCell>
                  <TableCell>{totalsRow.trips}</TableCell>
                  <TableCell>{totalsRow.passengers}</TableCell>
                  <TableCell>{totalsRow.pickupOtpPct}%</TableCell>
                  <TableCell>{totalsRow.dropoffOtpPct}%</TableCell>
                  <TableCell>{totalsRow.productivity}</TableCell>
                  <TableCell>{totalsRow.serviceHours}</TableCell>
                  <TableCell>{totalsRow.revenueHours}</TableCell>
                  <TableCell>{totalsRow.utilizationPct}%</TableCell>
                </TableRow>
              )}
              {sortedRows.map((row) => (
                <TableRow
                  key={row.routeName}
                  className={`cursor-pointer hover:bg-cc-surface-2 transition-colors ${selectedRouteName === row.routeName ? 'bg-cc-surface-2' : ''}`}
                  onClick={() => setSelectedRouteName(selectedRouteName === row.routeName ? 'all' : row.routeName)}
                >
                  <TableCell className="font-medium">{row.routeName}</TableCell>
                  <TableCell>{row.trips}</TableCell>
                  <TableCell>{row.passengers}</TableCell>
                  <TableCell>{row.pickupOtpPct}%</TableCell>
                  <TableCell>{row.dropoffOtpPct}%</TableCell>
                  <TableCell>{row.productivity}</TableCell>
                  <TableCell>{row.serviceHours}</TableCell>
                  <TableCell>{row.revenueHours}</TableCell>
                  <TableCell>{row.utilizationPct}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
    </>
  );
}
