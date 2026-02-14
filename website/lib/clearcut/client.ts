import type {
  AccessLevel,
  ApiErrorResponse,
  ApiSuccessResponse,
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
  type: 'trips' | 'routes';
  trip_count: number;
  route_count: number;
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
}): Promise<CreateSessionResponse> {
  return request<CreateSessionResponse>('/api/clearcut/sessions', {
    method: 'POST',
    body: input ?? {},
  });
}

export async function getSession(token: string, jwt?: string | null): Promise<GetSessionResponse> {
  return request<GetSessionResponse>(`/api/clearcut/sessions/${token}`, { jwt });
}

export async function updateSession(
  token: string,
  jwt: string,
  input: SessionStateUpdateInput,
): Promise<SessionState> {
  return request<SessionState>(`/api/clearcut/sessions/${token}`, {
    method: 'PUT',
    body: input,
    jwt,
  });
}

export async function deleteSession(token: string, jwt: string): Promise<{ deleted: true }> {
  return request<{ deleted: true }>(`/api/clearcut/sessions/${token}`, {
    method: 'DELETE',
    jwt,
  });
}

export async function authSession(token: string, password?: string): Promise<AuthSessionResponse> {
  return request<AuthSessionResponse>(`/api/clearcut/sessions/${token}/auth`, {
    method: 'POST',
    body: { password },
  });
}

export async function renameSession(token: string, jwt: string, name: string): Promise<{ name: string }> {
  return request<{ name: string }>(`/api/clearcut/sessions/${token}/name`, {
    method: 'PATCH',
    body: { name },
    jwt,
  });
}

export async function cloneSession(token: string, jwt: string): Promise<CloneSessionResponse> {
  return request<CloneSessionResponse>(`/api/clearcut/sessions/${token}/clone`, {
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
  return request<{ passwordProtected: true }>(`/api/clearcut/sessions/${token}/password`, {
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
  return request<{ passwordProtected: false }>(`/api/clearcut/sessions/${token}/password`, {
    method: 'DELETE',
    body: { currentPassword },
    jwt,
  });
}

export async function importTrips(token: string, jwt: string, file: File): Promise<ImportResponse> {
  const formData = new FormData();
  formData.set('file', file);
  return request<ImportResponse>(`/api/clearcut/sessions/${token}/import/trips`, {
    method: 'POST',
    jwt,
    formData,
  });
}

export async function importRoutes(token: string, jwt: string, file: File): Promise<ImportResponse> {
  const formData = new FormData();
  formData.set('file', file);
  return request<ImportResponse>(`/api/clearcut/sessions/${token}/import/routes`, {
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
  return request<ListTripsResponse>(`/api/clearcut/sessions/${token}/trips${qs}`, { jwt });
}

export async function listRoutes(token: string, jwt: string): Promise<ListRoutesResponse> {
  return request<ListRoutesResponse>(`/api/clearcut/sessions/${token}/routes`, { jwt });
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
