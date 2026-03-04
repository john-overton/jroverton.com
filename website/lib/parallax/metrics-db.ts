import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import { getMetricsDbPath } from './config';
import { METRICS_SCHEMA_SQL } from './metrics-schema';

let metricsDb: Database.Database | null = null;

function ensureMetricsDirectory(): void {
  const dbPath = getMetricsDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

export function getMetricsDb(): Database.Database {
  if (metricsDb) {
    return metricsDb;
  }

  ensureMetricsDirectory();
  metricsDb = new Database(getMetricsDbPath());
  metricsDb.pragma('journal_mode = WAL');
  metricsDb.exec(METRICS_SCHEMA_SQL);
  return metricsDb;
}

/* ------------------------------------------------------------------ */
/*  Write functions                                                    */
/* ------------------------------------------------------------------ */

export function recordPageView(input: {
  ip: string;
  page: string;
  sessionToken?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
}): void {
  getMetricsDb()
    .prepare(
      `INSERT INTO page_views (ip, page, session_token, user_agent, referrer)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(input.ip, input.page, input.sessionToken ?? null, input.userAgent ?? null, input.referrer ?? null);
}

export function recordApiEvent(input: {
  ip: string;
  method: string;
  path: string;
  action: string;
  sessionToken?: string | null;
  statusCode: number;
}): void {
  getMetricsDb()
    .prepare(
      `INSERT INTO api_events (ip, method, path, action, session_token, status_code)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(input.ip, input.method, input.path, input.action, input.sessionToken ?? null, input.statusCode);
}

export function recordHoneypotBlock(input: {
  ip: string;
  triggerCount: number;
  blockedUntil: string;
}): void {
  getMetricsDb()
    .prepare(
      `INSERT INTO honeypot_blocks (ip, trigger_count, blocked_until)
       VALUES (?, ?, ?)`,
    )
    .run(input.ip, input.triggerCount, input.blockedUntil);
}

/* ------------------------------------------------------------------ */
/*  Read functions (for admin panel)                                   */
/* ------------------------------------------------------------------ */

export interface OverviewMetrics {
  totalPageViews: number;
  uniqueVisitors: number;
  sessionsCreated: number;
  honeypotBlocks: number;
}

export function getOverviewMetrics(days: number = 30): OverviewMetrics {
  const db = getMetricsDb();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const pvRow = db
    .prepare('SELECT COUNT(*) as count FROM page_views WHERE created_at >= ?')
    .get(since) as { count: number };

  const uvRow = db
    .prepare('SELECT COUNT(DISTINCT ip) as count FROM page_views WHERE created_at >= ?')
    .get(since) as { count: number };

  const scRow = db
    .prepare("SELECT COUNT(*) as count FROM api_events WHERE action = 'session_create' AND created_at >= ?")
    .get(since) as { count: number };

  const hbRow = db
    .prepare('SELECT COUNT(*) as count FROM honeypot_blocks WHERE created_at >= ?')
    .get(since) as { count: number };

  return {
    totalPageViews: pvRow.count,
    uniqueVisitors: uvRow.count,
    sessionsCreated: scRow.count,
    honeypotBlocks: hbRow.count,
  };
}

export function getPageViewsByDay(days: number = 30): Array<{ date: string; count: number }> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  return getMetricsDb()
    .prepare(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM page_views
       WHERE created_at >= ?
       GROUP BY DATE(created_at)
       ORDER BY date`,
    )
    .all(since) as Array<{ date: string; count: number }>;
}

export function getTopPages(days: number = 30, limit: number = 10): Array<{ page: string; count: number }> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  return getMetricsDb()
    .prepare(
      `SELECT page, COUNT(*) as count
       FROM page_views
       WHERE created_at >= ?
       GROUP BY page
       ORDER BY count DESC
       LIMIT ?`,
    )
    .all(since, limit) as Array<{ page: string; count: number }>;
}

export function getEventsByAction(days: number = 30): Array<{ action: string; count: number }> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  return getMetricsDb()
    .prepare(
      `SELECT action, COUNT(*) as count
       FROM api_events
       WHERE created_at >= ?
       GROUP BY action
       ORDER BY count DESC`,
    )
    .all(since) as Array<{ action: string; count: number }>;
}

export interface EventLogItem {
  id: number;
  ip: string;
  method: string;
  path: string;
  action: string;
  session_token: string | null;
  status_code: number;
  created_at: string;
}

export function getEventLog(options: {
  page?: number;
  limit?: number;
  action?: string;
}): { items: EventLogItem[]; total: number } {
  const db = getMetricsDb();
  const limit = Math.min(options.limit ?? 50, 200);
  const offset = ((options.page ?? 1) - 1) * limit;

  const whereClause = options.action ? 'WHERE action = ?' : '';
  const params = options.action ? [options.action] : [];

  const totalRow = db
    .prepare(`SELECT COUNT(*) as count FROM api_events ${whereClause}`)
    .get(...params) as { count: number };

  const items = db
    .prepare(
      `SELECT * FROM api_events ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as EventLogItem[];

  return { items, total: totalRow.count };
}

export interface HoneypotBlockRow {
  id: number;
  ip: string;
  trigger_count: number;
  blocked_until: string;
  created_at: string;
}

export function getHoneypotBlocks(): HoneypotBlockRow[] {
  return getMetricsDb()
    .prepare('SELECT * FROM honeypot_blocks ORDER BY created_at DESC LIMIT 100')
    .all() as HoneypotBlockRow[];
}

export function getRecentEvents(limit: number = 20): EventLogItem[] {
  return getMetricsDb()
    .prepare('SELECT * FROM api_events ORDER BY created_at DESC LIMIT ?')
    .all(limit) as EventLogItem[];
}
