'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

import { ClearcutClientError, createSession } from '@/lib/clearcut/client';

const TOKEN_REGEX = /^[a-f0-9]{12}$/;
const CLEARCUT_FONT_STACK =
  '"Inter", "SF Pro Text", "Segoe UI", "Helvetica Neue", Arial, system-ui, sans-serif';

export default function ClearcutLandingClient() {
  const router = useRouter();
  const [name, setName] = useState('Untitled Run Cut');
  const [password, setPassword] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const tokenValid = TOKEN_REGEX.test(tokenInput.trim());

  async function onCreateSession(event: FormEvent) {
    event.preventDefault();
    setIsCreating(true);
    setMessage(null);
    try {
      const created = await createSession({
        name: name.trim() || 'Untitled Run Cut',
        password: password.trim() || undefined,
      });
      router.push(`/clearcut/s/${created.session.edit_token}`);
    } catch (error) {
      if (error instanceof ClearcutClientError) {
        setMessage(error.message);
      } else {
        setMessage('Failed to create a ClearCut session.');
      }
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: '4rem 1.25rem 2rem',
        fontFamily: CLEARCUT_FONT_STACK,
      }}
    >
      <header style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>RunCut</h1>
        <p style={{ color: '#4b5563', marginBottom: 0 }}>Run Cutting &amp; Optimization Tool</p>
      </header>

      <section
        style={{
          border: '1px solid #dbe1ea',
          borderRadius: 10,
          background: '#fff',
          padding: '1rem',
          marginBottom: '1rem',
        }}
      >
        <h2 style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>Create New Session</h2>
        <form onSubmit={onCreateSession}>
          <div className="row g-3">
            <div className="col-md-8">
              <label className="form-label" htmlFor="session-name">
                Session Name
              </label>
              <input
                id="session-name"
                className="form-control"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label" htmlFor="session-password">
                Password (Optional)
              </label>
              <input
                id="session-password"
                className="form-control"
                value={password}
                minLength={6}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimum 6 characters"
                type="password"
              />
            </div>
          </div>
          <div style={{ marginTop: '0.9rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button className="btn btn-primary" type="submit" disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Session'}
            </button>
            <span style={{ color: '#6b7280', fontSize: 13 }}>
              You will be redirected to your edit URL after creation.
            </span>
          </div>
        </form>
      </section>

      <section
        style={{
          border: '1px solid #dbe1ea',
          borderRadius: 10,
          background: '#fff',
          padding: '1rem',
          marginBottom: '1rem',
        }}
      >
        <h2 style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>Return to Session</h2>
        <div className="row g-2">
          <div className="col-sm-8">
            <input
              className="form-control"
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value.trim())}
              placeholder="Enter 12-character edit token"
              spellCheck={false}
            />
          </div>
          <div className="col-sm-4">
            <button
              className="btn btn-outline-secondary w-100"
              disabled={!tokenValid}
              onClick={() => router.push(`/clearcut/s/${tokenInput.trim()}`)}
              type="button"
            >
              Open Edit Session
            </button>
          </div>
        </div>
        {!tokenValid && tokenInput.length > 0 && (
          <p style={{ marginTop: '0.5rem', color: '#b45309', fontSize: 13 }}>
            Token must be a 12-character lowercase hex value.
          </p>
        )}
      </section>

      {message && <p style={{ color: '#b91c1c' }}>{message}</p>}

      <div style={{ marginTop: '1rem' }}>
        <Link href="/">Back to Home</Link>
      </div>
    </main>
  );
}
