import type { DepotRow, NewRouteRow, RouteRow } from './types';

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

/**
 * Match depot_address values from imported new routes to existing depots.
 * Creates new depots for unmatched addresses.
 * Returns the updated new routes (with depot field set) and any new depots to save.
 */
export function matchDepotsForNewRoutes(
  newRoutes: NewRouteRow[],
  existingDepots: DepotRow[],
  depotAddressMap: Map<string, string>,
): { updatedNewRoutes: NewRouteRow[]; newDepots: DepotRow[] } {
  if (depotAddressMap.size === 0) {
    return { updatedNewRoutes: newRoutes, newDepots: [] };
  }

  // Build address→depot_id lookup from existing depots
  const addressToDepotId = new Map<string, string>();
  for (const d of existingDepots) {
    if (d.depot_address) {
      addressToDepotId.set(d.depot_address.toLowerCase(), d.depot_id);
    }
  }

  // Find unique unmatched addresses
  const unmatchedAddresses = new Map<string, string>(); // lower→original
  for (const [, address] of depotAddressMap) {
    const key = address.toLowerCase();
    if (!addressToDepotId.has(key) && !unmatchedAddresses.has(key)) {
      unmatchedAddresses.set(key, address);
    }
  }

  // Create new depots for unmatched addresses
  const newDepots: DepotRow[] = [];
  if (unmatchedAddresses.size > 0) {
    const entries = [...unmatchedAddresses.values()];
    const rawNames = entries.map((addr) => generateDepotName(addr));
    const allNames = [...existingDepots.map((d) => d.depot_name), ...rawNames];
    const deduped = deduplicateNames(allNames);
    const newNames = deduped.slice(existingDepots.length);

    for (let i = 0; i < entries.length; i++) {
      const depotId = crypto.randomUUID();
      newDepots.push({
        depot_id: depotId,
        depot_name: newNames[i],
        depot_address: entries[i],
        depot_lat: null,
        depot_lon: null,
      });
      addressToDepotId.set(entries[i].toLowerCase(), depotId);
    }
  }

  // Update new routes with depot IDs
  const updatedNewRoutes = newRoutes.map((nr) => {
    const address = depotAddressMap.get(nr.new_route_id);
    if (!address) return nr;
    const depotId = addressToDepotId.get(address.toLowerCase());
    return depotId ? { ...nr, depot: depotId } : nr;
  });

  return { updatedNewRoutes, newDepots };
}
