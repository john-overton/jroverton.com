'use client';

import { useMemo, useState } from 'react';

import type {
  ImportApplyResponse,
  ImportMappingConfig,
  ImportPreviewResponse,
  ImportTemplateRecord,
  ImportValidateResponse,
  RouteRow,
  TripRow,
} from '@/lib/clearcut/types';

const CANONICAL_EVENTS: Array<ImportMappingConfig['event_values'][string]> = [
  'pullout',
  'pullin',
  'pickup',
  'dropoff',
  'break',
  'other',
];

const TRIP_FIELD_OPTIONS: Array<keyof TripRow> = [
  'trip_id',
  'route_id',
  'scheduled_pickup_time',
  'scheduled_appointment_time',
  'pickup_arrive_time',
  'pickup_leave_time',
  'dropoff_arrive_time',
  'dropoff_leave_time',
  'pickup_address',
  'pickup_lat',
  'pickup_lon',
  'dropoff_address',
  'dropoff_lat',
  'dropoff_lon',
  'status',
  'passenger_type',
  'passenger_count',
  'pick_odometer',
  'drop_odometer',
];

const ROUTE_FIELD_OPTIONS: Array<keyof RouteRow> = [
  'route_id',
  'scheduled_start_time',
  'scheduled_end_time',
  'actual_start_time',
  'actual_end_time',
];

interface Props {
  readonlyView: boolean;
  onPreview: (file: File) => Promise<ImportPreviewResponse>;
  onValidate: (preview: ImportPreviewResponse, config: ImportMappingConfig) => Promise<ImportValidateResponse>;
  onApply: (file: File, config: ImportMappingConfig) => Promise<ImportApplyResponse & { trip_count: number; route_count: number }>;
  onListTemplates: () => Promise<{ items: ImportTemplateRecord[]; count: number }>;
  onCreateTemplate: (input: {
    templateName: string;
    sourceSystem: string;
    notes?: string;
    config: ImportMappingConfig;
  }) => Promise<{ template: ImportTemplateRecord }>;
  onDeleteTemplate: (id: number) => Promise<{ deleted: true }>;
}

function emptyConfig(): ImportMappingConfig {
  return {
    event_column: '',
    event_values: {},
    field_mapping: { trip: {}, route: {} },
    match_rules: {
      trip_keys: ['trip_id', 'route_id'],
      route_keys: ['route_id'],
      create_missing_trip: false,
      create_missing_route: false,
    },
  };
}

export default function ImportMapperWizard(props: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [config, setConfig] = useState<ImportMappingConfig>(emptyConfig());
  const [validateResult, setValidateResult] = useState<ImportValidateResponse | null>(null);
  const [applyResult, setApplyResult] = useState<(ImportApplyResponse & { trip_count: number; route_count: number }) | null>(null);
  const [templates, setTemplates] = useState<ImportTemplateRecord[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [sourceSystem, setSourceSystem] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewHeaders = preview?.headers ?? [];
  const eventValues = useMemo(() => {
    if (!preview || !config.event_column) return [];
    const values = new Set<string>();
    for (const row of preview.rows) {
      const value = findValueByHeader(row, config.event_column);
      if (value) values.add(value);
    }
    return Array.from(values).slice(0, 30);
  }, [preview, config.event_column]);

  async function handlePreview() {
    if (!file) return;
    setStatus('Reading preview...');
    setError(null);
    try {
      const nextPreview = await props.onPreview(file);
      setPreview(nextPreview);
      setConfig((prev) => ({
        ...prev,
        event_column: prev.event_column || nextPreview.headers[0] || '',
      }));
      setStatus(`Loaded ${nextPreview.sample_count} sample rows from ${nextPreview.row_count} total rows.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview file.');
    }
  }

  async function handleValidate() {
    if (!preview) return;
    setStatus('Validating mapping...');
    setError(null);
    try {
      const result = await props.onValidate(preview, config);
      setValidateResult(result);
      setStatus(result.valid ? 'Mapping is valid.' : 'Mapping has errors.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed.');
    }
  }

  async function handleApply() {
    if (!preview || !file || props.readonlyView) return;
    setStatus('Applying import...');
    setError(null);
    try {
      const result = await props.onApply(file, config);
      setApplyResult(result);
      setStatus('Import apply complete.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import apply failed.');
    }
  }

  async function refreshTemplates() {
    try {
      const result = await props.onListTemplates();
      setTemplates(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load templates.');
    }
  }

  async function saveTemplate() {
    if (!templateName.trim() || !sourceSystem.trim()) {
      setError('Template name and source system are required.');
      return;
    }
    try {
      await props.onCreateTemplate({
        templateName: templateName.trim(),
        sourceSystem: sourceSystem.trim(),
        notes: notes.trim() || undefined,
        config,
      });
      setTemplateName('');
      setSourceSystem('');
      setNotes('');
      await refreshTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save template.');
    }
  }

  function loadTemplate(template: ImportTemplateRecord) {
    try {
      const eventData = JSON.parse(template.event_mapping_json) as {
        event_column?: string;
        event_values?: Record<string, ImportMappingConfig['event_values'][string]>;
      };
      const fieldMapping = JSON.parse(template.field_mapping_json) as ImportMappingConfig['field_mapping'];
      const matchRules = JSON.parse(template.match_rules_json) as ImportMappingConfig['match_rules'];
      setConfig({
        event_column: eventData.event_column ?? '',
        event_values: eventData.event_values ?? {},
        field_mapping: fieldMapping ?? { trip: {}, route: {} },
        match_rules: matchRules ?? emptyConfig().match_rules,
      });
      setStatus(`Loaded template '${template.template_name}'.`);
    } catch {
      setError('Template JSON is invalid.');
    }
  }

  return (
    <div>
      <SectionTitle title="Import Mapper Wizard" />
      <div className="row g-3 mb-3">
        <div className="col-md-8">
          <input
            className="form-control"
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            disabled={props.readonlyView}
          />
        </div>
        <div className="col-md-4">
          <button className="btn btn-outline-primary w-100" type="button" onClick={handlePreview} disabled={!file}>
            Preview First 100 Rows
          </button>
        </div>
      </div>

      {preview && (
        <>
          <FilePreviewTable preview={preview} />
          <EventValueMapper
            headers={previewHeaders}
            eventColumn={config.event_column}
            eventValues={eventValues}
            mappings={config.event_values}
            onEventColumnChange={(eventColumn) => setConfig((prev) => ({ ...prev, event_column: eventColumn }))}
            onEventMapChange={(rawValue, mappedValue) =>
              setConfig((prev) => ({
                ...prev,
                event_values: { ...prev.event_values, [rawValue]: mappedValue },
              }))
            }
          />
          <SchemaFieldMapper
            headers={previewHeaders}
            tripMappings={config.field_mapping.trip}
            routeMappings={config.field_mapping.route}
            onTripMapChange={(field, source) =>
              setConfig((prev) => ({
                ...prev,
                field_mapping: { ...prev.field_mapping, trip: { ...prev.field_mapping.trip, [field]: source } },
              }))
            }
            onRouteMapChange={(field, source) =>
              setConfig((prev) => ({
                ...prev,
                field_mapping: { ...prev.field_mapping, route: { ...prev.field_mapping.route, [field]: source } },
              }))
            }
          />
          <MatchRulesBuilder
            matchRules={config.match_rules}
            onMatchRulesChange={(next) => setConfig((prev) => ({ ...prev, match_rules: next }))}
          />
          <div className="d-flex gap-2 mb-3">
            <button className="btn btn-outline-secondary" type="button" onClick={handleValidate}>
              Validate Mapping
            </button>
            <button className="btn btn-primary" type="button" onClick={handleApply} disabled={props.readonlyView}>
              Apply Import
            </button>
          </div>
          {validateResult && <ImportReviewSummary validateResult={validateResult} applyResult={applyResult} />}
        </>
      )}

      <TemplateManager
        templates={templates}
        templateName={templateName}
        sourceSystem={sourceSystem}
        notes={notes}
        onTemplateNameChange={setTemplateName}
        onSourceSystemChange={setSourceSystem}
        onNotesChange={setNotes}
        onRefresh={refreshTemplates}
        onSave={saveTemplate}
        onLoad={loadTemplate}
        onDelete={async (id) => {
          await props.onDeleteTemplate(id);
          await refreshTemplates();
        }}
        readonlyView={props.readonlyView}
      />

      {status && <p style={{ color: '#065f46', marginTop: '0.6rem' }}>{status}</p>}
      {error && <p style={{ color: '#b91c1c', marginTop: '0.6rem' }}>{error}</p>}
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h3 style={{ fontSize: 17, marginBottom: '0.75rem' }}>{title}</h3>;
}

function FilePreviewTable({ preview }: { preview: ImportPreviewResponse }) {
  const shownRows = preview.rows.slice(0, 8);
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem', marginBottom: '0.8rem' }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>File Preview ({preview.sample_count} sampled rows)</div>
      <div style={{ overflowX: 'auto' }}>
        <table className="table table-sm mb-0">
          <thead>
            <tr>
              {preview.headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shownRows.map((row, idx) => (
              <tr key={`preview-row-${idx}`}>
                {preview.headers.map((header) => (
                  <td key={`${idx}-${header}`}>{row[header] ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EventValueMapper(props: {
  headers: string[];
  eventColumn: string;
  eventValues: string[];
  mappings: ImportMappingConfig['event_values'];
  onEventColumnChange: (eventColumn: string) => void;
  onEventMapChange: (rawValue: string, mappedValue: ImportMappingConfig['event_values'][string]) => void;
}) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem', marginBottom: '0.8rem' }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Event Mapping</div>
      <label className="form-label">Event Column</label>
      <select
        className="form-select mb-2"
        value={props.eventColumn}
        onChange={(event) => props.onEventColumnChange(event.target.value)}
      >
        <option value="">Select column</option>
        {props.headers.map((header) => (
          <option key={header} value={header}>
            {header}
          </option>
        ))}
      </select>
      {props.eventValues.map((rawValue) => (
        <div key={rawValue} className="row g-2 align-items-center mb-2">
          <div className="col-md-6">
            <code>{rawValue}</code>
          </div>
          <div className="col-md-6">
            <select
              className="form-select"
              value={props.mappings[rawValue] ?? 'other'}
              onChange={(event) =>
                props.onEventMapChange(rawValue, event.target.value as ImportMappingConfig['event_values'][string])
              }
            >
              {CANONICAL_EVENTS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}

function SchemaFieldMapper(props: {
  headers: string[];
  tripMappings: ImportMappingConfig['field_mapping']['trip'];
  routeMappings: ImportMappingConfig['field_mapping']['route'];
  onTripMapChange: (field: keyof TripRow, source: string) => void;
  onRouteMapChange: (field: keyof RouteRow, source: string) => void;
}) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem', marginBottom: '0.8rem' }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Schema Field Mapping</div>
      <div className="row">
        <div className="col-md-6">
          <h4 style={{ fontSize: 15 }}>Trip Fields</h4>
          {TRIP_FIELD_OPTIONS.map((field) => (
            <SelectField
              key={field}
              label={field}
              value={props.tripMappings[field] ?? ''}
              options={props.headers}
              onChange={(value) => props.onTripMapChange(field, value)}
            />
          ))}
        </div>
        <div className="col-md-6">
          <h4 style={{ fontSize: 15 }}>Route Fields</h4>
          {ROUTE_FIELD_OPTIONS.map((field) => (
            <SelectField
              key={field}
              label={field}
              value={props.routeMappings[field] ?? ''}
              options={props.headers}
              onChange={(value) => props.onRouteMapChange(field, value)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MatchRulesBuilder(props: {
  matchRules: ImportMappingConfig['match_rules'];
  onMatchRulesChange: (next: ImportMappingConfig['match_rules']) => void;
}) {
  const tripKeys = props.matchRules.trip_keys;
  const routeKeys = props.matchRules.route_keys;
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem', marginBottom: '0.8rem' }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Match Rules</div>
      <div className="row">
        <div className="col-md-6">
          <div className="mb-2">Trip match keys</div>
          {TRIP_FIELD_OPTIONS.map((key) => (
            <CheckField
              key={`trip-key-${key}`}
              label={key}
              checked={tripKeys.includes(key)}
              onChange={(checked) =>
                props.onMatchRulesChange({
                  ...props.matchRules,
                  trip_keys: checked
                    ? [...tripKeys, key]
                    : tripKeys.filter((current) => current !== key),
                })
              }
            />
          ))}
        </div>
        <div className="col-md-6">
          <div className="mb-2">Route match keys</div>
          {ROUTE_FIELD_OPTIONS.map((key) => (
            <CheckField
              key={`route-key-${key}`}
              label={key}
              checked={routeKeys.includes(key)}
              onChange={(checked) =>
                props.onMatchRulesChange({
                  ...props.matchRules,
                  route_keys: checked
                    ? [...routeKeys, key]
                    : routeKeys.filter((current) => current !== key),
                })
              }
            />
          ))}
        </div>
      </div>
      <CheckField
        label="Create missing trips"
        checked={Boolean(props.matchRules.create_missing_trip)}
        onChange={(checked) =>
          props.onMatchRulesChange({ ...props.matchRules, create_missing_trip: checked })
        }
      />
      <CheckField
        label="Create missing routes"
        checked={Boolean(props.matchRules.create_missing_route)}
        onChange={(checked) =>
          props.onMatchRulesChange({ ...props.matchRules, create_missing_route: checked })
        }
      />
    </div>
  );
}

function ImportReviewSummary(props: {
  validateResult: ImportValidateResponse;
  applyResult: (ImportApplyResponse & { trip_count: number; route_count: number }) | null;
}) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem', marginBottom: '0.8rem' }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Review Summary</div>
      <div>Valid: {props.validateResult.valid ? 'yes' : 'no'}</div>
      {props.validateResult.errors.length > 0 && (
        <ul>
          {props.validateResult.errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      )}
      {props.validateResult.warnings.length > 0 && (
        <ul>
          {props.validateResult.warnings.map((warn) => (
            <li key={warn}>{warn}</li>
          ))}
        </ul>
      )}
      {props.applyResult && (
        <div style={{ marginTop: 8 }}>
          <div>
            Processed rows: <strong>{props.applyResult.summary.processed_rows}</strong>
          </div>
          <div>
            Trips created/updated: {props.applyResult.summary.created_trips}/
            {props.applyResult.summary.updated_trips}
          </div>
          <div>
            Routes created/updated: {props.applyResult.summary.created_routes}/
            {props.applyResult.summary.updated_routes}
          </div>
          <div>Skipped rows: {props.applyResult.summary.skipped_rows}</div>
        </div>
      )}
    </div>
  );
}

function TemplateManager(props: {
  templates: ImportTemplateRecord[];
  templateName: string;
  sourceSystem: string;
  notes: string;
  onTemplateNameChange: (value: string) => void;
  onSourceSystemChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onRefresh: () => Promise<void>;
  onSave: () => Promise<void>;
  onLoad: (template: ImportTemplateRecord) => void;
  onDelete: (id: number) => Promise<void>;
  readonlyView: boolean;
}) {
  const [infoTemplateId, setInfoTemplateId] = useState<number | null>(null);

  function getTemplateInfo(template: ImportTemplateRecord): {
    notes: string;
    eventColumn: string;
    tripMappings: Array<{ target: string; source: string }>;
    routeMappings: Array<{ target: string; source: string }>;
  } {
    try {
      const eventData = JSON.parse(template.event_mapping_json) as {
        event_column?: string;
      };
      const fieldData = JSON.parse(template.field_mapping_json) as {
        trip?: Record<string, string>;
        route?: Record<string, string>;
      };
      const tripMappings = Object.entries(fieldData.trip ?? {})
        .filter(([, source]) => Boolean(source))
        .map(([target, source]) => ({ target, source }));
      const routeMappings = Object.entries(fieldData.route ?? {})
        .filter(([, source]) => Boolean(source))
        .map(([target, source]) => ({ target, source }));
      return {
        notes: template.notes ?? 'No notes provided.',
        eventColumn: eventData.event_column ?? '(not set)',
        tripMappings,
        routeMappings,
      };
    } catch {
      return {
        notes: template.notes ?? 'No notes provided.',
        eventColumn: '(invalid template JSON)',
        tripMappings: [],
        routeMappings: [],
      };
    }
  }

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem', marginBottom: '0.8rem' }}>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div style={{ fontWeight: 600 }}>Template Manager</div>
        <button className="btn btn-sm btn-outline-secondary" type="button" onClick={props.onRefresh}>
          Refresh
        </button>
      </div>
      <div className="row g-2 mb-2">
        <div className="col-md-4">
          <input
            className="form-control"
            placeholder="Template Name"
            value={props.templateName}
            onChange={(event) => props.onTemplateNameChange(event.target.value)}
            disabled={props.readonlyView}
          />
        </div>
        <div className="col-md-4">
          <input
            className="form-control"
            placeholder="Source System"
            value={props.sourceSystem}
            onChange={(event) => props.onSourceSystemChange(event.target.value)}
            disabled={props.readonlyView}
          />
        </div>
        <div className="col-md-4">
          <button className="btn btn-outline-primary w-100" type="button" onClick={props.onSave} disabled={props.readonlyView}>
            Save Template
          </button>
        </div>
      </div>
      <textarea
        className="form-control mb-2"
        rows={2}
        placeholder="Notes"
        value={props.notes}
        onChange={(event) => props.onNotesChange(event.target.value)}
        disabled={props.readonlyView}
      />
      <div style={{ maxHeight: 240, overflow: 'auto' }}>
        {props.templates.map((template) => (
          <div
            key={template.id}
            style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '0.5rem', marginBottom: '0.45rem' }}
          >
            <div style={{ fontWeight: 600 }}>{template.template_name}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{template.source_system}</div>
            <div className="d-flex gap-2 mt-2">
              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => props.onLoad(template)}>
                Load
              </button>
              <button
                className="btn btn-sm btn-outline-info"
                type="button"
                onClick={() =>
                  setInfoTemplateId((current) => (current === template.id ? null : template.id))
                }
              >
                Info
              </button>
              {!props.readonlyView && (
                <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => props.onDelete(template.id)}>
                  Delete
                </button>
              )}
            </div>
            {infoTemplateId === template.id && (
              <TemplateInfoPanel info={getTemplateInfo(template)} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TemplateInfoPanel({
  info,
}: {
  info: {
    notes: string;
    eventColumn: string;
    tripMappings: Array<{ target: string; source: string }>;
    routeMappings: Array<{ target: string; source: string }>;
  };
}) {
  return (
    <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 8, paddingTop: 8 }}>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
        Event column: <code>{info.eventColumn}</code>
      </div>
      <div style={{ fontSize: 12, color: '#374151', marginBottom: 6 }}>
        Notes: {info.notes}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600 }}>Expected field mappings</div>
      <div className="row">
        <div className="col-md-6">
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Trip</div>
          <ul style={{ marginBottom: 4 }}>
            {info.tripMappings.length === 0 && <li style={{ fontSize: 12 }}>No trip mappings saved.</li>}
            {info.tripMappings.map((item) => (
              <li key={`trip-map-${item.target}`} style={{ fontSize: 12 }}>
                <code>{item.target}</code> ← <code>{item.source}</code>
              </li>
            ))}
          </ul>
        </div>
        <div className="col-md-6">
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Route</div>
          <ul style={{ marginBottom: 4 }}>
            {info.routeMappings.length === 0 && <li style={{ fontSize: 12 }}>No route mappings saved.</li>}
            {info.routeMappings.map((item) => (
              <li key={`route-map-${item.target}`} style={{ fontSize: 12 }}>
                <code>{item.target}</code> ← <code>{item.source}</code>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="mb-2">
      <label className="form-label">{label}</label>
      <select className="form-select" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Not mapped</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="form-check mb-1">
      <input
        className="form-check-input"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <label className="form-check-label">{label}</label>
    </div>
  );
}

function findValueByHeader(row: Record<string, string | null>, header: string): string | null {
  for (const [key, value] of Object.entries(row)) {
    if (key.trim().toLowerCase() === header.trim().toLowerCase()) {
      return value;
    }
  }
  return null;
}
