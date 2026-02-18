'use client';

import type { ClearcutMetrics } from '@/lib/clearcut/metrics';

import { HeatStrip, MetricCard, SectionCard, TripTable } from './shared';

interface DeadheadTabProps {
  metrics: ClearcutMetrics;
}

export default function DeadheadTab({ metrics }: DeadheadTabProps) {
  return (
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
  );
}
