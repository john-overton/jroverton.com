'use client';

import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';

import { ClearcutClientError, createSession } from '@/lib/parallax/client';
import { trackPageView } from '@/lib/parallax/tracking';
import { hexToRgb } from './shared';
import ParallaxMark from './ParallaxMark';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TOKEN_REGEX = /^[a-f0-9]{12}$/;

// Revenue Run map colors
const PICKUP_COLOR = '#059669';
const DROPOFF_COLOR = '#E8590C';

// Fly-to timing
const FLY_DELAY_MS = 2000;
const FLY_DURATION_MS = 3000;
const FLY_ZOOM = 11;

/* ------------------------------------------------------------------ */
/*  Heatmap helpers (from MapTab pattern)                              */
/* ------------------------------------------------------------------ */

function buildHeatmapRamp(hex: string): mapboxgl.Expression {
  const [r, g, b] = hexToRgb(hex);
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

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ClearcutLandingClient() {
  const router = useRouter();

  // Form state
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const tokenValid = TOKEN_REGEX.test(tokenInput.trim());

  // Track page view
  useEffect(() => {
    trackPageView('landing');
  }, []);

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const mapStyle = process.env.NEXT_PUBLIC_MAPBOX_STYLE || 'mapbox://styles/mapbox/light-v11';

  // Session creation handler
  const onCreateSession = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    setIsCreating(true);
    setMessage(null);
    try {
      const created = await createSession({
        name: name.trim() || 'Untitled Session',
        password: password.trim() || undefined,
        _hp: honeypot || undefined,
      });
      router.push(`/parallax/s/${created.session.edit_token}`);
    } catch (error) {
      if (error instanceof ClearcutClientError) {
        if (error.code === 'bot_detected' || error.code === 'ip_blocked') {
          router.push('/');
          return;
        }
        setMessage(error.message);
      } else {
        setMessage('Failed to create a Parallax session.');
      }
    } finally {
      setIsCreating(false);
    }
  }, [name, password, honeypot, router]);

  // Token return handler
  const onReturnToSession = useCallback(() => {
    if (tokenValid) {
      router.push(`/parallax/s/${tokenInput.trim()}`);
    }
  }, [tokenInput, tokenValid, router]);

  // Map initialization
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: mapStyle,
      center: [-98.5, 39.8],
      zoom: 4,
      attributionControl: false,
      // Keep interactive true so mousemove/hover events fire for tooltips,
      // but disable all movement handlers individually below.
      scrollZoom: false,
      boxZoom: false,
      dragRotate: false,
      dragPan: false,
      keyboard: false,
      doubleClickZoom: false,
      touchZoomRotate: false,
      touchPitch: false,
    });

    map.on('load', () => {
      const canvas = map.getCanvas();
      canvas.style.cursor = 'default';

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
          'heatmap-weight': 1,
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 4, 15, 24],
          'heatmap-color': buildHeatmapRamp(PICKUP_COLOR),
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
          'heatmap-weight': 1,
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 4, 15, 24],
          'heatmap-color': buildHeatmapRamp(DROPOFF_COLOR),
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 7, 1, 15, 0],
        },
      });

      // Point layer (visible when zoomed in during fly animation)
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
            PICKUP_COLOR,
            DROPOFF_COLOR,
          ],
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0, 12, 0.8],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff',
          'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0, 12, 0.4],
        },
      });

      // Hit layer for tooltips
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

      // Tooltip popup
      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        maxWidth: '240px',
        className: 'parallax-map-popup',
      });

      map.on('mouseenter', 'trips-hit', () => {
        canvas.style.cursor = 'pointer';
      });
      map.on('mouseleave', 'trips-hit', () => {
        canvas.style.cursor = 'default';
        popup.remove();
      });
      map.on('mousemove', 'trips-hit', (e) => {
        if (!e.features || e.features.length === 0) return;
        const bbox: [mapboxgl.PointLike, mapboxgl.PointLike] = [
          [e.point.x - 15, e.point.y - 15],
          [e.point.x + 15, e.point.y + 15],
        ];
        const features = map.queryRenderedFeatures(bbox, { layers: ['trips-hit'] });
        if (features.length === 0) { popup.remove(); return; }

        let pickups = 0;
        let dropoffs = 0;
        for (const f of features) {
          if (f.properties?.pointType === 'dropoff') dropoffs += 1;
          else pickups += 1;
        }
        const total = pickups + dropoffs;
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-size:13px;line-height:1.5">` +
              `<strong>${total} trip${total !== 1 ? 's' : ''}</strong><br/>` +
              `<span style="color:${PICKUP_COLOR}">&#9679;</span> <span style="color:var(--color-cc-text-secondary)">Pickups: ${pickups}</span><br/>` +
              `<span style="color:${DROPOFF_COLOR}">&#9679;</span> <span style="color:var(--color-cc-text-secondary)">Dropoffs: ${dropoffs}</span>` +
              `</div>`,
          )
          .addTo(map);
      });

      // Fetch demo data and load into map
      fetch('/api/parallax/demo-preview')
        .then((res) => res.json())
        .then((json) => {
          if (!json.ok || !json.data) return;
          const { center, points } = json.data as {
            center: { lat: number; lon: number };
            points: Array<{ lon: number; lat: number; pointType: 'pickup' | 'dropoff' }>;
          };

          const features = points.map((p) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
            properties: { pointType: p.pointType },
          }));

          const source = map.getSource('trips') as mapboxgl.GeoJSONSource | undefined;
          source?.setData({ type: 'FeatureCollection', features });

          // Fly to the city center after delay, offset so the heatmap
          // centers at ~33% from the right edge of the viewport.
          // Using left padding shifts the effective map center to the right.
          setTimeout(() => {
            if (!mapRef.current) return;
            const vw = window.innerWidth;
            // We want the center at 67% from left, so pad the left by 34% of viewport
            const leftPad = Math.round(vw * 0.34);
            map.flyTo({
              center: [center.lon, center.lat],
              zoom: FLY_ZOOM,
              duration: FLY_DURATION_MS,
              essential: true,
              padding: { left: leftPad, top: 0, right: 0, bottom: 0 },
            });
          }, FLY_DELAY_MS);
        })
        .catch(() => {
          // Demo data unavailable — map stays at US overview
        });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mapboxToken, mapStyle]);

  return (
    <div
      style={{
        position: 'relative',
        zIndex: 1,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: "'DM Sans', var(--font-dm-sans), sans-serif",
        // No solid background here — the map sits at z-0 and must be
        // visible through the frosted glass panels (backdrop-filter).
        // Fallback cream only when there is no Mapbox token.
        background: mapboxToken ? 'transparent' : '#f4f3f0',
        color: '#1a1d23',
      }}
    >
      {/* Map background layer */}
      {mapboxToken && (
        <div
          ref={mapContainerRef}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            pointerEvents: 'auto',
          }}
        />
      )}

      {/* Hero section — pointerEvents: none lets hover pass through to the map */}
      <section
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          maxWidth: 1400,
          margin: '0 auto',
          padding: '0 56px',
          alignItems: 'center',
          gap: 64,
          width: '100%',
          position: 'relative',
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        {/* Left column: re-enable pointer events for the form */}
        <div
          style={{
            maxWidth: 500,
            animation: 'fadeUp 0.5s ease-out',
            pointerEvents: 'auto',
            background: 'rgba(244, 243, 240, 0.35)',
            backdropFilter: 'blur(3px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(3px) saturate(1.4)',
            borderRadius: 20,
            border: '1px solid rgba(255, 255, 255, 0.35)',
            boxShadow:
              '0 0 2px 1px rgba(26,29,35,0.06) inset, ' +
              '0 0 10px 4px rgba(26,29,35,0.04) inset, ' +
              '0 4px 24px rgba(26,29,35,0.06), ' +
              '0 8px 48px rgba(26,29,35,0.04)',
            padding: '36px 40px',
          }}
        >
          {/* Logo + wordmark */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 12 }}>
            <ParallaxMark size="hero" variant="color" />
            <div
              style={{
                fontFamily: "'Outfit', var(--font-outfit), sans-serif",
                fontWeight: 600,
                fontSize: 48,
                letterSpacing: 8,
                textTransform: 'uppercase' as const,
                color: '#1a1d23',
              }}
            >
              Parallax
            </div>
          </div>

          <div
            style={{
              fontFamily: "'DM Serif Display', var(--font-dm-serif), serif",
              fontSize: 28,
              fontWeight: 400,
              lineHeight: 1.3,
              color: '#363840',
              marginBottom: 20,
            }}
          >
            See your operation from <em style={{ fontStyle: 'italic', color: '#2a6b5a' }}>every angle</em>
          </div>

          <p
            style={{
              fontSize: 16,
              lineHeight: 1.65,
              color: '#363840',
              marginBottom: 32,
              maxWidth: 420,
            }}
          >
            Import your route and trip data, analyze demand patterns and performance characteristics, plan your route structure, and export optimized bids from real operational numbers.
          </p>
          <p style={{ fontSize: 12, color: '#4e4f52', marginBottom: 16 }}>
            Suitable for most on-demand and pre-scheduled trip services.
            </p>

          {/* Inline session form */}
          <form onSubmit={onCreateSession}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 5, flex: 1 }}>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: '#4e4f52',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase' as const,
                  }}
                >
                  Session Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Title your session"
                  required
                  style={{
                    padding: '12px 14px',
                    border: '1.5px solid rgba(26, 29, 35, 0.12)',
                    borderRadius: 8,
                    fontFamily: "'DM Sans', var(--font-dm-sans), sans-serif",
                    fontSize: 14,
                    color: '#1a1d23',
                    background: '#ffffff',
                    outline: 'none',
                  }}
                />
              </div>
              {/* Honeypot field — hidden from real users, bots will fill it */}
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: -9999,
                  opacity: 0,
                  height: 0,
                  width: 0,
                  overflow: 'hidden',
                  pointerEvents: 'none',
                }}
              >
                <label htmlFor="website">Website</label>
                <input
                  type="text"
                  id="website"
                  name="website"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 5, maxWidth: 160 }}>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: '#4e4f52',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase' as const,
                  }}
                >
                  Password <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10, color: '#8b8d94' }}>(optional)</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  minLength={6}
                  style={{
                    padding: '12px 14px',
                    border: '1.5px solid rgba(26, 29, 35, 0.12)',
                    borderRadius: 8,
                    fontFamily: "'DM Sans', var(--font-dm-sans), sans-serif",
                    fontSize: 14,
                    color: '#1a1d23',
                    background: '#ffffff',
                    outline: 'none',
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={isCreating || !name.trim()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  background: '#2a6b5a',
                  color: '#ffffff',
                  padding: '12px 24px',
                  borderRadius: 8,
                  fontFamily: "'DM Sans', var(--font-dm-sans), sans-serif",
                  fontSize: 14,
                  fontWeight: 500,
                  textDecoration: 'none',
                  border: 'none',
                  cursor: isCreating || !name.trim() ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap' as const,
                  height: 46,
                  opacity: isCreating || !name.trim() ? 0.7 : 1,
                }}
              >
                {isCreating ? 'Creating...' : 'Go'}
                {!isCreating && (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width={15} height={15}>
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                )}
              </button>
            </div>
          </form>

          {message && (
            <p style={{ color: '#DC2626', fontSize: 13, marginBottom: 12 }}>{message}</p>
          )}

          {/* Return to session */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: '#4e4f52' }}>
            {!showTokenInput ? (
              <>
                Have a token?{' '}
                <button
                  onClick={() => setShowTokenInput(true)}
                  style={{
                    color: '#2a6b5a',
                    textDecoration: 'none',
                    fontWeight: 500,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    padding: 0,
                  }}
                >
                  Return to session &rarr;
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
                <input
                  type="text"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value.trim())}
                  placeholder="Enter 12-character edit token"
                  spellCheck={false}
                  autoFocus
                  style={{
                    padding: '8px 12px',
                    border: '1.5px solid rgba(26, 29, 35, 0.12)',
                    borderRadius: 8,
                    fontFamily: "'DM Sans', var(--font-dm-sans), sans-serif",
                    fontSize: 13,
                    color: '#1a1d23',
                    background: '#ffffff',
                    outline: 'none',
                    flex: 1,
                    maxWidth: 240,
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && tokenValid) onReturnToSession();
                    if (e.key === 'Escape') setShowTokenInput(false);
                  }}
                />
                <button
                  onClick={onReturnToSession}
                  disabled={!tokenValid}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: tokenValid ? '#2a6b5a' : '#e0e4ef',
                    color: tokenValid ? '#fff' : '#9b9da3',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: tokenValid ? 'pointer' : 'not-allowed',
                    fontFamily: 'inherit',
                  }}
                >
                  Open
                </button>
                <button
                  onClick={() => { setShowTokenInput(false); setTokenInput(''); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#4e4f52',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    padding: 0,
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right column: empty — map background shows through */}
        <div />
      </section>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: '14px 56px',
          maxWidth: 1400,
          margin: '0 auto',
          width: '100%',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            pointerEvents: 'auto',
            background: 'rgba(244, 243, 240, 0.3)',
            backdropFilter: 'blur(3px) saturate(1.3)',
            WebkitBackdropFilter: 'blur(3px) saturate(1.3)',
            borderRadius: 12,
            border: '1px solid rgba(255, 255, 255, 0.25)',
            boxShadow: '0 0 2px 1px rgba(26,29,35,0.04) inset, 0 0 8px 3px rgba(26,29,35,0.03) inset',
            padding: '10px 20px',
          }}
        >
          <span style={{ fontSize: 13, color: '#4e4f52' }}>&copy; 2026 Parallax</span>
          <a href="/parallax/privacy" style={{ fontSize: 13, color: '#4e4f52', textDecoration: 'none' }}>Privacy</a>
          <a href="/parallax/terms" style={{ fontSize: 13, color: '#4e4f52', textDecoration: 'none' }}>Terms</a>
          <a href="mailto:john@jroverton.com" style={{ fontSize: 13, color: '#4e4f52', textDecoration: 'none' }}>Contact</a>
        </div>
      </div>

      {/* CSS keyframes */}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
