import type {
  AccessLevel,
  ApiErrorResponse,
  ApiSuccessResponse,
  ImportApplyResponse,
  ImportMappingConfig,
  ImportPreviewResponse,
  ImportTemplateRecord,
  ImportValidateResponse,
  OptimizationRow,
  RouteRow,
  SessionState,
  SessionStateUpdateInput,
  SettingsRow,
  TripRow,
} from './types';

export class ClearcutClientError extends Error {
  status: number;
  code: string;
  details?: unknown;
  retryAfterSeconds?: number;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  jwt?: string | null;
  formData?: FormData;
}

export interface CreateSessionResponse {
  session: {
    edit_token: string;
    readonly_token: string;
    name: string;
    created_at: string;
    updated_at: string;
    trip_count: number;
    route_count: number;
  };
  jwt: string;
}

export interface GetSessionResponse extends SessionState {
  jwt?: string;
}

export interface AuthSessionResponse {
  jwt: string;
  access: AccessLevel;
}

export interface CloneSessionResponse {
  session: {
    edit_token: string;
    readonly_token: string;
    name: string;
  };
  jwt: string;
}

export interface ImportResponse {
  imported: true;
  type: 'trips' | 'routes' | 'new_routes';
  trip_count: number;
  route_count: number;
  skipped_rows?: Array<{ row: number; reason: string }>;
  inserted_count?: number;
  updated_count?: number;
}

export interface ListTripsResponse {
  items: TripRow[];
  limit: number | null;
  offset: number | null;
  count: number;
}

export interface ListRoutesResponse {
  items: RouteRow[];
  count: number;
}

export interface ListTemplatesResponse {
  items: ImportTemplateRecord[];
  count: number;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const retryAfterHeader = response.headers.get('Retry-After');
  const retryAfterSeconds =
    retryAfterHeader && Number.isFinite(Number(retryAfterHeader))
      ? Number(retryAfterHeader)
      : undefined;
  const payload = (await response.json().catch(() => null)) as
    | ApiSuccessResponse<T>
    | ApiErrorResponse
    | null;

  if (!response.ok || !payload || !('ok' in payload) || !payload.ok) {
    const error = payload && 'error' in payload ? payload.error : undefined;
    throw new ClearcutClientError(
      response.status,
      error?.code ?? 'http_error',
      error?.message ?? `Request failed with status ${response.status}.`,
      error?.details,
      retryAfterSeconds,
    );
  }

  return payload.data;
}

async function request<T>(path: string, options?: RequestOptions): Promise<T> {
  const headers = new Headers();
  if (options?.jwt) {
    headers.set('Authorization', `Bearer ${options.jwt}`);
  }
  if (options?.body && !options.formData) {
    headers.set('Content-Type', 'application/json');
  }

  return parseResponse<T>(
    await fetch(path, {
      method: options?.method ?? 'GET',
      headers,
      body: options?.formData ?? (options?.body ? JSON.stringify(options.body) : undefined),
    }),
  );
}

export async function createSession(input?: {
  name?: string;
  password?: string;
  _hp?: string;
}): Promise<CreateSessionResponse> {
  return request<CreateSessionResponse>('/api/parallax/sessions', {
    method: 'POST',
    body: input ?? {},
  });
}

export async function getSession(token: string, jwt?: string | null): Promise<GetSessionResponse> {
  return request<GetSessionResponse>(`/api/parallax/sessions/${token}`, { jwt });
}

export async function updateSession(
  token: string,
  jwt: string,
  input: SessionStateUpdateInput,
): Promise<SessionState> {
  return request<SessionState>(`/api/parallax/sessions/${token}`, {
    method: 'PUT',
    body: input,
    jwt,
  });
}

export async function deleteSession(token: string, jwt: string): Promise<{ deleted: true }> {
  return request<{ deleted: true }>(`/api/parallax/sessions/${token}`, {
    method: 'DELETE',
    jwt,
  });
}

export async function authSession(token: string, password?: string): Promise<AuthSessionResponse> {
  return request<AuthSessionResponse>(`/api/parallax/sessions/${token}/auth`, {
    method: 'POST',
    body: { password },
  });
}

export async function renameSession(token: string, jwt: string, name: string): Promise<{ name: string }> {
  return request<{ name: string }>(`/api/parallax/sessions/${token}/name`, {
    method: 'PATCH',
    body: { name },
    jwt,
  });
}

export async function cloneSession(token: string, jwt: string): Promise<CloneSessionResponse> {
  return request<CloneSessionResponse>(`/api/parallax/sessions/${token}/clone`, {
    method: 'POST',
    jwt,
  });
}

export async function setSessionPassword(
  token: string,
  jwt: string,
  newPassword: string,
  currentPassword?: string,
): Promise<{ passwordProtected: true }> {
  return request<{ passwordProtected: true }>(`/api/parallax/sessions/${token}/password`, {
    method: 'PUT',
    body: { newPassword, currentPassword },
    jwt,
  });
}

export async function removeSessionPassword(
  token: string,
  jwt: string,
  currentPassword?: string,
): Promise<{ passwordProtected: false }> {
  return request<{ passwordProtected: false }>(`/api/parallax/sessions/${token}/password`, {
    method: 'DELETE',
    body: { currentPassword },
    jwt,
  });
}

export async function importTrips(token: string, jwt: string, file: File): Promise<ImportResponse> {
  const formData = new FormData();
  formData.set('file', file);
  return request<ImportResponse>(`/api/parallax/sessions/${token}/import/trips`, {
    method: 'POST',
    jwt,
    formData,
  });
}

export async function importRoutes(token: string, jwt: string, file: File): Promise<ImportResponse> {
  const formData = new FormData();
  formData.set('file', file);
  return request<ImportResponse>(`/api/parallax/sessions/${token}/import/routes`, {
    method: 'POST',
    jwt,
    formData,
  });
}

export async function importNewRoutes(token: string, jwt: string, file: File): Promise<ImportResponse> {
  const formData = new FormData();
  formData.set('file', file);
  return request<ImportResponse>(`/api/parallax/sessions/${token}/import/new-routes`, {
    method: 'POST',
    jwt,
    formData,
  });
}

export async function listTrips(
  token: string,
  jwt: string,
  pagination?: { limit?: number; offset?: number },
): Promise<ListTripsResponse> {
  const params = new URLSearchParams();
  if (typeof pagination?.limit === 'number') {
    params.set('limit', String(pagination.limit));
  }
  if (typeof pagination?.offset === 'number') {
    params.set('offset', String(pagination.offset));
  }
  const qs = params.size > 0 ? `?${params.toString()}` : '';
  return request<ListTripsResponse>(`/api/parallax/sessions/${token}/trips${qs}`, { jwt });
}

export async function listRoutes(token: string, jwt: string): Promise<ListRoutesResponse> {
  return request<ListRoutesResponse>(`/api/parallax/sessions/${token}/routes`, { jwt });
}

export async function saveSettings(
  token: string,
  jwt: string,
  settings: Partial<Omit<SettingsRow, 'id'>>,
): Promise<SessionState> {
  return updateSession(token, jwt, { settings });
}

export async function saveOptimization(
  token: string,
  jwt: string,
  optimization: Partial<Omit<OptimizationRow, 'id'>>,
): Promise<SessionState> {
  return updateSession(token, jwt, { optimization });
}

export async function previewImportFile(
  token: string,
  jwt: string,
  file: File,
  sheetName?: string,
): Promise<ImportPreviewResponse> {
  const formData = new FormData();
  formData.set('file', file);
  if (sheetName) {
    formData.set('sheet_name', sheetName);
  }
  return request<ImportPreviewResponse>(`/api/parallax/sessions/${token}/import/preview`, {
    method: 'POST',
    jwt,
    formData,
  });
}

export async function validateImportMappingConfig(
  token: string,
  jwt: string,
  preview: ImportPreviewResponse,
  config: ImportMappingConfig,
): Promise<ImportValidateResponse> {
  return request<ImportValidateResponse>(`/api/parallax/sessions/${token}/import/validate-mapping`, {
    method: 'POST',
    jwt,
    body: { preview, config },
  });
}

export async function applyImportMappingConfig(
  token: string,
  jwt: string,
  file: File,
  config: ImportMappingConfig,
  sheetName?: string,
): Promise<ImportApplyResponse & { trip_count: number; route_count: number }> {
  const formData = new FormData();
  formData.set('file', file);
  formData.set('config', JSON.stringify(config));
  if (sheetName) {
    formData.set('sheet_name', sheetName);
  }
  return request<ImportApplyResponse & { trip_count: number; route_count: number }>(
    `/api/parallax/sessions/${token}/import/apply`,
    {
      method: 'POST',
      jwt,
      formData,
    },
  );
}

export async function listImportTemplates(
  token: string,
  jwt: string,
): Promise<ListTemplatesResponse> {
  return request<ListTemplatesResponse>(`/api/parallax/import-templates`, { jwt });
}

export async function createImportTemplateRecord(
  token: string,
  jwt: string,
  input: {
    templateName: string;
    sourceSystem: string;
    notes?: string;
    config: ImportMappingConfig;
  },
): Promise<{ template: ImportTemplateRecord }> {
  return request<{ template: ImportTemplateRecord }>(`/api/parallax/import-templates`, {
    method: 'POST',
    jwt,
    body: {
      editToken: token,
      templateName: input.templateName,
      sourceSystem: input.sourceSystem,
      notes: input.notes ?? null,
      eventMappingJson: JSON.stringify({
        event_column: input.config.event_column,
        event_values: input.config.event_values,
      }),
      fieldMappingJson: JSON.stringify(input.config.field_mapping),
      matchRulesJson: JSON.stringify(input.config.match_rules),
    },
  });
}

export async function updateImportTemplateRecord(
  id: number,
  jwt: string,
  input: {
    templateName?: string;
    sourceSystem?: string;
    notes?: string | null;
    config?: ImportMappingConfig;
  },
): Promise<{ template: ImportTemplateRecord }> {
  return request<{ template: ImportTemplateRecord }>(`/api/parallax/import-templates/${id}`, {
    method: 'PATCH',
    jwt,
    body: {
      templateName: input.templateName,
      sourceSystem: input.sourceSystem,
      notes: input.notes,
      eventMappingJson: input.config
        ? JSON.stringify({
            event_column: input.config.event_column,
            event_values: input.config.event_values,
          })
        : undefined,
      fieldMappingJson: input.config ? JSON.stringify(input.config.field_mapping) : undefined,
      matchRulesJson: input.config ? JSON.stringify(input.config.match_rules) : undefined,
    },
  });
}

export async function deleteImportTemplateRecord(id: number, jwt: string): Promise<{ deleted: true }> {
  return request<{ deleted: true }>(`/api/parallax/import-templates/${id}`, {
    method: 'DELETE',
    jwt,
  });
}

export async function loadDemoData(token: string, jwt: string): Promise<SessionState> {
  return request<SessionState>(`/api/parallax/sessions/${token}/demo`, {
    method: 'POST',
    jwt,
  });
}
