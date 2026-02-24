'use client';

import { useEffect, useMemo, useState } from 'react';

import type { ClearcutMetrics, ComputeMetricsOptions } from '@/lib/clearcut/metrics';
import { computeClearcutMetrics } from '@/lib/clearcut/metrics';
import type { RouteRow, SessionState } from '@/lib/clearcut/types';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/clearcut/components/shadcn/select';
import { MetricCard, PerformanceCompositeChart, SectionCard } from './shared';

interface PerformanceTabProps {
  metrics: ClearcutMetrics;
  intervalMinutes: number;
  routes: RouteRow[];
  sessionState: SessionState | null;
  metricsOptions: ComputeMetricsOptions;
}

export default function PerformanceTab({
  metrics,
  intervalMinutes,
  routes,
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

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
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
    </>
  );
}
