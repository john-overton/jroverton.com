'use client';

import type { ClearcutMetrics } from '@/lib/clearcut/metrics';

import { MetricCard, MiniBars, SectionCard } from './shared';

interface RunsTabProps {
  metrics: ClearcutMetrics;
}

export default function RunsTab({ metrics }: RunsTabProps) {
  return (
    <>
      <div className="row">
        <MetricCard label="Current Runs" value={`${metrics.currentRuns}`} />
        <MetricCard label="Optimized Runs" value={`${metrics.optimizedRuns}`} />
        <MetricCard label="Imported Service Hours" value={`${metrics.importedServiceHours}`} />
        <MetricCard label="Optimized Service Hours" value={`${metrics.optimizedServiceHours}`} />
      </div>
      <SectionCard title="Current vs Optimized Vehicle Load">
        <div className="row">
          <div className="col-md-6 mb-3">
            <h4 style={{ fontSize: 15 }}>Current</h4>
            <MiniBars values={metrics.vehiclesByBlock} />
          </div>
          <div className="col-md-6 mb-3">
            <h4 style={{ fontSize: 15 }}>Optimized</h4>
            <MiniBars values={metrics.vehiclesByBlock.map((value) => Math.max(0, value - 1))} />
          </div>
        </div>
      </SectionCard>
    </>
  );
}
