import type { BidConfig, BidPackage, BidResult, BidType, DailyBlock, RunRow, ServiceDay } from './types';

// ── Constants ────────────────────────────────────────────────────────

const ALL_SERVICE_DAYS: ServiceDay[] = ['M', 'T', 'W', 'Th', 'F', 'Sa', 'Su'];

const DAY_INDEX: Record<ServiceDay, number> = { M: 0, T: 1, W: 2, Th: 3, F: 4, Sa: 5, Su: 6 };

export const DEFAULT_BID_CONFIG: BidConfig = {
  fte_min_hours: 35,
  fte_max_hours: 40,
  min_rest_hours: 10,
  max_consecutive_days: 6,
  depot_match_required: false,
  consistency_weight: 'high',
  rank_priority: 'hours',
  max_allowable_variance: 180,
};

// ── Helpers ──────────────────────────────────────────────────────────

/** Parse "HH:MM" to minutes since midnight. */
function parseClockToMinutes(value: string | null | undefined, fallback: number): number {
  if (!value) return fallback;
  const [hoursRaw, minutesRaw] = value.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return fallback;
  return hours * 60 + minutes;
}

function parseServiceDays(json: string): ServiceDay[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr)
      ? arr.filter((d: string) => ALL_SERVICE_DAYS.includes(d as ServiceDay)) as ServiceDay[]
      : [];
  } catch {
    return [];
  }
}

// ── Phase 1: Build Daily Blocks (one per run per day) ────────────────

export function buildDailyBlocks(runs: RunRow[]): DailyBlock[] {
  // Key: "runId|day" — each run (including each split) gets its own block
  const groups = new Map<string, { run_name: string; day: ServiceDay; run_ids: string[]; depot: string | null; pay_hours: number; starts: number[]; ends: number[] }>();

  for (const run of runs) {
    const days = parseServiceDays(run.service_days);
    const startMin = parseClockToMinutes(run.start_time, 0);
    const endMin = parseClockToMinutes(run.end_time, 0);
    const payHrs = Number(run.pay_hours) || 0;

    for (const day of days) {
      const key = `${run.run_id}|${day}`;
      let group = groups.get(key);
      if (!group) {
        group = { run_name: run.run_name, day, run_ids: [], depot: null, pay_hours: 0, starts: [], ends: [] };
        groups.set(key, group);
      }
      group.run_ids.push(run.run_id);
      group.pay_hours += payHrs;
      group.starts.push(startMin);
      group.ends.push(endMin);
      if (run.depot && !group.depot) group.depot = run.depot;
    }
  }

  const blocks: DailyBlock[] = [];
  for (const [, g] of groups) {
    const startMin = Math.min(...g.starts);
    const endMin = Math.max(...g.ends);
    blocks.push({
      run_name: g.run_name,
      day: g.day,
      run_ids: g.run_ids,
      depot: g.depot,
      pay_hours: Math.round(g.pay_hours * 10) / 10,
      start_time_minutes: startMin,
      end_time_minutes: endMin,
      span_minutes: Math.max(0, endMin - startMin),
    });
  }

  return blocks;
}

// ── Consecutive days off / work helpers ──────────────────────────────

function computeConsecutiveDaysOff(daysOn: ServiceDay[]): number {
  if (daysOn.length === 0) return 7;
  if (daysOn.length === 7) return 0;

  const onSet = new Set(daysOn.map((d) => DAY_INDEX[d]));
  // Walk through a doubled week to handle wrap-around
  let maxOff = 0;
  let current = 0;
  for (let i = 0; i < 14; i++) {
    if (onSet.has(i % 7)) {
      if (current > maxOff) maxOff = current;
      current = 0;
    } else {
      current++;
    }
  }
  return Math.min(maxOff, 7);
}

function computeMaxConsecutiveWork(daysOn: ServiceDay[]): number {
  if (daysOn.length === 0) return 0;

  const onSet = new Set(daysOn.map((d) => DAY_INDEX[d]));
  let maxWork = 0;
  let current = 0;
  for (let i = 0; i < 14; i++) {
    if (onSet.has(i % 7)) {
      current++;
      if (current > maxWork) maxWork = current;
    } else {
      current = 0;
    }
  }
  return Math.min(maxWork, 7);
}

// ── Variance / consistency scoring ──────────────────────────────────

function computeTimeVariance(blocks: DailyBlock[], field: 'start' | 'end'): number {
  if (blocks.length < 2) return 0;
  const values = blocks.map((b) => field === 'start' ? b.start_time_minutes : b.end_time_minutes);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.round(Math.sqrt(variance) * 10) / 10;
}

function computeConsistencyScore(startVar: number, endVar: number, maxVar: number): number {
  if (maxVar <= 0) return 100;
  const score = 100 - ((startVar + endVar) / (2 * maxVar)) * 100;
  return Math.round(Math.max(0, Math.min(100, score)) * 10) / 10;
}

// ── Compatibility scoring for greedy packing ────────────────────────

function getConsistencyWeight(weight: BidConfig['consistency_weight']): number {
  switch (weight) {
    case 'low': return 0.5;
    case 'medium': return 1.0;
    case 'high': return 1.5;
  }
}

function scoreCompatibility(
  existingBlocks: DailyBlock[],
  candidateBlocks: DailyBlock[],
  config: BidConfig,
): number {
  const allBlocks = [...existingBlocks, ...candidateBlocks];

  // Check for day conflicts
  const daySet = new Set<ServiceDay>();
  for (const b of existingBlocks) daySet.add(b.day);
  for (const b of candidateBlocks) {
    if (daySet.has(b.day)) return -Infinity; // day conflict
  }

  // Depot match bonus
  const depots = new Set(allBlocks.map((b) => b.depot).filter(Boolean));
  const depotBonus = depots.size <= 1 ? 50 : 0;
  if (config.depot_match_required && depots.size > 1) return -Infinity;

  // Day adjacency bonus
  const dayIndices = new Set(allBlocks.map((b) => DAY_INDEX[b.day]));
  let adjacencyBonus = 0;
  for (const idx of dayIndices) {
    if (dayIndices.has((idx + 1) % 7)) adjacencyBonus += 10;
  }

  // Time consistency bonus
  const startVar = computeTimeVariance(allBlocks, 'start');
  const endVar = computeTimeVariance(allBlocks, 'end');
  const rawConsistency = Math.max(0, 40 - ((startVar + endVar) / (2 * config.max_allowable_variance)) * 40);
  const consistencyBonus = rawConsistency * getConsistencyWeight(config.consistency_weight);

  return depotBonus + adjacencyBonus + consistencyBonus;
}

// ── Phase 2: FTE Package Assembly ───────────────────────────────────

interface WorkingPackage {
  blocks: DailyBlock[];
  weeklyHours: number;
  depot: string | null;
}

function assembleFTEPackages(
  blocks: DailyBlock[],
  config: BidConfig,
): { ftePackages: WorkingPackage[]; remainingBlocks: DailyBlock[] } {
  // Group blocks by run_id so each run (including splits) is evaluated independently
  const runGroups = new Map<string, DailyBlock[]>();
  for (const block of blocks) {
    const key = block.run_ids[0];
    if (!runGroups.has(key)) runGroups.set(key, []);
    runGroups.get(key)!.push(block);
  }

  // Sort groups by total weekly hours descending (bigger groups first)
  const sortedGroups = [...runGroups.entries()].sort(
    (a, b) => b[1].reduce((s, bl) => s + bl.pay_hours, 0) - a[1].reduce((s, bl) => s + bl.pay_hours, 0),
  );

  const packages: WorkingPackage[] = [];
  const assigned = new Set<string>(); // run_name keys that have been assigned

  // First pass: groups that already meet FTE threshold on their own
  for (const [key, groupBlocks] of sortedGroups) {
    const weeklyHours = groupBlocks.reduce((s, b) => s + b.pay_hours, 0);
    if (weeklyHours >= config.fte_min_hours && weeklyHours <= config.fte_max_hours) {
      const daysOn = [...new Set(groupBlocks.map((b) => b.day))];
      if (computeMaxConsecutiveWork(daysOn) <= config.max_consecutive_days) {
        packages.push({
          blocks: groupBlocks,
          weeklyHours: Math.round(weeklyHours * 10) / 10,
          depot: groupBlocks[0].depot,
        });
        assigned.add(key);
      }
    }
  }

  // Second pass: try to combine remaining groups into FTE packages
  const remainingGroups = sortedGroups.filter(([key]) => !assigned.has(key));

  for (const [key, groupBlocks] of remainingGroups) {
    if (assigned.has(key)) continue;

    // Try to fit into an existing package
    let bestPackageIdx = -1;
    let bestScore = -Infinity;

    for (let i = 0; i < packages.length; i++) {
      const pkg = packages[i];
      const combinedHours = pkg.weeklyHours + groupBlocks.reduce((s, b) => s + b.pay_hours, 0);
      if (combinedHours > config.fte_max_hours) continue;

      const combinedDays = [...new Set([...pkg.blocks.map((b) => b.day), ...groupBlocks.map((b) => b.day)])];
      if (computeMaxConsecutiveWork(combinedDays) > config.max_consecutive_days) continue;

      const score = scoreCompatibility(pkg.blocks, groupBlocks, config);
      if (score > bestScore) {
        bestScore = score;
        bestPackageIdx = i;
      }
    }

    if (bestPackageIdx >= 0 && bestScore > -Infinity) {
      const pkg = packages[bestPackageIdx];
      pkg.blocks = [...pkg.blocks, ...groupBlocks];
      pkg.weeklyHours = Math.round(pkg.blocks.reduce((s, b) => s + b.pay_hours, 0) * 10) / 10;
      assigned.add(key);
    } else {
      // Start a new package with this group
      const weeklyHours = groupBlocks.reduce((s, b) => s + b.pay_hours, 0);
      packages.push({
        blocks: groupBlocks,
        weeklyHours: Math.round(weeklyHours * 10) / 10,
        depot: groupBlocks[0].depot,
      });
      assigned.add(key);
    }
  }

  // Split packages into FTE-qualifying and remaining
  const ftePackages: WorkingPackage[] = [];
  const leftoverBlocks: DailyBlock[] = [];

  for (const pkg of packages) {
    if (pkg.weeklyHours >= config.fte_min_hours) {
      ftePackages.push(pkg);
    } else {
      leftoverBlocks.push(...pkg.blocks);
    }
  }

  return { ftePackages, remainingBlocks: leftoverBlocks };
}

// ── Phase 3: PT Package Assembly ────────────────────────────────────

function assemblePTPackages(
  blocks: DailyBlock[],
  config: BidConfig,
): WorkingPackage[] {
  if (blocks.length === 0) return [];

  // Group by run_id so each run (including splits) is independent
  const runGroups = new Map<string, DailyBlock[]>();
  for (const block of blocks) {
    const key = block.run_ids[0];
    if (!runGroups.has(key)) runGroups.set(key, []);
    runGroups.get(key)!.push(block);
  }

  const packages: WorkingPackage[] = [];
  const assigned = new Set<string>();

  // Sort groups by hours descending
  const sortedGroups = [...runGroups.entries()].sort(
    (a, b) => b[1].reduce((s, bl) => s + bl.pay_hours, 0) - a[1].reduce((s, bl) => s + bl.pay_hours, 0),
  );

  for (const [key, groupBlocks] of sortedGroups) {
    if (assigned.has(key)) continue;

    // Try to fit into an existing PT package
    let bestPackageIdx = -1;
    let bestScore = -Infinity;

    for (let i = 0; i < packages.length; i++) {
      const pkg = packages[i];
      const combinedHours = pkg.weeklyHours + groupBlocks.reduce((s, b) => s + b.pay_hours, 0);
      // PT packages must stay below FTE threshold
      if (combinedHours >= config.fte_min_hours) continue;

      const combinedDays = [...new Set([...pkg.blocks.map((b) => b.day), ...groupBlocks.map((b) => b.day)])];
      if (computeMaxConsecutiveWork(combinedDays) > config.max_consecutive_days) continue;

      const score = scoreCompatibility(pkg.blocks, groupBlocks, config);
      if (score > bestScore) {
        bestScore = score;
        bestPackageIdx = i;
      }
    }

    if (bestPackageIdx >= 0 && bestScore > -Infinity) {
      const pkg = packages[bestPackageIdx];
      pkg.blocks = [...pkg.blocks, ...groupBlocks];
      pkg.weeklyHours = Math.round(pkg.blocks.reduce((s, b) => s + b.pay_hours, 0) * 10) / 10;
    } else {
      const weeklyHours = groupBlocks.reduce((s, b) => s + b.pay_hours, 0);
      packages.push({
        blocks: groupBlocks,
        weeklyHours: Math.round(weeklyHours * 10) / 10,
        depot: groupBlocks[0].depot,
      });
    }
    assigned.add(key);
  }

  return packages;
}

// ── Phase 4: Finalize & Rank ────────────────────────────────────────

function finalizeBidPackage(wp: WorkingPackage, type: BidType, config: BidConfig): BidPackage {
  const daysOn = ALL_SERVICE_DAYS.filter((d) => wp.blocks.some((b) => b.day === d));
  const daysOff = ALL_SERVICE_DAYS.filter((d) => !daysOn.includes(d));
  const startVar = computeTimeVariance(wp.blocks, 'start');
  const endVar = computeTimeVariance(wp.blocks, 'end');
  const consistency = computeConsistencyScore(startVar, endVar, config.max_allowable_variance);

  const depots = new Set(wp.blocks.map((b) => b.depot).filter(Boolean));
  const depot = depots.size === 1 ? [...depots][0]! : null;

  return {
    bid_id: crypto.randomUUID(),
    bid_rank: 0, // assigned during ranking
    type,
    assigned_runs: [...new Set(wp.blocks.flatMap((b) => b.run_ids))],
    daily_blocks: wp.blocks,
    weekly_pay_hours: wp.weeklyHours,
    days_on: daysOn,
    days_off: daysOff,
    consecutive_days_off: computeConsecutiveDaysOff(daysOn),
    max_consecutive_work: computeMaxConsecutiveWork(daysOn),
    start_time_variance: startVar,
    end_time_variance: endVar,
    consistency_score: consistency,
    depot,
  };
}

function rankPackages(packages: BidPackage[], config: BidConfig): BidPackage[] {
  const ftePackages = packages.filter((p) => p.type === 'FTE');
  const ptPackages = packages.filter((p) => p.type === 'PT');

  const comparator = buildComparator(config.rank_priority);
  ftePackages.sort(comparator);
  ptPackages.sort(comparator);

  const ranked = [...ftePackages, ...ptPackages];
  for (let i = 0; i < ranked.length; i++) {
    ranked[i] = { ...ranked[i], bid_rank: i + 1 };
  }
  return ranked;
}

function buildComparator(priority: BidConfig['rank_priority']): (a: BidPackage, b: BidPackage) => number {
  return (a, b) => {
    const criteria: ((a: BidPackage, b: BidPackage) => number)[] = [];

    switch (priority) {
      case 'hours':
        criteria.push((x, y) => y.weekly_pay_hours - x.weekly_pay_hours);
        criteria.push((x, y) => y.consistency_score - x.consistency_score);
        criteria.push((x, y) => y.consecutive_days_off - x.consecutive_days_off);
        break;
      case 'consistency':
        criteria.push((x, y) => y.consistency_score - x.consistency_score);
        criteria.push((x, y) => y.weekly_pay_hours - x.weekly_pay_hours);
        criteria.push((x, y) => y.consecutive_days_off - x.consecutive_days_off);
        break;
      case 'days_off':
        criteria.push((x, y) => y.consecutive_days_off - x.consecutive_days_off);
        criteria.push((x, y) => y.weekly_pay_hours - x.weekly_pay_hours);
        criteria.push((x, y) => y.consistency_score - x.consistency_score);
        break;
    }
    // Final tie-breaker: earliest average start time
    criteria.push((x, y) => {
      const avgStartA = x.daily_blocks.length > 0
        ? x.daily_blocks.reduce((s, bl) => s + bl.start_time_minutes, 0) / x.daily_blocks.length
        : 0;
      const avgStartB = y.daily_blocks.length > 0
        ? y.daily_blocks.reduce((s, bl) => s + bl.start_time_minutes, 0) / y.daily_blocks.length
        : 0;
      return avgStartA - avgStartB;
    });

    for (const crit of criteria) {
      const result = crit(a, b);
      if (result !== 0) return result;
    }
    return 0;
  };
}

// ── Main entry point ────────────────────────────────────────────────

export function generateBidPackages(runs: RunRow[], config: BidConfig): BidResult {
  if (runs.length === 0) {
    return { config, packages: [], fte_count: 0, pt_count: 0, unassigned_blocks: [] };
  }

  // Phase 1: Build daily blocks (split reunion)
  const allBlocks = buildDailyBlocks(runs);

  // Phase 2: FTE assembly
  const { ftePackages, remainingBlocks } = assembleFTEPackages(allBlocks, config);

  // Phase 3: PT assembly
  const ptWorkingPackages = assemblePTPackages(remainingBlocks, config);

  // Finalize packages
  const fteBids = ftePackages.map((wp) => finalizeBidPackage(wp, 'FTE', config));
  const ptBids = ptWorkingPackages.map((wp) => finalizeBidPackage(wp, 'PT', config));

  // Phase 4: Rank
  const ranked = rankPackages([...fteBids, ...ptBids], config);

  return {
    config,
    packages: ranked,
    fte_count: fteBids.length,
    pt_count: ptBids.length,
    unassigned_blocks: [],
  };
}

// ── Quick FTE/PT estimation for stats bar ───────────────────────────

export function estimateFtePtCounts(
  runs: RunRow[],
  fteMinHours = 35,
  fteMaxHours = 40,
): { fte: number; pt: number } {
  if (runs.length === 0) return { fte: 0, pt: 0 };

  // Group by run_name to handle splits, then compute weekly hours
  const runGroups = new Map<string, { dailyPayHours: number; dayCount: number }>();

  for (const run of runs) {
    const key = run.run_name.toLowerCase();
    const days = parseServiceDays(run.service_days);
    const payHrs = Number(run.pay_hours) || 0;

    let group = runGroups.get(key);
    if (!group) {
      group = { dailyPayHours: 0, dayCount: 0 };
      runGroups.set(key, group);
    }
    // For splits sharing the same name+days, accumulate daily pay hours
    // Day count is the unique service days across all splits
    group.dailyPayHours += payHrs;
    group.dayCount = Math.max(group.dayCount, days.length);
  }

  let totalWeeklyHours = 0;
  for (const [, group] of runGroups) {
    totalWeeklyHours += group.dailyPayHours * group.dayCount;
  }

  const fte = Math.floor(totalWeeklyHours / fteMaxHours);
  const remainingHours = totalWeeklyHours - fte * fteMaxHours;
  const pt = remainingHours >= fteMinHours / 2 ? Math.ceil(remainingHours / 20) : (remainingHours > 0 ? 1 : 0);

  return { fte, pt };
}
