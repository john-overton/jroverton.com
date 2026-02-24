import type { DepotRow, RouteRow } from './types';

export function generateDepotName(address: string): string {
  const trimmed = address.trim();
  // Strip leading house number (digits, optional dash/slash/space)
  const withoutNumber = trimmed.replace(/^\d[\d\-\/]*\s*/, '');
  // Take first word as the name
  const firstWord = withoutNumber.split(/[\s,]+/)[0] || trimmed;
  return firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
}

export function deduplicateNames(names: string[]): string[] {
  const counts = new Map<string, number>();
  return names.map((name) => {
    const lower = name.toLowerCase();
    const count = (counts.get(lower) ?? 0) + 1;
    counts.set(lower, count);
    return count > 1 ? `${name} ${count}` : name;
  });
}

/**
 * Extract new depots from routes that aren't already in the existing depots list.
 * Returns only the new DepotRow entries to append (empty array if none).
 */
export function extractNewDepotsFromRoutes(routes: RouteRow[], existingDepots: DepotRow[]): DepotRow[] {
  const existingAddresses = new Set(
    existingDepots.map((d) => d.depot_address?.toLowerCase()).filter(Boolean),
  );

  const uniqueAddresses = new Map<string, RouteRow>();
  for (const route of routes) {
    if (!route.depot_address) continue;
    const key = route.depot_address.toLowerCase();
    if (!existingAddresses.has(key) && !uniqueAddresses.has(key)) {
      uniqueAddresses.set(key, route);
    }
  }

  if (uniqueAddresses.size === 0) return [];

  const newEntries = [...uniqueAddresses.values()];
  const rawNames = newEntries.map((r) => generateDepotName(r.depot_address!));
  // Account for existing depot names when deduplicating
  const allNames = [...existingDepots.map((d) => d.depot_name), ...rawNames];
  const deduped = deduplicateNames(allNames);
  const newNames = deduped.slice(existingDepots.length);

  return newEntries.map((route, i) => ({
    depot_id: crypto.randomUUID(),
    depot_name: newNames[i],
    depot_address: route.depot_address,
    depot_lat: route.depot_lat ?? null,
    depot_lon: route.depot_lon ?? null,
  }));
}
