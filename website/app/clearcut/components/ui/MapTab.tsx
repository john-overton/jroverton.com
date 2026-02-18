'use client';

import { useState } from 'react';

import type { ClearcutMetrics } from '@/lib/clearcut/metrics';

import { HeatStrip, SectionCard } from './shared';

interface MapTabProps {
  metrics: ClearcutMetrics;
}

export default function MapTab({ metrics }: MapTabProps) {
  const [mapBlockIdx, setMapBlockIdx] = useState(0);

  return (
    <>
      <SectionCard title="Trip Heatmap">
        <div style={{ marginBottom: 10 }}>
          <label className="form-label">
            Time Block ({metrics.blocks[mapBlockIdx]?.label ?? 'N/A'})
          </label>
          <input
            className="form-range"
            type="range"
            min={0}
            max={Math.max(0, metrics.blocks.length - 1)}
            value={mapBlockIdx}
            onChange={(event) => setMapBlockIdx(Number(event.target.value))}
          />
        </div>
        <HeatStrip values={metrics.pickupsByBlock.map((value, idx) => (idx === mapBlockIdx ? value : value * 0.4))} />
      </SectionCard>
    </>
  );
}
