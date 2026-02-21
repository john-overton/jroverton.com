'use client';

import { useState } from 'react';
import type { ClearcutMetrics } from '@/lib/clearcut/metrics';

import { DemandCompositeChart, HeatStrip, MetricCard, SectionCard } from './shared';

interface DemandTabProps {
  metrics: ClearcutMetrics;
  intervalMinutes: number;
}

export default function DemandTab({ metrics, intervalMinutes }: DemandTabProps) {
  const [demandMode, setDemandMode] = useState<'max' | 'avg'>('max');

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
        <MetricCard
          label={`Peak Pickups${metrics.maxPeakPickupsDate ? ` · ${metrics.maxPeakPickupsDate}` : ''}`}
          value={`${metrics.maxPeakPickups}`}
          sub={`avg ${metrics.peakPickups}`}
        />
        <MetricCard
          label={`Peak On-Board${metrics.maxPeakOnBoardDate ? ` · ${metrics.maxPeakOnBoardDate}` : ''}`}
          value={`${metrics.maxPeakOnBoardPassengers}`}
          sub={`avg ${metrics.avgPeakOnBoardPassengers}`}
        />
        <MetricCard
          label={`Peak Vehicles${metrics.maxPeakVehiclesDate ? ` · ${metrics.maxPeakVehiclesDate}` : ''}`}
          value={`${metrics.maxPeakVehicles}`}
          sub={`avg ${metrics.peakVehicles}`}
        />
        <MetricCard label="Total Trips" value={`${metrics.totalTrips}`} />
      </div>
      <SectionCard title={`Demand and Active Vehicles (${intervalMinutes}-min)`}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-cc-text-muted">
            Pickups and onboard demand are shown by {intervalMinutes}-minute block with vehicles on road as a line overlay.
          </div>
          <div className="flex gap-1 text-xs shrink-0 ml-3">
            <button
              className={`px-2 py-0.5 rounded ${demandMode === 'max' ? 'bg-cc-accent text-white' : 'bg-cc-surface-2 text-cc-text-muted'}`}
              onClick={() => setDemandMode('max')}
            >Max</button>
            <button
              className={`px-2 py-0.5 rounded ${demandMode === 'avg' ? 'bg-cc-accent text-white' : 'bg-cc-surface-2 text-cc-text-muted'}`}
              onClick={() => setDemandMode('avg')}
            >Avg</button>
          </div>
        </div>
        <DemandCompositeChart
          pickups={metrics.pickupsByBlock}
          onBoard={metrics.onBoardByBlock}
          vehicles={metrics.vehiclesByBlock}
          maxPickups={metrics.maxPickupsByBlock}
          maxOnBoard={metrics.maxOnBoardByBlock}
          maxVehicles={metrics.maxVehiclesByBlock}
          blocks={metrics.blocks}
          mode={demandMode}
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
