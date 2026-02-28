/**
 * Populate Demo Locations Database
 *
 * Uses Mapbox Search Box API to find real addresses in 15 US cities
 * and stores them in a SQLite database for demo data generation.
 *
 * Usage: npx tsx scripts/populate-demo-locations.ts
 *
 * Requires NEXT_PUBLIC_MAPBOX_TOKEN in website/.env.local
 *
 * The script is append-only: it will not overwrite existing data.
 * If a city already has enough locations, it will be skipped.
 * Re-running the script will only fetch what's missing.
 */

import fs from 'node:fs';
import path from 'node:path';

import { DEMO_CITIES } from '../lib/parallax/demo-cities';
import {
  getCityByName,
  getExistingAddressesForCity,
  getLocationsByCity,
  insertCity,
  insertLocation,
  withDemoLocationsDb,
} from '../lib/parallax/demo-locations-db';

// ── Configuration ───────────────────────────────────────────────────

const CONFIG = {
  // Mapbox API (loaded from .env.local if not set in environment)
  mapboxToken: '',

  // Hard limit on total API requests (safety guard — free tier is 50K/month)
  apiRequestHardLimit: 25_000,

  // Rate limiting: milliseconds between API requests
  apiDelayMs: 200,

  // City selection: null = all cities, or array of indices e.g. [0, 1, 2]
  cityIndices: null as number[] | null,

  // Per-city address targets
  destinationsPerCity: 100,
  residentialPerCity: 300,
  depotsPerCity: 3,

  // Search radius in miles (~100 sq mi circle ≈ 5.64 mile radius)
  searchRadiusMiles: 5.64,

  // Reverse geocoding: try this many random points per residential address needed
  reverseGeocodingOversample: 2.5,

  // ── Search Box API: Category search for destinations ────────────
  // Each category is searched via /search/searchbox/v1/category/{id}
  // Returns up to 25 results per call. These are tried first.
  destinationCategories: [
    'hospital',
    'pharmacy',
    'dentist',
    'doctor',
    'clinic',
    'optometrist',
    'library',
    'community_center',
    'government_office',
    'nursing_home',
  ],

  // ── Search Box API: Forward search for specific destination terms ─
  // Used as a supplement after category search to find POIs without clean category IDs.
  // Each term is searched as "{term} {cityName} {state}" via /search/searchbox/v1/forward
  // Returns up to 10 results per call.
  destinationSearchTerms: [
    'dialysis center',
    'senior center',
    'assisted living',
    'rehabilitation center',
    'VA hospital',
    'urgent care',
    'mental health clinic',
    'social services',
  ],

  // ── Depot search terms (forward search) ──────────────────────────
  depotSearchTerms: [
    'warehouse',
    'bus depot',
    'transit center',
    'industrial park',
    'storage facility',
    'distribution center',
  ],

  // Max distance from city center to accept a result (miles)
  maxResultDistanceMiles: 8.0,
};

// ── Mapbox API Helpers ──────────────────────────────────────────────

let apiRequestCount = 0;

function checkRequestLimit(): void {
  if (apiRequestCount >= CONFIG.apiRequestHardLimit) {
    throw new Error(
      `API request hard limit reached (${CONFIG.apiRequestHardLimit}). ` +
      `Stopping to prevent excessive charges.`,
    );
  }
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Search Box API types ────────────────────────────────────────────

interface SearchBoxFeature {
  type: 'Feature';
  geometry: {
    coordinates: [number, number]; // [lon, lat]
    type: 'Point';
  };
  properties: {
    name: string;
    mapbox_id: string;
    feature_type: string;
    address?: string;
    full_address?: string;
    place_formatted?: string;
    coordinates?: {
      longitude: number;
      latitude: number;
    };
    poi_category?: string[];
    poi_category_ids?: string[];
  };
}

interface SearchBoxResponse {
  type: 'FeatureCollection';
  features: SearchBoxFeature[];
}

// ── Geocoding v5 types (for reverse geocoding) ─────────────────────

interface MapboxFeature {
  place_name: string;
  center: [number, number]; // [lon, lat]
  text: string;
  properties: Record<string, unknown>;
}

interface MapboxGeocodingResponse {
  type: string;
  features: MapboxFeature[];
}

// ── Geo Helpers ────────────────────────────────────────────────────

function milesToDegrees(miles: number, latitude: number): { dLat: number; dLon: number } {
  const dLat = miles / 69.0;
  const dLon = miles / (69.0 * Math.cos((latitude * Math.PI) / 180));
  return { dLat, dLon };
}

function haversineDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeBbox(
  centerLat: number,
  centerLon: number,
  radiusMiles: number,
): string {
  const { dLat, dLon } = milesToDegrees(radiusMiles, centerLat);
  const minLon = centerLon - dLon;
  const minLat = centerLat - dLat;
  const maxLon = centerLon + dLon;
  const maxLat = centerLat + dLat;
  return `${minLon},${minLat},${maxLon},${maxLat}`;
}

// ── Search Box API: Category Search ─────────────────────────────────

async function categorySearch(
  categoryId: string,
  centerLat: number,
  centerLon: number,
): Promise<SearchBoxFeature[]> {
  checkRequestLimit();
  apiRequestCount += 1;

  const bbox = computeBbox(centerLat, centerLon, CONFIG.searchRadiusMiles);
  const params = new URLSearchParams({
    access_token: CONFIG.mapboxToken,
    proximity: `${centerLon},${centerLat}`,
    bbox,
    limit: '25',
    country: 'US',
    language: 'en',
  });

  const url = `https://api.mapbox.com/search/searchbox/v1/category/${encodeURIComponent(categoryId)}?${params}`;
  const response = await fetch(url);
  await delay(CONFIG.apiDelayMs);

  if (!response.ok) {
    if (response.status === 404 || response.status === 422) {
      // Category ID might not exist — skip silently
      return [];
    }
    console.error(`  Category search failed for "${categoryId}": ${response.status} ${response.statusText}`);
    return [];
  }

  const data = (await response.json()) as SearchBoxResponse;

  // Filter results by distance from city center
  const maxDist = CONFIG.maxResultDistanceMiles;
  return (data.features ?? []).filter((f) => {
    const [lon, lat] = f.geometry.coordinates;
    return haversineDistanceMiles(centerLat, centerLon, lat, lon) <= maxDist;
  });
}

// ── Search Box API: Forward Search ──────────────────────────────────

async function forwardSearch(
  query: string,
  centerLat: number,
  centerLon: number,
  limit: number = 10,
): Promise<SearchBoxFeature[]> {
  checkRequestLimit();
  apiRequestCount += 1;

  const bbox = computeBbox(centerLat, centerLon, CONFIG.searchRadiusMiles);
  const params = new URLSearchParams({
    q: query,
    access_token: CONFIG.mapboxToken,
    proximity: `${centerLon},${centerLat}`,
    bbox,
    limit: String(Math.min(limit, 10)),
    country: 'US',
    language: 'en',
    types: 'poi',
  });

  const url = `https://api.mapbox.com/search/searchbox/v1/forward?${params}`;
  const response = await fetch(url);
  await delay(CONFIG.apiDelayMs);

  if (!response.ok) {
    console.error(`  Forward search failed for "${query}": ${response.status} ${response.statusText}`);
    return [];
  }

  const data = (await response.json()) as SearchBoxResponse;

  // Filter results by distance from city center
  const maxDist = CONFIG.maxResultDistanceMiles;
  return (data.features ?? []).filter((f) => {
    const [lon, lat] = f.geometry.coordinates;
    return haversineDistanceMiles(centerLat, centerLon, lat, lon) <= maxDist;
  });
}

// ── Geocoding v5: Reverse Geocode (for residential addresses) ──────

async function reverseGeocode(
  lat: number,
  lon: number,
): Promise<MapboxFeature | null> {
  checkRequestLimit();
  apiRequestCount += 1;

  const params = new URLSearchParams({
    access_token: CONFIG.mapboxToken,
    types: 'address',
    limit: '1',
    language: 'en',
  });

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?${params}`;
  const response = await fetch(url);
  await delay(CONFIG.apiDelayMs);

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as MapboxGeocodingResponse;
  return data.features?.[0] ?? null;
}

// ── Feature → Address Extraction ────────────────────────────────────

function extractSearchBoxAddress(feature: SearchBoxFeature): string {
  return feature.properties.full_address ?? feature.properties.address ?? '';
}

function extractSearchBoxName(feature: SearchBoxFeature): string | null {
  return feature.properties.name ?? null;
}

function extractGeocodingAddress(feature: MapboxFeature): string {
  return feature.place_name ?? feature.text ?? '';
}

// ── Random Point Generation ─────────────────────────────────────────

function randomPointInRadius(
  centerLat: number,
  centerLon: number,
  radiusMiles: number,
): { lat: number; lon: number } {
  const { dLat, dLon } = milesToDegrees(radiusMiles, centerLat);
  const angle = Math.random() * 2 * Math.PI;
  const r = Math.sqrt(Math.random());
  return {
    lat: centerLat + r * dLat * Math.sin(angle),
    lon: centerLon + r * dLon * Math.cos(angle),
  };
}

// ── Load Token ──────────────────────────────────────────────────────

function loadMapboxToken(): string {
  if (process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
    return process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  }

  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('NEXT_PUBLIC_MAPBOX_TOKEN=')) {
        return trimmed.slice('NEXT_PUBLIC_MAPBOX_TOKEN='.length).trim();
      }
    }
  }

  throw new Error(
    'NEXT_PUBLIC_MAPBOX_TOKEN not found. Set it in the environment or in website/.env.local',
  );
}

// ── Main ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  CONFIG.mapboxToken = loadMapboxToken();
  console.log('Mapbox token loaded.');
  console.log(`Hard limit: ${CONFIG.apiRequestHardLimit} API requests`);
  console.log('Mode: append-only (existing data preserved)\n');

  const cities = CONFIG.cityIndices
    ? CONFIG.cityIndices.map((i) => DEMO_CITIES[i]).filter(Boolean)
    : DEMO_CITIES;

  console.log(`Processing ${cities.length} cities...\n`);

  const summary: Array<{
    city: string;
    destinations: number;
    residential: number;
    depots: number;
    skipped: boolean;
  }> = [];

  for (const city of cities) {
    console.log(`── ${city.name}, ${city.state} ──`);
    const cityLabel = `${city.name} ${city.state}`;

    // ── Check existing data (append-only) ──────────────────────────
    let cityId: number;
    let seenAddresses: Set<string>;
    let existingDest = 0;
    let existingRes = 0;
    let existingDepot = 0;

    const existingCity = withDemoLocationsDb((db) =>
      getCityByName(db, city.name, city.state),
    );

    if (existingCity) {
      cityId = existingCity.city_id;
      seenAddresses = withDemoLocationsDb((db) =>
        getExistingAddressesForCity(db, cityId),
      );
      const existingLocations = withDemoLocationsDb((db) =>
        getLocationsByCity(db, cityId),
      );
      existingDest = existingLocations.destinations.length;
      existingRes = existingLocations.residential.length;
      existingDepot = existingLocations.depots.length;

      if (
        existingDest >= CONFIG.destinationsPerCity &&
        existingRes >= CONFIG.residentialPerCity &&
        existingDepot >= CONFIG.depotsPerCity
      ) {
        console.log(`  Already fully populated (${existingDest} dest, ${existingRes} res, ${existingDepot} depot), skipping.\n`);
        summary.push({
          city: cityLabel,
          destinations: existingDest,
          residential: existingRes,
          depots: existingDepot,
          skipped: true,
        });
        continue;
      }

      console.log(`  Existing: ${existingDest} dest, ${existingRes} res, ${existingDepot} depot`);
    } else {
      cityId = withDemoLocationsDb((db) =>
        insertCity(db, {
          name: city.name,
          state: city.state,
          centerLat: city.centerLat,
          centerLon: city.centerLon,
        }),
      );
      seenAddresses = new Set();
    }

    // ── Destinations (category search + forward search) ────────────
    let destinationCount = existingDest;
    const destNeeded = CONFIG.destinationsPerCity;

    // Phase 1: Category search (up to 25 results per category)
    for (const categoryId of CONFIG.destinationCategories) {
      if (destinationCount >= destNeeded) break;

      try {
        const features = await categorySearch(
          categoryId,
          city.centerLat,
          city.centerLon,
        );

        for (const feature of features) {
          if (destinationCount >= destNeeded) break;
          const address = extractSearchBoxAddress(feature);
          const addressKey = address.toLowerCase().trim();
          if (!address || seenAddresses.has(addressKey)) continue;
          seenAddresses.add(addressKey);

          const [lon, lat] = feature.geometry.coordinates;
          const inserted = withDemoLocationsDb((db) =>
            insertLocation(db, {
              cityId,
              category: 'destination',
              address,
              lat,
              lon,
              placeName: extractSearchBoxName(feature),
            }),
          );
          if (inserted !== null) destinationCount += 1;
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('hard limit')) throw error;
        console.error(`  Error in category search "${categoryId}": ${error}`);
      }
    }

    // Phase 2: Forward search for specific terms (supplement if categories weren't enough)
    if (destinationCount < destNeeded) {
      for (const term of CONFIG.destinationSearchTerms) {
        if (destinationCount >= destNeeded) break;

        try {
          const query = `${term} ${cityLabel}`;
          const features = await forwardSearch(
            query,
            city.centerLat,
            city.centerLon,
          );

          for (const feature of features) {
            if (destinationCount >= destNeeded) break;
            const address = extractSearchBoxAddress(feature);
            const addressKey = address.toLowerCase().trim();
            if (!address || seenAddresses.has(addressKey)) continue;
            seenAddresses.add(addressKey);

            const [lon, lat] = feature.geometry.coordinates;
            const inserted = withDemoLocationsDb((db) =>
              insertLocation(db, {
                cityId,
                category: 'destination',
                address,
                lat,
                lon,
                placeName: extractSearchBoxName(feature),
              }),
            );
            if (inserted !== null) destinationCount += 1;
          }
        } catch (error) {
          if (error instanceof Error && error.message.includes('hard limit')) throw error;
          console.error(`  Error in forward search "${term}": ${error}`);
        }
      }
    }

    const newDest = destinationCount - existingDest;
    console.log(`  Destinations: ${destinationCount} (+${newDest} new)`);

    // ── Residential (reverse geocoding) ────────────────────────────
    let residentialCount = existingRes;
    const resNeeded = CONFIG.residentialPerCity;
    const remaining = resNeeded - residentialCount;
    const maxAttempts = Math.ceil(remaining * CONFIG.reverseGeocodingOversample);
    let attempts = 0;

    while (residentialCount < resNeeded && attempts < maxAttempts) {
      attempts += 1;
      const point = randomPointInRadius(
        city.centerLat,
        city.centerLon,
        CONFIG.searchRadiusMiles,
      );

      try {
        const feature = await reverseGeocode(point.lat, point.lon);
        if (!feature) continue;

        const address = extractGeocodingAddress(feature);
        const addressKey = address.toLowerCase().trim();
        if (!address || seenAddresses.has(addressKey)) continue;
        seenAddresses.add(addressKey);

        const inserted = withDemoLocationsDb((db) =>
          insertLocation(db, {
            cityId,
            category: 'residential',
            address,
            lat: feature.center[1],
            lon: feature.center[0],
            placeName: null,
          }),
        );
        if (inserted !== null) residentialCount += 1;
      } catch (error) {
        if (error instanceof Error && error.message.includes('hard limit')) throw error;
      }
    }

    const newRes = residentialCount - existingRes;
    console.log(`  Residential: ${residentialCount} (+${newRes} new, ${attempts} attempts)`);

    // ── Depots (forward search) ────────────────────────────────────
    let depotCount = existingDepot;
    const depotNeeded = CONFIG.depotsPerCity;

    for (const term of CONFIG.depotSearchTerms) {
      if (depotCount >= depotNeeded) break;

      try {
        const query = `${term} ${cityLabel}`;
        const features = await forwardSearch(
          query,
          city.centerLat,
          city.centerLon,
        );

        for (const feature of features) {
          if (depotCount >= depotNeeded) break;
          const address = extractSearchBoxAddress(feature);
          const addressKey = address.toLowerCase().trim();
          if (!address || seenAddresses.has(addressKey)) continue;
          seenAddresses.add(addressKey);

          const [lon, lat] = feature.geometry.coordinates;
          const inserted = withDemoLocationsDb((db) =>
            insertLocation(db, {
              cityId,
              category: 'depot',
              address,
              lat,
              lon,
              placeName: extractSearchBoxName(feature),
            }),
          );
          if (inserted !== null) depotCount += 1;
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('hard limit')) throw error;
        console.error(`  Error searching depot "${term}": ${error}`);
      }
    }

    const newDepot = depotCount - existingDepot;
    console.log(`  Depots: ${depotCount} (+${newDepot} new)`);

    summary.push({
      city: cityLabel,
      destinations: destinationCount,
      residential: residentialCount,
      depots: depotCount,
      skipped: false,
    });

    console.log(`  API requests so far: ${apiRequestCount}\n`);
  }

  // ── Summary ───────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════');
  console.log('Summary:');
  let totalDest = 0;
  let totalRes = 0;
  let totalDepot = 0;
  for (const row of summary) {
    const tag = row.skipped ? ' (skipped)' : '';
    console.log(`  ${row.city}: ${row.destinations} dest, ${row.residential} res, ${row.depots} depot${tag}`);
    totalDest += row.destinations;
    totalRes += row.residential;
    totalDepot += row.depots;
  }
  console.log('');
  console.log(`Total: ${totalDest} destinations, ${totalRes} residential, ${totalDepot} depots`);
  console.log(`Total locations: ${totalDest + totalRes + totalDepot}`);
  console.log(`Total API requests: ${apiRequestCount}`);
  console.log('═══════════════════════════════════════════');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
