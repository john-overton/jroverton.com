'use client';

import type { ClearcutMetrics } from '@/lib/clearcut/metrics';

import { MetricCard, PerformanceCompositeChart, SectionCard } from './shared';

interface PerformanceTabProps {
  metrics: ClearcutMetrics;
  intervalMinutes: number;
}

export default function PerformanceTab({ metrics, intervalMinutes }: PerformanceTabProps) {
  return (
    <>
      <div className="row">
        <MetricCard label="Pickup OTP" value={`${metrics.pickupOtpPct}%`} />
        <MetricCard label="Dropoff OTP" value={`${metrics.dropoffOtpPct}%`} />
        <MetricCard label="Average Productivity" value={`${metrics.avgProductivity}`} />
        <MetricCard label="Peak Productivity" value={`${metrics.peakProductivity}`} />
      </div>
      <SectionCard title={`Productivity & OTP (${intervalMinutes}-min)`}>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
          Productivity shown as bars (left axis). Pickup and dropoff OTP shown as lines (right axis, %).
        </div>
        <PerformanceCompositeChart
          productivity={metrics.productivityByBlock}
          pickupOtp={metrics.pickupOtpByBlock}
          dropoffOtp={metrics.dropoffOtpByBlock}
          blocks={metrics.blocks}
        />
      </SectionCard>
    </>
  );
}
