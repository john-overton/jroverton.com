'use client';

import { ChevronDown, ChevronRight, CircleHelp, Pencil, Plus, Save, Trash2, Wand2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

// import ImportMapperWizard from '@/app/parallax/components/ui/ImportMapperWizard';
import { Button } from '@/app/parallax/components/shadcn/button';
import { Checkbox } from '@/app/parallax/components/shadcn/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/app/parallax/components/shadcn/collapsible';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/app/parallax/components/shadcn/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/parallax/components/shadcn/dialog';
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
import type { ImportResponse } from '@/lib/parallax/client';
import { extractNewDepotsFromRoutes } from '@/lib/parallax/depot-utils';
import type { ClearcutMetrics } from '@/lib/parallax/metrics';
import type {
  DepotRow,
  ImportApplyResponse,
  ImportMappingConfig,
  ImportPreviewResponse,
  ImportTemplateRecord,
  ImportValidateResponse,
  RouteRow,
  SessionState,
  TripRow,
} from '@/lib/parallax/types';

import { SectionCard } from './shared';

function SettingLabel({ children, tip }: { children: React.ReactNode; tip: string }) {
  return (
    <Label className="text-xs text-cc-text-muted mb-1 inline-flex items-center gap-1">
      {children}
      <span className="relative group cursor-help">
        <CircleHelp size={12} className="text-cc-text-muted" />
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 p-1.5 rounded-md bg-cc-surface-1 border border-cc-border shadow-lg text-[11px] text-cc-text-secondary leading-snug hidden group-hover:block">
          {tip}
        </span>
      </span>
    </Label>
  );
}

function InfoLabel({ children, tip }: { children: React.ReactNode; tip: string }) {
  return (
    <div className="text-[13px] text-cc-text-muted inline-flex items-center gap-1">
      {children}
      <span className="relative group cursor-help">
        <CircleHelp size={12} className="text-cc-text-muted" />
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 p-1.5 rounded-md bg-cc-surface-1 border border-cc-border shadow-lg text-[11px] text-cc-text-secondary leading-snug hidden group-hover:block">
          {tip}
        </span>
      </span>
    </div>
  );
}

function ColumnSelectorDropdown<K extends string>({
  columns,
  visibleColumns,
  onToggle,
}: {
  columns: Array<{ key: K; label: string }>;
  visibleColumns: Record<K, boolean>;
  onToggle: (key: K, value: boolean) => void;
}) {
  const visibleCount = columns.filter((c) => visibleColumns[c.key]).length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" type="button" className="text-xs">
          Columns ({visibleCount}/{columns.length}) <ChevronDown size={14} className="ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.key}
            checked={visibleColumns[column.key]}
            onCheckedChange={(v) => onToggle(column.key, v === true)}
            onSelect={(e) => e.preventDefault()}
          >
            {column.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type TripDataColumnKey =
  | 'trip_id'
  | 'trip_date'
  | 'route_id'
  | 'scheduled_pickup_time'
  | 'scheduled_appointment_time'
  | 'pickup_arrive_time'
  | 'pickup_leave_time'
  | 'dropoff_arrive_time'
  | 'dropoff_leave_time'
  | 'pickup_address'
  | 'pickup_lat'
  | 'pickup_lon'
  | 'dropoff_address'
  | 'dropoff_lat'
  | 'dropoff_lon'
  | 'status'
  | 'passenger_type'
  | 'passenger_count'
  | 'pick_odometer'
  | 'drop_odometer';
type RouteDataColumnKey =
  | 'route_id'
  | 'route_name'
  | 'scheduled_start_time'
  | 'scheduled_end_time'
  | 'actual_start_time'
  | 'actual_end_time'
  | 'break1_start'
  | 'break1_end'
  | 'break2_start'
  | 'break2_end'
  | 'depot_address'
  | 'depot_lat'
  | 'depot_lon'
  | 'distance_to_first_pick'
  | 'distance_from_last_drop';

const TRIP_DATA_PAGE_SIZE = 10;
const ROUTE_DATA_PAGE_SIZE = 10;

const TRIP_DATA_COLUMNS: Array<{
  key: TripDataColumnKey;
  label: string;
  getValue: (trip: TripRow) => string | null;
}> = [
  { key: 'trip_id', label: 'Trip ID', getValue: (trip) => trip.trip_id },
  { key: 'trip_date', label: 'Trip Date', getValue: (trip) => trip.trip_date ?? '-' },
  { key: 'route_id', label: 'Route', getValue: (trip) => trip.route_id },
  { key: 'scheduled_pickup_time', label: 'Sched. Pickup', getValue: (trip) => trip.scheduled_pickup_time },
  { key: 'scheduled_appointment_time', label: 'Sched. Appt.', getValue: (trip) => trip.scheduled_appointment_time ?? '-' },
  { key: 'pickup_arrive_time', label: 'Pickup Arrive', getValue: (trip) => trip.pickup_arrive_time ?? '-' },
  { key: 'pickup_leave_time', label: 'Pickup Leave', getValue: (trip) => trip.pickup_leave_time ?? '-' },
  { key: 'dropoff_arrive_time', label: 'Dropoff Arrive', getValue: (trip) => trip.dropoff_arrive_time ?? '-' },
  { key: 'dropoff_leave_time', label: 'Dropoff Leave', getValue: (trip) => trip.dropoff_leave_time ?? '-' },
  { key: 'pickup_address', label: 'Pickup Address', getValue: (trip) => trip.pickup_address ?? '-' },
  { key: 'pickup_lat', label: 'Pickup Lat', getValue: (trip) => trip.pickup_lat ?? '-' },
  { key: 'pickup_lon', label: 'Pickup Lon', getValue: (trip) => trip.pickup_lon ?? '-' },
  { key: 'dropoff_address', label: 'Dropoff Address', getValue: (trip) => trip.dropoff_address ?? '-' },
  { key: 'dropoff_lat', label: 'Dropoff Lat', getValue: (trip) => trip.dropoff_lat ?? '-' },
  { key: 'dropoff_lon', label: 'Dropoff Lon', getValue: (trip) => trip.dropoff_lon ?? '-' },
  { key: 'status', label: 'Status', getValue: (trip) => trip.status },
  { key: 'passenger_type', label: 'Passenger Type', getValue: (trip) => trip.passenger_type },
  { key: 'passenger_count', label: 'Passengers', getValue: (trip) => trip.passenger_count ?? '-' },
  { key: 'pick_odometer', label: 'Pick Odometer', getValue: (trip) => trip.pick_odometer ?? '-' },
  { key: 'drop_odometer', label: 'Drop Odometer', getValue: (trip) => trip.drop_odometer ?? '-' },
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
  { key: 'break1_start', label: 'Break 1 Start', getValue: (route) => route.break1_start ?? '-' },
  { key: 'break1_end', label: 'Break 1 End', getValue: (route) => route.break1_end ?? '-' },
  { key: 'break2_start', label: 'Break 2 Start', getValue: (route) => route.break2_start ?? '-' },
  { key: 'break2_end', label: 'Break 2 End', getValue: (route) => route.break2_end ?? '-' },
  { key: 'depot_address', label: 'Depot Address', getValue: (route) => route.depot_address ?? '-' },
  { key: 'depot_lat', label: 'Depot Lat', getValue: (route) => route.depot_lat ?? '-' },
  { key: 'depot_lon', label: 'Depot Lon', getValue: (route) => route.depot_lon ?? '-' },
  { key: 'distance_to_first_pick', label: 'Dist to 1st Pick', getValue: (route) => route.distance_to_first_pick ?? '-' },
  { key: 'distance_from_last_drop', label: 'Dist from Last Drop', getValue: (route) => route.distance_from_last_drop ?? '-' },
];

interface ImportTabProps {
  readonlyView: boolean;
  state: SessionState;
  metrics: ClearcutMetrics;
  session: {
    uploadTrips: (file: File) => Promise<ImportResponse | undefined>;
    uploadRoutes: (file: File) => Promise<ImportResponse | undefined>;
    uploadNewRoutes: (file: File) => Promise<ImportResponse | undefined>;
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
    changes: Partial<Record<
      | 'pickup_otp_window_before_min'
      | 'pickup_otp_window_after_min'
      | 'dropoff_otp_window_before_min'
      | 'dropoff_otp_window_after_min',
      number
    >>,
  ) => void;
  depots: DepotRow[];
  onDepotsChange: (depots: DepotRow[]) => void;
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
  depots,
  onDepotsChange,
}: ImportTabProps) {
  const [tripsOpen, setTripsOpen] = useState(false);
  const [routesOpen, setRoutesOpen] = useState(false);
  const [tripPage, setTripPage] = useState(1);
  const [routePage, setRoutePage] = useState(1);
  const [flatImportLog, setFlatImportLog] = useState<{
    trips: Array<{ row: number; reason: string }>;
    routes: Array<{ row: number; reason: string }>;
    newRoutes?: Array<{ row: number; reason: string }>;
  } | null>(null);
  const [showFlatImportLog, setShowFlatImportLog] = useState(false);
  const [tripVisibleColumns, setTripVisibleColumns] = useState<Record<TripDataColumnKey, boolean>>({
    trip_id: true,
    trip_date: true,
    route_id: true,
    scheduled_pickup_time: true,
    scheduled_appointment_time: true,
    pickup_arrive_time: true,
    pickup_leave_time: true,
    dropoff_arrive_time: true,
    dropoff_leave_time: true,
    pickup_address: true,
    pickup_lat: true,
    pickup_lon: true,
    dropoff_address: true,
    dropoff_lat: true,
    dropoff_lon: true,
    status: true,
    passenger_type: true,
    passenger_count: true,
    pick_odometer: true,
    drop_odometer: true,
  });
  const [routeVisibleColumns, setRouteVisibleColumns] = useState<Record<RouteDataColumnKey, boolean>>({
    route_id: true,
    route_name: true,
    scheduled_start_time: true,
    scheduled_end_time: true,
    actual_start_time: true,
    actual_end_time: true,
    break1_start: true,
    break1_end: true,
    break2_start: true,
    break2_end: true,
    depot_address: true,
    depot_lat: true,
    depot_lon: true,
    distance_to_first_pick: true,
    distance_from_last_drop: true,
  });

  // ── Debounced OTP settings ─────────────────────────────────────────
  type OtpKey = 'pickup_otp_window_before_min' | 'pickup_otp_window_after_min'
    | 'dropoff_otp_window_before_min' | 'dropoff_otp_window_after_min';
  const OTP_KEYS: OtpKey[] = [
    'pickup_otp_window_before_min', 'pickup_otp_window_after_min',
    'dropoff_otp_window_before_min', 'dropoff_otp_window_after_min',
  ];
  const [localOtp, setLocalOtp] = useState<Record<OtpKey, string>>({
    pickup_otp_window_before_min: String(state.settings.pickup_otp_window_before_min),
    pickup_otp_window_after_min: String(state.settings.pickup_otp_window_after_min),
    dropoff_otp_window_before_min: String(state.settings.dropoff_otp_window_before_min),
    dropoff_otp_window_after_min: String(state.settings.dropoff_otp_window_after_min),
  });
  const otpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const otpDirty = useRef<Set<OtpKey>>(new Set());
  // Values we flushed to parent but parent state hasn't confirmed yet
  const otpPending = useRef<Partial<Record<OtpKey, number>>>({});

  // Sync local state when settings change externally, but only for fields
  // the user isn't actively editing and that aren't waiting on a pending save
  useEffect(() => {
    setLocalOtp((prev) => {
      const next = { ...prev };
      for (const k of OTP_KEYS) {
        // Clear pending once parent state catches up
        if (k in otpPending.current && state.settings[k] === otpPending.current[k]) {
          delete otpPending.current[k];
        }
        // Only sync from parent if not dirty and not pending
        if (!otpDirty.current.has(k) && !(k in otpPending.current)) {
          next[k] = String(state.settings[k]);
        }
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.settings.pickup_otp_window_before_min,
    state.settings.pickup_otp_window_after_min,
    state.settings.dropoff_otp_window_before_min,
    state.settings.dropoff_otp_window_after_min,
  ]);

  const handleOtpChange = useCallback(
    (key: OtpKey, raw: string) => {
      setLocalOtp((prev) => ({ ...prev, [key]: raw }));
      otpDirty.current.add(key);
      if (otpTimer.current) clearTimeout(otpTimer.current);
      otpTimer.current = setTimeout(() => {
        // Flush all dirty fields in one batch call
        setLocalOtp((prev) => {
          const changes: Partial<Record<OtpKey, number>> = {};
          const next = { ...prev };
          for (const k of otpDirty.current) {
            const num = Number(prev[k]) || 0;
            changes[k] = num;
            next[k] = String(num);
          }
          otpDirty.current.clear();
          otpPending.current = { ...otpPending.current, ...changes };
          onOtpWindowChange(changes);
          return next;
        });
      }, 2000);
    },
    [onOtpWindowChange],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (otpTimer.current) clearTimeout(otpTimer.current);
    };
  }, []);

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

  function downloadSampleCsv(kind: 'trips' | 'routes' | 'new_routes') {
    const tripSample = [
      'trip_id,trip_date,scheduled_pickup_time,scheduled_appointment_time,pickup_arrive_time,pickup_leave_time,dropoff_arrive_time,dropoff_leave_time,route_id,pickup_address,pickup_lat,pickup_lon,dropoff_address,dropoff_lat,dropoff_lon,status,passenger_type,passenger_count,pick_odometer,drop_odometer',
      'TRIP-001,2026-02-01,2026-02-01 08:00:00,2026-02-01 08:30:00,2026-02-01 07:58:00,2026-02-01 08:02:00,2026-02-01 08:27:00,2026-02-01 08:31:00,ROUTE-001,123 Main St,40.7128,-74.0060,456 Oak Ave,40.7580,-73.9855,completed,ambulatory,1,1000,1010',
      'TRIP-002,2026-02-01,2026-02-01 09:15:00,2026-02-01 09:45:00,,,,,ROUTE-001,789 Elm Blvd,40.7484,-73.9856,321 Pine St,40.7614,-73.9776,scheduled,wheelchair,1,,',
      '',
      '# DATA TYPES: TEXT,DATE,DATETIME,DATETIME,DATETIME,DATETIME,DATETIME,DATETIME,TEXT,TEXT,DECIMAL,DECIMAL,TEXT,DECIMAL,DECIMAL,TEXT,ENUM,INTEGER,DECIMAL,DECIMAL',
      '# REQUIRED: yes,no,yes,no,no,no,no,no,yes,no,no,no,no,no,no,yes,no (default: ambulatory),no,no,no',
      '# ENUM VALUES for passenger_type: ambulatory | wheelchair | extra_large',
      '# DATETIME FORMAT: YYYY-MM-DD HH:MM:SS  |  DATE FORMAT: YYYY-MM-DD',
    ].join('\n');
    const routeSample = [
      'route_id,route_date,route_name,scheduled_start_time,scheduled_end_time,actual_start_time,actual_end_time,break1_start,break1_end,break2_start,break2_end,depot_address,depot_lat,depot_lon,distance_to_first_pick,distance_from_last_drop',
      'ROUTE-001,2026-02-01,North Loop,2026-02-01 07:30:00,2026-02-01 17:00:00,2026-02-01 07:35:00,2026-02-01 16:55:00,2026-02-01 11:00:00,2026-02-01 11:30:00,,,100 Depot Way,40.7128,-74.0060,3.2,4.5',
      'ROUTE-002,2026-02-01,South Loop,2026-02-01 06:00:00,2026-02-01 14:00:00,,,,,,,200 Base Rd,40.7484,-73.9856,,',
      '',
      '# DATA TYPES: TEXT,DATE,TEXT,DATETIME,DATETIME,DATETIME,DATETIME,DATETIME,DATETIME,DATETIME,DATETIME,TEXT,DECIMAL,DECIMAL,DECIMAL,DECIMAL',
      '# REQUIRED: yes,no,no,yes,yes,no,no,no,no,no,no,no,no,no,no,no',
      '# DATETIME FORMAT: YYYY-MM-DD HH:MM:SS  |  DATE FORMAT: YYYY-MM-DD',
    ].join('\n');
    const newRouteSample = [
      'new_route_name,start_time,end_time,service_days,depot_address,route_area,split_number,break_1_start,break_1_end,break_2_start,break_2_end',
      'North Loop,06:00,14:00,"M,T,W,Th,F",100 Depot Way,,0,10:00,10:30,,',
      'South Loop,14:00,22:00,"M,T,W,Th,F",100 Depot Way,,0,18:00,18:30,,',
      '',
      '# DATA TYPES: TEXT,TIME (HH:MM),TIME (HH:MM),TEXT (comma-separated),TEXT,TEXT,INTEGER,TIME (HH:MM),TIME (HH:MM),TIME (HH:MM),TIME (HH:MM)',
      '# REQUIRED: yes,yes,yes,no (default: M T W Th F),no,no,no (default: 0),no,no,no,no',
      '# SERVICE DAYS VALUES: M | T | W | Th | F | Sa | Su',
    ].join('\n');

    const content = kind === 'trips' ? tripSample : kind === 'routes' ? routeSample : newRouteSample;
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = kind === 'trips' ? 'parallax-flat-trip-sample.csv' : kind === 'routes' ? 'parallax-flat-route-sample.csv' : 'parallax-flat-new-route-sample.csv';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <SectionCard title="Data Import">
        <div className="text-[13px] text-cc-text-secondary mb-4 bg-cc-surface-2 border border-cc-border rounded-lg px-4 py-3 leading-relaxed">
          Upload past route and trip data to analyze demand or build a new route structure based on existing routes (trip data is not required). If you already have a new route structure you want to modify or break into bids, you can upload that directly.
        </div>
        <FlatFileImport
          readonlyView={readonlyView}
          onDownloadSample={downloadSampleCsv}
          onImport={async (tripFile, routeFile, newRouteFile) => {
            if (readonlyView) return;
            setStatus('Importing files...');
            setError(null);
            setFlatImportLog(null);
            try {
              const skippedMessages: string[] = [];
              let routeSkipped: Array<{ row: number; reason: string }> = [];
              let tripSkipped: Array<{ row: number; reason: string }> = [];
              let newRouteSkipped: Array<{ row: number; reason: string }> = [];
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
              if (newRouteFile) {
                const newRouteResult = await session.uploadNewRoutes(newRouteFile);
                if (newRouteResult?.skipped_rows?.length) {
                  skippedMessages.push(`${newRouteResult.skipped_rows.length} new route row(s) skipped.`);
                  newRouteSkipped = newRouteResult.skipped_rows;
                }
              }
              if (routeSkipped.length > 0 || tripSkipped.length > 0 || newRouteSkipped.length > 0) {
                setFlatImportLog({ routes: routeSkipped, trips: tripSkipped, newRoutes: newRouteSkipped });
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
        {!readonlyView && (
          <Button variant="outline" className="mt-3" onClick={onLoadDemo} type="button">
            Load Demo Dataset
          </Button>
        )}
      </SectionCard>

      <DepotSettings
        readonlyView={readonlyView}
        routes={state.routes}
        depots={depots}
        onDepotsChange={onDepotsChange}
      />

      <SectionCard title="System Settings">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <InfoLabel tip="Auto-derived from imported data with a 30-minute buffer before the earliest trip or shift start.">Derived Service Start</InfoLabel>
            <div className="font-semibold">{metrics.derivedServiceWindow.startLabel}</div>
          </div>
          <div>
            <InfoLabel tip="Auto-derived from imported data with a 30-minute buffer after the latest trip or shift end.">Derived Service End</InfoLabel>
            <div className="font-semibold">{metrics.derivedServiceWindow.endLabel}</div>
          </div>
          <div>
            <InfoLabel tip="Total hours between the derived service start and end times.">Service Hours</InfoLabel>
            <div className="font-semibold">
              {metrics.derivedServiceWindow.isTwentyFourHours
                ? '24:00'
                : metrics.derivedServiceWindow.durationLabel}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <div>
            <InfoLabel tip="The earliest actual or scheduled time found across all imported trips and routes.">Earliest Data Time</InfoLabel>
            <div className="font-semibold">
              {metrics.derivedServiceWindow.earliestDataTime ?? 'No trip data'}
            </div>
          </div>
          <div>
            <InfoLabel tip="The latest actual or scheduled time found across all imported trips and routes.">Latest Data Time</InfoLabel>
            <div className="font-semibold">
              {metrics.derivedServiceWindow.latestDataTime ?? 'No trip data'}
            </div>
          </div>
        </div>
        <hr className="my-3 border-cc-border" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <SettingLabel tip="Minutes before the scheduled pickup time that still counts as on-time.">Pickup OTP: before</SettingLabel>
            <Input
              type="number"
              min={0}
              max={180}
              step={1}
              disabled={readonlyView}
              value={localOtp.pickup_otp_window_before_min}
              onChange={(event) =>
                handleOtpChange('pickup_otp_window_before_min', event.target.value)
              }
            />
          </div>
          <div>
            <SettingLabel tip="Minutes after the scheduled pickup time that still counts as on-time.">Pickup OTP: after</SettingLabel>
            <Input
              type="number"
              min={0}
              max={180}
              step={1}
              disabled={readonlyView}
              value={localOtp.pickup_otp_window_after_min}
              onChange={(event) =>
                handleOtpChange('pickup_otp_window_after_min', event.target.value)
              }
            />
          </div>
          <div>
            <SettingLabel tip="Minutes before the scheduled dropoff time that still counts as on-time.">Dropoff OTP: before</SettingLabel>
            <Input
              type="number"
              min={0}
              max={180}
              step={1}
              disabled={readonlyView}
              value={localOtp.dropoff_otp_window_before_min}
              onChange={(event) =>
                handleOtpChange('dropoff_otp_window_before_min', event.target.value)
              }
            />
          </div>
          <div>
            <SettingLabel tip="Minutes after the scheduled dropoff time that still counts as on-time.">Dropoff OTP: after</SettingLabel>
            <Input
              type="number"
              min={0}
              max={180}
              step={1}
              disabled={readonlyView}
              value={localOtp.dropoff_otp_window_after_min}
              onChange={(event) =>
                handleOtpChange('dropoff_otp_window_after_min', event.target.value)
              }
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Data Views">
        <Collapsible open={tripsOpen} onOpenChange={setTripsOpen} className="mb-3">
          <CollapsibleTrigger className="flex items-center gap-1.5 bg-transparent border-none p-0 cursor-pointer text-sm font-semibold w-full">
            <ChevronRight
              size={14}
              className="transition-transform duration-150 data-[state=open]:rotate-90"
              data-state={tripsOpen ? 'open' : 'closed'}
            />
            Trips ({state.trips.length})
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="overflow-x-auto mt-2">
              <div className="mb-3">
                <ColumnSelectorDropdown
                  columns={TRIP_DATA_COLUMNS}
                  visibleColumns={tripVisibleColumns}
                  onToggle={(key, value) =>
                    setTripVisibleColumns((prev) => ({ ...prev, [key]: value }))
                  }
                />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    {activeTripColumns.map((column) => (
                      <TableHead key={`trip-col-head-${column.key}`}>{column.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tripPageRows.map((trip) => (
                    <TableRow key={`trip-view-${trip.trip_id}-${trip.route_id}`}>
                      {activeTripColumns.map((column) => (
                        <TableCell key={`trip-row-${trip.trip_id}-${column.key}`}>
                          {column.getValue(trip) ?? '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {state.trips.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={Math.max(activeTripColumns.length, 1)} className="text-cc-text-muted">
                        No trips available.
                      </TableCell>
                    </TableRow>
                  )}
                  {state.trips.length > 0 && activeTripColumns.length === 0 && (
                    <TableRow>
                      <TableCell className="text-cc-text-muted">Select at least one column.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {state.trips.length > 0 && (
                <div className="flex items-center justify-between mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    disabled={currentTripPage <= 1}
                    onClick={() => setTripPage((prev) => Math.max(1, prev - 1))}
                  >
                    Previous
                  </Button>
                  <div className="text-[13px]">
                    Page {currentTripPage} of {tripTotalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    disabled={currentTripPage >= tripTotalPages}
                    onClick={() => setTripPage((prev) => Math.min(tripTotalPages, prev + 1))}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible open={routesOpen} onOpenChange={setRoutesOpen}>
          <CollapsibleTrigger className="flex items-center gap-1.5 bg-transparent border-none p-0 cursor-pointer text-sm font-semibold w-full">
            <ChevronRight
              size={14}
              className="transition-transform duration-150 data-[state=open]:rotate-90"
              data-state={routesOpen ? 'open' : 'closed'}
            />
            Routes ({state.routes.length})
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="overflow-x-auto mt-2">
              <div className="mb-3">
                <ColumnSelectorDropdown
                  columns={ROUTE_DATA_COLUMNS}
                  visibleColumns={routeVisibleColumns}
                  onToggle={(key, value) =>
                    setRouteVisibleColumns((prev) => ({ ...prev, [key]: value }))
                  }
                />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    {activeRouteColumns.map((column) => (
                      <TableHead key={`route-col-head-${column.key}`}>{column.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {routePageRows.map((route) => (
                    <TableRow key={`route-view-${route.route_id}`}>
                      {activeRouteColumns.map((column) => (
                        <TableCell key={`route-row-${route.route_id}-${column.key}`}>
                          {column.getValue(route) ?? '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {state.routes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={Math.max(activeRouteColumns.length, 1)} className="text-cc-text-muted">
                        No routes available.
                      </TableCell>
                    </TableRow>
                  )}
                  {state.routes.length > 0 && activeRouteColumns.length === 0 && (
                    <TableRow>
                      <TableCell className="text-cc-text-muted">Select at least one column.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {state.routes.length > 0 && (
                <div className="flex items-center justify-between mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    disabled={currentRoutePage <= 1}
                    onClick={() => setRoutePage((prev) => Math.max(1, prev - 1))}
                  >
                    Previous
                  </Button>
                  <div className="text-[13px]">
                    Page {currentRoutePage} of {routeTotalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    disabled={currentRoutePage >= routeTotalPages}
                    onClick={() => setRoutePage((prev) => Math.min(routeTotalPages, prev + 1))}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </SectionCard>

      {flatImportLog && (flatImportLog.trips.length > 0 || flatImportLog.routes.length > 0) && (
        <p className="text-[13px]">
          Some rows were skipped during flat file import.{' '}
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => setShowFlatImportLog(true)}
          >
            View skipped row log
          </Button>
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
  onDownloadSample,
  onImport,
}: {
  readonlyView: boolean;
  onDownloadSample: (kind: 'trips' | 'routes' | 'new_routes') => void;
  onImport: (tripFile: File | null, routeFile: File | null, newRouteFile: File | null) => Promise<void>;
}) {
  const [tripFile, setTripFile] = useState<File | null>(null);
  const [routeFile, setRouteFile] = useState<File | null>(null);
  const [newRouteFile, setNewRouteFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const routeInputRef = useRef<HTMLInputElement>(null);
  const tripInputRef = useRef<HTMLInputElement>(null);
  const newRouteInputRef = useRef<HTMLInputElement>(null);
  const [routeDragOver, setRouteDragOver] = useState(false);
  const [tripDragOver, setTripDragOver] = useState(false);
  const [newRouteDragOver, setNewRouteDragOver] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [tripError, setTripError] = useState<string | null>(null);
  const [newRouteError, setNewRouteError] = useState<string | null>(null);

  function validateFile(file: File): { valid: true } | { valid: false; reason: string } {
    if (file.size === 0) return { valid: false, reason: 'File is empty (0 bytes).' };
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['csv', 'xlsx', 'xls'].includes(ext)) {
      return { valid: false, reason: `Unsupported file type ".${ext ?? ''}". Use .csv, .xlsx, or .xls.` };
    }
    return { valid: true };
  }

  function handleRouteFile(file: File | null) {
    if (!file) { setRouteFile(null); return; }
    const result = validateFile(file);
    if (!result.valid) {
      setRouteError(result.reason);
      setRouteFile(null);
      if (routeInputRef.current) routeInputRef.current.value = '';
      return;
    }
    setRouteError(null);
    setRouteFile(file);
  }

  function handleTripFile(file: File | null) {
    if (!file) { setTripFile(null); return; }
    const result = validateFile(file);
    if (!result.valid) {
      setTripError(result.reason);
      setTripFile(null);
      if (tripInputRef.current) tripInputRef.current.value = '';
      return;
    }
    setTripError(null);
    setTripFile(file);
  }

  function handleNewRouteFile(file: File | null) {
    if (!file) { setNewRouteFile(null); return; }
    const result = validateFile(file);
    if (!result.valid) {
      setNewRouteError(result.reason);
      setNewRouteFile(null);
      if (newRouteInputRef.current) newRouteInputRef.current.value = '';
      return;
    }
    setNewRouteError(null);
    setNewRouteFile(file);
  }

  async function handleImport() {
    if (readonlyView || (!tripFile && !routeFile && !newRouteFile)) return;
    setImporting(true);
    try {
      await onImport(tripFile, routeFile, newRouteFile);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-cc-border rounded-[10px] overflow-hidden">
          <div className="bg-cc-surface-2 px-4 py-2.5 flex items-center justify-between">
            <div className="font-semibold text-sm">Route File (CSV/XLSX)</div>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              className="text-xs text-cc-text-muted h-auto py-1"
              onClick={() => onDownloadSample('routes')}
            >
              Sample CSV
            </Button>
          </div>
          <div
            className={`p-4 transition-colors ${routeDragOver ? 'border-2 border-dashed border-cc-accent bg-cc-accent/5' : ''}`}
            style={{ background: readonlyView && !routeDragOver ? 'var(--color-cc-surface-2)' : undefined }}
            onDragOver={(e) => { e.preventDefault(); setRouteDragOver(true); }}
            onDragEnter={(e) => { e.preventDefault(); setRouteDragOver(true); }}
            onDragLeave={() => setRouteDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setRouteDragOver(false);
              if (readonlyView) return;
              handleRouteFile(e.dataTransfer.files[0] ?? null);
            }}
          >
            <input
              ref={routeInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              disabled={readonlyView}
              onChange={(event) => handleRouteFile(event.target.files?.[0] ?? null)}
            />
            <div className="flex border border-cc-border rounded-md overflow-hidden">
              <button
                type="button"
                disabled={readonlyView}
                className="shrink-0 bg-cc-accent text-white text-sm px-4 py-2 font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                onClick={() => routeInputRef.current?.click()}
              >
                Browse
              </button>
              <div className="flex-1 flex items-center px-3 text-sm text-cc-text-muted truncate bg-cc-surface-1">
                {routeFile ? <span className="text-cc-success truncate">{routeFile.name}</span> : 'No file selected — or drag & drop here'}
              </div>
            </div>
            {routeError && <div className="text-cc-danger text-[13px] mt-1.5">{routeError}</div>}
          </div>
        </div>
        <div className="border border-cc-border rounded-[10px] overflow-hidden">
          <div className="bg-cc-surface-2 px-4 py-2.5 flex items-center justify-between">
            <div className="font-semibold text-sm">Trip File (CSV/XLSX)</div>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              className="text-xs text-cc-text-muted h-auto py-1"
              onClick={() => onDownloadSample('trips')}
            >
              Sample CSV
            </Button>
          </div>
          <div
            className={`p-4 transition-colors ${tripDragOver ? 'border-2 border-dashed border-cc-accent bg-cc-accent/5' : ''}`}
            style={{ background: readonlyView && !tripDragOver ? 'var(--color-cc-surface-2)' : undefined }}
            onDragOver={(e) => { e.preventDefault(); setTripDragOver(true); }}
            onDragEnter={(e) => { e.preventDefault(); setTripDragOver(true); }}
            onDragLeave={() => setTripDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setTripDragOver(false);
              if (readonlyView) return;
              handleTripFile(e.dataTransfer.files[0] ?? null);
            }}
          >
            <input
              ref={tripInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              disabled={readonlyView}
              onChange={(event) => handleTripFile(event.target.files?.[0] ?? null)}
            />
            <div className="flex border border-cc-border rounded-md overflow-hidden">
              <button
                type="button"
                disabled={readonlyView}
                className="shrink-0 bg-cc-accent text-white text-sm px-4 py-2 font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                onClick={() => tripInputRef.current?.click()}
              >
                Browse
              </button>
              <div className="flex-1 flex items-center px-3 text-sm text-cc-text-muted truncate bg-cc-surface-1">
                {tripFile ? <span className="text-cc-success truncate">{tripFile.name}</span> : 'No file selected — or drag & drop here'}
              </div>
            </div>
            {tripError && <div className="text-cc-danger text-[13px] mt-1.5">{tripError}</div>}
          </div>
        </div>
        <div className="border border-cc-border rounded-[10px] overflow-hidden">
          <div className="bg-cc-surface-2 px-4 py-2.5 flex items-center justify-between">
            <div className="font-semibold text-sm">New Route File (CSV/XLSX)</div>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              className="text-xs text-cc-text-muted h-auto py-1"
              onClick={() => onDownloadSample('new_routes')}
            >
              Sample CSV
            </Button>
          </div>
          <div
            className={`p-4 transition-colors ${newRouteDragOver ? 'border-2 border-dashed border-cc-accent bg-cc-accent/5' : ''}`}
            style={{ background: readonlyView && !newRouteDragOver ? 'var(--color-cc-surface-2)' : undefined }}
            onDragOver={(e) => { e.preventDefault(); setNewRouteDragOver(true); }}
            onDragEnter={(e) => { e.preventDefault(); setNewRouteDragOver(true); }}
            onDragLeave={() => setNewRouteDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setNewRouteDragOver(false);
              if (readonlyView) return;
              handleNewRouteFile(e.dataTransfer.files[0] ?? null);
            }}
          >
            <input
              ref={newRouteInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              disabled={readonlyView}
              onChange={(event) => handleNewRouteFile(event.target.files?.[0] ?? null)}
            />
            <div className="flex border border-cc-border rounded-md overflow-hidden">
              <button
                type="button"
                disabled={readonlyView}
                className="shrink-0 bg-cc-accent text-white text-sm px-4 py-2 font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                onClick={() => newRouteInputRef.current?.click()}
              >
                Browse
              </button>
              <div className="flex-1 flex items-center px-3 text-sm text-cc-text-muted truncate bg-cc-surface-1">
                {newRouteFile ? <span className="text-cc-success truncate">{newRouteFile.name}</span> : 'No file selected — or drag & drop here'}
              </div>
            </div>
            {newRouteError && <div className="text-cc-danger text-[13px] mt-1.5">{newRouteError}</div>}
          </div>
        </div>
      </div>
      <Button
        className="mt-3"
        type="button"
        disabled={readonlyView || importing || (!tripFile && !routeFile && !newRouteFile)}
        onClick={handleImport}
      >
        {importing ? 'Importing...' : 'Import Files'}
      </Button>
      {!tripFile && !routeFile && !newRouteFile && (
        <div className="text-[13px] text-cc-text-muted mt-2">
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
    newRoutes?: Array<{ row: number; reason: string }>;
  };
}) {
  const hasTrips = props.log.trips.length > 0;
  const hasRoutes = props.log.routes.length > 0;
  const hasNewRoutes = (props.log.newRoutes?.length ?? 0) > 0;

  return (
    <Dialog open={props.show} onOpenChange={(open) => { if (!open) props.onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Flat Import Skipped Rows</DialogTitle>
        </DialogHeader>
        <div>
          <p className="text-[13px] text-cc-text-secondary">
            These rows were skipped during the most recent flat-file import. Row numbers correspond to the
            original CSV/XLSX (header is row 1).
          </p>
          {hasRoutes && (
            <div className="border border-cc-border rounded-lg p-3 mb-3">
              <div className="font-semibold mb-1.5">
                Route file skipped rows ({props.log.routes.length})
              </div>
              <ul className="mb-0 max-h-[220px] overflow-auto">
                {props.log.routes.map((err, idx) => (
                  <li key={`flat-route-error-${idx}`} className="text-[13px]">
                    Row {err.row}: {err.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {hasTrips && (
            <div className="border border-cc-border rounded-lg p-3 mb-3">
              <div className="font-semibold mb-1.5">
                Trip file skipped rows ({props.log.trips.length})
              </div>
              <ul className="mb-0 max-h-[220px] overflow-auto">
                {props.log.trips.map((err, idx) => (
                  <li key={`flat-trip-error-${idx}`} className="text-[13px]">
                    Row {err.row}: {err.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {hasNewRoutes && (
            <div className="border border-cc-border rounded-lg p-3 mb-3">
              <div className="font-semibold mb-1.5">
                New route file skipped rows ({props.log.newRoutes!.length})
              </div>
              <ul className="mb-0 max-h-[220px] overflow-auto">
                {props.log.newRoutes!.map((err, idx) => (
                  <li key={`flat-new-route-error-${idx}`} className="text-[13px]">
                    Row {err.row}: {err.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!hasTrips && !hasRoutes && !hasNewRoutes && (
            <p className="text-[13px] text-cc-text-muted">No skipped rows were reported for the last import.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Depot Settings component ────────────────────────────────────────

function DepotSettings({
  readonlyView,
  routes,
  depots,
  onDepotsChange,
}: {
  readonlyView: boolean;
  routes: RouteRow[];
  depots: DepotRow[];
  onDepotsChange: (depots: DepotRow[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DepotRow[]>(depots);

  // Sync draft when saved depots change from outside (e.g. page load)
  useEffect(() => {
    if (!editing) setDraft(depots);
  }, [depots, editing]);

  function extractFromRoutes() {
    const base = editing ? draft : depots;
    const newDepots = extractNewDepotsFromRoutes(routes, base);
    if (newDepots.length === 0) return;
    const updated = [...base, ...newDepots];
    setDraft(updated);
    if (!editing) setEditing(true);
  }

  function addCustomDepot() {
    const base = editing ? draft : depots;
    const newDepot: DepotRow = {
      depot_id: crypto.randomUUID(),
      depot_name: `Depot ${base.length + 1}`,
      depot_address: null,
      depot_lat: null,
      depot_lon: null,
    };
    const updated = [...base, newDepot];
    setDraft(updated);
    if (!editing) setEditing(true);
  }

  function updateDepotName(depotId: string, name: string) {
    setDraft((prev) => prev.map((d) => (d.depot_id === depotId ? { ...d, depot_name: name } : d)));
  }

  function deleteDepot(depotId: string) {
    setDraft((prev) => prev.filter((d) => d.depot_id !== depotId));
  }

  function handleSave() {
    onDepotsChange(draft);
    setEditing(false);
  }

  function handleCancel() {
    setDraft(depots);
    setEditing(false);
  }

  const displayDepots = editing ? draft : depots;

  return (
    <SectionCard title="Depot Settings">
      <div className="flex flex-col gap-2 mb-3">
        {!readonlyView && (
          <>
            <div className="flex items-center gap-2">
              {!editing && depots.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => { setDraft(depots); setEditing(true); }} type="button">
                  <Pencil size={14} className="mr-1.5" /> Edit Depots
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={extractFromRoutes} type="button">
                <Wand2 size={14} className="mr-1.5" /> Extract from Routes
              </Button>
              <Button variant="outline" size="sm" onClick={addCustomDepot} type="button">
                <Plus size={14} className="mr-1.5" /> Add Custom Depot
              </Button>
            </div>
            {editing && (
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleSave} type="button">
                  <Save size={14} className="mr-1.5" /> Save
                </Button>
                <Button variant="outline" size="sm" onClick={handleCancel} type="button">
                  <X size={14} className="mr-1.5" /> Cancel
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {displayDepots.length === 0 ? (
        <div className="text-xs text-cc-text-muted py-3">
          No depots configured. Extract from imported route data or add a custom depot.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[150px]">Name</TableHead>
              <TableHead className="min-w-[200px]">Address</TableHead>
              {editing && <TableHead className="min-w-[60px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayDepots.map((depot) => (
              <TableRow key={depot.depot_id}>
                <TableCell>
                  {editing ? (
                    <Input
                      value={depot.depot_name}
                      className="h-7 text-xs"
                      onChange={(e) => updateDepotName(depot.depot_id, e.target.value)}
                    />
                  ) : (
                    <span className="text-xs">{depot.depot_name}</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-cc-text-muted">
                  {depot.depot_address || '(custom)'}
                </TableCell>
                {editing && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-cc-danger"
                      onClick={() => deleteDepot(depot.depot_id)}
                      title="Delete depot"
                      type="button"
                    >
                      <Trash2 size={13} />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  );
}
