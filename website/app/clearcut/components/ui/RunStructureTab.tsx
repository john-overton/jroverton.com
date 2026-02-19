'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { ClearcutMetrics } from '@/lib/clearcut/metrics';
import { buildOptimizedRoutes, buildRunCutForDate, computeAvgShiftHours, getAvailableDates } from '@/lib/clearcut/run-structure';
import type { OptimizationRow, RouteRow } from '@/lib/clearcut/types';

import { RunStructureChart, SectionCard } from './shared';

interface RunStructureTabProps {
  metrics: ClearcutMetrics;
  fullDayMetrics: ClearcutMetrics;
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
  fullDayMetrics,
  optimization,
  routes,
  selectedDays,
  readonlyView,
  intervalMinutes,
  onOptimizationChange,
}: RunStructureTabProps) {
  // Local slider overrides — null means "use prop value", non-null means "user is dragging"
  const [draftProductivity, setDraftProductivity] = useState<number | null>(null);
  const [draftMaxShift, setDraftMaxShift] = useState<number | null>(null);
  const [draftMinShift, setDraftMinShift] = useState<number | null>(null);

  // Resolved values: draft (if dragging) or persisted prop
  const localProductivity = draftProductivity ?? optimization.target_productivity ?? 2.0;
  const localMaxShift = draftMaxShift ?? optimization.max_driver_spread_hrs ?? 12;
  const localMinShift = draftMinShift ?? parseRunStructureJson(optimization.run_structure_json).minShiftHrs;

  // Refs to read latest value in pointer-up handlers without stale closures
  const productivityRef = useRef(localProductivity);
  productivityRef.current = localProductivity;
  const maxShiftRef = useRef(localMaxShift);
  maxShiftRef.current = localMaxShift;
  const minShiftRef = useRef(localMinShift);
  minShiftRef.current = localMinShift;

  const [selectedRunCutDate, setSelectedRunCutDate] = useState<string | null>(null);

  const availableDates = useMemo(
    () => getAvailableDates(routes, selectedDays),
    [routes, selectedDays],
  );

  // Auto-select first available date when filter changes
  useEffect(() => {
    if (availableDates.length > 0 && (!selectedRunCutDate || !availableDates.includes(selectedRunCutDate))) {
      setSelectedRunCutDate(availableDates[0]);
    } else if (availableDates.length === 0) {
      setSelectedRunCutDate(null);
    }
  }, [availableDates, selectedRunCutDate]);

  const avgShiftHours = useMemo(
    () => computeAvgShiftHours(routes, selectedDays),
    [routes, selectedDays],
  );

  const currentRunCut = useMemo(
    () => selectedRunCutDate ? buildRunCutForDate(routes, selectedRunCutDate, fullDayMetrics.blocks, intervalMinutes) : [],
    [routes, selectedRunCutDate, fullDayMetrics.blocks, intervalMinutes],
  );

  const optimizedRoutes = useMemo(
    () =>
      buildOptimizedRoutes({
        blocks: fullDayMetrics.blocks,
        activeTripsPerBlock: fullDayMetrics.onBoardByBlock,
        targetProductivity: localProductivity,
        maxShiftHours: localMaxShift,
        minShiftHours: localMinShift,
        startDeadheadMinutes: fullDayMetrics.avgStartDeadheadMinutes,
        endDeadheadMinutes: fullDayMetrics.avgEndDeadheadMinutes,
      }),
    [fullDayMetrics.blocks, fullDayMetrics.onBoardByBlock, localProductivity, localMaxShift, localMinShift, fullDayMetrics.avgStartDeadheadMinutes, fullDayMetrics.avgEndDeadheadMinutes],
  );

  // Compute vehicles-per-block from current run cut using full-day blocks
  const currentVehiclesByBlockFullDay = useMemo(() => {
    const counts = new Array(fullDayMetrics.blocks.length).fill(0) as number[];
    for (const row of currentRunCut) {
      for (const idx of row.activeBlockIndices) {
        if (idx >= 0 && idx < counts.length) counts[idx] += 1;
      }
    }
    return counts;
  }, [currentRunCut, fullDayMetrics.blocks.length]);

  // Map full-day current vehicles onto the filtered view blocks for the chart
  const currentVehiclesByBlock = useMemo(() => {
    return metrics.blocks.map((viewBlock) => {
      const fullIdx = fullDayMetrics.blocks.findIndex(
        (b) => b.startMinutes === viewBlock.startMinutes,
      );
      return fullIdx >= 0 ? currentVehiclesByBlockFullDay[fullIdx] : 0;
    });
  }, [metrics.blocks, fullDayMetrics.blocks, currentVehiclesByBlockFullDay]);

  // Compute vehicles-per-block from optimized routes using full-day blocks
  const optimizedVehiclesByBlockFullDay = useMemo(() => {
    const counts = new Array(fullDayMetrics.blocks.length).fill(0) as number[];
    for (const route of optimizedRoutes) {
      for (const idx of route.activeBlockIndices) {
        if (idx >= 0 && idx < counts.length) counts[idx] += 1;
      }
    }
    return counts;
  }, [optimizedRoutes, fullDayMetrics.blocks.length]);

  // Map full-day optimized vehicles onto the filtered view blocks for the chart
  const optimizedVehiclesByBlock = useMemo(() => {
    return metrics.blocks.map((viewBlock) => {
      const fullIdx = fullDayMetrics.blocks.findIndex(
        (b) => b.startMinutes === viewBlock.startMinutes,
      );
      return fullIdx >= 0 ? optimizedVehiclesByBlockFullDay[fullIdx] : 0;
    });
  }, [metrics.blocks, fullDayMetrics.blocks, optimizedVehiclesByBlockFullDay]);

  // Average daily trips = sum of pickupsByBlock (already day-averaged in computeClearcutMetrics)
  const avgDailyTrips = useMemo(
    () => Math.round(fullDayMetrics.pickupsByBlock.reduce((sum, v) => sum + v, 0) * 10) / 10,
    [fullDayMetrics.pickupsByBlock],
  );

  // Stats for current run cut — productivity from avg daily trips / daily service hours
  const currentStats = useMemo(() => {
    const totalHours = currentRunCut.reduce((sum, r) => sum + r.durationHours, 0);
    const maxVehicles = Math.max(...currentVehiclesByBlockFullDay, 0);
    const productivity = totalHours > 0
      ? Math.round((avgDailyTrips / totalHours) * 100) / 100
      : 0;
    return {
      totalHours: Math.round(totalHours * 10) / 10,
      maxVehicles,
      productivity,
    };
  }, [currentRunCut, currentVehiclesByBlockFullDay, avgDailyTrips]);

  // Stats for optimized routes — productivity from avg daily trips / optimized service hours
  const optimizedStats = useMemo(() => {
    const totalHours = optimizedRoutes.reduce((sum, r) => sum + r.durationHours, 0);
    const maxVehicles = Math.max(...optimizedVehiclesByBlockFullDay, 0);
    const productivity = totalHours > 0
      ? Math.round((avgDailyTrips / totalHours) * 100) / 100
      : 0;
    return {
      totalHours: Math.round(totalHours * 10) / 10,
      maxVehicles,
      productivity,
    };
  }, [optimizedRoutes, optimizedVehiclesByBlockFullDay, avgDailyTrips]);

  return (
    <>
      <SectionCard title="Optimization Parameters">
        <div className="row g-3">
          <div className="col-md-3">
            <label className="form-label">Target Productivity</label>
            <div style={{ fontSize: 12, color: '#2563eb', marginBottom: 4 }}>
              Actual: <strong>{fullDayMetrics.avgProductivity}</strong> &middot; Target: <strong>{localProductivity}</strong>
            </div>
            <input
              className="form-range"
              disabled={readonlyView}
              type="range"
              min={1.0}
              max={3.5}
              step={0.1}
              value={localProductivity}
              onChange={(e) => setDraftProductivity(Number(e.target.value))}
              onPointerUp={() => { onOptimizationChange('target_productivity', productivityRef.current); setDraftProductivity(null); }}
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
              onChange={(e) => setDraftMinShift(Number(e.target.value))}
              onPointerUp={() => { onOptimizationChange('run_structure_json', JSON.stringify({ minShiftHrs: minShiftRef.current })); setDraftMinShift(null); }}
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
              onChange={(e) => setDraftMaxShift(Number(e.target.value))}
              onPointerUp={() => { onOptimizationChange('max_driver_spread_hrs', maxShiftRef.current); setDraftMaxShift(null); }}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">Deadhead</label>
            <div style={{ fontSize: 12, color: '#2563eb', marginBottom: 4 }}>
              First Pick: <strong>{Math.round(fullDayMetrics.avgStartDeadheadMinutes * 10) / 10} min</strong>
            </div>
            <div style={{ fontSize: 12, color: '#2563eb', marginBottom: 4 }}>
              Return to Yard: <strong>{Math.round(fullDayMetrics.avgEndDeadheadMinutes * 10) / 10} min</strong>
            </div>
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
          currentVehicles={currentVehiclesByBlock}
          optimizedVehicles={optimizedVehiclesByBlock}
          blocks={metrics.blocks}
        />
      </SectionCard>

      <div className="row">
        <div className="col-lg-6 mb-3">
          <SectionCard title="Imported Run Cut">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <select
                className="form-select form-select-sm"
                style={{ width: 'auto', minWidth: 200 }}
                value={selectedRunCutDate ?? ''}
                onChange={(e) => setSelectedRunCutDate(e.target.value || null)}
              >
                {availableDates.length === 0 && <option value="">No dates available</option>}
                {availableDates.map((dateStr) => {
                  const d = new Date(dateStr + 'T00:00:00');
                  const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                  return <option key={dateStr} value={dateStr}>{label}</option>;
                })}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 13, flexWrap: 'wrap' }}>
              <span>Avg Daily Trips: <strong>{avgDailyTrips}</strong></span>
              <span>Hours: <strong>{currentStats.totalHours}</strong></span>
              <span>Peak Vehicles: <strong>{currentStats.maxVehicles}</strong></span>
              <span>Productivity: <strong>{currentStats.productivity}</strong></span>
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
              Imported routes for the selected date, rounded up to {intervalMinutes}-min blocks.
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
                      No routes for selected date
                    </td>
                  </tr>
                )}
                {currentRunCut.map((row, idx) => (
                  <tr key={`${row.routeName}-${idx}`}>
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
            <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 13, flexWrap: 'wrap' }}>
              <span>Avg Daily Trips: <strong>{avgDailyTrips}</strong></span>
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
                </tr>
              </thead>
              <tbody>
                {optimizedRoutes.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ color: '#6b7280' }}>
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
