'use client';

import type { ClearcutMetrics } from '@/lib/clearcut/metrics';

import { DemandCompositeChart, HeatStrip, MetricCard, SectionCard } from './shared';

interface DemandTabProps {
  metrics: ClearcutMetrics;
}

export default function DemandTab({ metrics }: DemandTabProps) {
  return (
    <>
      <div className="row">
        <MetricCard label="Peak Pickups" value={`${metrics.peakPickups}`} />
        <MetricCard label="Peak On-Board" value={`${metrics.peakOnBoard}`} />
        <MetricCard label="Peak Vehicles" value={`${metrics.peakVehicles}`} />
        <MetricCard label="Total Trips" value={`${metrics.totalTrips}`} />
      </div>
      <SectionCard title="Demand and Active Vehicles (15-min)">
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
          Pickups and onboard demand are shown by 15-minute block with vehicles on road as a line overlay.
        </div>
        <DemandCompositeChart
          pickups={metrics.pickupsByBlock}
          onBoard={metrics.onBoardByBlock}
          vehicles={metrics.vehiclesByBlock}
          blocks={metrics.blocks}
        />
      </SectionCard>
      <SectionCard title="Deadhead Intensity (empty-time heatmap)">
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
          Darker cells indicate a higher share of active vehicle time with no passengers on board.
        </div>
        <HeatStrip values={metrics.deadheadByBlock} blocks={metrics.blocks} />
      </SectionCard>
    </>
  );
}
