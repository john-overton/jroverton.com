'use client';

import type { ClearcutMetrics } from '@/lib/clearcut/metrics';
import type { OptimizationRow } from '@/lib/clearcut/types';

import { MetricCard, SectionCard } from './shared';

interface OptimizeTabProps {
  metrics: ClearcutMetrics;
  optimization: OptimizationRow;
  readonlyView: boolean;
  onOptimizationChange: (
    key: 'target_productivity' | 'min_otp_target' | 'max_driver_spread_hrs' | 'peak_vehicles' | 'run_structure_json',
    value: number | string | null,
  ) => void;
}

export default function OptimizeTab({ metrics, optimization, readonlyView, onOptimizationChange }: OptimizeTabProps) {
  return (
    <>
      <SectionCard title="Optimization Parameters">
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label">
              Target Productivity ({optimization.target_productivity ?? 2.0})
            </label>
            <input
              className="form-range"
              disabled={readonlyView}
              type="range"
              min={1.0}
              max={3.5}
              step={0.1}
              value={optimization.target_productivity ?? 2.0}
              onChange={(event) =>
                onOptimizationChange('target_productivity', Number(event.target.value))
              }
            />
          </div>
          <div className="col-md-6">
            <label className="form-label">
              Min OTP Target ({optimization.min_otp_target ?? 85}%)
            </label>
            <input
              className="form-range"
              disabled={readonlyView}
              type="range"
              min={75}
              max={98}
              step={1}
              value={optimization.min_otp_target ?? 85}
              onChange={(event) =>
                onOptimizationChange('min_otp_target', Number(event.target.value))
              }
            />
          </div>
          <div className="col-md-6">
            <label className="form-label">
              Max Driver Spread ({optimization.max_driver_spread_hrs ?? 12} hrs)
            </label>
            <input
              className="form-range"
              disabled={readonlyView}
              type="range"
              min={8}
              max={14}
              step={0.5}
              value={optimization.max_driver_spread_hrs ?? 12}
              onChange={(event) =>
                onOptimizationChange('max_driver_spread_hrs', Number(event.target.value))
              }
            />
          </div>
          <div className="col-md-6">
            <label className="form-label">
              Peak Vehicles ({optimization.peak_vehicles ?? metrics.peakVehicles})
            </label>
            <input
              className="form-range"
              disabled={readonlyView}
              type="range"
              min={12}
              max={36}
              step={1}
              value={optimization.peak_vehicles ?? metrics.peakVehicles}
              onChange={(event) =>
                onOptimizationChange('peak_vehicles', Number(event.target.value))
              }
            />
          </div>
        </div>
      </SectionCard>
      <div className="row">
        <MetricCard label="Est. Service Hours" value={`${metrics.optimizedServiceHours}`} />
        <MetricCard label="Est. OTP" value={`${Math.max(metrics.avgOtp, 85)}%`} />
        <MetricCard label="Est. Deadhead" value={`${Math.max(3, metrics.avgDeadheadStartMiles)}%`} />
        <MetricCard label="Est. Productivity" value={`${Math.max(1.2, metrics.avgProductivity)}`} />
      </div>
    </>
  );
}
