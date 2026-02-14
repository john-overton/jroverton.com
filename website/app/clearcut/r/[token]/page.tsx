'use client';

import { useEffect, useState } from 'react';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      sessionName: string;
      tripCount: number;
      routeCount: number;
      issuedJwt: boolean;
    };

export default function ClearCutReadonlySessionPage({ params }: { params: { token: string } }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/clearcut/sessions/${params.token}`);
        const payload = await res.json();
        if (!res.ok || !payload?.ok) {
          throw new Error(payload?.error?.message ?? 'Failed to load read-only session.');
        }

        if (!cancelled) {
          setState({
            status: 'ready',
            sessionName: payload.data.session.name,
            tripCount: payload.data.session.trip_count,
            routeCount: payload.data.session.route_count,
            issuedJwt: Boolean(payload.data.jwt),
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Failed to load read-only session.',
          });
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [params.token]);

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '5rem 1.25rem 2rem' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>ClearCut Read-Only Session</h1>
      <p style={{ color: '#666', marginBottom: '1rem' }}>
        URL mode: <code>/clearcut/r/{params.token}</code>
      </p>
      {state.status === 'loading' && <p>Loading session...</p>}
      {state.status === 'error' && <p style={{ color: '#b91c1c' }}>{state.message}</p>}
      {state.status === 'ready' && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
          <p>
            Session: <strong>{state.sessionName}</strong>
          </p>
          <p>
            Data: {state.tripCount} trips, {state.routeCount} routes
          </p>
          <p>JWT issued on load: {state.issuedJwt ? 'yes' : 'no'}</p>
          <p style={{ color: '#666' }}>Mutations should be blocked using readonly JWT access.</p>
        </div>
      )}
    </main>
  );
}
