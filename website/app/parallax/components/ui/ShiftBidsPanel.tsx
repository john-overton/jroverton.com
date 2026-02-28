'use client';

import { ChevronDown, ChevronRight, CircleHelp, Download, Play } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/app/parallax/components/shadcn/badge';
import { Button } from '@/app/parallax/components/shadcn/button';
import { Checkbox } from '@/app/parallax/components/shadcn/checkbox';
import { Input } from '@/app/parallax/components/shadcn/input';
import { Label } from '@/app/parallax/components/shadcn/label';
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
import { DEFAULT_BID_CONFIG, generateBidPackages } from '@/lib/parallax/bid-algorithm';
import { exportBidsToExcel } from '@/lib/parallax/bid-export';
import type { BidConfig, BidResult, DepotRow, RunRow, ServiceDay } from '@/lib/parallax/types';

const ALL_SERVICE_DAYS: ServiceDay[] = ['M', 'T', 'W', 'Th', 'F', 'Sa', 'Su'];

function SettingLabel({ children, tip }: { children: React.ReactNode; tip: string }) {
  return (
    <Label className="text-xs text-cc-text-muted mb-1 inline-flex items-center gap-1">
      {children}
      <span className="relative group cursor-help">
        <CircleHelp size={12} className="text-cc-text-muted" />
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 p-1.5 rounded-md bg-cc-surface-1 border border-cc-border shadow-lg text-[11px] text-cc-text-secondary leading-snug hidden group-hover:block">
          {tip}
        </span>
      </span>
    </Label>
  );
}

interface ShiftBidsPanelProps {
  runs: RunRow[];
  depots: DepotRow[];
  readonlyView: boolean;
}

export default function ShiftBidsPanel({ runs, depots, readonlyView }: ShiftBidsPanelProps) {
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [config, setConfig] = useState<BidConfig>({ ...DEFAULT_BID_CONFIG });
  const [result, setResult] = useState<BidResult | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'FTE' | 'PT'>('all');

  function updateConfig<K extends keyof BidConfig>(key: K, value: BidConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  function handleGenerate() {
    const bidResult = generateBidPackages(runs, config);
    setResult(bidResult);
  }

  const depotNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of depots) map.set(d.depot_id, d.depot_name);
    return map;
  }, [depots]);

  function handleExport() {
    if (!result) return;
    exportBidsToExcel(result, depots);
  }

  const filteredPackages = useMemo(() => {
    if (!result) return [];
    if (typeFilter === 'all') return result.packages;
    return result.packages.filter((p) => p.type === typeFilter);
  }, [result, typeFilter]);

  return (
    <div className="mt-3">
      {/* ── Settings ─────────────────────────────────────────────── */}
      <div className="mb-3 border border-cc-border rounded-lg">
        <button
          className="flex items-center gap-1.5 w-full px-3 py-2 text-sm font-medium text-cc-text-secondary hover:text-cc-accent transition-colors"
          onClick={() => setSettingsOpen((prev) => !prev)}
          type="button"
        >
          {settingsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Bid Settings
        </button>

        {settingsOpen && (
          <div className="px-3 pb-3 space-y-3">
            {/* Row 1 */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <SettingLabel tip="Minimum weekly pay hours for a package to qualify as full-time.">FTE Min Hours</SettingLabel>
                <Input
                  type="number"
                  value={config.fte_min_hours || ''}
                  className="h-7 text-xs"
                  onChange={(e) => updateConfig('fte_min_hours', e.target.value === '' ? 0 : Number(e.target.value))}
                />
              </div>
              <div>
                <SettingLabel tip="Maximum weekly pay hours for full-time packages. Packages approaching this limit may trigger overtime.">FTE Max Hours</SettingLabel>
                <Input
                  type="number"
                  value={config.fte_max_hours || ''}
                  className="h-7 text-xs"
                  onChange={(e) => updateConfig('fte_max_hours', e.target.value === '' ? 0 : Number(e.target.value))}
                />
              </div>
              <div>
                <SettingLabel tip="Minimum hours between the end of one shift and the start of the next.">Min Rest Hours</SettingLabel>
                <Input
                  type="number"
                  value={config.min_rest_hours || ''}
                  className="h-7 text-xs"
                  onChange={(e) => updateConfig('min_rest_hours', e.target.value === '' ? 0 : Number(e.target.value))}
                />
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <SettingLabel tip="Maximum number of consecutive work days allowed in a single bid package.">Max Consecutive Days</SettingLabel>
                <Input
                  type="number"
                  value={config.max_consecutive_days || ''}
                  className="h-7 text-xs"
                  onChange={(e) => updateConfig('max_consecutive_days', e.target.value === '' ? 0 : Number(e.target.value))}
                />
              </div>
              <div>
                <SettingLabel tip="Maximum acceptable start time variance in minutes. Used to calculate consistency scores.">Max Variance (min)</SettingLabel>
                <Input
                  type="number"
                  value={config.max_allowable_variance || ''}
                  className="h-7 text-xs"
                  onChange={(e) => updateConfig('max_allowable_variance', e.target.value === '' ? 0 : Number(e.target.value))}
                />
              </div>
              <div className="flex items-end gap-2 pb-0.5">
                <Checkbox
                  id="depot-match"
                  checked={config.depot_match_required}
                  onCheckedChange={(checked) => updateConfig('depot_match_required', checked === true)}
                />
                <SettingLabel tip="When enabled, all runs in a bid package must share the same depot.">Depot Match Required</SettingLabel>
              </div>
            </div>

            {/* Row 3 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <SettingLabel tip="How heavily start/end time consistency is weighted when grouping runs. Higher values favor predictable schedules.">Consistency Weight</SettingLabel>
                <Select
                  value={config.consistency_weight}
                  onValueChange={(v) => updateConfig('consistency_weight', v as BidConfig['consistency_weight'])}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <SettingLabel tip="Primary sort criteria for bid ranking. Higher-ranked bids are picked first by senior drivers.">Rank Priority</SettingLabel>
                <Select
                  value={config.rank_priority}
                  onValueChange={(v) => updateConfig('rank_priority', v as BidConfig['rank_priority'])}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hours">Weekly Hours</SelectItem>
                    <SelectItem value="consistency">Consistency</SelectItem>
                    <SelectItem value="days_off">Days Off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Action bar ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleGenerate} disabled={runs.length === 0} type="button">
            <Play size={14} className="mr-1.5" /> Generate Bids
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={!result || result.packages.length === 0}
            type="button"
          >
            <Download size={14} className="mr-1.5" /> Export Excel
          </Button>
        </div>

        {result && (
          <div className="flex gap-0.5 items-center">
            <span className="text-xs text-cc-text-muted mr-1">Show:</span>
            {(['all', 'FTE', 'PT'] as const).map((t) => (
              <button
                key={t}
                className={`px-2 py-0.5 text-[10px] rounded ${typeFilter === t ? 'bg-cc-accent text-white' : 'bg-cc-surface-2 text-cc-text-muted'}`}
                onClick={() => setTypeFilter(t)}
                type="button"
              >
                {t === 'all' ? 'All' : t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Results summary ──────────────────────────────────────── */}
      {result && (
        <div className="flex gap-4 mb-3 text-[13px] flex-wrap">
          <span>FTE Packages: <strong>{result.fte_count}</strong></span>
          <span>PT Packages: <strong>{result.pt_count}</strong></span>
          {result.unassigned_blocks.length > 0 && (
            <span className="text-cc-danger">
              Unassigned Blocks: <strong>{result.unassigned_blocks.length}</strong>
            </span>
          )}
        </div>
      )}

      {/* ── Bid table ────────────────────────────────────────────── */}
      {result && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[50px]">Rank</TableHead>
                <TableHead className="min-w-[50px]">Type</TableHead>
                <TableHead className="min-w-[150px]">Runs</TableHead>
                <TableHead className="min-w-[160px]">Days On</TableHead>
                <TableHead className="min-w-[100px]">Days Off</TableHead>
                <TableHead className="min-w-[90px]">Weekly Hrs</TableHead>
                <TableHead className="min-w-[80px]">Consec. Off</TableHead>
                <TableHead className="min-w-[90px]">Consistency</TableHead>
                <TableHead className="min-w-[80px]">Depot</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPackages.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-cc-text-muted">
                    {result.packages.length === 0
                      ? 'No bid packages generated. Add runs and click Generate Bids.'
                      : `No ${typeFilter} packages found.`}
                  </TableCell>
                </TableRow>
              )}
              {filteredPackages.map((pkg) => {
                const runNames = [...new Set(pkg.daily_blocks.map((b) => b.run_name))].join(', ');
                return (
                  <TableRow key={pkg.bid_id}>
                    <TableCell className="text-xs font-medium">{pkg.bid_rank}</TableCell>
                    <TableCell>
                      <Badge variant={pkg.type === 'FTE' ? 'default' : 'secondary'} className="text-[10px]">
                        {pkg.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{runNames}</TableCell>
                    <TableCell>
                      <div className="flex gap-0.5">
                        {ALL_SERVICE_DAYS.map((day) => (
                          <span
                            key={day}
                            className={`px-1 py-0 text-[10px] rounded ${
                              pkg.days_on.includes(day)
                                ? 'bg-cc-accent text-white'
                                : 'bg-cc-surface-2 text-cc-text-muted'
                            }`}
                          >
                            {day}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-cc-text-muted">
                      {pkg.days_off.join(', ') || '\u2014'}
                    </TableCell>
                    <TableCell className="text-xs">{pkg.weekly_pay_hours}</TableCell>
                    <TableCell className="text-xs">{pkg.consecutive_days_off}</TableCell>
                    <TableCell className="text-xs">{pkg.consistency_score}%</TableCell>
                    <TableCell className="text-xs text-cc-text-muted">
                      {pkg.depot ? (depotNameMap.get(pkg.depot) ?? pkg.depot) : 'Mixed'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────── */}
      {!result && (
        <div className="text-xs text-cc-text-muted py-6 text-center">
          Configure settings above and click Generate Bids to create shift bid packages from your runs.
        </div>
      )}
    </div>
  );
}
