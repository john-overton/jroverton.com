'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ClearcutMetrics } from '@/lib/clearcut/metrics';
import { buildCurrentRunCut, buildOptimizedRoutes, computeAvgShiftHours } from '@/lib/clearcut/run-structure';
import type { OptimizationRow, RouteRow } from '@/lib/clearcut/types';

import { RunStructureChart, SectionCard } from './shared';

interface RunStructureTabProps {
  metrics: ClearcutMetrics;
  optimization: OptimizationRow;
  routes: RouteRow[];
  selectedDays: number[];
  readonlyView: boolean;
  intervalMinutes: number;
  onOptimizationChange: (
    key: 'target_productivity' | 'max_driver_spread_hrs' | 'peak_vehicles' | 'run_structure_json',
    value: number | string | null,
  ) => void;
}

function parseRunStructureJson(json: string | null): { minShiftHrs: number } {
  if (!json) return { minShiftHrs: 4 };
  try {
    const parsed = JSON.parse(json);
    return { minShiftHrs: typeof parsed.minShiftHrs === 'number' ? parsed.minShiftHrs : 4 };
  } catch {
    return { minShiftHrs: 4 };
  }
}

export default function RunStructureTab({
  metrics,
  optimization,
  routes,
  selectedDays,
  readonlyView,
  intervalMinutes,
  onOptimizationChange,
}: RunStructureTabProps) {
  const [localProductivity, setLocalProductivity] = useState(optimization.target_productivity ?? 2.0);
  const [localMaxShift, setLocalMaxShift] = useState(optimization.max_driver_spread_hrs ?? 12);
  const [localPeakVehicles, setLocalPeakVehicles] = useState(optimization.peak_vehicles ?? metrics.peakVehicles);
  const [localMinShift, setLocalMinShift] = useState(() => parseRunStructureJson(optimization.run_structure_json).minShiftHrs);

  useEffect(() => {
    setLocalProductivity(optimization.target_productivity ?? 2.0);
  }, [optimization.target_productivity]);
  useEffect(() => {
    setLocalMaxShift(optimization.max_driver_spread_hrs ?? 12);
  }, [optimization.max_driver_spread_hrs]);
  useEffect(() => {
    setLocalPeakVehicles(optimization.peak_vehicles ?? metrics.peakVehicles);
  }, [optimization.peak_vehicles, metrics.peakVehicles]);
  useEffect(() => {
    setLocalMinShift(parseRunStructureJson(optimization.run_structure_json).minShiftHrs);
  }, [optimization.run_structure_json]);

  const commitProductivity = useCallback(() => {
    onOptimizationChange('target_productivity', localProductivity);
  }, [localProductivity, onOptimizationChange]);
  const commitMaxShift = useCallback(() => {
    onOptimizationChange('max_driver_spread_hrs', localMaxShift);
  }, [localMaxShift, onOptimizationChange]);
  const commitPeakVehicles = useCallback(() => {
    onOptimizationChange('peak_vehicles', localPeakVehicles);
  }, [localPeakVehicles, onOptimizationChange]);
  const commitMinShift = useCallback(() => {
    onOptimizationChange('run_structure_json', JSON.stringify({ minShiftHrs: localMinShift }));
  }, [localMinShift, onOptimizationChange]);

  const avgShiftHours = useMemo(
    () => computeAvgShiftHours(routes, selectedDays),
    [routes, selectedDays],
  );

  const currentRunCut = useMemo(
    () => buildCurrentRunCut(routes, selectedDays, metrics.blocks, intervalMinutes),
    [routes, selectedDays, metrics.blocks, intervalMinutes],
  );

  const optimizedRoutes = useMemo(
    () =>
      buildOptimizedRoutes({
        blocks: metrics.blocks,
        pickupsByBlock: metrics.pickupsByBlock,
        targetProductivity: localProductivity,
        maxShiftHours: localMaxShift,
        minShiftHours: localMinShift,
        peakVehicles: localPeakVehicles,
      }),
    [metrics.blocks, metrics.pickupsByBlock, localProductivity, localMaxShift, localMinShift, localPeakVehicles],
  );

  // Compute vehicles-per-block from optimized routes for the chart line
  const optimizedVehiclesByBlock = useMemo(() => {
    const counts = new Array(metrics.blocks.length).fill(0) as number[];
    for (const route of optimizedRoutes) {
      for (const idx of route.activeBlockIndices) {
        if (idx >= 0 && idx < counts.length) counts[idx] += 1;
      }
    }
    return counts;
  }, [optimizedRoutes, metrics.blocks.length]);

  // Stats for current run cut
  const currentStats = useMemo(() => {
    const totalHours = currentRunCut.reduce((sum, r) => sum + r.durationHours, 0);
    const maxVehicles = metrics.peakVehicles;
    const productivity = metrics.avgProductivity;
    return {
      totalHours: Math.round(totalHours * 10) / 10,
      maxVehicles,
      productivity,
    };
  }, [currentRunCut, metrics.peakVehicles, metrics.avgProductivity]);

  // Stats for optimized routes
  const optimizedStats = useMemo(() => {
    const totalHours = optimizedRoutes.reduce((sum, r) => sum + r.durationHours, 0);
    const maxVehicles = Math.max(...optimizedVehiclesByBlock, 0);
    const totalTrips = optimizedRoutes.reduce((sum, r) => sum + r.estimatedTrips, 0);
    const productivity = totalHours > 0 ? Math.round((totalTrips / totalHours) * 100) / 100 : 0;
    return {
      totalHours: Math.round(totalHours * 10) / 10,
      maxVehicles,
      productivity,
    };
  }, [optimizedRoutes, optimizedVehiclesByBlock]);

  return (
    <>
      <SectionCard title="Optimization Parameters">
        <div className="row g-3">
          <div className="col-md-3">
            <label className="form-label">Target Productivity</label>
            <div style={{ fontSize: 12, color: '#2563eb', marginBottom: 4 }}>
              Actual: <strong>{metrics.avgProductivity}</strong> &middot; Target: <strong>{localProductivity}</strong>
            </div>
            <input
              className="form-range"
              disabled={readonlyView}
              type="range"
              min={1.0}
              max={3.5}
              step={0.1}
              value={localProductivity}
              onChange={(e) => setLocalProductivity(Number(e.target.value))}
              onPointerUp={commitProductivity}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">Min Shift Length</label>
            <div style={{ fontSize: 12, color: '#2563eb', marginBottom: 4 }}>
              Min: <strong>{localMinShift} hrs</strong>
            </div>
            <input
              className="form-range"
              disabled={readonlyView}
              type="range"
              min={2}
              max={8}
              step={0.5}
              value={localMinShift}
              onChange={(e) => setLocalMinShift(Number(e.target.value))}
              onPointerUp={commitMinShift}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">Max Shift Length</label>
            <div style={{ fontSize: 12, color: '#2563eb', marginBottom: 4 }}>
              Actual avg: <strong>{avgShiftHours} hrs</strong> &middot; Max: <strong>{localMaxShift} hrs</strong>
            </div>
            <input
              className="form-range"
              disabled={readonlyView}
              type="range"
              min={8}
              max={14}
              step={0.5}
              value={localMaxShift}
              onChange={(e) => setLocalMaxShift(Number(e.target.value))}
              onPointerUp={commitMaxShift}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">Peak Vehicles</label>
            <div style={{ fontSize: 12, color: '#2563eb', marginBottom: 4 }}>
              Actual: <strong>{metrics.peakVehicles}</strong> &middot; Target: <strong>{localPeakVehicles}</strong>
            </div>
            <input
              className="form-range"
              disabled={readonlyView}
              type="range"
              min={1}
              max={Math.max(metrics.peakVehicles + 10, 36)}
              step={1}
              value={localPeakVehicles}
              onChange={(e) => setLocalPeakVehicles(Number(e.target.value))}
              onPointerUp={commitPeakVehicles}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Demand & Vehicle Coverage">
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
          Demand shown as bars. Current vehicles (solid teal) and optimized vehicles (dashed amber) as line overlays.
        </div>
        <RunStructureChart
          pickups={metrics.pickupsByBlock}
          onBoard={metrics.onBoardByBlock}
          currentVehicles={metrics.vehiclesByBlock}
          optimizedVehicles={optimizedVehiclesByBlock}
          blocks={metrics.blocks}
        />
      </SectionCard>

      <div className="row">
        <div className="col-lg-6 mb-3">
          <SectionCard title="Average Run Cut">
            <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 13 }}>
              <span>Hours: <strong>{currentStats.totalHours}</strong></span>
              <span>Peak Vehicles: <strong>{currentStats.maxVehicles}</strong></span>
              <span>Productivity: <strong>{currentStats.productivity}</strong></span>
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
              Average shift times per route across selected days, rounded up to {intervalMinutes}-min blocks.
            </div>
            <table className="table table-sm mb-0">
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Shift Start</th>
                  <th>Shift End</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {currentRunCut.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ color: '#6b7280' }}>
                      No routes available
                    </td>
                  </tr>
                )}
                {currentRunCut.map((row) => (
                  <tr key={row.routeName}>
                    <td>{row.routeName}</td>
                    <td>{row.shiftStart}</td>
                    <td>{row.shiftEnd}</td>
                    <td>{row.durationHours} hrs</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </div>
        <div className="col-lg-6 mb-3">
          <SectionCard title="Optimized Routes">
            <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 13 }}>
              <span>Hours: <strong>{optimizedStats.totalHours}</strong></span>
              <span>Peak Vehicles: <strong>{optimizedStats.maxVehicles}</strong></span>
              <span>Productivity: <strong>{optimizedStats.productivity}</strong></span>
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
              Algorithmically built routes based on demand and optimization parameters.
            </div>
            <table className="table table-sm mb-0">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Shift Start</th>
                  <th>Shift End</th>
                  <th>Duration</th>
                  <th>Est. Trips</th>
                </tr>
              </thead>
              <tbody>
                {optimizedRoutes.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ color: '#6b7280' }}>
                      No routes generated
                    </td>
                  </tr>
                )}
                {optimizedRoutes.map((row) => (
                  <tr key={row.vehicleId}>
                    <td>Vehicle {row.vehicleId}</td>
                    <td>{row.shiftStart}</td>
                    <td>{row.shiftEnd}</td>
                    <td>{row.durationHours} hrs</td>
                    <td>{row.estimatedTrips}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
