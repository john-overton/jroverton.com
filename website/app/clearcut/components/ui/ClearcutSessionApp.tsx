'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChangeEvent, DragEvent, FormEvent, ReactNode, useMemo, useState } from 'react';

import ImportMapperWizard from '@/app/clearcut/components/ui/ImportMapperWizard';
import { ClearcutClientError } from '@/lib/clearcut/client';
import { buildDemoTripsAndRoutes } from '@/lib/clearcut/demo-data';
import { computeClearcutMetrics } from '@/lib/clearcut/metrics';
import { useClearcutSession, type ClearcutMode } from '@/lib/clearcut/use-clearcut-session';

type TabKey = 'import' | 'demand' | 'performance' | 'map' | 'runs' | 'optimize' | 'deadhead';
type ImportViewMode = 'main' | 'wizard' | 'flat';
type TripDataColumnKey =
  | 'trip_id'
  | 'route_id'
  | 'pickup_time'
  | 'dropoff_time'
  | 'status'
  | 'passenger_type';
type RouteDataColumnKey =
  | 'route_id'
  | 'scheduled_start_time'
  | 'scheduled_end_time'
  | 'actual_start_time'
  | 'actual_end_time';

const TAB_ITEMS: Array<{ key: TabKey; label: string }> = [
  { key: 'import', label: 'Import' },
  { key: 'demand', label: 'Demand' },
  { key: 'performance', label: 'Performance' },
  { key: 'map', label: 'Trip Map' },
  { key: 'runs', label: 'Run Structure' },
  { key: 'optimize', label: 'Optimize' },
  { key: 'deadhead', label: 'Deadhead' },
];
const CLEARCUT_FONT_STACK =
  '"Inter", "SF Pro Text", "Segoe UI", "Helvetica Neue", Arial, system-ui, sans-serif';
const TRIP_DATA_PAGE_SIZE = 10;
const ROUTE_DATA_PAGE_SIZE = 10;

interface Props {
  token: string;
  mode: ClearcutMode;
}

function MetricCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="col-md-3 col-sm-6 mb-3">
      <div style={{ border: '1px solid #dee5f0', borderRadius: 10, padding: '0.75rem', background: '#fff' }}>
        <div style={{ color: '#6b7280', fontSize: 13 }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: color ?? '#1f2937' }}>{value}</div>
        {sub && <div style={{ color: '#6b7280', fontSize: 12 }}>{sub}</div>}
      </div>
    </div>
  );
}

function MiniBars({ values, max }: { values: number[]; max?: number }) {
  const resolvedMax = max ?? Math.max(...values, 1);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${values.length}, 1fr)`, gap: 3, height: 88 }}>
      {values.map((value, index) => {
        const height = Math.max(4, (value / resolvedMax) * 100);
        return (
          <div key={`bar-${index}`} style={{ display: 'flex', alignItems: 'end' }}>
            <div
              title={String(Math.round(value * 100) / 100)}
              style={{ width: '100%', height: `${height}%`, background: '#4f46e5', borderRadius: 4 }}
            />
          </div>
        );
      })}
    </div>
  );
}

function HeatStrip({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${values.length}, 1fr)`, gap: 4 }}>
      {values.map((value, index) => {
        const ratio = value / max;
        const color =
          ratio >= 0.67 ? '#dc2626' : ratio >= 0.33 ? '#f59e0b' : ratio > 0 ? '#3b82f6' : '#e5e7eb';
        return <div key={`heat-${index}`} style={{ height: 18, borderRadius: 5, background: color }} />;
      })}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ border: '1px solid #dee5f0', borderRadius: 10, background: '#fff', padding: '0.9rem', marginBottom: '0.9rem' }}>
      <h3 style={{ fontSize: 17, marginBottom: '0.75rem' }}>{title}</h3>
      {children}
    </section>
  );
}

export default function ClearcutSessionApp({ token, mode }: Props) {
  const router = useRouter();
  const session = useClearcutSession(token, mode);
  const [tab, setTab] = useState<TabKey>('import');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mapBlockIdx, setMapBlockIdx] = useState(0);
  const [importViewMode, setImportViewMode] = useState<ImportViewMode>('main');
  const [wizardKey, setWizardKey] = useState(0);
  const [tripPage, setTripPage] = useState(1);
  const [routePage, setRoutePage] = useState(1);
  const [tripVisibleColumns, setTripVisibleColumns] = useState<Record<TripDataColumnKey, boolean>>({
    trip_id: true,
    route_id: true,
    pickup_time: true,
    dropoff_time: true,
    status: true,
    passenger_type: true,
  });
  const [routeVisibleColumns, setRouteVisibleColumns] = useState<Record<RouteDataColumnKey, boolean>>({
    route_id: true,
    scheduled_start_time: true,
    scheduled_end_time: true,
    actual_start_time: true,
    actual_end_time: true,
  });

  const readonlyView = mode === 'readonly';

  const ready = session.loadState.status === 'ready' ? session.loadState : null;
  const metrics = useMemo(
    () => (ready ? computeClearcutMetrics(ready.state) : null),
    [ready],
  );
  const tripColumns = useMemo(
    () =>
      [
        { key: 'trip_id', label: 'Trip', getValue: (trip: (typeof ready.state.trips)[number]) => trip.trip_id },
        { key: 'route_id', label: 'Route', getValue: (trip: (typeof ready.state.trips)[number]) => trip.route_id },
        {
          key: 'pickup_time',
          label: 'Pickup',
          getValue: (trip: (typeof ready.state.trips)[number]) =>
            trip.pickup_arrive_time ?? trip.scheduled_pickup_time,
        },
        {
          key: 'dropoff_time',
          label: 'Dropoff',
          getValue: (trip: (typeof ready.state.trips)[number]) =>
            trip.dropoff_leave_time ?? trip.scheduled_appointment_time,
        },
        { key: 'status', label: 'Status', getValue: (trip: (typeof ready.state.trips)[number]) => trip.status },
        {
          key: 'passenger_type',
          label: 'Passenger Type',
          getValue: (trip: (typeof ready.state.trips)[number]) => trip.passenger_type,
        },
      ] satisfies Array<{
        key: TripDataColumnKey;
        label: string;
        getValue: (trip: (typeof ready.state.trips)[number]) => string | null;
      }>,
    [ready],
  );
  const routeColumns = useMemo(
    () =>
      [
        {
          key: 'route_id',
          label: 'Route',
          getValue: (route: (typeof ready.state.routes)[number]) => route.route_id,
        },
        {
          key: 'scheduled_start_time',
          label: 'Scheduled Start',
          getValue: (route: (typeof ready.state.routes)[number]) => route.scheduled_start_time,
        },
        {
          key: 'scheduled_end_time',
          label: 'Scheduled End',
          getValue: (route: (typeof ready.state.routes)[number]) => route.scheduled_end_time,
        },
        {
          key: 'actual_start_time',
          label: 'Actual Start',
          getValue: (route: (typeof ready.state.routes)[number]) => route.actual_start_time ?? '-',
        },
        {
          key: 'actual_end_time',
          label: 'Actual End',
          getValue: (route: (typeof ready.state.routes)[number]) => route.actual_end_time ?? '-',
        },
      ] satisfies Array<{
        key: RouteDataColumnKey;
        label: string;
        getValue: (route: (typeof ready.state.routes)[number]) => string | null;
      }>,
    [ready],
  );
  const activeTripColumns = tripColumns.filter((column) => tripVisibleColumns[column.key]);
  const activeRouteColumns = routeColumns.filter((column) => routeVisibleColumns[column.key]);
  const tripCount = ready?.state.trips.length ?? 0;
  const routeCount = ready?.state.routes.length ?? 0;
  const tripTotalPages = Math.max(1, Math.ceil(tripCount / TRIP_DATA_PAGE_SIZE));
  const routeTotalPages = Math.max(1, Math.ceil(routeCount / ROUTE_DATA_PAGE_SIZE));
  const currentTripPage = Math.min(tripPage, tripTotalPages);
  const currentRoutePage = Math.min(routePage, routeTotalPages);
  const tripRows = ready?.state.trips ?? [];
  const routeRows = ready?.state.routes ?? [];
  const tripPageRows = tripRows.slice(
    (currentTripPage - 1) * TRIP_DATA_PAGE_SIZE,
    currentTripPage * TRIP_DATA_PAGE_SIZE,
  );
  const routePageRows = routeRows.slice(
    (currentRoutePage - 1) * ROUTE_DATA_PAGE_SIZE,
    currentRoutePage * ROUTE_DATA_PAGE_SIZE,
  );
  const hasData = ready ? ready.state.session.trip_count > 0 || ready.state.session.route_count > 0 : false;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  async function onUpload(type: 'trips' | 'routes', file: File) {
    if (readonlyView) {
      return;
    }
    setStatus(`Uploading ${type}...`);
    setError(null);
    try {
      if (type === 'trips') {
        await session.uploadTrips(file);
      } else {
        await session.uploadRoutes(file);
      }
      setStatus(`${type === 'trips' ? 'Trips' : 'Routes'} imported.`);
    } catch (uploadError) {
      setStatus(null);
      setError(uploadError instanceof Error ? uploadError.message : 'Import failed.');
    }
  }

  async function onLoadDemo() {
    if (readonlyView || !ready) {
      return;
    }
    setStatus('Loading demo dataset...');
    setError(null);
    try {
      const payload = buildDemoTripsAndRoutes();
      await session.saveState({ trips: payload.trips, routes: payload.routes });
      setStatus('Demo dataset loaded.');
    } catch (demoError) {
      setStatus(null);
      setError(demoError instanceof Error ? demoError.message : 'Failed to load demo data.');
    }
  }

  function downloadSampleCsv(kind: 'trips' | 'routes') {
    const tripSample = [
      'trip_id,scheduled_pickup_time,scheduled_appointment_time,pickup_arrive_time,pickup_leave_time,dropoff_arrive_time,dropoff_leave_time,route_id,pickup_address,pickup_lat,pickup_lon,dropoff_address,dropoff_lat,dropoff_lon,status,passenger_type,passenger_count,pick_odometer,drop_odometer',
      'TRIP-001,2026-02-01 08:00:00,2026-02-01 08:30:00,2026-02-01 07:58:00,2026-02-01 08:02:00,2026-02-01 08:27:00,2026-02-01 08:31:00,ROUTE-001,123 Main St,,,456 Oak St,,,completed,ambulatory,1,1000,1010',
    ].join('\n');
    const routeSample = [
      'route_id,scheduled_start_time,scheduled_end_time,actual_start_time,actual_end_time',
      'ROUTE-001,2026-02-01 07:30:00,2026-02-01 17:00:00,2026-02-01 07:35:00,2026-02-01 16:55:00',
    ].join('\n');

    const content = kind === 'trips' ? tripSample : routeSample;
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = kind === 'trips' ? 'clearcut-flat-trip-sample.csv' : 'clearcut-flat-route-sample.csv';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  async function onSave() {
    if (!ready || readonlyView) {
      return;
    }
    setSaving(true);
    setError(null);
    setStatus('Saving session...');
    try {
      await session.saveState({
        settings: ready.state.settings,
        optimization: ready.state.optimization,
      });
      setStatus('Session saved.');
    } catch (saveError) {
      setStatus(null);
      setError(saveError instanceof Error ? saveError.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function onRename() {
    if (readonlyView || !ready) {
      return;
    }
    const nextName = window.prompt('Rename session', ready.state.session.name)?.trim();
    if (!nextName) {
      return;
    }
    try {
      await session.rename(nextName);
      setStatus('Session renamed.');
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : 'Rename failed.');
    }
  }

  async function onClone() {
    if (readonlyView) {
      return;
    }
    try {
      const clone = await session.clone();
      router.push(`/clearcut/s/${clone.session.edit_token}`);
    } catch (cloneError) {
      setError(cloneError instanceof Error ? cloneError.message : 'Clone failed.');
    }
  }

  async function onDelete() {
    if (readonlyView) {
      return;
    }
    const confirmed = window.confirm('Delete this session permanently?');
    if (!confirmed) {
      return;
    }
    try {
      await session.remove();
      router.push('/clearcut');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Delete failed.');
    }
  }

  async function onSetPassword() {
    if (readonlyView) {
      return;
    }
    const newPassword = window.prompt('Set a new password (minimum 6 characters)')?.trim();
    if (!newPassword) {
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    const currentPassword = window.prompt('Enter current password if one exists (leave empty if none).');
    try {
      await session.setPassword(newPassword, currentPassword || undefined);
      setStatus('Password updated.');
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : 'Password update failed.');
    }
  }

  async function onRemovePassword() {
    if (readonlyView) {
      return;
    }
    const currentPassword = window.prompt('Enter current password to remove protection.');
    try {
      await session.removePassword(currentPassword || undefined);
      setStatus('Password protection removed.');
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : 'Could not remove password.');
    }
  }

  async function onUnlock(password: string) {
    setStatus('Unlocking session...');
    setError(null);
    try {
      await session.unlock(password);
      setStatus('Session unlocked.');
    } catch (unlockError) {
      if (unlockError instanceof ClearcutClientError && unlockError.status === 429) {
        const wait = unlockError.retryAfterSeconds ?? 60;
        setError(`Too many attempts. Try again in ${wait} seconds.`);
        return;
      }
      setError(unlockError instanceof Error ? unlockError.message : 'Unlock failed.');
    }
  }

  function onOptimizationChange(
    key:
      | 'target_productivity'
      | 'min_otp_target'
      | 'max_driver_spread_hrs'
      | 'peak_vehicles'
      | 'run_structure_json',
    value: number | string | null,
  ) {
    if (!ready || readonlyView) {
      return;
    }
    const current = ready.state.optimization;
    const next = { ...current, [key]: value };
    session.saveState({ optimization: next }).catch((saveError) => {
      setError(saveError instanceof Error ? saveError.message : 'Failed to persist optimization setting.');
    });
  }

  if (session.loadState.status === 'loading') {
    return (
      <main
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '4rem 1.25rem 2rem',
          fontFamily: CLEARCUT_FONT_STACK,
        }}
      >
        <p>Loading session...</p>
      </main>
    );
  }

  if (session.loadState.status === 'not_found') {
    return (
      <main
        style={{
          maxWidth: 900,
          margin: '0 auto',
          padding: '4rem 1.25rem 2rem',
          fontFamily: CLEARCUT_FONT_STACK,
        }}
      >
        <h1>Session Not Found</h1>
        <p style={{ color: '#4b5563' }}>
          The session token is invalid or no longer exists.
        </p>
        <Link href="/clearcut">Create a new session</Link>
      </main>
    );
  }

  if (session.loadState.status === 'password_required') {
    return (
      <main
        style={{
          maxWidth: 560,
          margin: '0 auto',
          padding: '4rem 1.25rem 2rem',
          fontFamily: CLEARCUT_FONT_STACK,
        }}
      >
        <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>{session.loadState.name}</h1>
        <p style={{ color: '#4b5563', marginBottom: '1rem' }}>This edit session is password protected.</p>
        <PasswordPrompt onSubmit={onUnlock} />
        {session.loadState.retryAfterSeconds && (
          <p style={{ color: '#b45309', marginTop: '0.75rem' }}>
            Try again in {session.loadState.retryAfterSeconds} seconds.
          </p>
        )}
        {error && <p style={{ color: '#b91c1c', marginTop: '0.75rem' }}>{error}</p>}
      </main>
    );
  }

  if (session.loadState.status === 'error') {
    return (
      <main
        style={{
          maxWidth: 900,
          margin: '0 auto',
          padding: '4rem 1.25rem 2rem',
          fontFamily: CLEARCUT_FONT_STACK,
        }}
      >
        <h1>Unable to load session</h1>
        <p style={{ color: '#b91c1c' }}>{session.loadState.message}</p>
        <button className="btn btn-outline-secondary" onClick={() => session.loadSession()} type="button">
          Retry
        </button>
      </main>
    );
  }

  if (!ready || !metrics) {
    return null;
  }

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '3rem 1.25rem 2rem',
        fontFamily: CLEARCUT_FONT_STACK,
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'start' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.35rem' }}>{ready.state.session.name}</h1>
          <div style={{ color: '#4b5563', fontSize: 14 }}>
            Run Cutting &amp; Optimization Tool {readonlyView ? '• Read-only Mode' : ''}
          </div>
          <div style={{ color: '#4b5563', fontSize: 13, marginTop: 6 }}>
            Data loaded: {ready.state.session.trip_count} trips, {ready.state.session.route_count} routes
          </div>
          {!readonlyView && origin && (
            <div style={{ marginTop: 8, fontSize: 13 }}>
              Share link: <code>{`${origin}/clearcut/r/${ready.state.session.readonly_token}`}</code>{' '}
              <button
                className="btn btn-sm btn-outline-secondary"
                style={{ marginLeft: 8 }}
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(`${origin}/clearcut/r/${ready.state.session.readonly_token}`);
                  setStatus('Read-only link copied.');
                }}
              >
                Copy
              </button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'end' }}>
          {!readonlyView && (
            <>
              <button className="btn btn-outline-secondary" onClick={onRename} type="button">
                Rename
              </button>
              <button className="btn btn-outline-secondary" onClick={onSetPassword} type="button">
                Set Password
              </button>
              <button className="btn btn-outline-secondary" onClick={onRemovePassword} type="button">
                Remove Password
              </button>
              <button className="btn btn-outline-secondary" onClick={onClone} type="button">
                Save As New
              </button>
              <button className="btn btn-outline-danger" onClick={onDelete} type="button">
                Delete
              </button>
            </>
          )}
          <button className="btn btn-primary" disabled={readonlyView || saving} onClick={onSave} type="button">
            {saving ? 'Saving...' : 'Save Run Cut'}
          </button>
        </div>
      </header>

      <div style={{ marginTop: '0.9rem', marginBottom: '0.5rem' }}>
        <ul className="nav nav-tabs">
          {TAB_ITEMS.map((item) => {
            const disabled = item.key !== 'import' && !hasData;
            return (
              <li className="nav-item" key={item.key}>
                <button
                  type="button"
                  className={`nav-link ${tab === item.key ? 'active' : ''}`}
                  disabled={disabled}
                  onClick={() => setTab(item.key)}
                >
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {status && <p style={{ color: '#065f46', marginBottom: '0.5rem' }}>{status}</p>}
      {error && <p style={{ color: '#b91c1c', marginBottom: '0.5rem' }}>{error}</p>}

      {tab === 'import' && (
        <>
          <SectionCard title="Data Import">
            {importViewMode === 'main' && (
              <div className="row g-3">
                <div className="col-md-6">
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '0.9rem' }}>
                    <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
                      Event-based import with templates and field mapping.
                    </div>
                    <button
                      className="btn btn-outline-primary w-100"
                      type="button"
                      onClick={() => setImportViewMode('wizard')}
                    >
                      Trip Import Wizard
                    </button>
                  </div>
                </div>
                <div className="col-md-6">
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '0.9rem' }}>
                    <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
                      Direct trip/route file upload with CSV samples.
                    </div>
                    <button
                      className="btn btn-outline-secondary w-100"
                      type="button"
                      onClick={() => setImportViewMode('flat')}
                    >
                      Flat File Import
                    </button>
                  </div>
                </div>
              </div>
            )}

            {importViewMode === 'wizard' && (
              <div className="mt-2">
                <button
                  className="btn btn-sm btn-outline-secondary mb-3"
                  type="button"
                  onClick={() => {
                    setImportViewMode('main');
                    setWizardKey((prev) => prev + 1);
                    setStatus(null);
                    setError(null);
                  }}
                >
                  Back to Import Options
                </button>
                <ImportMapperWizard
                  key={`import-wizard-${wizardKey}`}
                  readonlyView={readonlyView}
                  onPreview={session.previewImport}
                  onValidate={session.validateImport}
                  onApply={session.applyImport}
                  onListTemplates={session.listTemplates}
                  onCreateTemplate={session.createTemplate}
                  onDeleteTemplate={session.deleteTemplate}
                />
              </div>
            )}

            {importViewMode === 'flat' && (
              <div className="mt-2">
                <button
                  className="btn btn-sm btn-outline-secondary mb-3"
                  type="button"
                  onClick={() => {
                    setImportViewMode('main');
                    setStatus(null);
                    setError(null);
                  }}
                >
                  Back to Import Options
                </button>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <div className="d-flex gap-2 mb-2">
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        type="button"
                        onClick={() => downloadSampleCsv('trips')}
                      >
                        Download Trip Sample CSV
                      </button>
                    </div>
                    <UploadCard
                      label="Flat Trip Import (CSV/XLSX)"
                      disabled={readonlyView}
                      onUpload={(file) => onUpload('trips', file)}
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <div className="d-flex gap-2 mb-2">
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        type="button"
                        onClick={() => downloadSampleCsv('routes')}
                      >
                        Download Route Sample CSV
                      </button>
                    </div>
                    <UploadCard
                      label="Flat Route Import (CSV/XLSX)"
                      disabled={readonlyView}
                      onUpload={(file) => onUpload('routes', file)}
                    />
                  </div>
                </div>
              </div>
            )}
            {!readonlyView && (
              <button className="btn btn-outline-primary mt-3" onClick={onLoadDemo} type="button">
                Load Demo Dataset
              </button>
            )}
          </SectionCard>

          <SectionCard title="System Settings">
            <div className="row g-3">
              <div className="col-md-4">
                <div style={{ fontSize: 13, color: '#6b7280' }}>Derived Service Start</div>
                <div style={{ fontWeight: 600 }}>{metrics.derivedServiceWindow.startLabel}</div>
              </div>
              <div className="col-md-4">
                <div style={{ fontSize: 13, color: '#6b7280' }}>Derived Service End</div>
                <div style={{ fontWeight: 600 }}>{metrics.derivedServiceWindow.endLabel}</div>
              </div>
              <div className="col-md-4">
                <div style={{ fontSize: 13, color: '#6b7280' }}>Service Hours</div>
                <div style={{ fontWeight: 600 }}>
                  {metrics.derivedServiceWindow.isTwentyFourHours
                    ? '24:00'
                    : metrics.derivedServiceWindow.durationLabel}
                </div>
              </div>
              <div className="col-md-6">
                <div style={{ fontSize: 13, color: '#6b7280' }}>Earliest Data Time</div>
                <div style={{ fontWeight: 600 }}>
                  {metrics.derivedServiceWindow.earliestDataTime ?? 'No trip data'}
                </div>
              </div>
              <div className="col-md-6">
                <div style={{ fontSize: 13, color: '#6b7280' }}>Latest Data Time</div>
                <div style={{ fontWeight: 600 }}>
                  {metrics.derivedServiceWindow.latestDataTime ?? 'No trip data'}
                </div>
              </div>
              <div className="col-12">
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  Service window is auto-derived from imported data (actual times preferred, fallback to scheduled), with a 1-hour buffer before first pickup and after last dropoff.
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Data Views">
            <details style={{ marginBottom: 12 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                Trips ({ready.state.trips.length})
              </summary>
              <div style={{ overflowX: 'auto', marginTop: 8 }}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Columns</div>
                  <div className="d-flex flex-wrap gap-3">
                    {tripColumns.map((column) => (
                      <label key={`trip-col-toggle-${column.key}`} className="form-check-label" style={{ fontSize: 13 }}>
                        <input
                          type="checkbox"
                          className="form-check-input me-1"
                          checked={tripVisibleColumns[column.key]}
                          onChange={(event) =>
                            setTripVisibleColumns((prev) => ({
                              ...prev,
                              [column.key]: event.target.checked,
                            }))
                          }
                        />
                        {column.label}
                      </label>
                    ))}
                  </div>
                </div>
                <table className="table table-sm">
                  <thead>
                    <tr>
                      {activeTripColumns.map((column) => (
                        <th key={`trip-col-head-${column.key}`}>{column.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tripPageRows.map((trip) => (
                      <tr key={`trip-view-${trip.trip_id}-${trip.route_id}`}>
                        {activeTripColumns.map((column) => (
                          <td key={`trip-row-${trip.trip_id}-${column.key}`}>
                            {column.getValue(trip) ?? '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {ready.state.trips.length === 0 && (
                      <tr>
                        <td colSpan={Math.max(activeTripColumns.length, 1)} style={{ color: '#6b7280' }}>
                          No trips available.
                        </td>
                      </tr>
                    )}
                    {ready.state.trips.length > 0 && activeTripColumns.length === 0 && (
                      <tr>
                        <td style={{ color: '#6b7280' }}>Select at least one column.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {ready.state.trips.length > 0 && (
                  <div className="d-flex align-items-center justify-content-between">
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      type="button"
                      disabled={currentTripPage <= 1}
                      onClick={() => setTripPage((prev) => Math.max(1, prev - 1))}
                    >
                      Previous
                    </button>
                    <div style={{ fontSize: 13 }}>
                      Page {currentTripPage} of {tripTotalPages}
                    </div>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      type="button"
                      disabled={currentTripPage >= tripTotalPages}
                      onClick={() => setTripPage((prev) => Math.min(tripTotalPages, prev + 1))}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </details>

            <details>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                Routes ({ready.state.routes.length})
              </summary>
              <div style={{ overflowX: 'auto', marginTop: 8 }}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Columns</div>
                  <div className="d-flex flex-wrap gap-3">
                    {routeColumns.map((column) => (
                      <label key={`route-col-toggle-${column.key}`} className="form-check-label" style={{ fontSize: 13 }}>
                        <input
                          type="checkbox"
                          className="form-check-input me-1"
                          checked={routeVisibleColumns[column.key]}
                          onChange={(event) =>
                            setRouteVisibleColumns((prev) => ({
                              ...prev,
                              [column.key]: event.target.checked,
                            }))
                          }
                        />
                        {column.label}
                      </label>
                    ))}
                  </div>
                </div>
                <table className="table table-sm">
                  <thead>
                    <tr>
                      {activeRouteColumns.map((column) => (
                        <th key={`route-col-head-${column.key}`}>{column.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {routePageRows.map((route) => (
                      <tr key={`route-view-${route.route_id}`}>
                        {activeRouteColumns.map((column) => (
                          <td key={`route-row-${route.route_id}-${column.key}`}>
                            {column.getValue(route) ?? '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {ready.state.routes.length === 0 && (
                      <tr>
                        <td colSpan={Math.max(activeRouteColumns.length, 1)} style={{ color: '#6b7280' }}>
                          No routes available.
                        </td>
                      </tr>
                    )}
                    {ready.state.routes.length > 0 && activeRouteColumns.length === 0 && (
                      <tr>
                        <td style={{ color: '#6b7280' }}>Select at least one column.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {ready.state.routes.length > 0 && (
                  <div className="d-flex align-items-center justify-content-between">
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      type="button"
                      disabled={currentRoutePage <= 1}
                      onClick={() => setRoutePage((prev) => Math.max(1, prev - 1))}
                    >
                      Previous
                    </button>
                    <div style={{ fontSize: 13 }}>
                      Page {currentRoutePage} of {routeTotalPages}
                    </div>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      type="button"
                      disabled={currentRoutePage >= routeTotalPages}
                      onClick={() => setRoutePage((prev) => Math.min(routeTotalPages, prev + 1))}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </details>
          </SectionCard>
        </>
      )}

      {tab === 'demand' && (
        <>
          <div className="row">
            <MetricCard label="Peak Pickups" value={`${metrics.peakPickups}`} />
            <MetricCard label="Peak On-Board" value={`${metrics.peakOnBoard}`} />
            <MetricCard label="Peak Vehicles" value={`${metrics.peakVehicles}`} />
            <MetricCard label="Total Trips" value={`${metrics.totalTrips}`} />
          </div>
          <SectionCard title="Demand by Time Block">
            <MiniBars values={metrics.pickupsByBlock} />
          </SectionCard>
          <SectionCard title="Deadhead Intensity">
            <HeatStrip values={metrics.deadheadByBlock} />
          </SectionCard>
        </>
      )}

      {tab === 'performance' && (
        <>
          <div className="row">
            <MetricCard label="Average OTP" value={`${metrics.avgOtp}%`} />
            <MetricCard label="Blocks Below Target" value={`${metrics.blocksBelowOtp}`} />
            <MetricCard label="Average Productivity" value={`${metrics.avgProductivity}`} />
            <MetricCard label="Peak Productivity" value={`${metrics.peakProductivity}`} />
          </div>
          <SectionCard title="On-Time Performance (by block)">
            <MiniBars values={metrics.otpByBlock} max={100} />
          </SectionCard>
          <SectionCard title="Productivity (trips/vehicle)">
            <MiniBars values={metrics.productivityByBlock} />
          </SectionCard>
        </>
      )}

      {tab === 'map' && (
        <>
          <SectionCard title="Trip Heatmap">
            <div style={{ marginBottom: 10 }}>
              <label className="form-label">
                Time Block ({metrics.blocks[mapBlockIdx]?.label ?? 'N/A'})
              </label>
              <input
                className="form-range"
                type="range"
                min={0}
                max={Math.max(0, metrics.blocks.length - 1)}
                value={mapBlockIdx}
                onChange={(event) => setMapBlockIdx(Number(event.target.value))}
              />
            </div>
            <HeatStrip values={metrics.pickupsByBlock.map((value, idx) => (idx === mapBlockIdx ? value : value * 0.4))} />
          </SectionCard>
        </>
      )}

      {tab === 'runs' && (
        <>
          <div className="row">
            <MetricCard label="Current Runs" value={`${metrics.currentRuns}`} />
            <MetricCard label="Optimized Runs" value={`${metrics.optimizedRuns}`} />
            <MetricCard label="Imported Service Hours" value={`${metrics.importedServiceHours}`} />
            <MetricCard label="Optimized Service Hours" value={`${metrics.optimizedServiceHours}`} />
          </div>
          <SectionCard title="Current vs Optimized Vehicle Load">
            <div className="row">
              <div className="col-md-6 mb-3">
                <h4 style={{ fontSize: 15 }}>Current</h4>
                <MiniBars values={metrics.vehiclesByBlock} />
              </div>
              <div className="col-md-6 mb-3">
                <h4 style={{ fontSize: 15 }}>Optimized</h4>
                <MiniBars values={metrics.vehiclesByBlock.map((value) => Math.max(0, value - 1))} />
              </div>
            </div>
          </SectionCard>
        </>
      )}

      {tab === 'optimize' && (
        <>
          <SectionCard title="Optimization Parameters">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">
                  Target Productivity ({ready.state.optimization.target_productivity ?? 2.0})
                </label>
                <input
                  className="form-range"
                  disabled={readonlyView}
                  type="range"
                  min={1.0}
                  max={3.5}
                  step={0.1}
                  value={ready.state.optimization.target_productivity ?? 2.0}
                  onChange={(event) =>
                    onOptimizationChange('target_productivity', Number(event.target.value))
                  }
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">
                  Min OTP Target ({ready.state.optimization.min_otp_target ?? 85}%)
                </label>
                <input
                  className="form-range"
                  disabled={readonlyView}
                  type="range"
                  min={75}
                  max={98}
                  step={1}
                  value={ready.state.optimization.min_otp_target ?? 85}
                  onChange={(event) =>
                    onOptimizationChange('min_otp_target', Number(event.target.value))
                  }
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">
                  Max Driver Spread ({ready.state.optimization.max_driver_spread_hrs ?? 12} hrs)
                </label>
                <input
                  className="form-range"
                  disabled={readonlyView}
                  type="range"
                  min={8}
                  max={14}
                  step={0.5}
                  value={ready.state.optimization.max_driver_spread_hrs ?? 12}
                  onChange={(event) =>
                    onOptimizationChange('max_driver_spread_hrs', Number(event.target.value))
                  }
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">
                  Peak Vehicles ({ready.state.optimization.peak_vehicles ?? metrics.peakVehicles})
                </label>
                <input
                  className="form-range"
                  disabled={readonlyView}
                  type="range"
                  min={12}
                  max={36}
                  step={1}
                  value={ready.state.optimization.peak_vehicles ?? metrics.peakVehicles}
                  onChange={(event) =>
                    onOptimizationChange('peak_vehicles', Number(event.target.value))
                  }
                />
              </div>
            </div>
          </SectionCard>
          <div className="row">
            <MetricCard label="Est. Service Hours" value={`${metrics.optimizedServiceHours}`} />
            <MetricCard label="Est. OTP" value={`${Math.max(metrics.avgOtp, 85)}%`} />
            <MetricCard label="Est. Deadhead" value={`${Math.max(3, metrics.avgDeadheadStartMiles)}%`} />
            <MetricCard label="Est. Productivity" value={`${Math.max(1.2, metrics.avgProductivity)}`} />
          </div>
        </>
      )}

      {tab === 'deadhead' && (
        <>
          <div className="row">
            <MetricCard label="Avg Trip Miles" value={`${metrics.avgTripMiles}`} />
            <MetricCard label="Avg DH Miles (Start)" value={`${metrics.avgDeadheadStartMiles}`} />
            <MetricCard label="Avg DH Miles (End)" value={`${metrics.avgDeadheadEndMiles}`} />
            <MetricCard label="Total Trips" value={`${metrics.totalTrips}`} />
          </div>
          <SectionCard title="Deadhead Ratio by Block">
            <HeatStrip values={metrics.deadheadByBlock} />
          </SectionCard>
          <SectionCard title="High Deadhead Trips">
            <div className="row">
              <div className="col-md-6">
                <TripTable title="Start of Service" trips={metrics.highDeadheadTripsStart} />
              </div>
              <div className="col-md-6">
                <TripTable title="End of Service" trips={metrics.highDeadheadTripsEnd} />
              </div>
            </div>
          </SectionCard>
        </>
      )}
    </main>
  );
}

function PasswordPrompt({ onSubmit }: { onSubmit: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(password);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="unlock-password" className="form-label">
        Password
      </label>
      <input
        id="unlock-password"
        type="password"
        className="form-control"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <button className="btn btn-primary mt-3" type="submit" disabled={!password || submitting}>
        {submitting ? 'Unlocking...' : 'Unlock'}
      </button>
    </form>
  );
}

function UploadCard({
  label,
  disabled,
  onUpload,
}: {
  label: string;
  disabled: boolean;
  onUpload: (file: File) => void;
}) {
  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      onUpload(file);
    }
    event.target.value = '';
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (disabled) {
      return;
    }
    const file = event.dataTransfer.files?.[0];
    if (file) {
      onUpload(file);
    }
  }

  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      style={{
        border: '1px dashed #94a3b8',
        borderRadius: 10,
        padding: '1rem',
        background: disabled ? '#f8fafc' : '#fff',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 8 }}>Drag and drop or browse a file.</div>
      <input
        type="file"
        className="form-control"
        accept=".csv,.xlsx,.xls"
        disabled={disabled}
        onChange={handleFileInput}
      />
    </div>
  );
}

function TripTable({ title, trips }: { title: string; trips: Array<{ trip_id: string; route_id: string }> }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem', marginBottom: '0.75rem' }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{title}</div>
      <table className="table table-sm mb-0">
        <thead>
          <tr>
            <th>Trip</th>
            <th>Route</th>
          </tr>
        </thead>
        <tbody>
          {trips.length === 0 && (
            <tr>
              <td colSpan={2} style={{ color: '#6b7280' }}>
                No trips available
              </td>
            </tr>
          )}
          {trips.map((trip) => (
            <tr key={trip.trip_id}>
              <td>{trip.trip_id}</td>
              <td>{trip.route_id}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
