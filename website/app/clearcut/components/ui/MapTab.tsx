'use client';

import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { ClearcutMetrics, TimeBlock } from '@/lib/clearcut/metrics';
import type { TripRow } from '@/lib/clearcut/types';

import { HeatStrip, SectionCard, parseDateTime } from './shared';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MapTabProps {
  metrics: ClearcutMetrics;
  trips: TripRow[];
  selectedDays: number[];
}

interface GeoTrip {
  lon: number;
  lat: number;
  blockIndex: number;
  passengerCount: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function tripPickupTime(trip: TripRow): Date | null {
  return (
    parseDateTime(trip.pickup_leave_time) ??
    parseDateTime(trip.pickup_arrive_time) ??
    parseDateTime(trip.scheduled_pickup_time)
  );
}

function dateToMinutes(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function pickBlockIndex(minutes: number, blocks: TimeBlock[]): number {
  const idx = blocks.findIndex((b) => minutes >= b.startMinutes && minutes < b.endMinutes);
  return idx >= 0 ? idx : Math.max(0, blocks.length - 1);
}

/** Convert trips to geo-located entries with block assignment. */
function tripsToGeoTrips(trips: TripRow[], blocks: TimeBlock[], selectedDays: Set<number>): GeoTrip[] {
  const result: GeoTrip[] = [];
  for (const trip of trips) {
    const lat = parseFloat(trip.pickup_lat ?? '');
    const lon = parseFloat(trip.pickup_lon ?? '');
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const pickup = tripPickupTime(trip);
    if (!pickup) continue;
    if (!selectedDays.has(pickup.getDay())) continue;

    const minutes = dateToMinutes(pickup);
    const blockIdx = pickBlockIndex(minutes, blocks);
    const passengers = Math.max(1, parseInt(trip.passenger_count ?? '1', 10) || 1);
    result.push({ lon, lat, blockIndex: blockIdx, passengerCount: passengers });
  }
  return result;
}

/**
 * Build a GeoJSON FeatureCollection with gaussian temporal falloff
 * so adjacent time blocks blend smoothly as the slider moves.
 */
function buildGeoJSON(
  geoTrips: GeoTrip[],
  selectedBlock: number,
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const SIGMA = 1.5;
  const TWO_SIGMA_SQ = 2 * SIGMA * SIGMA;
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];

  for (const t of geoTrips) {
    const dist = Math.abs(t.blockIndex - selectedBlock);
    const weight = Math.exp(-(dist * dist) / TWO_SIGMA_SQ);
    if (weight < 0.01) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [t.lon, t.lat] },
      properties: { weight: weight * t.passengerCount, passengers: t.passengerCount },
    });
  }

  return { type: 'FeatureCollection', features };
}

/** Compute evenly-spaced legend labels for the time slider. */
function computeLegendLabels(blocks: TimeBlock[]): string[] {
  const count = blocks.length;
  if (count === 0) return [];
  const targetCount = Math.min(8, count);
  const step = Math.max(1, Math.floor(count / targetCount));
  const labels: string[] = [];
  for (let i = 0; i < count; i += step) {
    labels.push(blocks[i].label);
  }
  if (labels[labels.length - 1] !== blocks[count - 1].label) {
    labels.push(blocks[count - 1].label);
  }
  return labels;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function MapTab({ metrics, trips, selectedDays }: MapTabProps) {
  const [mapBlockIdx, setMapBlockIdx] = useState(0);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapLoadedRef = useRef(false);
  const boundsAppliedRef = useRef(false);

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const selectedDaySet = useMemo(() => new Set(selectedDays), [selectedDays]);

  const geoTrips = useMemo(
    () => tripsToGeoTrips(trips, metrics.blocks, selectedDaySet),
    [trips, metrics.blocks, selectedDaySet],
  );

  const legendLabels = useMemo(() => computeLegendLabels(metrics.blocks), [metrics.blocks]);

  /* ---- Map initialization ---- */
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-98.5, 39.8],
      zoom: 4,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.on('load', () => {
      map.addSource('trips', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'trips-heat',
        type: 'heatmap',
        source: 'trips',
        maxzoom: 15,
        paint: {
          'heatmap-weight': ['get', 'weight'],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 4, 15, 24],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(33,102,172,0)',
            0.2,
            'rgb(103,169,207)',
            0.4,
            'rgb(209,229,240)',
            0.6,
            'rgb(253,219,199)',
            0.8,
            'rgb(239,138,98)',
            1,
            'rgb(178,24,43)',
          ],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 7, 1, 15, 0],
        },
      });

      map.addLayer({
        id: 'trips-point',
        type: 'circle',
        source: 'trips',
        minzoom: 10,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3, 15, 8],
          'circle-color': [
            'interpolate',
            ['linear'],
            ['get', 'weight'],
            0,
            'rgba(33,102,172,0)',
            1,
            'rgb(103,169,207)',
            3,
            'rgb(239,138,98)',
            5,
            'rgb(178,24,43)',
          ],
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0, 12, 0.8],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff',
          'circle-stroke-opacity': 0.4,
        },
      });

      mapLoadedRef.current = true;
      mapRef.current = map;
    });

    return () => {
      mapLoadedRef.current = false;
      boundsAppliedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, [mapboxToken]);

  /* ---- Update GeoJSON source when trips or selected block change ---- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    const source = map.getSource('trips') as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;

    source.setData(buildGeoJSON(geoTrips, mapBlockIdx));
  }, [geoTrips, mapBlockIdx]);

  /* ---- Auto-fit bounds on first meaningful data load ---- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current || geoTrips.length === 0 || boundsAppliedRef.current) return;

    const bounds = new mapboxgl.LngLatBounds();
    for (const t of geoTrips) {
      bounds.extend([t.lon, t.lat]);
    }
    map.fitBounds(bounds, { padding: 40, maxZoom: 13 });
    boundsAppliedRef.current = true;
  }, [geoTrips]);

  /* ---- No token fallback ---- */
  if (!mapboxToken) {
    return (
      <SectionCard title="Trip Heatmap">
        <p style={{ color: '#6b7280', textAlign: 'center', padding: 20 }}>
          Mapbox token not configured. Add <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> to{' '}
          <code>.env.local</code> to enable the map.
        </p>
      </SectionCard>
    );
  }

  return (
    <>
      <SectionCard title="Trip Heatmap">
        {/* Time scrubber */}
        <div style={{ marginBottom: 12 }}>
          <label className="form-label" style={{ fontWeight: 600 }}>
            Time Block: {metrics.blocks[mapBlockIdx]?.label ?? 'N/A'}
          </label>
          <input
            className="form-range"
            type="range"
            min={0}
            max={Math.max(0, metrics.blocks.length - 1)}
            value={mapBlockIdx}
            onChange={(e) => setMapBlockIdx(Number(e.target.value))}
          />
          {/* Time legend */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
              color: '#6b7280',
              marginTop: 2,
              paddingLeft: 2,
              paddingRight: 2,
              userSelect: 'none',
            }}
          >
            {legendLabels.map((label, i) => (
              <span key={i}>{label}</span>
            ))}
          </div>
        </div>

        {/* Pickup intensity strip */}
        <HeatStrip
          values={metrics.pickupsByBlock.map((v, i) => (i === mapBlockIdx ? v : v * 0.4))}
        />

        {/* Mapbox map */}
        <div
          ref={mapContainerRef}
          style={{
            width: '100%',
            height: 500,
            borderRadius: 8,
            marginTop: 12,
            overflow: 'hidden',
          }}
        />

        {geoTrips.length === 0 && (
          <p style={{ color: '#6b7280', textAlign: 'center', marginTop: 12 }}>
            No trips with GPS coordinates available for the selected filters.
          </p>
        )}
      </SectionCard>
    </>
  );
}
