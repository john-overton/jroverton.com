'use client';

import type { ClearcutMetrics } from '@/lib/clearcut/metrics';

import { DemandCompositeChart, HeatStrip, MetricCard, SectionCard } from './shared';

interface DemandTabProps {
  metrics: ClearcutMetrics;
  intervalMinutes: number;
}

export default function DemandTab({ metrics, intervalMinutes }: DemandTabProps) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
        <MetricCard label="Peak Pickups" value={`${metrics.peakPickups}`} />
        <MetricCard label="Peak On-Board" value={`${metrics.peakOnBoard}`} />
        <MetricCard label="Avg On-Board" value={`${metrics.avgOnBoard}`} />
        <MetricCard label="Peak Vehicles" value={`${metrics.peakVehicles}`} />
        <MetricCard label="Total Trips" value={`${metrics.totalTrips}`} />
      </div>
      <SectionCard title={`Demand and Active Vehicles (${intervalMinutes}-min)`}>
        <div className="text-xs text-cc-text-muted mb-2">
          Pickups and onboard demand are shown by {intervalMinutes}-minute block with vehicles on road as a line overlay.
        </div>
        <DemandCompositeChart
          pickups={metrics.pickupsByBlock}
          onBoard={metrics.onBoardByBlock}
          vehicles={metrics.vehiclesByBlock}
          blocks={metrics.blocks}
        />
      </SectionCard>
      <SectionCard title="Deadhead Intensity (empty-time heatmap)">
        <div className="text-xs text-cc-text-muted mb-2">
          Darker cells indicate a higher share of active vehicle time with no passengers on board.
        </div>
        <HeatStrip values={metrics.deadheadByBlock} blocks={metrics.blocks} />
      </SectionCard>
    </>
  );
}
