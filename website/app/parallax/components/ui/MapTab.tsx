'use client';

import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Label } from '@/app/parallax/components/shadcn/label';
import { Slider } from '@/app/parallax/components/shadcn/slider';
import { useClearcutTheme } from '@/app/parallax/theme/ClearcutThemeProvider';
import type { ClearcutMetrics, TimeBlock } from '@/lib/parallax/metrics';
import type { TripRow } from '@/lib/parallax/types';

import { HeatStrip, SectionCard, hexToRgb, parseDateTime } from './shared';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MapTabProps {
  metrics: ClearcutMetrics;
  trips: TripRow[];
  selectedDays: number[];
  specificDate?: string | null;
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

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function tripDropoffTime(trip: TripRow): Date | null {
  return (
    parseDateTime(trip.dropoff_leave_time) ??
    parseDateTime(trip.dropoff_arrive_time) ??
    parseDateTime(trip.scheduled_appointment_time)
  );
}

/** Convert trips to geo-located entries (both pickup and dropoff) with block assignment. */
function tripsToGeoTrips(trips: TripRow[], blocks: TimeBlock[], selectedDays: Set<number>, specificDate?: string | null): GeoTrip[] {
  const result: GeoTrip[] = [];
  for (const trip of trips) {
    const pickup = tripPickupTime(trip);
    if (!pickup) continue;
    if (specificDate) {
      if (formatDateKey(pickup) !== specificDate) continue;
    } else {
      if (!selectedDays.has(pickup.getDay())) continue;
    }

    const pickupMinutes = dateToMinutes(pickup);
    const pickupBlockIdx = pickBlockIndex(pickupMinutes, blocks);
    const passengers = Math.max(1, parseInt(trip.passenger_count ?? '1', 10) || 1);

    const pickLat = parseFloat(trip.pickup_lat ?? '');
    const pickLon = parseFloat(trip.pickup_lon ?? '');
    if (Number.isFinite(pickLat) && Number.isFinite(pickLon)) {
      result.push({ lon: pickLon, lat: pickLat, blockIndex: pickupBlockIdx, passengerCount: passengers, pointType: 'pickup' });
    }

    const dropoff = tripDropoffTime(trip);
    const dropoffMinutes = dropoff ? dateToMinutes(dropoff) : pickupMinutes;
    const dropoffBlockIdx = pickBlockIndex(dropoffMinutes, blocks);
    const dropLat = parseFloat(trip.dropoff_lat ?? '');
    const dropLon = parseFloat(trip.dropoff_lon ?? '');
    if (Number.isFinite(dropLat) && Number.isFinite(dropLon)) {
      result.push({ lon: dropLon, lat: dropLat, blockIndex: dropoffBlockIdx, passengerCount: passengers, pointType: 'dropoff' });
    }
  }
  return result;
}

function buildGeoJSON(
  geoTrips: GeoTrip[],
  selectedBlock: number,
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const t of geoTrips) {
    if (t.blockIndex !== selectedBlock) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [t.lon, t.lat] },
      properties: { weight: 1, passengers: t.passengerCount, pointType: t.pointType },
    });
  }
  return { type: 'FeatureCollection', features };
}

/** Build a Mapbox heatmap-color ramp from a base hex color. */
function buildHeatmapRamp(hex: string): mapboxgl.Expression {
  const [r, g, b] = hexToRgb(hex);
  // Progressively darken toward full density while keeping the hue
  const dark = (f: number) => [Math.round(r * f), Math.round(g * f), Math.round(b * f)];
  const [dr1, dg1, db1] = dark(0.8);
  const [dr2, dg2, db2] = dark(0.65);
  const [dr3, dg3, db3] = dark(0.5);
  return [
    'interpolate',
    ['linear'],
    ['heatmap-density'],
    0, 'rgba(0,0,0,0)',
    0.15, `rgba(${r},${g},${b},0.3)`,
    0.35, `rgba(${r},${g},${b},0.5)`,
    0.6, `rgba(${dr1},${dg1},${db1},0.7)`,
    0.8, `rgba(${dr2},${dg2},${db2},0.85)`,
    1, `rgb(${dr3},${dg3},${db3})`,
  ] as mapboxgl.Expression;
}

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

export default function MapTab({ metrics, trips, selectedDays, specificDate }: MapTabProps) {
  const [mapBlockIdx, setMapBlockIdx] = useState(() => Math.floor(metrics.blocks.length / 2));
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapLoadedRef = useRef(false);
  const boundsAppliedRef = useRef(false);
  const geoTripsRef = useRef<GeoTrip[]>([]);
  const mapBlockIdxRef = useRef(mapBlockIdx);
  mapBlockIdxRef.current = mapBlockIdx;

  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const { palette } = useClearcutTheme();
  const pickupColor = palette.mapColors.pickup;
  const dropoffColor = palette.mapColors.dropoff;
  const pickupColorRef = useRef(pickupColor);
  const dropoffColorRef = useRef(dropoffColor);
  pickupColorRef.current = pickupColor;
  dropoffColorRef.current = dropoffColor;

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const mapStyleLight = process.env.NEXT_PUBLIC_MAPBOX_STYLE || 'mapbox://styles/mapbox/light-v11';
  const mapStyleDark = process.env.NEXT_PUBLIC_MAPBOX_STYLE_DARK || 'mapbox://styles/mapbox/dark-v11';
  const mapStyle = palette.mode === 'dark' ? mapStyleDark : mapStyleLight;

  const selectedDaySet = useMemo(() => new Set(selectedDays), [selectedDays]);

  const geoTrips = useMemo(
    () => tripsToGeoTrips(trips, metrics.blocks, selectedDaySet, specificDate),
    [trips, metrics.blocks, selectedDaySet, specificDate],
  );
  geoTripsRef.current = geoTrips;

  /** Per-block event counts — every pickup and every dropoff is 1 event, regardless of GPS. */
  const eventsByBlock = useMemo(() => {
    const counts = new Array(metrics.blocks.length).fill(0) as number[];
    for (const trip of trips) {
      const pickup = tripPickupTime(trip);
      if (!pickup) continue;
      if (specificDate) {
        if (formatDateKey(pickup) !== specificDate) continue;
      } else {
        if (!selectedDaySet.has(pickup.getDay())) continue;
      }
      // Pickup event
      const pickupIdx = pickBlockIndex(dateToMinutes(pickup), metrics.blocks);
      if (pickupIdx >= 0) counts[pickupIdx] += 1;
      // Dropoff event (separate time block)
      const dropoff = tripDropoffTime(trip);
      if (dropoff) {
        const dropoffIdx = pickBlockIndex(dateToMinutes(dropoff), metrics.blocks);
        if (dropoffIdx >= 0) counts[dropoffIdx] += 1;
      }
    }
    return counts;
  }, [trips, metrics.blocks, selectedDaySet, specificDate]);

  const legendLabels = useMemo(() => computeLegendLabels(metrics.blocks), [metrics.blocks]);

  /* ---- Reset slider to middle when blocks change ---- */
  useEffect(() => {
    setMapBlockIdx(Math.floor(metrics.blocks.length / 2));
  }, [metrics.blocks]);

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

      // Pickup heatmap
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
          'heatmap-color': buildHeatmapRamp(pickupColorRef.current),
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 7, 1, 15, 0],
        },
      });

      // Dropoff heatmap
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
          'heatmap-color': buildHeatmapRamp(dropoffColorRef.current),
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
            'case',
            ['==', ['get', 'pointType'], 'pickup'],
            pickupColorRef.current,
            dropoffColorRef.current,
          ],
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0, 12, 0.8],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff',
          'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0, 12, 0.4],
        },
      });

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

      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        maxWidth: '240px',
        className: 'parallax-map-popup',
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
              `<span style="color:${pickupColorRef.current}">&#9679;</span> <span style="color:var(--color-cc-text-secondary)">Pickups: ${pickups}</span><br/>` +
              `<span style="color:${dropoffColorRef.current}">&#9679;</span> <span style="color:var(--color-cc-text-secondary)">Dropoffs: ${dropoffs}</span>` +
              `</div>`,
          )
          .addTo(map);
      });

      mapLoadedRef.current = true;
      mapRef.current = map;

      // Push initial heatmap data now that the map is ready
      if (geoTripsRef.current.length > 0) {
        const source = map.getSource('trips') as mapboxgl.GeoJSONSource | undefined;
        source?.setData(buildGeoJSON(geoTripsRef.current, mapBlockIdxRef.current));
      }

      // Fit bounds on initial load if geo data is already available
      if (geoTripsRef.current.length > 0 && !boundsAppliedRef.current) {
        const bounds = new mapboxgl.LngLatBounds();
        for (const t of geoTripsRef.current) {
          bounds.extend([t.lon, t.lat]);
        }
        map.fitBounds(bounds, { padding: 40, maxZoom: 13 });
        boundsAppliedRef.current = true;
      }
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    const source = map.getSource('trips') as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;

    source.setData(buildGeoJSON(geoTrips, mapBlockIdx));
  }, [geoTrips, mapBlockIdx]);

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

  /* ---- Update map layer colors when palette changes ---- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    map.setPaintProperty('trips-heat-pickup', 'heatmap-color', buildHeatmapRamp(pickupColor));
    map.setPaintProperty('trips-heat-dropoff', 'heatmap-color', buildHeatmapRamp(dropoffColor));
    map.setPaintProperty('trips-point', 'circle-color', [
      'case',
      ['==', ['get', 'pointType'], 'pickup'],
      pickupColor,
      dropoffColor,
    ]);
  }, [pickupColor, dropoffColor]);

  if (!mapboxToken) {
    return (
      <SectionCard title="Trip Heatmap">
        <p className="text-cc-text-muted text-center py-5">
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
        <div className="mb-3">
          <Label className="font-semibold">
            Time Block: {metrics.blocks[mapBlockIdx]?.label ?? 'N/A'}
          </Label>
          <Slider
            min={0}
            max={Math.max(0, metrics.blocks.length - 1)}
            step={1}
            value={[mapBlockIdx]}
            onValueChange={([v]) => setMapBlockIdx(v)}
            className="mt-2"
          />
          {/* Time legend */}
          <div className="flex justify-between text-[11px] text-cc-text-muted mt-1 px-0.5 select-none">
            {legendLabels.map((label, i) => (
              <span key={i}>{label}</span>
            ))}
          </div>
        </div>

        {/* Pickup intensity strip */}
        <HeatStrip
          values={eventsByBlock}
          blocks={metrics.blocks}
          activeIndex={mapBlockIdx}
          onBlockClick={(index) => setMapBlockIdx(index)}
          valueLabel="Events"
          valueSuffix=""
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
          <p className="text-cc-text-muted text-center mt-3">
            No trips with GPS coordinates available for the selected filters.
          </p>
        )}
      </SectionCard>
    </>
  );
}
