'use client';

import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/app/parallax/components/shadcn/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/parallax/components/shadcn/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/parallax/components/shadcn/table';
import type { CurrentRunCutRow } from '@/lib/parallax/run-structure';
import type { DepotRow, ServiceDay, VehicleTypeRow } from '@/lib/parallax/types';

import { ALL_SERVICE_DAYS, parseClockToMinutes } from './shared';

// ── Sortable header for imported runs table ─────────────────────────

type ImportedSortColumn = 'routeName' | 'shiftStart' | 'shiftEnd' | 'durationHours';

function ImportedSortableHead({
  column,
  label,
  className,
  sortKey,
  sortDir,
  onSort,
}: {
  column: ImportedSortColumn;
  label: string;
  className?: string;
  sortKey: ImportedSortColumn;
  sortDir: 'asc' | 'desc';
  onSort: (key: ImportedSortColumn) => void;
}) {
  const active = sortKey === column;
  return (
    <TableHead className={className}>
      <button
        className="inline-flex items-center gap-1 hover:text-cc-accent transition-colors"
        onClick={() => onSort(column)}
        type="button"
      >
        {label}
        {active ? (
          sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
        ) : (
          <span className="w-3" />
        )}
      </button>
    </TableHead>
  );
}

/** Parse a 12-hour "H:MM AM/PM" label back to minutes-of-day for sorting */
function parseClockFromLabel(label: string): number {
  const match = label.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

// ── Main component ──────────────────────────────────────────────────

interface ImportedRoutesPanelProps {
  currentRunCut: CurrentRunCutRow[];
  depots: DepotRow[];
  vehicleTypes: VehicleTypeRow[];
  readonlyView: boolean;
  intervalMinutes: number;
  avgDailyTrips: number;
  currentStats: { totalHours: number; maxVehicles: number; productivity: number };
  availableDates: string[];
  selectedRunCutDate: string | null;
  onSelectedRunCutDateChange: (date: string | null) => void;
  copyDaysSelection: ServiceDay[];
  onToggleCopyDay: (day: ServiceDay) => void;
  onCopyAllFromLiveDay: () => void;
  onCopySingleRun: (row: CurrentRunCutRow) => void;
}

export default function ImportedRoutesPanel({
  currentRunCut,
  depots,
  vehicleTypes,
  readonlyView,
  intervalMinutes,
  avgDailyTrips,
  currentStats,
  availableDates,
  selectedRunCutDate,
  onSelectedRunCutDateChange,
  copyDaysSelection,
  onToggleCopyDay,
  onCopyAllFromLiveDay,
  onCopySingleRun,
}: ImportedRoutesPanelProps) {
  const [importedSortKey, setImportedSortKey] = useState<ImportedSortColumn>('shiftStart');
  const [importedSortDir, setImportedSortDir] = useState<'asc' | 'desc'>('asc');
  const [importedBreaksExpanded, setImportedBreaksExpanded] = useState(false);

  // Depot address → name lookup
  const depotAddressToName = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of depots) {
      if (d.depot_address) map.set(d.depot_address, d.depot_name);
    }
    return map;
  }, [depots]);

  const vehicleTypeNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const vt of vehicleTypes) map.set(vt.vehicle_type_id, vt.vehicle_type_name);
    return map;
  }, [vehicleTypes]);

  function toggleImportedSort(key: ImportedSortColumn) {
    if (importedSortKey === key) {
      setImportedSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setImportedSortKey(key);
      setImportedSortDir('asc');
    }
  }

  const sortedRunCut = useMemo(() => {
    const dir = importedSortDir === 'asc' ? 1 : -1;
    return [...currentRunCut].sort((a, b) => {
      let cmp: number;
      switch (importedSortKey) {
        case 'shiftStart':
        case 'shiftEnd':
          cmp = parseClockFromLabel(a[importedSortKey]) - parseClockFromLabel(b[importedSortKey]);
          break;
        case 'durationHours':
          cmp = a.durationHours - b.durationHours;
          break;
        case 'routeName':
        default:
          cmp = a.routeName.localeCompare(b.routeName);
          break;
      }
      return cmp !== 0 ? cmp * dir : a.routeName.localeCompare(b.routeName);
    });
  }, [currentRunCut, importedSortKey, importedSortDir]);

  return (
    <>
      <div className="flex items-center gap-3 mb-3 mt-3">
        <Select
          value={selectedRunCutDate ?? ''}
          onValueChange={(v) => onSelectedRunCutDateChange(v || null)}
        >
          <SelectTrigger className="w-auto min-w-[200px]">
            <SelectValue placeholder="No dates available" />
          </SelectTrigger>
          <SelectContent>
            {availableDates.length === 0 && <SelectItem value="">No dates available</SelectItem>}
            {availableDates.map((dateStr) => {
              const d = new Date(dateStr + 'T00:00:00');
              const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
              return <SelectItem key={dateStr} value={dateStr}>{label}</SelectItem>;
            })}
          </SelectContent>
        </Select>
        {!readonlyView && currentRunCut.length > 0 && (
          <Button variant="outline" size="sm" onClick={onCopyAllFromLiveDay} disabled={copyDaysSelection.length === 0} type="button">
            <Copy size={14} className="mr-1.5" /> Copy Day to Route Editor
          </Button>
        )}
      </div>

      {!readonlyView && (
        <div className="flex gap-0.5 items-center mb-3">
          <span className="text-xs text-cc-text-muted mr-1">Copy to:</span>
          {ALL_SERVICE_DAYS.map((day) => (
            <button
              key={day}
              className={`px-1.5 py-0.5 text-[10px] rounded ${copyDaysSelection.includes(day) ? 'bg-cc-accent text-white' : 'bg-cc-surface-2 text-cc-text-muted'}`}
              onClick={() => onToggleCopyDay(day)}
              type="button"
            >{day}</button>
          ))}
        </div>
      )}

      <div className="flex gap-4 mb-3 text-[13px] flex-wrap">
        <span>Avg Daily Trips: <strong>{avgDailyTrips}</strong></span>
        <span>Hours: <strong>{currentStats.totalHours}</strong></span>
        <span>Peak Vehicles: <strong>{currentStats.maxVehicles}</strong></span>
        <span>Productivity: <strong>{currentStats.productivity}</strong></span>
      </div>
      <div className="text-xs text-cc-text-muted mb-2">
        Imported routes for the selected date, rounded up to {intervalMinutes}-min blocks.
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <ImportedSortableHead column="routeName" label="Route" sortKey={importedSortKey} sortDir={importedSortDir} onSort={toggleImportedSort} />
              {depots.length > 0 && <TableHead>Depot</TableHead>}
              {vehicleTypes.length > 0 && <TableHead>Vehicle</TableHead>}
              <TableHead>Zone</TableHead>
              <ImportedSortableHead column="shiftStart" label="Shift Start" sortKey={importedSortKey} sortDir={importedSortDir} onSort={toggleImportedSort} />
              <ImportedSortableHead column="shiftEnd" label="Shift End" sortKey={importedSortKey} sortDir={importedSortDir} onSort={toggleImportedSort} />
              <ImportedSortableHead column="durationHours" label="Duration" sortKey={importedSortKey} sortDir={importedSortDir} onSort={toggleImportedSort} />
              {importedBreaksExpanded ? (
                <>
                  <TableHead>
                    <button
                      className="inline-flex items-center gap-1 hover:text-cc-accent transition-colors"
                      onClick={() => setImportedBreaksExpanded(false)}
                      type="button"
                    >
                      <ChevronDown size={13} /> Break 1
                    </button>
                  </TableHead>
                  <TableHead>Break 2</TableHead>
                </>
              ) : (
                <TableHead>
                  <button
                    className="inline-flex items-center gap-1 hover:text-cc-accent transition-colors"
                    onClick={() => setImportedBreaksExpanded(true)}
                    type="button"
                  >
                    <ChevronRight size={13} /> Breaks
                  </button>
                </TableHead>
              )}
              {!readonlyView && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRunCut.length === 0 && (
              <TableRow>
                <TableCell colSpan={importedBreaksExpanded ? (readonlyView ? 7 : 8) : (readonlyView ? 6 : 7) + (depots.length > 0 ? 1 : 0)} className="text-cc-text-muted">
                  No routes for selected date
                </TableCell>
              </TableRow>
            )}
            {sortedRunCut.map((row, idx) => (
              <TableRow key={`${row.routeName}-${idx}`}>
                <TableCell>{row.routeName}</TableCell>
                {depots.length > 0 && (
                  <TableCell className="text-xs text-cc-text-muted">
                    {row.depotAddress ? (depotAddressToName.get(row.depotAddress) ?? row.depotAddress) : '\u2014'}
                  </TableCell>
                )}
                {vehicleTypes.length > 0 && (
                  <TableCell className="text-xs text-cc-text-muted">
                    {row.vehicleTypeId ? (vehicleTypeNameMap.get(row.vehicleTypeId) ?? row.vehicleTypeId) : '\u2014'}
                  </TableCell>
                )}
                <TableCell className="text-xs text-cc-text-muted">
                  {row.zone ?? '—'}
                </TableCell>
                <TableCell>{row.shiftStart}</TableCell>
                <TableCell>{row.shiftEnd}</TableCell>
                <TableCell>{row.durationHours} hrs</TableCell>
                {importedBreaksExpanded ? (
                  <>
                    <TableCell>
                      <span className="text-xs text-cc-text-muted">
                        {row.break1Start && row.break1End ? `${row.break1Start} - ${row.break1End}` : '\u2014'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-cc-text-muted">
                        {row.break2Start && row.break2End ? `${row.break2Start} - ${row.break2End}` : '\u2014'}
                      </span>
                    </TableCell>
                  </>
                ) : (
                  <TableCell>
                    <span className="text-xs text-cc-text-muted">
                      {(() => {
                        const b1 = row.break1Start && row.break1End ? `${row.break1Start} - ${row.break1End}` : null;
                        const b2 = row.break2Start && row.break2End ? `${row.break2Start} - ${row.break2End}` : null;
                        if (b1 && b2) return `${b1}, ${b2}`;
                        return b1 ?? b2 ?? '\u2014';
                      })()}
                    </span>
                  </TableCell>
                )}
                {!readonlyView && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onCopySingleRun(row)}
                      title="Copy to route editor"
                      type="button"
                    >
                      <Copy size={13} />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
