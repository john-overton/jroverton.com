import path from 'node:path';

export const CLEARCUT_TOKEN_REGEX = /^[a-f0-9]{12}$/;
export const CLEARCUT_TOKEN_BYTES = 6;
export const CLEARCUT_JWT_TTL_SECONDS = 60 * 60 * 24 * 3; // 3 days

export const AUTH_ATTEMPT_WINDOW_MS = 30_000;
export const AUTH_MAX_ATTEMPTS = 5;
export const AUTH_LOCKOUT_MS = 5 * 60_000;

const defaultDataRoot = path.join(process.cwd(), 'data', 'clearcut');

export const clearcutConfig = {
  dataRoot: process.env.CLEARCUT_DATA_DIR
    ? path.resolve(process.env.CLEARCUT_DATA_DIR)
    : defaultDataRoot,
  jwtSecret:
    process.env.CLEARCUT_JWT_SECRET ??
    (process.env.NODE_ENV === 'production'
      ? ''
      : 'clearcut-dev-secret-change-me'),
};

export function getRegistryDbPath(): string {
  return path.join(clearcutConfig.dataRoot, 'registry.db');
}

export function getSessionsDirPath(): string {
  return path.join(clearcutConfig.dataRoot, 'sessions');
}

export function getSessionDbPath(editToken: string): string {
  return path.join(getSessionsDirPath(), `${editToken}.db`);
}
