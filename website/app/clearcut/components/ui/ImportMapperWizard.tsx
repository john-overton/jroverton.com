'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/app/clearcut/components/shadcn/button';
import { Checkbox } from '@/app/clearcut/components/shadcn/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/clearcut/components/shadcn/dialog';
import { Input } from '@/app/clearcut/components/shadcn/input';
import { Label } from '@/app/clearcut/components/shadcn/label';
import { Progress } from '@/app/clearcut/components/shadcn/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/clearcut/components/shadcn/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/clearcut/components/shadcn/table';
import type {
  ImportApplyResponse,
  ImportMappingConfig,
  ImportPreviewResponse,
  ImportTemplateRecord,
  ImportValidateResponse,
  RouteRow,
  TripRow,
} from '@/lib/clearcut/types';

import { SectionCard } from './shared';

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
  'trip_date',
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
  'route_date',
  'route_name',
  'scheduled_start_time',
  'scheduled_end_time',
  'actual_start_time',
  'actual_end_time',
  'break1',
  'break2',
];

interface Props {
  readonlyView: boolean;
  onPreview: (file: File, sheetName?: string) => Promise<ImportPreviewResponse>;
  onValidate: (preview: ImportPreviewResponse, config: ImportMappingConfig) => Promise<ImportValidateResponse>;
  onApply: (
    file: File,
    config: ImportMappingConfig,
    sheetName?: string,
  ) => Promise<ImportApplyResponse & { trip_count: number; route_count: number }>;
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
      trip_grouping: {
        keys: ['trip_date', 'route_id'],
        pickup_key_field: 'trip_id',
        dropoff_key_field: 'trip_id',
      },
      trip_route_join: {
        join_columns: [
          { trip_field: 'trip_date', route_field: 'route_date' },
          { trip_field: 'route_id', route_field: 'route_id' },
        ],
      },
    },
  };
}

export default function ImportMapperWizard(props: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheetName, setSelectedSheetName] = useState('');
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
  const [showImportModal, setShowImportModal] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importRunning, setImportRunning] = useState(false);
  const [importLogLines, setImportLogLines] = useState<string[]>([]);
  const [importErrors, setImportErrors] = useState<Array<{ row: number; reason: string }>>([]);
  const [importResult, setImportResult] = useState<(ImportApplyResponse & { trip_count: number; route_count: number }) | null>(null);

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

  async function loadPreview(targetSheetName?: string) {
    if (!file) return;
    setStatus('Reading preview...');
    setError(null);
    try {
      const nextPreview = await props.onPreview(file, targetSheetName);
      setPreview(nextPreview);
      setValidateResult(null);
      setApplyResult(null);
      setSheetNames(nextPreview.sheet_names);
      setSelectedSheetName(nextPreview.selected_sheet ?? '');
      setConfig((prev) => ({
        ...prev,
        event_column: includesHeader(nextPreview.headers, prev.event_column) ? prev.event_column : nextPreview.headers[0] || '',
      }));
      const sheetSuffix =
        nextPreview.sheet_names.length > 1 && nextPreview.selected_sheet
          ? ` from sheet '${nextPreview.selected_sheet}'`
          : '';
      setStatus(`Loaded ${nextPreview.sample_count} sample rows from ${nextPreview.row_count} total rows${sheetSuffix}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview file.');
    }
  }

  async function handlePreview() {
    await loadPreview(selectedSheetName || undefined);
  }

  async function handleSheetChange(nextSheetName: string) {
    setSelectedSheetName(nextSheetName);
    await loadPreview(nextSheetName);
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
    setShowImportModal(true);
    setImportRunning(true);
    setImportProgress(8);
    setImportLogLines(['Preparing import payload...']);
    setImportErrors([]);
    setImportResult(null);

    const progressTimer = window.setInterval(() => {
      setImportProgress((prev) => (prev < 88 ? prev + 4 : prev));
    }, 280);

    try {
      setImportLogLines((prev) => [...prev, 'Uploading file and mapping configuration...']);
      const result = await props.onApply(file, config, selectedSheetName || undefined);
      setApplyResult(result);
      setImportResult(result);
      setImportErrors(result.errors);
      setImportLogLines((prev) => [
        ...prev,
        `Import complete: ${result.summary.created_trips + result.summary.updated_trips} trip updates, ${result.summary.created_routes + result.summary.updated_routes} route updates.`,
        result.errors.length > 0 ? `${result.errors.length} row error(s) detected.` : 'No row errors detected.',
      ]);
      setStatus('Import apply complete.');
      setImportProgress(100);
    } catch (err) {
      setImportLogLines((prev) => [...prev, 'Import failed.']);
      setImportProgress(100);
      setError(err instanceof Error ? err.message : 'Import apply failed.');
    } finally {
      window.clearInterval(progressTimer);
      setImportRunning(false);
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
      const matchRules = parseMatchRules(template.match_rules_json);
      setConfig({
        event_column: eventData.event_column ?? '',
        event_values: eventData.event_values ?? {},
        field_mapping: fieldMapping ?? { trip: {}, route: {} },
        match_rules: matchRules,
      });
      setStatus(`Loaded template '${template.template_name}'.`);
    } catch {
      setError('Template JSON is invalid.');
    }
  }

  return (
    <div>
      <h3 className="text-[17px] font-semibold mb-3">Import Mapper Wizard</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <div className="md:col-span-2">
          <Input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setSheetNames([]);
              setSelectedSheetName('');
              setPreview(null);
              setValidateResult(null);
              setApplyResult(null);
            }}
            disabled={props.readonlyView}
          />
        </div>
        <Button variant="outline" className="w-full" type="button" onClick={handlePreview} disabled={!file}>
          Preview First 100 Rows
        </Button>
      </div>

      {preview && (
        <>
          {sheetNames.length > 1 && (
            <div className="border border-cc-border rounded-lg p-3 mb-3 bg-cc-surface-2">
              <Label className="font-semibold">Workbook Sheet</Label>
              <Select
                value={selectedSheetName}
                onValueChange={(v) => { void handleSheetChange(v); }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sheetNames.map((sheetName) => (
                    <SelectItem key={sheetName} value={sheetName}>
                      {sheetName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-cc-text-muted mt-1.5">
                This workbook has multiple sheets. Choose the sheet to preview and import.
              </div>
            </div>
          )}
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
          <div className="flex gap-2 mb-3">
            <Button variant="outline" type="button" onClick={handleValidate}>
              Validate Mapping
            </Button>
            <Button type="button" onClick={handleApply} disabled={props.readonlyView}>
              Apply Import
            </Button>
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

      {status && <p className="text-cc-success mt-2">{status}</p>}
      {error && <p className="text-cc-danger mt-2">{error}</p>}

      <ImportStatusModal
        show={showImportModal}
        running={importRunning}
        progress={importProgress}
        logs={importLogLines}
        errors={importErrors}
        result={importResult}
        onClose={() => {
          if (!importRunning) {
            setShowImportModal(false);
          }
        }}
      />
    </div>
  );
}

function ImportStatusModal(props: {
  show: boolean;
  running: boolean;
  progress: number;
  logs: string[];
  errors: Array<{ row: number; reason: string }>;
  result: (ImportApplyResponse & { trip_count: number; route_count: number }) | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={props.show} onOpenChange={(open) => { if (!open && !props.running) props.onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Import Status</DialogTitle>
        </DialogHeader>
        <div>
          <div className="text-[13px] text-cc-text-secondary mb-1.5">
            {props.running ? 'Import is in progress...' : 'Import finished.'}
          </div>
          <Progress value={props.progress} className="mb-3" />

          {props.result && (
            <div className="border border-cc-border rounded-lg p-3 mb-3">
              <div className="font-semibold mb-1.5">Inserted Summary</div>
              <div className="text-[13px]">
                Trips inserted: <strong>{props.result.summary.created_trips}</strong>
              </div>
              <div className="text-[13px] mb-1.5">
                Routes inserted: <strong>{props.result.summary.created_routes}</strong>
              </div>
              <div className="text-[13px] mb-1">Trip dates inserted:</div>
              <ul className="mb-2">
                {props.result.inserted_by_date.trips.length === 0 && <li>None</li>}
                {props.result.inserted_by_date.trips.map((item) => (
                  <li key={`trip-date-${item.date}`}>
                    <code>{item.date}</code>: {item.count}
                  </li>
                ))}
              </ul>
              <div className="text-[13px] mb-1">Route dates inserted:</div>
              <ul className="mb-0">
                {props.result.inserted_by_date.routes.length === 0 && <li>None</li>}
                {props.result.inserted_by_date.routes.map((item) => (
                  <li key={`route-date-${item.date}`}>
                    <code>{item.date}</code>: {item.count}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="border border-cc-border rounded-lg p-3 mb-3">
            <div className="font-semibold mb-1.5">Import Log</div>
            <ul className="mb-0">
              {props.logs.map((line, index) => (
                <li key={`import-log-${index}`} className="text-[13px]">
                  {line}
                </li>
              ))}
            </ul>
          </div>

          {props.errors.length > 0 && (
            <div className="border border-cc-danger/30 bg-cc-danger/5 rounded-lg p-3">
              <div className="font-semibold mb-1.5 text-cc-danger">
                Import Errors ({props.errors.length})
              </div>
              <ul className="mb-0 max-h-[220px] overflow-auto">
                {props.errors.map((err, idx) => (
                  <li key={`import-error-${idx}`} className="text-[13px] text-cc-danger">
                    Row {err.row}: {err.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FilePreviewTable({ preview }: { preview: ImportPreviewResponse }) {
  const shownRows = preview.rows.slice(0, 8);
  return (
    <div className="border border-cc-border rounded-lg p-3 mb-3">
      <div className="font-semibold mb-2">File Preview ({preview.sample_count} sampled rows)</div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {preview.headers.map((header) => (
                <TableHead key={header}>{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shownRows.map((row, idx) => (
              <TableRow key={`preview-row-${idx}`}>
                {preview.headers.map((header) => (
                  <TableCell key={`${idx}-${header}`}>{row[header] ?? ''}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
    <div className="border border-cc-border rounded-lg p-3 mb-3">
      <div className="font-semibold mb-2">Event Mapping</div>
      <Label>Event Column</Label>
      <Select value={props.eventColumn} onValueChange={props.onEventColumnChange}>
        <SelectTrigger className="mt-1 mb-2">
          <SelectValue placeholder="Select column" />
        </SelectTrigger>
        <SelectContent>
          {props.headers.map((header) => (
            <SelectItem key={header} value={header}>
              {header}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {props.eventValues.map((rawValue) => (
        <div key={rawValue} className="grid grid-cols-2 gap-2 items-center mb-2">
          <code>{rawValue}</code>
          <Select
            value={props.mappings[rawValue] ?? 'other'}
            onValueChange={(v) =>
              props.onEventMapChange(rawValue, v as ImportMappingConfig['event_values'][string])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CANONICAL_EVENTS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
    <div className="border border-cc-border rounded-lg p-3 mb-3">
      <div className="font-semibold mb-2">Schema Field Mapping</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="text-[15px] font-semibold">Trip Fields</h4>
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
        <div>
          <h4 className="text-[15px] font-semibold">Route Fields</h4>
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
  const tripGrouping = props.matchRules.trip_grouping;
  const tripRouteJoin = props.matchRules.trip_route_join;
  return (
    <>
      <div className="border border-cc-border rounded-lg p-3 mb-3">
        <div className="font-semibold mb-2">Trip Grouping</div>
        <div className="mb-2">Grouping keys (supports one or multiple columns)</div>
        {TRIP_FIELD_OPTIONS.map((key) => (
          <CheckField
            key={`trip-key-${key}`}
            label={key}
            checked={tripGrouping.keys.includes(key)}
            onChange={(checked) =>
              props.onMatchRulesChange({
                ...props.matchRules,
                trip_grouping: {
                  ...tripGrouping,
                  keys: checked
                    ? [...tripGrouping.keys, key]
                    : tripGrouping.keys.filter((current) => current !== key),
                },
              })
            }
          />
        ))}
        <SelectField
          label="Pickup Key Field"
          value={tripGrouping.pickup_key_field}
          options={TRIP_FIELD_OPTIONS}
          onChange={(value) =>
            props.onMatchRulesChange({
              ...props.matchRules,
              trip_grouping: { ...tripGrouping, pickup_key_field: value as keyof TripRow },
            })
          }
        />
        <SelectField
          label="Dropoff Key Field"
          value={tripGrouping.dropoff_key_field}
          options={TRIP_FIELD_OPTIONS}
          onChange={(value) =>
            props.onMatchRulesChange({
              ...props.matchRules,
              trip_grouping: { ...tripGrouping, dropoff_key_field: value as keyof TripRow },
            })
          }
        />
      </div>
      <div className="border border-cc-border rounded-lg p-3 mb-3">
        <div className="font-semibold mb-2">Trip / Route Join</div>
        <div className="mb-2">Join columns (default: date + route_id)</div>
        {[
          { trip_field: 'trip_date' as keyof TripRow, route_field: 'route_date' as keyof RouteRow, label: 'Date' },
          { trip_field: 'route_id' as keyof TripRow, route_field: 'route_id' as keyof RouteRow, label: 'Route ID' },
          { trip_field: 'trip_id' as keyof TripRow, route_field: 'route_name' as keyof RouteRow, label: 'Trip ID -> Route Name' },
        ].map((joinOption) => (
          <CheckField
            key={`join-col-${joinOption.trip_field}-${joinOption.route_field}`}
            label={joinOption.label}
            checked={tripRouteJoin.join_columns.some(
              (column) =>
                column.trip_field === joinOption.trip_field && column.route_field === joinOption.route_field,
            )}
            onChange={(checked) => {
              const nextJoinColumns = checked
                ? [...tripRouteJoin.join_columns, { trip_field: joinOption.trip_field, route_field: joinOption.route_field }]
                : tripRouteJoin.join_columns.filter(
                    (column) =>
                      !(
                        column.trip_field === joinOption.trip_field &&
                        column.route_field === joinOption.route_field
                      ),
                  );
              props.onMatchRulesChange({
                ...props.matchRules,
                trip_route_join: {
                  ...tripRouteJoin,
                  join_columns: nextJoinColumns,
                },
              });
            }}
          />
        ))}
      </div>
    </>
  );
}

function ImportReviewSummary(props: {
  validateResult: ImportValidateResponse;
  applyResult: (ImportApplyResponse & { trip_count: number; route_count: number }) | null;
}) {
  return (
    <div className="border border-cc-border rounded-lg p-3 mb-3">
      <div className="font-semibold mb-2">Review Summary</div>
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
        <div className="mt-2">
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
    <div className="border border-cc-border rounded-lg p-3 mb-3">
      <div className="flex justify-between items-center mb-2">
        <div className="font-semibold">Template Manager</div>
        <Button variant="outline" size="sm" type="button" onClick={props.onRefresh}>
          Refresh
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
        <Input
          placeholder="Template Name"
          value={props.templateName}
          onChange={(event) => props.onTemplateNameChange(event.target.value)}
          disabled={props.readonlyView}
        />
        <Input
          placeholder="Source System"
          value={props.sourceSystem}
          onChange={(event) => props.onSourceSystemChange(event.target.value)}
          disabled={props.readonlyView}
        />
        <Button variant="outline" className="w-full" type="button" onClick={props.onSave} disabled={props.readonlyView}>
          Save Template
        </Button>
      </div>
      <textarea
        className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mb-2"
        rows={2}
        placeholder="Notes"
        value={props.notes}
        onChange={(event) => props.onNotesChange(event.target.value)}
        disabled={props.readonlyView}
      />
      <div className="max-h-[240px] overflow-auto">
        {props.templates.map((template) => (
          <div
            key={template.id}
            className="border border-cc-border rounded-md p-2 mb-1.5"
          >
            <div className="font-semibold">{template.template_name}</div>
            <div className="text-xs text-cc-text-muted">{template.source_system}</div>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" size="sm" type="button" onClick={() => props.onLoad(template)}>
                Load
              </Button>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() =>
                  setInfoTemplateId((current) => (current === template.id ? null : template.id))
                }
              >
                Info
              </Button>
              {!props.readonlyView && (
                <Button variant="destructive" size="sm" type="button" onClick={() => props.onDelete(template.id)}>
                  Delete
                </Button>
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
    <div className="border-t border-cc-border mt-2 pt-2">
      <div className="text-xs text-cc-text-muted mb-1">
        Event column: <code>{info.eventColumn}</code>
      </div>
      <div className="text-xs text-cc-text-secondary mb-1.5">
        Notes: {info.notes}
      </div>
      <div className="text-xs font-semibold">Expected field mappings</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <div className="text-xs text-cc-text-muted mt-1">Trip</div>
          <ul className="mb-1">
            {info.tripMappings.length === 0 && <li className="text-xs">No trip mappings saved.</li>}
            {info.tripMappings.map((item) => (
              <li key={`trip-map-${item.target}`} className="text-xs">
                <code>{item.target}</code> &larr; <code>{item.source}</code>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-xs text-cc-text-muted mt-1">Route</div>
          <ul className="mb-1">
            {info.routeMappings.length === 0 && <li className="text-xs">No route mappings saved.</li>}
            {info.routeMappings.map((item) => (
              <li key={`route-map-${item.target}`} className="text-xs">
                <code>{item.target}</code> &larr; <code>{item.source}</code>
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
      <Label>{label}</Label>
      <Select value={value || '__not_mapped__'} onValueChange={(v) => onChange(v === '__not_mapped__' ? '' : v)}>
        <SelectTrigger className="mt-1">
          <SelectValue placeholder="Not mapped" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__not_mapped__">Not mapped</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
    <div className="flex items-center gap-2 mb-1">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
      />
      <Label className="font-normal">{label}</Label>
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

function includesHeader(headers: string[], candidate: string): boolean {
  const normalizedCandidate = candidate.trim().toLowerCase();
  if (!normalizedCandidate) {
    return false;
  }
  return headers.some((header) => header.trim().toLowerCase() === normalizedCandidate);
}

function parseMatchRules(rawJson: string): ImportMappingConfig['match_rules'] {
  const defaults = emptyConfig().match_rules;
  const parsed = JSON.parse(rawJson) as
    | ImportMappingConfig['match_rules']
    | {
        trip_keys?: string[];
        route_keys?: string[];
      };

  const maybeNewShape = parsed as ImportMappingConfig['match_rules'];
  if (maybeNewShape?.trip_grouping && maybeNewShape?.trip_route_join) {
    return {
      trip_grouping: {
        keys: maybeNewShape.trip_grouping.keys?.length
          ? maybeNewShape.trip_grouping.keys
          : defaults.trip_grouping.keys,
        pickup_key_field:
          maybeNewShape.trip_grouping.pickup_key_field ?? defaults.trip_grouping.pickup_key_field,
        dropoff_key_field:
          maybeNewShape.trip_grouping.dropoff_key_field ?? defaults.trip_grouping.dropoff_key_field,
      },
      trip_route_join: {
        join_columns: maybeNewShape.trip_route_join.join_columns?.length
          ? maybeNewShape.trip_route_join.join_columns
          : defaults.trip_route_join.join_columns,
      },
    };
  }

  const legacy = parsed as {
    trip_keys?: string[];
    route_keys?: string[];
  };
  const legacyTripKeys = (legacy.trip_keys ?? []).filter((key): key is keyof TripRow =>
    (TRIP_FIELD_OPTIONS as string[]).includes(key),
  );
  const legacyRouteKeys = new Set(legacy.route_keys ?? []);

  const joinColumns: Array<{ trip_field: keyof TripRow; route_field: keyof RouteRow }> = [];
  if (legacyRouteKeys.has('route_id')) {
    joinColumns.push({ trip_field: 'route_id', route_field: 'route_id' });
  }
  if (legacyRouteKeys.has('route_date') || legacyRouteKeys.has('scheduled_start_time')) {
    joinColumns.push({ trip_field: 'trip_date', route_field: 'route_date' });
  }

  return {
    trip_grouping: {
      keys: legacyTripKeys.length > 0 ? legacyTripKeys : defaults.trip_grouping.keys,
      pickup_key_field: 'trip_id',
      dropoff_key_field: 'trip_id',
    },
    trip_route_join: {
      join_columns: joinColumns.length > 0 ? joinColumns : defaults.trip_route_join.join_columns,
    },
  };
}
