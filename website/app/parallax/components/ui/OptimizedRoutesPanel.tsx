'use client';

/**
 * OptimizedRoutesPanel — extracted from RunStructureTab.
 * Contains the algorithmic route optimization (buildOptimizedRoutes).
 * Not currently rendered; preserved for future re-integration.
 */

import { useMemo, useRef, useState } from 'react';

import { Label } from '@/app/parallax/components/shadcn/label';
import { Slider } from '@/app/parallax/components/shadcn/slider';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/parallax/components/shadcn/table';
import type { ClearcutMetrics } from '@/lib/parallax/metrics';
import { buildOptimizedRoutes, computeAvgShiftHours } from '@/lib/parallax/run-structure';
import type { OptimizationRow, RouteRow } from '@/lib/parallax/types';

import { SectionCard } from './shared';

interface OptimizedRoutesPanelProps {
  metrics: ClearcutMetrics;
  fullDayMetrics: ClearcutMetrics;
  optimization: OptimizationRow;
  routes: RouteRow[];
  selectedDays: number[];
  readonlyView: boolean;
  avgDailyTrips: number;
  onOptimizationChange: (
    key: 'target_productivity' | 'max_driver_spread_hrs' | 'peak_vehicles' | 'run_structure_json',
    value: number | string | null,
  ) => void;
}

function parseRunStructureJson(json: string | null): { minShiftHrs: number; routeLengthBias: number } {
  if (!json) return { minShiftHrs: 4, routeLengthBias: 0.5 };
  try {
    const parsed = JSON.parse(json);
    return {
      minShiftHrs: typeof parsed.minShiftHrs === 'number' ? parsed.minShiftHrs : 4,
      routeLengthBias: typeof parsed.routeLengthBias === 'number' ? parsed.routeLengthBias : 0.5,
    };
  } catch {
    return { minShiftHrs: 4, routeLengthBias: 0.5 };
  }
}

export default function OptimizedRoutesPanel({
  fullDayMetrics,
  optimization,
  routes,
  selectedDays,
  readonlyView,
  avgDailyTrips,
  onOptimizationChange,
}: OptimizedRoutesPanelProps) {
  const [demandMode, setDemandMode] = useState<'max' | 'avg'>('max');
  const [draftProductivity, setDraftProductivity] = useState<number | null>(null);
  const [draftMaxShift, setDraftMaxShift] = useState<number | null>(null);
  const [draftMinShift, setDraftMinShift] = useState<number | null>(null);
  const [draftRouteBias, setDraftRouteBias] = useState<number | null>(null);

  const runStructureSettings = parseRunStructureJson(optimization.run_structure_json);
  const localProductivity = draftProductivity ?? optimization.target_productivity ?? 2.0;
  const localMaxShift = draftMaxShift ?? optimization.max_driver_spread_hrs ?? 12;
  const localMinShift = draftMinShift ?? runStructureSettings.minShiftHrs;
  const localRouteBias = draftRouteBias ?? runStructureSettings.routeLengthBias;

  const productivityRef = useRef(localProductivity);
  productivityRef.current = localProductivity;
  const maxShiftRef = useRef(localMaxShift);
  maxShiftRef.current = localMaxShift;
  const minShiftRef = useRef(localMinShift);
  minShiftRef.current = localMinShift;
  const routeBiasRef = useRef(localRouteBias);
  routeBiasRef.current = localRouteBias;

  const avgShiftHours = useMemo(
    () => computeAvgShiftHours(routes, selectedDays),
    [routes, selectedDays],
  );

  const activeTripsForOptimizer = demandMode === 'max' ? fullDayMetrics.maxOnBoardByBlock : fullDayMetrics.onBoardByBlock;

  const optimizedRoutes = useMemo(
    () =>
      buildOptimizedRoutes({
        blocks: fullDayMetrics.blocks,
        activeTripsPerBlock: activeTripsForOptimizer,
        targetProductivity: localProductivity,
        maxShiftHours: localMaxShift,
        minShiftHours: localMinShift,
        startDeadheadMinutes: fullDayMetrics.avgStartDeadheadMinutes,
        endDeadheadMinutes: fullDayMetrics.avgEndDeadheadMinutes,
        routeLengthBias: localRouteBias,
      }),
    [fullDayMetrics.blocks, activeTripsForOptimizer, localProductivity, localMaxShift, localMinShift, fullDayMetrics.avgStartDeadheadMinutes, fullDayMetrics.avgEndDeadheadMinutes, localRouteBias],
  );

  const optimizedVehiclesByBlockFullDay = useMemo(() => {
    const counts = new Array(fullDayMetrics.blocks.length).fill(0) as number[];
    for (const route of optimizedRoutes) {
      for (const idx of route.activeBlockIndices) {
        if (idx >= 0 && idx < counts.length) counts[idx] += 1;
      }
    }
    return counts;
  }, [optimizedRoutes, fullDayMetrics.blocks.length]);

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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label>Target Productivity</Label>
            <div className="text-xs text-cc-info mb-1">
              Actual: <strong>{fullDayMetrics.avgProductivity}</strong> &middot; Target: <strong>{localProductivity}</strong>
            </div>
            <Slider
              disabled={readonlyView}
              min={1.0}
              max={3.5}
              step={0.1}
              value={[localProductivity]}
              onValueChange={([v]) => setDraftProductivity(v)}
              onValueCommit={() => { onOptimizationChange('target_productivity', productivityRef.current); setDraftProductivity(null); }}
            />
          </div>
          <div>
            <Label>Min Shift Length</Label>
            <div className="text-xs text-cc-info mb-1">
              Min: <strong>{localMinShift} hrs</strong>
            </div>
            <Slider
              disabled={readonlyView}
              min={2}
              max={8}
              step={0.5}
              value={[localMinShift]}
              onValueChange={([v]) => setDraftMinShift(v)}
              onValueCommit={() => { onOptimizationChange('run_structure_json', JSON.stringify({ minShiftHrs: minShiftRef.current, routeLengthBias: routeBiasRef.current })); setDraftMinShift(null); }}
            />
          </div>
          <div>
            <Label>Max Shift Length</Label>
            <div className="text-xs text-cc-info mb-1">
              Actual avg: <strong>{avgShiftHours} hrs</strong> &middot; Max: <strong>{localMaxShift} hrs</strong>
            </div>
            <Slider
              disabled={readonlyView}
              min={8}
              max={14}
              step={0.5}
              value={[localMaxShift]}
              onValueChange={([v]) => setDraftMaxShift(v)}
              onValueCommit={() => { onOptimizationChange('max_driver_spread_hrs', maxShiftRef.current); setDraftMaxShift(null); }}
            />
          </div>
          <div>
            <Label>Deadhead</Label>
            <div className="text-xs text-cc-info mb-1">
              First Pick: <strong>{Math.round(fullDayMetrics.avgStartDeadheadMinutes * 10) / 10} min</strong>
            </div>
            <div className="text-xs text-cc-info mb-1">
              Return to Yard: <strong>{Math.round(fullDayMetrics.avgEndDeadheadMinutes * 10) / 10} min</strong>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
          <div>
            <Label>Route Length Bias</Label>
            <div className="text-xs text-cc-info mb-1">
              Short &larr; <strong>{localRouteBias}</strong> &rarr; Long
            </div>
            <Slider
              disabled={readonlyView}
              min={0}
              max={1}
              step={0.1}
              value={[localRouteBias]}
              onValueChange={([v]) => setDraftRouteBias(v)}
              onValueCommit={() => { onOptimizationChange('run_structure_json', JSON.stringify({ minShiftHrs: minShiftRef.current, routeLengthBias: routeBiasRef.current })); setDraftRouteBias(null); }}
            />
          </div>
          <div>
            <div className="flex gap-1 text-xs mt-5">
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
      </SectionCard>

      <SectionCard title="Optimized Routes">
        <div className="flex gap-4 mb-3 text-[13px] flex-wrap">
          <span>Avg Daily Trips: <strong>{avgDailyTrips}</strong></span>
          <span>Hours: <strong>{optimizedStats.totalHours}</strong></span>
          <span>Peak Vehicles: <strong>{optimizedStats.maxVehicles}</strong></span>
          <span>Productivity: <strong>{optimizedStats.productivity}</strong></span>
        </div>
        <div className="text-xs text-cc-text-muted mb-2">
          Algorithmically built routes based on demand and optimization parameters.
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vehicle</TableHead>
              <TableHead>Shift Start</TableHead>
              <TableHead>Shift End</TableHead>
              <TableHead>Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {optimizedRoutes.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-cc-text-muted">
                  No routes generated
                </TableCell>
              </TableRow>
            )}
            {optimizedRoutes.map((row) => (
              <TableRow key={row.vehicleId}>
                <TableCell>Vehicle {row.vehicleId}</TableCell>
                <TableCell>{row.shiftStart}</TableCell>
                <TableCell>{row.shiftEnd}</TableCell>
                <TableCell>{row.durationHours} hrs</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>
    </>
  );
}
