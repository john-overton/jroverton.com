'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Badge } from '@/app/parallax/components/shadcn/badge';
import { Button } from '@/app/parallax/components/shadcn/button';
import { Input } from '@/app/parallax/components/shadcn/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/parallax/components/shadcn/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/app/parallax/components/shadcn/tabs';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface OverviewData {
  overview: {
    totalPageViews: number;
    uniqueVisitors: number;
    sessionsCreated: number;
    honeypotBlocks: number;
  };
  dailyViews: Array<{ date: string; views: number; visitors: number }>;
  topPages: Array<{ page: string; count: number }>;
  eventsByAction: Array<{ action: string; count: number }>;
  recentEvents: Array<{
    id: number;
    ip: string;
    method: string;
    path: string;
    action: string;
    session_token: string | null;
    status_code: number;
    created_at: string;
  }>;
}

interface SessionItem {
  edit_token: string;
  readonly_token: string;
  name: string;
  has_password: boolean;
  created_at: string;
  updated_at: string;
  accessed_at: string;
  trip_count: number;
  route_count: number;
}

interface HoneypotBlock {
  id: number;
  ip: string;
  trigger_count: number;
  blocked_until: string;
  created_at: string;
  source: 'db' | 'memory';
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

async function adminFetch<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error?.message ?? `Request failed (${res.status})`);
  }
  const payload = await res.json();
  return payload.data;
}

/* ------------------------------------------------------------------ */
/*  Login Form                                                         */
/* ------------------------------------------------------------------ */

function AdminLoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch('/api/parallax/admin/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(data?.error?.message ?? 'Invalid password.');
          return;
        }
        onSuccess();
      } catch {
        setError('Connection failed.');
      } finally {
        setSubmitting(false);
      }
    },
    [password, onSuccess],
  );

  return (
    <div className="flex items-center justify-center min-h-screen bg-cc-bg">
      <div className="bg-cc-surface-1 border border-cc-border rounded-[10px] p-8 w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-1">Parallax Admin</h1>
        <p className="text-cc-text-muted text-sm mb-6">Enter the admin password to continue.</p>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            autoFocus
          />
          {error && <p className="text-sm text-cc-danger">{error}</p>}
          <Button type="submit" disabled={submitting || !password}>
            {submitting ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Metric Card                                                        */
/* ------------------------------------------------------------------ */

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-cc-surface-1 border border-cc-border rounded-[10px] p-3">
      <div className="text-cc-text-muted text-[13px]">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section Card                                                       */
/* ------------------------------------------------------------------ */

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-cc-border rounded-[10px] bg-cc-surface-1 p-4 mb-4">
      <h3 className="text-[17px] font-semibold mb-3">{title}</h3>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Overview Tab                                                       */
/* ------------------------------------------------------------------ */

function OverviewPanel({ data }: { data: OverviewData | null }) {
  if (!data) {
    return <p className="text-cc-text-muted text-sm">Loading...</p>;
  }

  const { overview, dailyViews, topPages, eventsByAction, recentEvents } = data;

  return (
    <div>
      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <MetricCard label="Page Views (30d)" value={overview.totalPageViews} />
        <MetricCard label="Unique Visitors (30d)" value={overview.uniqueVisitors} />
        <MetricCard label="Sessions Created (30d)" value={overview.sessionsCreated} />
        <MetricCard label="Honeypot Blocks (30d)" value={overview.honeypotBlocks} />
      </div>

      {/* Daily activity chart */}
      {dailyViews.length > 0 && (
        <SectionCard title="Daily Activity">
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={dailyViews}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-cc-border)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: 'var(--color-cc-text-muted)' }}
                  tickFormatter={(v: string) => {
                    const d = new Date(v + 'T00:00:00');
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-cc-text-muted)' }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="views" name="Page Views" fill="var(--color-cc-accent)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="visitors" name="Unique Visitors" fill="var(--color-cc-success, #22c55e)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      )}

      {/* Top pages + Events by action side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionCard title="Top Pages">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Page</TableHead>
                <TableHead className="text-right">Views</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topPages.map((p) => (
                <TableRow key={p.page}>
                  <TableCell className="font-mono text-sm">{p.page}</TableCell>
                  <TableCell className="text-right">{p.count}</TableCell>
                </TableRow>
              ))}
              {topPages.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-cc-text-muted text-center">No data yet</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </SectionCard>

        <SectionCard title="Events by Action">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead className="text-right">Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventsByAction.map((e) => (
                <TableRow key={e.action}>
                  <TableCell className="font-mono text-sm">{e.action}</TableCell>
                  <TableCell className="text-right">{e.count}</TableCell>
                </TableRow>
              ))}
              {eventsByAction.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-cc-text-muted text-center">No data yet</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </SectionCard>
      </div>

      {/* Recent events */}
      <SectionCard title="Recent Events">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentEvents.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-sm whitespace-nowrap">{formatDateTime(e.created_at)}</TableCell>
                  <TableCell className="font-mono text-sm">{e.action}</TableCell>
                  <TableCell className="text-sm">{e.method}</TableCell>
                  <TableCell className="font-mono text-sm">{e.ip}</TableCell>
                  <TableCell>
                    <Badge variant={e.status_code < 400 ? 'secondary' : 'destructive'}>
                      {e.status_code}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {recentEvents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-cc-text-muted text-center">No events yet</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sessions Tab                                                       */
/* ------------------------------------------------------------------ */

function SessionsPanel({ sessions }: { sessions: SessionItem[] | null }) {
  if (!sessions) {
    return <p className="text-cc-text-muted text-sm">Loading...</p>;
  }

  return (
    <SectionCard title={`All Sessions (${sessions.length})`}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Token</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last Accessed</TableHead>
              <TableHead className="text-right">Trips</TableHead>
              <TableHead className="text-right">Routes</TableHead>
              <TableHead>Password</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((s) => (
              <TableRow key={s.edit_token}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="font-mono text-sm">{s.edit_token.slice(0, 8)}...</TableCell>
                <TableCell className="text-sm whitespace-nowrap">{formatDate(s.created_at)}</TableCell>
                <TableCell className="text-sm whitespace-nowrap">{formatDate(s.accessed_at)}</TableCell>
                <TableCell className="text-right">{s.trip_count}</TableCell>
                <TableCell className="text-right">{s.route_count}</TableCell>
                <TableCell>
                  {s.has_password ? (
                    <Badge variant="default">Protected</Badge>
                  ) : (
                    <Badge variant="outline">None</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {sessions.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-cc-text-muted text-center">No sessions</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  Security Tab                                                       */
/* ------------------------------------------------------------------ */

function SecurityPanel({ blocks }: { blocks: HoneypotBlock[] | null }) {
  if (!blocks) {
    return <p className="text-cc-text-muted text-sm">Loading...</p>;
  }

  const now = new Date();

  return (
    <SectionCard title={`Blocked IPs (${blocks.length})`}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>IP Address</TableHead>
              <TableHead>Triggers</TableHead>
              <TableHead>Blocked Until</TableHead>
              <TableHead>Recorded</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {blocks.map((b, i) => {
              const isActive = new Date(b.blocked_until) > now;
              return (
                <TableRow key={`${b.ip}-${i}`}>
                  <TableCell className="font-mono text-sm">{b.ip}</TableCell>
                  <TableCell>{b.trigger_count}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{formatDateTime(b.blocked_until)}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{formatDateTime(b.created_at)}</TableCell>
                  <TableCell>
                    <Badge variant={isActive ? 'destructive' : 'outline'}>
                      {isActive ? 'Active' : 'Expired'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{b.source === 'memory' ? 'In-Memory' : 'Persisted'}</TableCell>
                </TableRow>
              );
            })}
            {blocks.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-cc-text-muted text-center">No blocked IPs</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function AdminPanelClient() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Data states
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [sessions, setSessions] = useState<SessionItem[] | null>(null);
  const [honeypotBlocks, setHoneypotBlocks] = useState<HoneypotBlock[] | null>(null);

  // Check if already authenticated on mount
  useEffect(() => {
    adminFetch('/api/parallax/admin/overview')
      .then((data) => {
        setOverviewData(data as OverviewData);
        setAuthenticated(true);
      })
      .catch(() => {
        // Not authenticated
      })
      .finally(() => setCheckingAuth(false));
  }, []);

  // Load data when tab changes
  useEffect(() => {
    if (!authenticated) return;

    if (activeTab === 'overview' && !overviewData) {
      adminFetch<OverviewData>('/api/parallax/admin/overview').then(setOverviewData).catch(() => {});
    } else if (activeTab === 'sessions' && !sessions) {
      adminFetch<{ sessions: SessionItem[] }>('/api/parallax/admin/sessions')
        .then((d) => setSessions(d.sessions))
        .catch(() => {});
    } else if (activeTab === 'security' && !honeypotBlocks) {
      adminFetch<{ blocks: HoneypotBlock[] }>('/api/parallax/admin/honeypot')
        .then((d) => setHoneypotBlocks(d.blocks))
        .catch(() => {});
    }
  }, [authenticated, activeTab, overviewData, sessions, honeypotBlocks]);

  const onLoginSuccess = useCallback(() => {
    setAuthenticated(true);
    // Load overview data after login
    adminFetch<OverviewData>('/api/parallax/admin/overview').then(setOverviewData).catch(() => {});
  }, []);

  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-cc-bg">
        <p className="text-cc-text-muted">Loading...</p>
      </div>
    );
  }

  if (!authenticated) {
    return <AdminLoginForm onSuccess={onLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-cc-bg">
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold">Parallax Admin</h1>
            <p className="text-cc-text-muted text-sm">Usage metrics and security overview</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Refresh current tab data
              if (activeTab === 'overview') {
                setOverviewData(null);
                adminFetch<OverviewData>('/api/parallax/admin/overview').then(setOverviewData).catch(() => {});
              } else if (activeTab === 'sessions') {
                setSessions(null);
                adminFetch<{ sessions: SessionItem[] }>('/api/parallax/admin/sessions')
                  .then((d) => setSessions(d.sessions))
                  .catch(() => {});
              } else if (activeTab === 'security') {
                setHoneypotBlocks(null);
                adminFetch<{ blocks: HoneypotBlock[] }>('/api/parallax/admin/honeypot')
                  .then((d) => setHoneypotBlocks(d.blocks))
                  .catch(() => {});
              }
            }}
          >
            Refresh
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList variant="line" className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewPanel data={overviewData} />
          </TabsContent>

          <TabsContent value="sessions">
            <SessionsPanel sessions={sessions} />
          </TabsContent>

          <TabsContent value="security">
            <SecurityPanel blocks={honeypotBlocks} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
