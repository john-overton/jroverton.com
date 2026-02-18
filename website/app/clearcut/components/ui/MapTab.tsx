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
  pointType: 'pickup' | 'dropoff';
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

/** Convert trips to geo-located entries (both pickup and dropoff) with block assignment. */
function tripsToGeoTrips(trips: TripRow[], blocks: TimeBlock[], selectedDays: Set<number>): GeoTrip[] {
  const result: GeoTrip[] = [];
  for (const trip of trips) {
    const pickup = tripPickupTime(trip);
    if (!pickup) continue;
    if (!selectedDays.has(pickup.getDay())) continue;

    const minutes = dateToMinutes(pickup);
    const blockIdx = pickBlockIndex(minutes, blocks);
    const passengers = Math.max(1, parseInt(trip.passenger_count ?? '1', 10) || 1);

    const pickLat = parseFloat(trip.pickup_lat ?? '');
    const pickLon = parseFloat(trip.pickup_lon ?? '');
    if (Number.isFinite(pickLat) && Number.isFinite(pickLon)) {
      result.push({ lon: pickLon, lat: pickLat, blockIndex: blockIdx, passengerCount: passengers, pointType: 'pickup' });
    }

    const dropLat = parseFloat(trip.dropoff_lat ?? '');
    const dropLon = parseFloat(trip.dropoff_lon ?? '');
    if (Number.isFinite(dropLat) && Number.isFinite(dropLon)) {
      result.push({ lon: dropLon, lat: dropLat, blockIndex: blockIdx, passengerCount: passengers, pointType: 'dropoff' });
    }
  }
  return result;
}

/**
 * Build a GeoJSON FeatureCollection with gaussian temporal falloff
 * so adjacent time blocks blend smoothly as the slider moves.
 * Weights are normalized to 0–1 so the full color ramp is used
 * regardless of absolute passenger counts.
 */
function buildGeoJSON(
  geoTrips: GeoTrip[],
  selectedBlock: number,
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const SIGMA = 1.5;
  const TWO_SIGMA_SQ = 2 * SIGMA * SIGMA;

  // First pass: compute raw weights and find max for normalization
  const rawEntries: Array<{ t: GeoTrip; rawWeight: number }> = [];
  let maxWeight = 0;
  for (const t of geoTrips) {
    const dist = Math.abs(t.blockIndex - selectedBlock);
    const w = Math.exp(-(dist * dist) / TWO_SIGMA_SQ) * t.passengerCount;
    if (w < 0.01) continue;
    rawEntries.push({ t, rawWeight: w });
    if (w > maxWeight) maxWeight = w;
  }

  // Second pass: normalize to 0–1 range
  const scale = maxWeight > 0 ? 1 / maxWeight : 1;
  const features: GeoJSON.Feature<GeoJSON.Point>[] = rawEntries.map(({ t, rawWeight }) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [t.lon, t.lat] },
    properties: { weight: rawWeight * scale, passengers: t.passengerCount, pointType: t.pointType },
  }));

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

  const popupRef = useRef<mapboxgl.Popup | null>(null);

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const mapStyle = process.env.NEXT_PUBLIC_MAPBOX_STYLE || 'mapbox://styles/mapbox/dark-v11';

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
      style: mapStyle,
      center: [-98.5, 39.8],
      zoom: 4,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.on('load', () => {
      map.addSource('trips', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Pickup heatmap (blue)
      map.addLayer({
        id: 'trips-heat-pickup',
        type: 'heatmap',
        source: 'trips',
        maxzoom: 15,
        filter: ['==', ['get', 'pointType'], 'pickup'],
        paint: {
          'heatmap-weight': ['get', 'weight'],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 4, 15, 24],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(0,0,0,0)',
            0.15,
            'rgba(65,139,212,0.3)',
            0.35,
            'rgba(65,139,212,0.5)',
            0.6,
            'rgba(45,112,192,0.7)',
            0.8,
            'rgba(30,90,170,0.85)',
            1,
            'rgb(20,70,150)',
          ],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 7, 1, 15, 0],
        },
      });

      // Dropoff heatmap (red)
      map.addLayer({
        id: 'trips-heat-dropoff',
        type: 'heatmap',
        source: 'trips',
        maxzoom: 15,
        filter: ['==', ['get', 'pointType'], 'dropoff'],
        paint: {
          'heatmap-weight': ['get', 'weight'],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 4, 15, 24],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(0,0,0,0)',
            0.15,
            'rgba(220,100,80,0.3)',
            0.35,
            'rgba(220,100,80,0.5)',
            0.6,
            'rgba(200,60,50,0.7)',
            0.8,
            'rgba(180,40,35,0.85)',
            1,
            'rgb(160,25,25)',
          ],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 7, 1, 15, 0],
        },
      });

      // Visible circle layer at high zoom — colored by pickup (blue) vs dropoff (red)
      map.addLayer({
        id: 'trips-point',
        type: 'circle',
        source: 'trips',
        minzoom: 10,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3, 15, 8],
          'circle-color': [
            'case',
            ['==', ['get', 'pointType'], 'pickup'],
            'rgb(45,112,192)',
            'rgb(200,60,50)',
          ],
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0, 12, 0.8],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff',
          'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0, 12, 0.4],
        },
      });

      // Invisible hit-test layer at ALL zoom levels for hover detection
      map.addLayer({
        id: 'trips-hit',
        type: 'circle',
        source: 'trips',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 12, 8, 16, 15, 8],
          'circle-color': 'transparent',
          'circle-opacity': 0,
        },
      });

      /* ---- Hover popup (works at all zoom levels) ---- */
      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        maxWidth: '240px',
      });
      popupRef.current = popup;

      map.on('mouseenter', 'trips-hit', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'trips-hit', () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
      });

      map.on('mousemove', 'trips-hit', (e) => {
        if (!e.features || e.features.length === 0) return;

        // Query a small bbox around the cursor to catch nearby points
        const bbox: [mapboxgl.PointLike, mapboxgl.PointLike] = [
          [e.point.x - 15, e.point.y - 15],
          [e.point.x + 15, e.point.y + 15],
        ];
        const features = map.queryRenderedFeatures(bbox, { layers: ['trips-hit'] });
        if (features.length === 0) {
          popup.remove();
          return;
        }

        let pickups = 0;
        let dropoffs = 0;
        for (const f of features) {
          const pax = (f.properties?.passengers as number) ?? 1;
          if (f.properties?.pointType === 'dropoff') {
            dropoffs += pax;
          } else {
            pickups += pax;
          }
        }
        const total = pickups + dropoffs;

        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-size:13px;line-height:1.5">` +
              `<strong>${total} trip${total !== 1 ? 's' : ''}</strong><br/>` +
              `<span style="color:rgb(45,112,192)">&#9679;</span> Pickups: ${pickups}<br/>` +
              `<span style="color:rgb(200,60,50)">&#9679;</span> Dropoffs: ${dropoffs}` +
              `</div>`,
          )
          .addTo(map);
      });

      mapLoadedRef.current = true;
      mapRef.current = map;
    });

    return () => {
      mapLoadedRef.current = false;
      boundsAppliedRef.current = false;
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [mapboxToken, mapStyle]);

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
