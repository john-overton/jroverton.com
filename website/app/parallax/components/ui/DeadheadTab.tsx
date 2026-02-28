'use client';

import type { ClearcutMetrics } from '@/lib/clearcut/metrics';

import { HeatStrip, MetricCard, SectionCard, YardTripTable } from './shared';

interface DeadheadTabProps {
  metrics: ClearcutMetrics;
}

export default function DeadheadTab({ metrics }: DeadheadTabProps) {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <MetricCard label="Avg Leave Yard Slack" value={`${metrics.avgLeaveYardSlackMinutes} min`} />
        <MetricCard label="Avg Return Yard Slack" value={`${metrics.avgReturnYardSlackMinutes} min`} />
        <MetricCard label="Late Return %" value={`${metrics.lateReturnPct}%`} />
        <MetricCard label="Total Trips" value={`${metrics.totalTrips}`} />
      </div>
      <SectionCard title="Deadhead Ratio by 15-min Block">
        <HeatStrip values={metrics.deadheadByBlock} blocks={metrics.blocks} />
      </SectionCard>
      <SectionCard title="Yard Trips">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <YardTripTable title="Start of Service" trips={metrics.yardStartTrips} variant="start" />
          <YardTripTable title="Return to Yard" trips={metrics.yardEndTrips} variant="return" />
        </div>
      </SectionCard>
    </>
  );
}
