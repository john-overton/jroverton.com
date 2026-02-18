'use client';

import { useState } from 'react';

import ImportMapperWizard from '@/app/clearcut/components/ui/ImportMapperWizard';
import type { ImportResponse } from '@/lib/clearcut/client';
import type { ClearcutMetrics } from '@/lib/clearcut/metrics';
import type {
  ImportApplyResponse,
  ImportMappingConfig,
  ImportPreviewResponse,
  ImportTemplateRecord,
  ImportValidateResponse,
  RouteRow,
  SessionState,
  TripRow,
} from '@/lib/clearcut/types';

import { SectionCard } from './shared';

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
  | 'route_name'
  | 'scheduled_start_time'
  | 'scheduled_end_time'
  | 'actual_start_time'
  | 'actual_end_time'
  | 'break1'
  | 'break2';

const TRIP_DATA_PAGE_SIZE = 10;
const ROUTE_DATA_PAGE_SIZE = 10;

const TRIP_DATA_COLUMNS: Array<{
  key: TripDataColumnKey;
  label: string;
  getValue: (trip: TripRow) => string | null;
}> = [
  { key: 'trip_id', label: 'Trip', getValue: (trip) => trip.trip_id },
  { key: 'route_id', label: 'Route', getValue: (trip) => trip.route_id },
  {
    key: 'pickup_time',
    label: 'Pickup',
    getValue: (trip) => trip.pickup_arrive_time ?? trip.scheduled_pickup_time,
  },
  {
    key: 'dropoff_time',
    label: 'Dropoff',
    getValue: (trip) => trip.dropoff_leave_time ?? trip.scheduled_appointment_time,
  },
  { key: 'status', label: 'Status', getValue: (trip) => trip.status },
  { key: 'passenger_type', label: 'Passenger Type', getValue: (trip) => trip.passenger_type },
];

const ROUTE_DATA_COLUMNS: Array<{
  key: RouteDataColumnKey;
  label: string;
  getValue: (route: RouteRow) => string | null;
}> = [
  { key: 'route_id', label: 'Route', getValue: (route) => route.route_id },
  { key: 'route_name', label: 'Route Name', getValue: (route) => route.route_name ?? '-' },
  {
    key: 'scheduled_start_time',
    label: 'Scheduled Start',
    getValue: (route) => route.scheduled_start_time,
  },
  {
    key: 'scheduled_end_time',
    label: 'Scheduled End',
    getValue: (route) => route.scheduled_end_time,
  },
  { key: 'actual_start_time', label: 'Actual Start', getValue: (route) => route.actual_start_time ?? '-' },
  { key: 'actual_end_time', label: 'Actual End', getValue: (route) => route.actual_end_time ?? '-' },
  { key: 'break1', label: 'Break 1', getValue: (route) => route.break1 ?? '-' },
  { key: 'break2', label: 'Break 2', getValue: (route) => route.break2 ?? '-' },
];

interface ImportTabProps {
  readonlyView: boolean;
  state: SessionState;
  metrics: ClearcutMetrics;
  session: {
    uploadTrips: (file: File) => Promise<ImportResponse | undefined>;
    uploadRoutes: (file: File) => Promise<ImportResponse | undefined>;
    previewImport: (file: File, sheetName?: string) => Promise<ImportPreviewResponse>;
    validateImport: (preview: ImportPreviewResponse, config: ImportMappingConfig) => Promise<ImportValidateResponse>;
    applyImport: (
      file: File,
      config: ImportMappingConfig,
      sheetName?: string,
    ) => Promise<ImportApplyResponse & { trip_count: number; route_count: number }>;
    listTemplates: () => Promise<{ items: ImportTemplateRecord[]; count: number }>;
    createTemplate: (input: {
      templateName: string;
      sourceSystem: string;
      notes?: string;
      config: ImportMappingConfig;
    }) => Promise<{ template: ImportTemplateRecord }>;
    deleteTemplate: (id: number) => Promise<{ deleted: true }>;
  };
  setStatus: (msg: string | null) => void;
  setError: (msg: string | null) => void;
  onLoadDemo: () => void;
  onOtpWindowChange: (
    key:
      | 'pickup_otp_window_before_min'
      | 'pickup_otp_window_after_min'
      | 'dropoff_otp_window_before_min'
      | 'dropoff_otp_window_after_min',
    value: number,
  ) => void;
}

export default function ImportTab({
  readonlyView,
  state,
  metrics,
  session,
  setStatus,
  setError,
  onLoadDemo,
  onOtpWindowChange,
}: ImportTabProps) {
  const [importViewMode, setImportViewMode] = useState<ImportViewMode>('main');
  const [wizardKey, setWizardKey] = useState(0);
  const [tripPage, setTripPage] = useState(1);
  const [routePage, setRoutePage] = useState(1);
  const [flatImportLog, setFlatImportLog] = useState<{
    trips: Array<{ row: number; reason: string }>;
    routes: Array<{ row: number; reason: string }>;
  } | null>(null);
  const [showFlatImportLog, setShowFlatImportLog] = useState(false);
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
    route_name: true,
    scheduled_start_time: true,
    scheduled_end_time: true,
    actual_start_time: true,
    actual_end_time: true,
    break1: true,
    break2: true,
  });

  const activeTripColumns = TRIP_DATA_COLUMNS.filter((column) => tripVisibleColumns[column.key]);
  const activeRouteColumns = ROUTE_DATA_COLUMNS.filter((column) => routeVisibleColumns[column.key]);
  const tripCount = state.trips.length;
  const routeCount = state.routes.length;
  const tripTotalPages = Math.max(1, Math.ceil(tripCount / TRIP_DATA_PAGE_SIZE));
  const routeTotalPages = Math.max(1, Math.ceil(routeCount / ROUTE_DATA_PAGE_SIZE));
  const currentTripPage = Math.min(tripPage, tripTotalPages);
  const currentRoutePage = Math.min(routePage, routeTotalPages);
  const tripPageRows = state.trips.slice(
    (currentTripPage - 1) * TRIP_DATA_PAGE_SIZE,
    currentTripPage * TRIP_DATA_PAGE_SIZE,
  );
  const routePageRows = state.routes.slice(
    (currentRoutePage - 1) * ROUTE_DATA_PAGE_SIZE,
    currentRoutePage * ROUTE_DATA_PAGE_SIZE,
  );

  function downloadSampleCsv(kind: 'trips' | 'routes') {
    const tripSample = [
      'trip_id,trip_date,scheduled_pickup_time,scheduled_appointment_time,pickup_arrive_time,pickup_leave_time,dropoff_arrive_time,dropoff_leave_time,route_id,pickup_address,pickup_lat,pickup_lon,dropoff_address,dropoff_lat,dropoff_lon,status,passenger_type,passenger_count,pick_odometer,drop_odometer',
      'TRIP-001,2026-02-01,2026-02-01 08:00:00,2026-02-01 08:30:00,2026-02-01 07:58:00,2026-02-01 08:02:00,2026-02-01 08:27:00,2026-02-01 08:31:00,ROUTE-001,123 Main St,,,456 Oak St,,,completed,ambulatory,1,1000,1010',
    ].join('\n');
    const routeSample = [
      'route_id,route_date,route_name,scheduled_start_time,scheduled_end_time,actual_start_time,actual_end_time,break1,break2',
      'ROUTE-001,2026-02-01,North Loop,2026-02-01 07:30:00,2026-02-01 17:00:00,2026-02-01 07:35:00,2026-02-01 16:55:00,2026-02-01 11:00:00,2026-02-01 14:00:00',
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

  return (
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
          <FlatFileImport
            readonlyView={readonlyView}
            onBack={() => {
              setImportViewMode('main');
              setStatus(null);
              setError(null);
            }}
            onDownloadSample={downloadSampleCsv}
            onImport={async (tripFile, routeFile) => {
              if (readonlyView) return;
              setStatus('Importing routes and trips...');
              setError(null);
              setFlatImportLog(null);
              try {
                const skippedMessages: string[] = [];
                let routeSkipped: Array<{ row: number; reason: string }> = [];
                let tripSkipped: Array<{ row: number; reason: string }> = [];
                if (routeFile) {
                  const routeResult = await session.uploadRoutes(routeFile);
                  if (routeResult?.skipped_rows?.length) {
                    skippedMessages.push(`${routeResult.skipped_rows.length} route row(s) skipped.`);
                    routeSkipped = routeResult.skipped_rows;
                  }
                }
                if (tripFile) {
                  const tripResult = await session.uploadTrips(tripFile);
                  if (tripResult?.skipped_rows?.length) {
                    skippedMessages.push(`${tripResult.skipped_rows.length} trip row(s) skipped.`);
                    tripSkipped = tripResult.skipped_rows;
                  }
                }
                if (routeSkipped.length > 0 || tripSkipped.length > 0) {
                  setFlatImportLog({ routes: routeSkipped, trips: tripSkipped });
                }
                const statusParts = ['Import complete.'];
                if (skippedMessages.length > 0) {
                  statusParts.push(skippedMessages.join(' '));
                }
                setStatus(statusParts.join(' '));
              } catch (uploadError) {
                setStatus(null);
                setError(uploadError instanceof Error ? uploadError.message : 'Import failed.');
              }
            }}
          />
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
          <div className="col-12">
            <hr style={{ margin: '0.5rem 0' }} />
          </div>
          <div className="col-md-3">
            <label className="form-label">Pickup OTP: minutes before</label>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: '-2px', marginBottom: 6 }}>
              Minutes before scheduled pickup that is on time.
            </div>
            <input
              className="form-control"
              type="number"
              min={0}
              max={180}
              step={1}
              disabled={readonlyView}
              value={state.settings.pickup_otp_window_before_min}
              onChange={(event) =>
                onOtpWindowChange('pickup_otp_window_before_min', Number(event.target.value))
              }
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">Pickup OTP: minutes after</label>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: '-2px', marginBottom: 6 }}>
              Minutes after scheduled pickup that is on time.
            </div>
            <input
              className="form-control"
              type="number"
              min={0}
              max={180}
              step={1}
              disabled={readonlyView}
              value={state.settings.pickup_otp_window_after_min}
              onChange={(event) =>
                onOtpWindowChange('pickup_otp_window_after_min', Number(event.target.value))
              }
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">Dropoff OTP: minutes before</label>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: '-2px', marginBottom: 6 }}>
              Minutes before dropoff that is on time.
            </div>
            <input
              className="form-control"
              type="number"
              min={0}
              max={180}
              step={1}
              disabled={readonlyView}
              value={state.settings.dropoff_otp_window_before_min}
              onChange={(event) =>
                onOtpWindowChange('dropoff_otp_window_before_min', Number(event.target.value))
              }
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">Dropoff OTP: minutes after</label>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: '-2px', marginBottom: 6 }}>
              Minutes after dropoff that is on time.
            </div>
            <input
              className="form-control"
              type="number"
              min={0}
              max={180}
              step={1}
              disabled={readonlyView}
              value={state.settings.dropoff_otp_window_after_min}
              onChange={(event) =>
                onOtpWindowChange('dropoff_otp_window_after_min', Number(event.target.value))
              }
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Data Views">
        <details style={{ marginBottom: 12 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
            Trips ({state.trips.length})
          </summary>
          <div style={{ overflowX: 'auto', marginTop: 8 }}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Columns</div>
              <div className="d-flex flex-wrap gap-3">
                {TRIP_DATA_COLUMNS.map((column) => (
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
                {state.trips.length === 0 && (
                  <tr>
                    <td colSpan={Math.max(activeTripColumns.length, 1)} style={{ color: '#6b7280' }}>
                      No trips available.
                    </td>
                  </tr>
                )}
                {state.trips.length > 0 && activeTripColumns.length === 0 && (
                  <tr>
                    <td style={{ color: '#6b7280' }}>Select at least one column.</td>
                  </tr>
                )}
              </tbody>
            </table>
            {state.trips.length > 0 && (
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
            Routes ({state.routes.length})
          </summary>
          <div style={{ overflowX: 'auto', marginTop: 8 }}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Columns</div>
              <div className="d-flex flex-wrap gap-3">
                {ROUTE_DATA_COLUMNS.map((column) => (
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
                {state.routes.length === 0 && (
                  <tr>
                    <td colSpan={Math.max(activeRouteColumns.length, 1)} style={{ color: '#6b7280' }}>
                      No routes available.
                    </td>
                  </tr>
                )}
                {state.routes.length > 0 && activeRouteColumns.length === 0 && (
                  <tr>
                    <td style={{ color: '#6b7280' }}>Select at least one column.</td>
                  </tr>
                )}
              </tbody>
            </table>
            {state.routes.length > 0 && (
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

      {flatImportLog && (flatImportLog.trips.length > 0 || flatImportLog.routes.length > 0) && (
        <p style={{ fontSize: 13 }}>
          Some rows were skipped during flat file import.{' '}
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setShowFlatImportLog(true)}
          >
            View skipped row log
          </button>
        </p>
      )}

      {flatImportLog && (
        <FlatImportLogModal
          show={showFlatImportLog}
          onClose={() => setShowFlatImportLog(false)}
          log={flatImportLog}
        />
      )}
    </>
  );
}

function FlatFileImport({
  readonlyView,
  onBack,
  onDownloadSample,
  onImport,
}: {
  readonlyView: boolean;
  onBack: () => void;
  onDownloadSample: (kind: 'trips' | 'routes') => void;
  onImport: (tripFile: File | null, routeFile: File | null) => Promise<void>;
}) {
  const [tripFile, setTripFile] = useState<File | null>(null);
  const [routeFile, setRouteFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  async function handleImport() {
    if (readonlyView || (!tripFile && !routeFile)) return;
    setImporting(true);
    try {
      await onImport(tripFile, routeFile);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        className="btn btn-sm btn-outline-secondary mb-3"
        type="button"
        onClick={onBack}
      >
        Back to Import Options
      </button>
      <div className="row">
        <div className="col-md-6 mb-3">
          <div className="d-flex gap-2 mb-2">
            <button
              className="btn btn-sm btn-outline-secondary"
              type="button"
              onClick={() => onDownloadSample('routes')}
            >
              Download Route Sample CSV
            </button>
          </div>
          <div
            style={{
              border: '1px dashed #94a3b8',
              borderRadius: 10,
              padding: '1rem',
              background: readonlyView ? '#f8fafc' : '#fff',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Route File (CSV/XLSX)</div>
            <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 8 }}>
              Select the route file to import.
            </div>
            <input
              type="file"
              className="form-control"
              accept=".csv,.xlsx,.xls"
              disabled={readonlyView}
              onChange={(event) => {
                setRouteFile(event.target.files?.[0] ?? null);
              }}
            />
            {routeFile && (
              <div style={{ fontSize: 13, color: '#065f46', marginTop: 6 }}>
                Selected: {routeFile.name}
              </div>
            )}
          </div>
        </div>
        <div className="col-md-6 mb-3">
          <div className="d-flex gap-2 mb-2">
            <button
              className="btn btn-sm btn-outline-secondary"
              type="button"
              onClick={() => onDownloadSample('trips')}
            >
              Download Trip Sample CSV
            </button>
          </div>
          <div
            style={{
              border: '1px dashed #94a3b8',
              borderRadius: 10,
              padding: '1rem',
              background: readonlyView ? '#f8fafc' : '#fff',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Trip File (CSV/XLSX)</div>
            <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 8 }}>
              Select the trip file to import.
            </div>
            <input
              type="file"
              className="form-control"
              accept=".csv,.xlsx,.xls"
              disabled={readonlyView}
              onChange={(event) => {
                setTripFile(event.target.files?.[0] ?? null);
              }}
            />
            {tripFile && (
              <div style={{ fontSize: 13, color: '#065f46', marginTop: 6 }}>
                Selected: {tripFile.name}
              </div>
            )}
          </div>
        </div>
      </div>
      <button
        className="btn btn-primary"
        type="button"
        disabled={readonlyView || importing || (!tripFile && !routeFile)}
        onClick={handleImport}
      >
        {importing ? 'Importing...' : 'Import Files'}
      </button>
      {!tripFile && !routeFile && (
        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>
          Select at least one file to import. Routes are imported first so trips can be validated against them.
        </div>
      )}
    </div>
  );
}

function FlatImportLogModal(props: {
  show: boolean;
  onClose: () => void;
  log: {
    trips: Array<{ row: number; reason: string }>;
    routes: Array<{ row: number; reason: string }>;
  };
}) {
  if (!props.show) {
    return null;
  }

  const hasTrips = props.log.trips.length > 0;
  const hasRoutes = props.log.routes.length > 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 10,
          width: '100%',
          maxWidth: 780,
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #e5e7eb',
            padding: '0.75rem 1rem',
          }}
        >
          <h4 style={{ margin: 0, fontSize: 17 }}>Flat Import Skipped Rows</h4>
          <button className="btn btn-sm btn-outline-secondary" type="button" onClick={props.onClose}>
            Close
          </button>
        </div>
        <div style={{ padding: '0.9rem 1rem' }}>
          <p style={{ fontSize: 13, color: '#4b5563' }}>
            These rows were skipped during the most recent flat-file import. Row numbers correspond to the
            original CSV/XLSX (header is row 1).
          </p>
          {hasRoutes && (
            <div
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: '0.7rem',
                marginBottom: '0.75rem',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                Route file skipped rows ({props.log.routes.length})
              </div>
              <ul style={{ marginBottom: 0, maxHeight: 220, overflow: 'auto' }}>
                {props.log.routes.map((err, idx) => (
                  <li key={`flat-route-error-${idx}`} style={{ fontSize: 13 }}>
                    Row {err.row}: {err.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {hasTrips && (
            <div
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: '0.7rem',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                Trip file skipped rows ({props.log.trips.length})
              </div>
              <ul style={{ marginBottom: 0, maxHeight: 220, overflow: 'auto' }}>
                {props.log.trips.map((err, idx) => (
                  <li key={`flat-trip-error-${idx}`} style={{ fontSize: 13 }}>
                    Row {err.row}: {err.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!hasTrips && !hasRoutes && (
            <p style={{ fontSize: 13, color: '#6b7280' }}>No skipped rows were reported for the last import.</p>
          )}
        </div>
      </div>
    </div>
  );
}
