'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  ClearcutClientError,
  authSession,
  cloneSession,
  deleteSession,
  getSession,
  importRoutes,
  importTrips,
  removeSessionPassword,
  renameSession,
  setSessionPassword,
  updateSession,
} from './client';
import { clearSessionJwt, getSessionJwt, setSessionJwt } from './session-auth';
import type { AccessLevel, SessionState, SessionStateUpdateInput } from './types';

export type ClearcutMode = 'edit' | 'readonly';

export type ClearcutLoadState =
  | { status: 'loading' }
  | { status: 'password_required'; name: string; retryAfterSeconds?: number }
  | { status: 'not_found' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      state: SessionState;
      access: AccessLevel;
      hasJwt: boolean;
    };

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

  const loadSession = useCallback(
    async (options?: { forceNoJwt?: boolean }) => {
      setLoadState({ status: 'loading' });
      const attempt = async (jwt: string | null) => {
        const data = await getSession(token, jwt);
        if (data.jwt) {
          setSessionJwt(token, data.jwt);
        }
        setLoadState({
          status: 'ready',
          state: data,
          access: mode === 'readonly' ? 'readonly' : 'edit',
          hasJwt: Boolean(data.jwt || jwt),
        });
      };

      try {
        const jwt = options?.forceNoJwt ? null : getSessionJwt(token);
        await attempt(jwt);
      } catch (error) {
        if (isJwtAuthError(error) && !options?.forceNoJwt) {
          clearSessionJwt(token);
          try {
            await attempt(null);
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
    async (input: SessionStateUpdateInput): Promise<SessionState> => {
      return withEditJwt(async (jwt) => {
        const state = await updateSession(token, jwt, input);
        setLoadState({ status: 'ready', state, access: mode, hasJwt: true });
        return state;
      });
    },
    [mode, token, withEditJwt],
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

  return {
    loadState,
    loadSession,
    unlock,
    saveState,
    rename,
    clone,
    remove,
    setPassword,
    removePassword,
    uploadTrips,
    uploadRoutes,
    clearAuth: () => clearSessionJwt(token),
  };
}
