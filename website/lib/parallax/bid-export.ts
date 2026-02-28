import * as XLSX from 'xlsx';
import type { BidPackage, BidResult, DepotRow } from './types';

function packageToRow(pkg: BidPackage, depotNameMap: Map<string, string>) {
  // Build a readable run summary from daily blocks
  const runNames = [...new Set(pkg.daily_blocks.map((b) => b.run_name))].join(', ');

  return {
    Rank: pkg.bid_rank,
    Type: pkg.type,
    Runs: runNames,
    'Days On': pkg.days_on.join(', '),
    'Days Off': pkg.days_off.join(', '),
    'Weekly Pay Hours': pkg.weekly_pay_hours,
    'Consecutive Days Off': pkg.consecutive_days_off,
    'Max Consecutive Work': pkg.max_consecutive_work,
    'Start Time Variance (min)': pkg.start_time_variance,
    'End Time Variance (min)': pkg.end_time_variance,
    'Consistency Score': pkg.consistency_score,
    Depot: pkg.depot ? (depotNameMap.get(pkg.depot) ?? pkg.depot) : 'Mixed',
  };
}

function setColumnWidths(sheet: XLSX.WorkSheet) {
  sheet['!cols'] = [
    { wch: 6 },   // Rank
    { wch: 5 },   // Type
    { wch: 30 },  // Runs
    { wch: 20 },  // Days On
    { wch: 20 },  // Days Off
    { wch: 16 },  // Weekly Pay Hours
    { wch: 20 },  // Consecutive Days Off
    { wch: 22 },  // Max Consecutive Work
    { wch: 22 },  // Start Variance
    { wch: 22 },  // End Variance
    { wch: 18 },  // Consistency
    { wch: 15 },  // Depot
  ];
}

export function exportBidsToExcel(result: BidResult, depots: DepotRow[]): void {
  const depotNameMap = new Map<string, string>();
  for (const d of depots) depotNameMap.set(d.depot_id, d.depot_name);

  const wb = XLSX.utils.book_new();

  const ftePackages = result.packages.filter((p) => p.type === 'FTE');
  const fteData = ftePackages.map((p) => packageToRow(p, depotNameMap));
  const fteSheet = XLSX.utils.json_to_sheet(fteData.length > 0 ? fteData : [{}]);
  setColumnWidths(fteSheet);
  XLSX.utils.book_append_sheet(wb, fteSheet, 'FTE Bids');

  const ptPackages = result.packages.filter((p) => p.type === 'PT');
  const ptData = ptPackages.map((p) => packageToRow(p, depotNameMap));
  const ptSheet = XLSX.utils.json_to_sheet(ptData.length > 0 ? ptData : [{}]);
  setColumnWidths(ptSheet);
  XLSX.utils.book_append_sheet(wb, ptSheet, 'PT Bids');

  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shift-bids-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
