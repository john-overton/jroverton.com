'use client';

import { useState } from 'react';
import type { ClearcutMetrics } from '@/lib/parallax/metrics';

import { type BreakoutMode, DemandCompositeChart, HeatStrip, MetricCard, SectionCard } from './shared';

interface DemandTabProps {
  metrics: ClearcutMetrics;
  intervalMinutes: number;
}

export default function DemandTab({ metrics, intervalMinutes }: DemandTabProps) {
  const [demandMode, setDemandMode] = useState<'max' | 'avg'>('max');
  const [breakoutMode, setBreakoutMode] = useState<BreakoutMode>('total');

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
        <MetricCard
          label={`Peak Pickups${metrics.maxPeakPickupsDate ? ` · ${metrics.maxPeakPickupsDate}` : ''}`}
          value={`${metrics.maxPeakPickups}`}
          sub={`avg ${metrics.peakPickups}`}
        />
        <MetricCard
          label={`Peak On-Board Pax${metrics.maxPeakOnBoardDate ? ` · ${metrics.maxPeakOnBoardDate}` : ''}`}
          value={`${metrics.maxPeakOnBoardPassengers}`}
          sub={`avg ${metrics.avgPeakOnBoardPassengers}`}
        />
        <MetricCard
          label="Peak On-Board Time"
          value={`${metrics.peakOnBoardTimeMinutes} min`}
          sub={`avg ${metrics.avgOnBoardTimeMinutes} min`}
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
          <div className="flex items-center gap-3 shrink-0 ml-3">
            <div className="flex gap-1 text-xs">
              <button
                className={`px-2 py-0.5 rounded ${breakoutMode === 'total' ? 'bg-cc-accent text-white' : 'bg-cc-surface-2 text-cc-text-muted'}`}
                onClick={() => setBreakoutMode('total')}
              >Total</button>
              <button
                className={`px-2 py-0.5 rounded ${breakoutMode === 'byStatus' ? 'bg-cc-accent text-white' : 'bg-cc-surface-2 text-cc-text-muted'}`}
                onClick={() => setBreakoutMode('byStatus')}
              >By Status</button>
              <button
                className={`px-2 py-0.5 rounded ${breakoutMode === 'byPassengerType' ? 'bg-cc-accent text-white' : 'bg-cc-surface-2 text-cc-text-muted'}`}
                onClick={() => setBreakoutMode('byPassengerType')}
              >By Mode</button>
            </div>
            <div className="flex gap-1 text-xs">
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
        </div>
        <DemandCompositeChart
          pickups={metrics.pickupsByBlock}
          onBoard={metrics.onBoardByBlock}
          vehicles={metrics.vehiclesByBlock}
          maxPickups={metrics.maxPickupsByBlock}
          maxOnBoard={metrics.maxOnBoardByBlock}
          maxVehicles={metrics.maxVehiclesByBlock}
          onBreak={metrics.vehiclesOnBreakByBlock}
          maxOnBreak={metrics.maxVehiclesOnBreakByBlock}
          blocks={metrics.blocks}
          mode={demandMode}
          breakoutMode={breakoutMode}
          pickupsByCategory={
            breakoutMode === 'byStatus'
              ? metrics.pickupsByBlockByStatus
              : breakoutMode === 'byPassengerType'
              ? metrics.pickupsByBlockByPassengerType
              : undefined
          }
          onBoardByCategory={
            breakoutMode === 'byStatus'
              ? metrics.onBoardByBlockByStatus
              : breakoutMode === 'byPassengerType'
              ? metrics.onBoardByBlockByPassengerType
              : undefined
          }
          maxPickupsByCategory={
            breakoutMode === 'byStatus'
              ? metrics.maxPickupsByBlockByStatus
              : breakoutMode === 'byPassengerType'
              ? metrics.maxPickupsByBlockByPassengerType
              : undefined
          }
          maxOnBoardByCategory={
            breakoutMode === 'byStatus'
              ? metrics.maxOnBoardByBlockByStatus
              : breakoutMode === 'byPassengerType'
              ? metrics.maxOnBoardByBlockByPassengerType
              : undefined
          }
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
