'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
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
import { Label } from '@/app/parallax/components/shadcn/label';
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

interface SettingsData {
  settings: Record<string, string>;
  mapboxStatus: {
    count: number;
    limit: number;
    allowed: boolean;
    cycleStart: string;
  };
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
/*  Settings Tab                                                       */
/* ------------------------------------------------------------------ */

function SettingsPanel({ data, onRefresh }: { data: SettingsData | null; onRefresh: () => void }) {
  const [billingDay, setBillingDay] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [currentCount, setCurrentCount] = useState('');
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (data && !initialized.current) {
      setBillingDay(data.settings.mapbox_billing_cycle_day ?? '1');
      setMonthlyLimit(data.settings.mapbox_monthly_limit ?? '40000');
      setCurrentCount(String(data.mapboxStatus.count));
      initialized.current = true;
    }
  }, [data]);

  if (!data) {
    return <p className="text-cc-text-muted text-sm">Loading...</p>;
  }

  const { mapboxStatus } = data;
  const pct = mapboxStatus.limit > 0 ? Math.min(100, Math.round((mapboxStatus.count / mapboxStatus.limit) * 100)) : 100;

  async function saveSettings() {
    setSaving(true);
    setMessage(null);
    try {
      const updates: Record<string, string> = {
        mapbox_billing_cycle_day: billingDay,
        mapbox_monthly_limit: monthlyLimit,
      };

      // If the user changed the current count, compute the new offset
      const desiredCount = parseInt(currentCount, 10);
      if (Number.isFinite(desiredCount) && desiredCount !== mapboxStatus.count) {
        const currentOffset = parseInt(data!.settings.mapbox_count_offset ?? '0', 10) || 0;
        // actual db count = mapboxStatus.count - currentOffset
        const dbCount = mapboxStatus.count - currentOffset;
        const newOffset = desiredCount - dbCount;
        updates.mapbox_count_offset = String(newOffset);
      }

      const res = await fetch('/api/parallax/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setMessage(d?.error?.message ?? 'Save failed.');
        return;
      }
      setMessage('Settings saved.');
      initialized.current = false;
      onRefresh();
    } catch {
      setMessage('Connection failed.');
    } finally {
      setSaving(false);
    }
  }

  async function resetCounter() {
    setResetting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/parallax/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mapbox_counter_reset_at: new Date().toISOString(),
          mapbox_count_offset: '0',
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setMessage(d?.error?.message ?? 'Reset failed.');
        return;
      }
      setMessage('Counter reset to 0.');
      initialized.current = false;
      onRefresh();
    } catch {
      setMessage('Connection failed.');
    } finally {
      setResetting(false);
    }
  }

  return (
    <div>
      <SectionCard title="Mapbox Usage">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <MetricCard label="Map Loads (cycle)" value={mapboxStatus.count.toLocaleString()} />
          <MetricCard label="Monthly Limit" value={mapboxStatus.limit.toLocaleString()} />
          <MetricCard label="Status" value={mapboxStatus.allowed ? 'Active' : 'Disabled'} />
          <MetricCard label="Cycle Start" value={formatDate(mapboxStatus.cycleStart)} />
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-cc-text-muted mb-1">
            <span>{pct}% used</span>
            <span>{mapboxStatus.count.toLocaleString()} / {mapboxStatus.limit.toLocaleString()}</span>
          </div>
          <div className="w-full h-2 bg-cc-surface-2 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                backgroundColor: pct >= 90 ? 'var(--color-cc-danger, #ef4444)' : pct >= 70 ? 'var(--color-cc-warning, #f59e0b)' : 'var(--color-cc-success, #22c55e)',
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <Label className="mb-1.5">Current Count</Label>
            <Input
              type="number"
              min={0}
              value={currentCount}
              onChange={(e) => setCurrentCount(e.target.value)}
            />
            <p className="text-xs text-cc-text-muted mt-1">Set to match your Mapbox dashboard count</p>
          </div>
          <div>
            <Label className="mb-1.5">Monthly Load Limit</Label>
            <Input
              type="number"
              min={0}
              value={monthlyLimit}
              onChange={(e) => setMonthlyLimit(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div>
            <Label className="mb-1.5">Billing Cycle Start Day (1-28)</Label>
            <Input
              type="number"
              min={1}
              max={28}
              value={billingDay}
              onChange={(e) => setBillingDay(e.target.value)}
            />
          </div>
          <div className="flex gap-2 items-end">
            <Button onClick={saveSettings} disabled={saving} size="sm">
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
            <Button onClick={resetCounter} disabled={resetting} variant="outline" size="sm">
              {resetting ? 'Resetting...' : 'Reset Counter'}
            </Button>
          </div>
        </div>
        {message && <p className="text-sm text-cc-text-secondary mt-2">{message}</p>}
      </SectionCard>
    </div>
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
  const [settingsData, setSettingsData] = useState<SettingsData | null>(null);

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
    } else if (activeTab === 'settings' && !settingsData) {
      adminFetch<SettingsData>('/api/parallax/admin/settings').then(setSettingsData).catch(() => {});
    }
  }, [authenticated, activeTab, overviewData, sessions, honeypotBlocks, settingsData]);

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
              } else if (activeTab === 'settings') {
                setSettingsData(null);
                adminFetch<SettingsData>('/api/parallax/admin/settings').then(setSettingsData).catch(() => {});
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
            <TabsTrigger value="settings">Settings</TabsTrigger>
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

          <TabsContent value="settings">
            <SettingsPanel
              data={settingsData}
              onRefresh={() => {
                setSettingsData(null);
                adminFetch<SettingsData>('/api/parallax/admin/settings').then(setSettingsData).catch(() => {});
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
