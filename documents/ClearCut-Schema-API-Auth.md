# ClearCut Schema, API, and Auth Reference

This document describes the current ClearCut backend implementation in `website/`.

## Scope

- Base URL family:
  - `/clearcut`
  - `/clearcut/s/{edit_token}`
  - `/clearcut/r/{readonly_token}`
- API base:
  - `/api/clearcut/sessions`
- Runtime:
  - Next.js App Router route handlers (`runtime = "nodejs"`)

## Configuration

Environment variables:

- `CLEARCUT_DATA_DIR` (optional): root directory for SQLite files.
  - default: `<project>/website/data/clearcut`
- `CLEARCUT_JWT_SECRET` (required in production): JWT signing secret.
  - dev fallback: `clearcut-dev-secret-change-me`

Token and auth constants:

- Token format: 12-char lowercase hex (`^[a-f0-9]{12}$`)
- JWT algorithm: `HS256`
- JWT TTL: 3 days
- Auth rate limit: more than 5 failed attempts in 30s -> 5 minute lockout (per session/IP)

## Data Storage Model

### Registry DB

Path: `data/clearcut/registry.db` (or under `CLEARCUT_DATA_DIR`)

Table: `sessions`

- `edit_token` TEXT PRIMARY KEY
- `readonly_token` TEXT UNIQUE
- `name` TEXT NOT NULL default `'Untitled Run Cut'`
- `password_hash` TEXT nullable (bcrypt hash)
- `created_at` TEXT UTC ISO timestamp
- `updated_at` TEXT UTC ISO timestamp
- `accessed_at` TEXT UTC ISO timestamp
- `trip_count` INTEGER default 0
- `route_count` INTEGER default 0

Indexes:

- `idx_readonly_token` on `readonly_token`
- `idx_accessed_at` on `accessed_at`

### Per-Session DB

Path: `data/clearcut/sessions/{edit_token}.db`

Tables:

- `trips`
  - `trip_id` PK
  - schedule and actual trip times
  - route id, addresses, lat/lon, status, passenger count, odometers
- `routes`
  - `route_id` PK
  - scheduled and actual start/end times
- `settings` (single row, `id = 1`)
  - `avg_ride_time_min`, `otp_target_pct`, `productivity_baseline`
  - `deadhead_threshold_pct`, service day bounds, day type, selected time range
- `optimization` (single row, `id = 1`)
  - optimization slider values and `run_structure_json`

Session DB initialization auto-creates schema and seeds row `id=1` for `settings` and `optimization`.

## API Envelope

Success:

```json
{
  "ok": true,
  "data": {}
}
```

Error:

```json
{
  "ok": false,
  "error": {
    "code": "error_code",
    "message": "Human readable message",
    "details": {}
  }
}
```

## Auth Model

### JWT Claims

- `sub`: edit token (session identifier)
- `access`: `edit` or `readonly`
- `iat`, `exp`: standard JWT timestamps

### Access rules

- Mutations require:
  - valid Bearer JWT
  - `sub` matches target session edit token
  - `access = "edit"`
- Read endpoints accept:
  - either `edit` or `readonly` access

### Session access behavior

- `GET /api/clearcut/sessions/{token}`:
  - If Bearer JWT is provided, it must match the session (`sub` check).
  - If no JWT:
    - `edit` token + password-protected session -> `401 password_required`
    - `edit` token + no password -> auto-issue edit JWT
    - `readonly` token -> auto-issue readonly JWT

### Password rules

- Password minimum length: 6
- Hashing: bcrypt (`bcryptjs`, 12 rounds)
- Password set/change/remove updates registry hash.
- Existing JWTs are not actively revoked on password change/remove; they expire naturally.

## Endpoint Reference

All endpoints are under `/api/clearcut/sessions`.

### Session lifecycle

- `POST /`
  - Create new session, generate edit + readonly tokens, provision session DB.
  - Body: `{ "name"?: string, "password"?: string }`
  - Returns: session metadata + edit JWT.

- `GET /{token}`
  - Load full session state by edit or readonly token.
  - May issue JWT automatically when no Bearer token is provided (see auth behavior).

- `PUT /{edit_token}`
  - Edit-only update.
  - Body supports partial state updates:
    - `settings`
    - `optimization`
    - full replacement `trips`
    - full replacement `routes`
  - Updates registry counts/timestamps.

- `DELETE /{edit_token}`
  - Edit-only delete.
  - Deletes registry row and session DB file.

- `POST /{edit_token}/clone`
  - Edit-only clone to new token pair.
  - Copies session DB file and returns new session metadata + edit JWT.

- `PATCH /{edit_token}/name`
  - Edit-only rename.
  - Body: `{ "name": "New Name" }`

### Auth and password

- `POST /{edit_token}/auth`
  - If session has password: verify `{ "password": "..." }`, return edit JWT.
  - If session has no password: return edit JWT directly.
  - Rate limited by session/IP with lockout response:
    - status `429`
    - `Retry-After` header

- `PUT /{edit_token}/password`
  - Edit-only set or change password.
  - Body:
    - set on unprotected session: `{ "newPassword": "..." }`
    - change on protected session: `{ "currentPassword": "...", "newPassword": "..." }`

- `DELETE /{edit_token}/password`
  - Edit-only remove password.
  - If currently protected, body must include `{ "currentPassword": "..." }`.

### Data access

- `GET /{token}/trips`
  - Read endpoint (edit or readonly JWT).
  - Query params:
    - `limit` (optional)
    - `offset` (optional)
  - Returns `items`, `count`, plus echoed `limit`/`offset`.

- `GET /{token}/routes`
  - Read endpoint (edit or readonly JWT).
  - Returns `items` and `count`.

### Import endpoints (multipart)

- `POST /{edit_token}/import/trips`
  - Edit-only.
  - Content type: `multipart/form-data`
  - Required field: `file`
  - Supported parser: CSV/XLSX (via `xlsx`)
  - Replaces all existing `trips` rows.

- `POST /{edit_token}/import/routes`
  - Edit-only.
  - Content type: `multipart/form-data`
  - Required field: `file`
  - Supported parser: CSV/XLSX
  - Replaces all existing `routes` rows.

Import validation currently enforces:

- required column presence
- required key fields by row
- datetime format checks (`YYYY-MM-DD HH:MM:SS`) on configured datetime fields

## Required File Columns

### Trips import columns

- `trip_id`
- `scheduled_pickup_time`
- `scheduled_appointment_time`
- `pickup_arrive_time`
- `pickup_leave_time`
- `dropoff_arrive_time`
- `dropoff_leave_time`
- `route_id`
- `pickup_address`
- `pickup_lat`
- `pickup_lon`
- `dropoff_address`
- `dropoff_lat`
- `dropoff_lon`
- `status`
- `passenger_count`
- `pick_odometer`
- `drop_odometer`

### Routes import columns

- `route_id`
- `scheduled_start_time`
- `scheduled_end_time`
- `actual_start_time`
- `actual_end_time`

## URL/Frontend Routing Notes

The following pages are scaffolded and wired for mode context:

- `website/app/clearcut/page.tsx`
- `website/app/clearcut/s/[token]/page.tsx`
- `website/app/clearcut/r/[token]/page.tsx`

These are minimal loaders and placeholders intended for full UI integration next.
