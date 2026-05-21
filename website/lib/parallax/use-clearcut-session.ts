'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  applyImportMappingConfig,
  ClearcutClientError,
  authSession,
  cloneSession,
  createImportTemplateRecord,
  deleteSession,
  deleteImportTemplateRecord,
  getSession,
  getSessionMetadata,
  importNewRoutes,
  importRoutes,
  importTrips,
  listAllRoutes,
  listImportTemplates,
  listTripsPage,
  loadDemoData,
  previewImportFile,
  removeSessionPassword,
  renameSession,
  setSessionPassword,
  updateSession,
  updateImportTemplateRecord,
  validateImportMappingConfig,
} from './client';
import { clearSessionJwt, getSessionJwt, setSessionJwt } from './session-auth';
import type {
  AccessLevel,
  ImportMappingConfig,
  ImportPreviewResponse,
  NewRouteRow,
  NewRoutesDelta,
  PartialSessionState,
  RouteRow,
  SessionMetadata,
  SessionState,
  SessionStateUpdateInput,
  TripRow,
} from './types';

export type ClearcutMode = 'edit' | 'readonly';

export type LoadingStage = 'metadata' | 'trips' | 'routes';

export type ClearcutLoadState =
  | { status: 'loading'; stage?: LoadingStage; progress?: { loaded: number; total: number }; metadata?: SessionMetadata }
  | { status: 'password_required'; name: string; retryAfterSeconds?: number }
  | { status: 'not_found' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      state: SessionState;
      access: AccessLevel;
      hasJwt: boolean;
      summary?: SessionMetadata['summary'];
    };

function mergeServerResponse(
  current: SessionState,
  server: PartialSessionState,
  sentFields: Set<string>,
): SessionState {
  let newRoutes = current.new_routes;
  if (server.new_routes_conflict && server.new_routes) {
    newRoutes = server.new_routes;
  } else if (server.new_routes) {
    newRoutes = server.new_routes;
  }

  return {
    session: server.session,
    settings: server.settings ?? current.settings,
    optimization: server.optimization ?? current.optimization,
    trips: server.trips ?? current.trips,
    routes: server.routes ?? current.routes,
    new_routes: newRoutes,
    depots: server.depots ?? current.depots,
    vehicle_types: server.vehicle_types ?? current.vehicle_types,
    bid_result: sentFields.has('optimization') ? server.bid_result : current.bid_result,
  };
}

function isJwtAuthError(error: unknown): boolean {
  return (
    error instanceof ClearcutClientError &&
    (error.code === 'missing_bearer_token' ||
      error.code === 'invalid_jwt' ||
      error.code === 'jwt_expired' ||
      error.code === 'jwt_session_mismatch')
  );
}

export function useClearcutSession(token: string, mode: ClearcutMode) {
  const [loadState, setLoadState] = useState<ClearcutLoadState>({ status: 'loading' });
  const newRoutesVersionRef = useRef<number>(0);

  const TRIP_PAGE_SIZE = 5000;

  const loadSession = useCallback(
    async (options?: { forceNoJwt?: boolean }) => {
      setLoadState({ status: 'loading', stage: 'metadata' });

      const attemptProgressiveLoad = async (jwt: string | null) => {
        const metadata = await getSessionMetadata(token, jwt);
        if (metadata.jwt) {
          setSessionJwt(token, metadata.jwt);
        }
        const resolvedJwt = metadata.jwt ?? jwt;

        setLoadState({
          status: 'loading',
          stage: 'trips',
          progress: { loaded: 0, total: metadata.summary.tripCount },
          metadata,
        });

        const allTrips: TripRow[] = [];
        const allRoutes: RouteRow[] = [];
        const totalTrips = metadata.summary.tripCount;

        const routesPromise = listAllRoutes(token, resolvedJwt).then((res) => {
          allRoutes.push(...res.items);
        });

        if (totalTrips > 0) {
          let offset = 0;
          while (offset < totalTrips) {
            const page = await listTripsPage(token, resolvedJwt, TRIP_PAGE_SIZE, offset);
            allTrips.push(...page.items);
            offset += page.items.length;
            if (page.items.length === 0) break;
            setLoadState({
              status: 'loading',
              stage: 'trips',
              progress: { loaded: allTrips.length, total: totalTrips },
              metadata,
            });
          }
        }

        await routesPromise;
        setLoadState({ status: 'loading', stage: 'routes', progress: { loaded: allRoutes.length, total: allRoutes.length }, metadata });

        newRoutesVersionRef.current = metadata.new_routes_version;

        const state: SessionState = {
          session: metadata.session,
          settings: metadata.settings,
          optimization: metadata.optimization,
          trips: allTrips,
          routes: allRoutes,
          new_routes: metadata.new_routes,
          depots: metadata.depots,
          vehicle_types: metadata.vehicle_types,
          bid_result: metadata.bid_result,
        };

        setLoadState({
          status: 'ready',
          state,
          access: mode === 'readonly' ? 'readonly' : 'edit',
          hasJwt: Boolean(resolvedJwt),
          summary: metadata.summary,
        });
      };

      try {
        const jwt = options?.forceNoJwt ? null : getSessionJwt(token);
        await attemptProgressiveLoad(jwt);
      } catch (error) {
        if (isJwtAuthError(error) && !options?.forceNoJwt) {
          clearSessionJwt(token);
          try {
            await attemptProgressiveLoad(null);
            return;
          } catch (retryError) {
            error = retryError;
          }
        }

        if (error instanceof ClearcutClientError) {
          if (error.code === 'password_required') {
            const details = (error.details ?? {}) as { name?: string };
            setLoadState({
              status: 'password_required',
              name: details.name ?? 'Protected Session',
              retryAfterSeconds: error.retryAfterSeconds,
            });
            return;
          }
          if (error.code === 'session_not_found') {
            setLoadState({ status: 'not_found' });
            return;
          }
          setLoadState({ status: 'error', message: error.message });
          return;
        }

        setLoadState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Failed to load session.',
        });
      }
    },
    [mode, token],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSession();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [loadSession]);

  const unlock = useCallback(
    async (password: string) => {
      const auth = await authSession(token, password);
      setSessionJwt(token, auth.jwt);
      await loadSession();
    },
    [loadSession, token],
  );

  const withEditJwt = useCallback(async <T,>(callback: (jwt: string) => Promise<T>): Promise<T> => {
    const jwt = getSessionJwt(token);
    if (!jwt) {
      throw new Error('Authentication required. Reload the session first.');
    }
    return callback(jwt);
  }, [token]);

  const saveState = useCallback(
    async (input: SessionStateUpdateInput): Promise<PartialSessionState> => {
      setLoadState((prev) => {
        if (prev.status !== 'ready') return prev;
        const s = prev.state;

        let newRoutes = input.new_routes ?? s.new_routes;
        if (input.new_routes_delta) {
          const deleteSet = new Set(input.new_routes_delta.delete_ids);
          const upsertMap = new Map(input.new_routes_delta.upsert.map((r) => [r.new_route_id, r]));
          newRoutes = s.new_routes
            .filter((r) => !deleteSet.has(r.new_route_id))
            .map((r) => upsertMap.get(r.new_route_id) ?? r);
          for (const r of input.new_routes_delta.upsert) {
            if (!s.new_routes.some((existing) => existing.new_route_id === r.new_route_id)) {
              newRoutes.push(r);
            }
          }
        }

        const optimistic: SessionState = {
          ...s,
          settings: input.settings ? { ...s.settings, ...input.settings } : s.settings,
          optimization: input.optimization ? { ...s.optimization, ...input.optimization } : s.optimization,
          trips: input.trips ?? s.trips,
          routes: input.routes ?? s.routes,
          new_routes: newRoutes,
          depots: input.depots ?? s.depots,
          vehicle_types: input.vehicle_types ?? s.vehicle_types,
        };
        return { ...prev, state: optimistic };
      });
      const sentFields = new Set(Object.keys(input));
      return withEditJwt(async (jwt) => {
        const serverState = await updateSession(token, jwt, input);
        if (serverState.new_routes_version != null) {
          newRoutesVersionRef.current = serverState.new_routes_version;
        }
        setLoadState((prev) => {
          if (prev.status !== 'ready') return prev;
          const merged = mergeServerResponse(prev.state, serverState, sentFields);
          return { ...prev, state: merged };
        });
        return serverState;
      });
    },
    [token, withEditJwt],
  );

  const rename = useCallback(
    async (name: string) =>
      withEditJwt(async (jwt) => {
        await renameSession(token, jwt, name);
        await loadSession();
      }),
    [loadSession, token, withEditJwt],
  );

  const clone = useCallback(
    async () =>
      withEditJwt(async (jwt) => {
        return cloneSession(token, jwt);
      }),
    [token, withEditJwt],
  );

  const remove = useCallback(
    async () =>
      withEditJwt(async (jwt) => {
        return deleteSession(token, jwt);
      }),
    [token, withEditJwt],
  );

  const setPassword = useCallback(
    async (newPassword: string, currentPassword?: string) =>
      withEditJwt(async (jwt) => {
        await setSessionPassword(token, jwt, newPassword, currentPassword);
      }),
    [token, withEditJwt],
  );

  const removePassword = useCallback(
    async (currentPassword?: string) =>
      withEditJwt(async (jwt) => {
        await removeSessionPassword(token, jwt, currentPassword);
      }),
    [token, withEditJwt],
  );

  const uploadTrips = useCallback(
    async (file: File) =>
      withEditJwt(async (jwt) => {
        const result = await importTrips(token, jwt, file);
        await loadSession();
        return result;
      }),
    [loadSession, token, withEditJwt],
  );

  const uploadRoutes = useCallback(
    async (file: File) =>
      withEditJwt(async (jwt) => {
        const result = await importRoutes(token, jwt, file);
        await loadSession();
        return result;
      }),
    [loadSession, token, withEditJwt],
  );

  const uploadNewRoutes = useCallback(
    async (file: File) =>
      withEditJwt(async (jwt) => {
        const result = await importNewRoutes(token, jwt, file);
        await loadSession();
        return result;
      }),
    [loadSession, token, withEditJwt],
  );

  const previewImport = useCallback(
    async (file: File, sheetName?: string): Promise<ImportPreviewResponse> =>
      withEditJwt((jwt) => previewImportFile(token, jwt, file, sheetName)),
    [token, withEditJwt],
  );

  const validateImport = useCallback(
    async (preview: ImportPreviewResponse, config: ImportMappingConfig) =>
      withEditJwt((jwt) => validateImportMappingConfig(token, jwt, preview, config)),
    [token, withEditJwt],
  );

  const applyImport = useCallback(
    async (file: File, config: ImportMappingConfig, sheetName?: string) =>
      withEditJwt(async (jwt) => {
        const result = await applyImportMappingConfig(token, jwt, file, config, sheetName);
        await loadSession();
        return result;
      }),
    [loadSession, token, withEditJwt],
  );

  const listTemplates = useCallback(
    async () => withEditJwt((jwt) => listImportTemplates(token, jwt)),
    [token, withEditJwt],
  );

  const createTemplate = useCallback(
    async (input: { templateName: string; sourceSystem: string; notes?: string; config: ImportMappingConfig }) =>
      withEditJwt((jwt) => createImportTemplateRecord(token, jwt, input)),
    [token, withEditJwt],
  );

  const updateTemplate = useCallback(
    async (
      id: number,
      input: {
        templateName?: string;
        sourceSystem?: string;
        notes?: string | null;
        config?: ImportMappingConfig;
      },
    ) => withEditJwt((jwt) => updateImportTemplateRecord(id, jwt, input)),
    [withEditJwt],
  );

  const deleteTemplate = useCallback(
    async (id: number) => withEditJwt((jwt) => deleteImportTemplateRecord(id, jwt)),
    [withEditJwt],
  );

  const loadDemo = useCallback(
    async (): Promise<SessionState> =>
      withEditJwt(async (jwt) => {
        const state = await loadDemoData(token, jwt);
        setLoadState({ status: 'ready', state, access: mode, hasJwt: true });
        return state;
      }),
    [mode, token, withEditJwt],
  );

  return {
    loadState,
    loadSession,
    unlock,
    saveState,
    getNewRoutesVersion: () => newRoutesVersionRef.current,
    rename,
    clone,
    remove,
    setPassword,
    removePassword,
    uploadTrips,
    uploadRoutes,
    uploadNewRoutes,
    previewImport,
    validateImport,
    applyImport,
    listTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    loadDemo,
    clearAuth: () => clearSessionJwt(token),
  };
}
