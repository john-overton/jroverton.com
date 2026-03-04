/**
 * Fire-and-forget client-side page view tracking.
 * Silently fails — tracking should never break the app.
 */
export function trackPageView(page: string, sessionToken?: string): void {
  try {
    fetch('/api/parallax/metrics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page,
        session_token: sessionToken ?? null,
        referrer: typeof document !== 'undefined' ? document.referrer : null,
      }),
      keepalive: true,
    }).catch(() => {
      // Silent failure
    });
  } catch {
    // Silent failure
  }
}

/**
 * Fire-and-forget Mapbox map load tracking.
 * Called when a Mapbox map instance fires its 'load' event.
 */
export function trackMapboxLoad(sessionToken?: string): void {
  try {
    fetch('/api/parallax/metrics/mapbox-load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token: sessionToken ?? null }),
      keepalive: true,
    }).catch(() => {
      // Silent failure
    });
  } catch {
    // Silent failure
  }
}

/**
 * Check whether the Mapbox map is allowed (under monthly load limit).
 * Returns { allowed, count, limit, cycleStart } or null on failure.
 */
export async function checkMapboxStatus(): Promise<{
  allowed: boolean;
  count: number;
  limit: number;
  cycleStart: string;
} | null> {
  try {
    const res = await fetch('/api/parallax/metrics/mapbox-status');
    if (!res.ok) return null;
    const payload = await res.json();
    return payload.data ?? null;
  } catch {
    // On error, allow the map (fail open)
    return null;
  }
}
