'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

import { Button } from '@/app/clearcut/components/shadcn/button';
import { Input } from '@/app/clearcut/components/shadcn/input';
import { Label } from '@/app/clearcut/components/shadcn/label';
import { ClearcutClientError, createSession } from '@/lib/clearcut/client';

const TOKEN_REGEX = /^[a-f0-9]{12}$/;

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
    <main className="max-w-[960px] mx-auto px-5 pt-16 pb-8">
      <header className="mb-5">
        <h1 className="text-3xl font-bold mb-1">RunCut</h1>
        <p className="text-cc-text-secondary">Run Cutting &amp; Optimization Tool</p>
      </header>

      <section className="border border-cc-border rounded-[10px] bg-cc-surface-1 p-4 mb-4">
        <h2 className="text-xl font-semibold mb-3">Create New Session</h2>
        <form onSubmit={onCreateSession}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Label htmlFor="session-name">Session Name</Label>
              <Input
                id="session-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="session-password">Password (Optional)</Label>
              <Input
                id="session-password"
                value={password}
                minLength={6}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimum 6 characters"
                type="password"
                className="mt-1"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2 items-center">
            <Button type="submit" disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Session'}
            </Button>
            <span className="text-cc-text-muted text-[13px]">
              You will be redirected to your edit URL after creation.
            </span>
          </div>
        </form>
      </section>

      <section className="border border-cc-border rounded-[10px] bg-cc-surface-1 p-4 mb-4">
        <h2 className="text-xl font-semibold mb-3">Return to Session</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="sm:col-span-2">
            <Input
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value.trim())}
              placeholder="Enter 12-character edit token"
              spellCheck={false}
            />
          </div>
          <Button
            variant="outline"
            className="w-full"
            disabled={!tokenValid}
            onClick={() => router.push(`/clearcut/s/${tokenInput.trim()}`)}
            type="button"
          >
            Open Edit Session
          </Button>
        </div>
        {!tokenValid && tokenInput.length > 0 && (
          <p className="mt-2 text-cc-warning text-[13px]">
            Token must be a 12-character lowercase hex value.
          </p>
        )}
      </section>

      {message && <p className="text-cc-danger">{message}</p>}

      <div className="mt-4">
        <Link href="/">Back to Home</Link>
      </div>
    </main>
  );
}
