import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import { getRegistryDbPath } from './config';
import { ApiError } from './errors';
import { REGISTRY_SCHEMA_SQL } from './schema';
import type { SessionRecord } from './types';

let registryDb: Database.Database | null = null;

type SessionLookupRow = SessionRecord;

function ensureRegistryDirectory(): void {
  const dbPath = getRegistryDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

export function getRegistryDb(): Database.Database {
  if (registryDb) {
    return registryDb;
  }

  ensureRegistryDirectory();
  registryDb = new Database(getRegistryDbPath());
  registryDb.pragma('journal_mode = WAL');
  registryDb.exec(REGISTRY_SCHEMA_SQL);
  return registryDb;
}

export function findSessionByEditToken(editToken: string): SessionRecord | null {
  const row = getRegistryDb()
    .prepare('SELECT * FROM sessions WHERE edit_token = ?')
    .get(editToken) as SessionLookupRow | undefined;
  return row ?? null;
}

export function findSessionByReadonlyToken(readonlyToken: string): SessionRecord | null {
  const row = getRegistryDb()
    .prepare('SELECT * FROM sessions WHERE readonly_token = ?')
    .get(readonlyToken) as SessionLookupRow | undefined;
  return row ?? null;
}

export function findSessionByAnyToken(token: string): { session: SessionRecord; tokenType: 'edit' | 'readonly' } | null {
  const editMatch = findSessionByEditToken(token);
  if (editMatch) {
    return { session: editMatch, tokenType: 'edit' };
  }

  const readonlyMatch = findSessionByReadonlyToken(token);
  if (readonlyMatch) {
    return { session: readonlyMatch, tokenType: 'readonly' };
  }

  return null;
}

export function createSessionRecord(input: {
  editToken: string;
  readonlyToken: string;
  name?: string;
  passwordHash?: string | null;
}): SessionRecord {
  const db = getRegistryDb();
  const name = input.name?.trim() || 'Untitled Run Cut';
  const passwordHash = input.passwordHash ?? null;

  db.prepare(
    `INSERT INTO sessions (edit_token, readonly_token, name, password_hash)
     VALUES (?, ?, ?, ?)`,
  ).run(input.editToken, input.readonlyToken, name, passwordHash);

  const created = findSessionByEditToken(input.editToken);
  if (!created) {
    throw new ApiError(500, 'registry_insert_failed', 'Failed to create session registry record.');
  }

  return created;
}

export function touchSessionAccess(editToken: string): void {
  getRegistryDb()
    .prepare(
      `UPDATE sessions
       SET accessed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE edit_token = ?`,
    )
    .run(editToken);
}

export function touchSessionUpdate(editToken: string): void {
  getRegistryDb()
    .prepare(
      `UPDATE sessions
       SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE edit_token = ?`,
    )
    .run(editToken);
}

export function renameSession(editToken: string, name: string): void {
  getRegistryDb()
    .prepare(
      `UPDATE sessions
       SET name = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE edit_token = ?`,
    )
    .run(name.trim() || 'Untitled Run Cut', editToken);
}

export function setSessionPasswordHash(editToken: string, passwordHash: string | null): void {
  getRegistryDb()
    .prepare(
      `UPDATE sessions
       SET password_hash = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE edit_token = ?`,
    )
    .run(passwordHash, editToken);
}

export function updateSessionCounts(editToken: string, tripCount: number, routeCount: number): void {
  getRegistryDb()
    .prepare(
      `UPDATE sessions
       SET trip_count = ?, route_count = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE edit_token = ?`,
    )
    .run(tripCount, routeCount, editToken);
}

export function deleteSessionRecord(editToken: string): void {
  getRegistryDb().prepare('DELETE FROM sessions WHERE edit_token = ?').run(editToken);
}
