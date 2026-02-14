import Link from 'next/link';

export default function ClearCutLandingPage() {
  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '5rem 1.25rem 2rem' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>ClearCut</h1>
      <p style={{ color: '#666', marginBottom: '1.5rem' }}>
        New run cut session entry point. Backend APIs are available and ready for UI integration.
      </p>

      <section
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: '1rem',
          background: '#fff',
        }}
      >
        <p style={{ marginBottom: '0.75rem' }}>
          To create a session, call <code>POST /api/clearcut/sessions</code> and navigate to the
          returned URLs:
        </p>
        <ul>
          <li>
            Edit URL: <code>/clearcut/s/&lt;edit_token&gt;</code>
          </li>
          <li>
            Read-only URL: <code>/clearcut/r/&lt;readonly_token&gt;</code>
          </li>
        </ul>
      </section>

      <div style={{ marginTop: '1rem' }}>
        <Link href="/">Back to Home</Link>
      </div>
    </main>
  );
}
