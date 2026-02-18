'use client';

import type { ClearcutMetrics } from '@/lib/clearcut/metrics';

import { MetricCard, MiniBars, SectionCard } from './shared';

interface PerformanceTabProps {
  metrics: ClearcutMetrics;
  otpTargetPct: number;
}

export default function PerformanceTab({ metrics, otpTargetPct }: PerformanceTabProps) {
  return (
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
        <MetricCard label="OTP Target" value={`${otpTargetPct}%`} />
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
  );
}
