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
