export const METRICS_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS page_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  page TEXT NOT NULL,
  session_token TEXT,
  user_agent TEXT,
  referrer TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_pv_created ON page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_pv_page ON page_views(page);
CREATE INDEX IF NOT EXISTS idx_pv_ip ON page_views(ip);

CREATE TABLE IF NOT EXISTS api_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  action TEXT NOT NULL,
  session_token TEXT,
  status_code INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_ae_created ON api_events(created_at);
CREATE INDEX IF NOT EXISTS idx_ae_action ON api_events(action);
CREATE INDEX IF NOT EXISTS idx_ae_ip ON api_events(ip);

CREATE TABLE IF NOT EXISTS honeypot_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  trigger_count INTEGER NOT NULL DEFAULT 1,
  blocked_until TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_hb_ip ON honeypot_blocks(ip);
CREATE INDEX IF NOT EXISTS idx_hb_created ON honeypot_blocks(created_at);
`;
