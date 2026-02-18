# RunCut — UI Scope Document

Run Cutting & Optimization Tool

| **Field**   | Value         |
|-------------|---------------|
| **Version** | 1.0 — Draft   |
| **Date**    | February 2026 |
| **Author**  |               |
| **Status**  | In Progress   |

> **FILL IN:** *Add project stakeholders, review cadence, and any external dependencies*

## Table of Contents


**Phase 1 — Foundation**

- [1. Overview](#1-overview)
- [2. Data Model & Calculations](#2-data-model-calculations)
  - [2.1 Derived Fields](#21-derived-fields)
  - [2.2 Import Processing Pipeline](#22-import-processing-pipeline)
  - [2.3 Demand Carry-Forward Formula](#23-demand-carry-forward-formula)
  - [2.4 Deadhead Calculation](#24-deadhead-calculation)
  - [2.5 OTP Calculation](#25-otp-calculation)
  - [2.6 Productivity Calculation](#26-productivity-calculation)
  - [2.7 Optimization Model](#27-optimization-model)
- [3. Technical Requirements](#3-technical-requirements)
  - [3.1 Frontend Stack](#31-frontend-stack)
  - [3.2 Backend / API](#32-backend-api)
  - [3.3 Performance Requirements](#33-performance-requirements)
  - [3.4 Browser Support](#34-browser-support)
  - [3.5 Accessibility](#35-accessibility)

**Phase 2 — Backend Architecture**

- [4. Session Model & Persistence](#4-session-model-persistence)
  - [4.1 How It Works](#41-how-it-works)
  - [4.2 Token Specification](#42-token-specification)
    - [4.2.1 Edit Token](#421-edit-token)
    - [4.2.2 Read-Only Token](#422-read-only-token)
  - [4.3 Password Protection](#43-password-protection)
    - [4.3.1 Setting a Password](#431-setting-a-password)
    - [4.3.2 Authentication Flow](#432-authentication-flow)
    - [4.3.3 Anonymous JWT (Unprotected Sessions)](#433-anonymous-jwt-unprotected-sessions)
    - [4.3.4 JWT Structure](#434-jwt-structure)
  - [4.4 Backend Storage Model](#44-backend-storage-model)
    - [4.4.1 Architecture: SQLite per Session](#441-architecture-sqlite-per-session)
    - [4.4.2 Session Registry (System Database)](#442-session-registry-system-database)
    - [4.4.3 Per-Session Database Schema](#443-per-session-database-schema)
    - [4.4.4 Persisted State Summary](#444-persisted-state-summary)
  - [4.5 Anonymous (Unsaved) Usage](#45-anonymous-unsaved-usage)
  - [4.6 Session Lifecycle & Cleanup](#46-session-lifecycle-cleanup)
- [5. Session API](#5-session-api)

**Phase 3 — UI Framework**

- [6. Global Layout & Navigation](#6-global-layout-navigation)
  - [6.1 Application Header](#61-application-header)
  - [6.2 System Settings Bar](#62-system-settings-bar)
    - [6.2.1 Day of Week Selection](#621-day-of-week-selection)
    - [6.2.2 Time Range Slider](#622-time-range-slider)
  - [6.3 Tab Navigation](#63-tab-navigation)
- [7. Landing & Session Management](#7-landing-session-management)
  - [7.1 Root Landing Page](#71-root-landing-page)
    - [7.1.1 Return to Previous Session](#711-return-to-previous-session)
  - [7.2 Session URL Behavior](#72-session-url-behavior)
    - [7.2.1 Edit URL (`/s/{edit_token}`)](#721-edit-url-sedit_token)
    - [7.2.2 Read-Only URL (`/r/{readonly_token}`)](#722-read-only-url-rreadonly_token)
  - [7.3 Save & Update Flow](#73-save-update-flow)
    - [7.3.1 First Save (New Session)](#731-first-save-new-session)
    - [7.3.2 Subsequent Saves (Existing Session)](#732-subsequent-saves-existing-session)
    - [7.3.3 Save As New](#733-save-as-new)
  - [7.4 Read-Only Link Display](#74-read-only-link-display)
  - [7.5 Rename](#75-rename)
  - [7.6 Password Management](#76-password-management)
  - [7.7 Delete Session](#77-delete-session)
  - [7.8 Header State by Session Context](#78-header-state-by-session-context)
- [8. Import Tab](#8-import-tab)
  - [8.1 File Upload Areas](#81-file-upload-areas)
    - [8.1.1 Trip Data Upload](#811-trip-data-upload)
    - [8.1.2 Route Schedule Upload](#812-route-schedule-upload)
  - [8.2 Settings Panel](#82-settings-panel)
    - [8.2.1 Service Parameters](#821-service-parameters)
    - [8.2.2 Display Preferences](#822-display-preferences)
  - [8.3 Import Actions](#83-import-actions)

**Phase 4 — Analysis Views**

- [9. Demand Analysis Tab](#9-demand-analysis-tab)
  - [9.1 Summary Metrics](#91-summary-metrics)
  - [9.2 Demand and Active Vehicles Chart](#92-demand-and-active-vehicles-chart)
    - [9.2.1 Bar Layer — Demand](#921-bar-layer-demand)
    - [9.2.2 Line Layer — Active Vehicles](#922-line-layer-active-vehicles)
    - [9.2.3 Tooltip](#923-tooltip)
  - [9.3 Deadhead Intensity Heatmap](#93-deadhead-intensity-heatmap)
- [10. Performance Tab](#10-performance-tab)
  - [10.1 Summary Metrics](#101-summary-metrics)
  - [10.2 On-Time Performance Chart](#102-on-time-performance-chart)
  - [10.3 Productivity Chart](#103-productivity-chart)
- [11. Trip Map Tab](#11-trip-map-tab)
  - [11.1 Heatmap Canvas](#111-heatmap-canvas)
  - [11.2 Time Scrubber](#112-time-scrubber)
  - [11.3 Legend and Context](#113-legend-and-context)

**Phase 5 — Optimization & Output**

- [12. Run Structure Tab](#12-run-structure-tab)
  - [12.1 Summary Metrics](#121-summary-metrics)
  - [12.2 Gantt Charts](#122-gantt-charts)
  - [12.3 Detail Comparison Table](#123-detail-comparison-table)
- [13. Optimize Run Cut Tab](#13-optimize-run-cut-tab)
  - [13.1 Optimization Parameters](#131-optimization-parameters)
  - [13.2 Estimated Outcomes Panel](#132-estimated-outcomes-panel)
  - [13.3 Comparison Panel](#133-comparison-panel)
- [14. Deadhead Review Tab](#14-deadhead-review-tab)
  - [14.1 Summary Metrics](#141-summary-metrics)
  - [14.2 Deadhead Ratio Heatmap](#142-deadhead-ratio-heatmap)
  - [14.3 High Deadhead Trip Tables](#143-high-deadhead-trip-tables)
- [15. Export & Reporting](#15-export-reporting)

**Appendix**

- [16. Resolved Questions](#16-resolved-questions)
- [17. Remaining Open Questions](#17-remaining-open-questions)

---

# 1. Overview

RunCut is a web-based run cutting and optimization tool designed for paratransit and demand-response transit operations. The tool allows dispatchers and schedulers to import trip and route data, visualize service demand across the day, evaluate current performance, and generate optimized run structures using adjustable parameters.

The interface is built around a tab-based workflow that guides the user from data import through analysis to optimization, with a persistent system settings bar that controls day-of-week filtering and time range selection across all views.

> **FILL IN:** *Add target user personas, deployment context (standalone web app, embedded in existing platform, etc.), and any authentication/access control requirements*

# 2. Data Model & Calculations

This section documents the data transformations between raw imported data and the derived metrics displayed throughout the tool. All source fields are defined in the schemas in Section 8.1.

## 2.1 Derived Fields

The following fields are computed from the imported data and used across multiple tabs.

| **Derived Field**         | **Source**             | **Formula**                                                                                                            |
|---------------------------|------------------------|------------------------------------------------------------------------------------------------------------------------|
| Trip Miles                | Trip data              | drop_odometer - pick_odometer                                                                                          |
| Inter-Trip Deadhead Miles | Trip data (per route)  | Current trip pick_odometer - prior trip drop_odometer (same route, sequential by pickup_leave_time)                    |
| Start-of-Day Deadhead     | Trip data + Route data | First trip pick_odometer on a route minus route start odometer (if available), or estimated from depot to first pickup |
| End-of-Day Deadhead       | Trip data + Route data | Route end odometer minus last trip drop_odometer, or estimated from last dropoff to depot                              |
| Ride Time                 | Trip data              | dropoff_arrive_time - pickup_leave_time                                                                                |
| Dwell Time (Pickup)       | Trip data              | pickup_leave_time - pickup_arrive_time                                                                                 |
| Dwell Time (Dropoff)      | Trip data              | dropoff_leave_time - dropoff_arrive_time                                                                               |
| Service Hours (per route) | Route data             | actual_end_time - actual_start_time                                                                                    |
| Schedule Variance         | Route data             | (actual_end_time - actual_start_time) - (scheduled_end_time - scheduled_start_time)                                    |
| OTP (per trip)            | Trip data              | pickup_arrive_time vs. scheduled_pickup_time within the defined on-time window                                         |

> **FILL IN:** *Define depot locations or base odometer values if start/end-of-day deadhead should be calculated from actual depot positions rather than estimated. Specify how odometer gaps or resets are handled.*

## 2.2 Import Processing Pipeline

On import, the following processing steps occur: datetime parsing and validation of all time fields against the expected YYYY-MM-DD HH:MM:SS format, column header matching, route_id cross-referencing between trip and route files, computation of derived fields, and assignment of trips to 15-minute time blocks based on scheduled_pickup_time.

> **FILL IN:** *Define the step-by-step processing order, error handling for malformed rows, and how partial data (e.g., missing actual times but valid scheduled times) is treated. Specify the internal data structures used.*

## 2.3 Demand Carry-Forward Formula

The on-board estimate uses a carry-forward model based on average ride time. With the default 28-minute ride time, passengers picked up in the previous two 15-minute blocks are assumed to still be on board. Passenger counts from the passenger_count field are used rather than a flat count of one per trip.

> **FILL IN:** *Define the precise formula. Is it: on_board\[t\] = sum(passenger_count for pickups in t) + sum(passenger_count for pickups in t-1) + sum(passenger_count for pickups in t-2)? Or should actual ride times (dropoff_arrive_time - pickup_leave_time) be used when available instead of the average?*

## 2.4 Deadhead Calculation

Deadhead miles are calculated from odometer readings. Inter-trip deadhead on a route is the difference between the current trip’s pick_odometer and the previous trip’s drop_odometer. Start-of-day and end-of-day deadhead represent the empty miles from depot to first pickup and last dropoff to depot respectively.

> **FILL IN:** *Define whether inter-trip deadhead includes wait time at the next pickup or only travel time. Specify how routes with a single trip are handled. Clarify the depot odometer reference point.*

## 2.5 OTP Calculation

On-time performance is evaluated by comparing pickup_arrive_time against scheduled_pickup_time. The on-time window and how early arrivals are treated must be defined.

> **FILL IN:** *Define the on-time window (e.g., 0 to 15 minutes after scheduled_pickup_time). Specify whether trips where the vehicle arrives before the scheduled time are counted as on-time or flagged separately. Define how no-shows and cancellations factor into the OTP denominator.*

## 2.6 Productivity Calculation

Productivity is calculated as completed trips divided by revenue hours. Revenue hours are derived from route service hours minus deadhead time.

> **FILL IN:** *Define precisely: trips_per_revenue_hour = completed_trips / revenue_hours. Specify what counts as a completed trip by status field values. Define how revenue hours are calculated from the route actual times and deadhead.*

## 2.7 Optimization Model

> **FILL IN:** *Document the algorithm or model used to generate the optimized run cut. Include: objective function, constraints, solver type, computation approach, and how the four slider parameters map to model inputs. Specify whether this produces a deterministic result or a range of feasible solutions.*

# 3. Technical Requirements

## 3.1 Frontend Stack

- **Framework:** Next.js (App Router) with React, TypeScript
- **Charting:** Recharts (BarChart, Line, ResponsiveContainer, Tooltip)
- **UI Framework:** Bootstrap 5 via react-bootstrap, inline styles
- **Icons:** lucide-react
- **State Management:** React hooks (`useState`, `useMemo`, `useCallback`, `useEffect`); custom `useClearcutSession` hook for session lifecycle
- **Build Tooling:** Next.js built-in (Turbopack dev, webpack production)

### Component Architecture

The session UI follows a tab-per-file pattern with a thin orchestrator. All files are in `website/app/clearcut/components/ui/`.

| **File** | **Description** |
|---|---|
| `ClearcutSessionApp.tsx` | Orchestrator — owns session hook, filter bar (day/time selector), header, tab navigation, status/error display, and session-level action handlers (save, rename, clone, delete, password). Delegates tab rendering to individual components. |
| `shared.tsx` | Shared display components (`MetricCard`, `MiniBars`, `HeatStrip`, `DemandCompositeChart`, `SectionCard`, `TripTable`, `PasswordPrompt`) and utility functions (`parseClockToMinutes`, `formatMinutesToClock`, `formatMinutesToLabel`, `parseDateTime`, `deriveSliderBoundsFromTrips`). Also exports shared constants (`CLEARCUT_FONT_STACK`, `DEMAND_BLOCK_MINUTES`). |
| `ImportTab.tsx` | Import tab — file upload (wizard and flat-file), system settings (OTP windows), and data view tables with pagination. Owns import-specific state (view mode, pagination, column visibility, flat import log). Contains private `FlatFileImport` and `FlatImportLogModal` components. |
| `DemandTab.tsx` | Demand tab — pure display. Peak metrics, composite demand/vehicles chart, deadhead heatmap. |
| `PerformanceTab.tsx` | Performance tab — pure display. OTP and productivity metrics with block-level bar charts. |
| `MapTab.tsx` | Trip Map tab — owns `mapBlockIdx` state for time scrubber. Pickup heatmap visualization. |
| `RunsTab.tsx` | Run Structure tab — pure display. Current vs optimized run comparison. |
| `OptimizeTab.tsx` | Optimize tab — optimization parameter sliders with estimated outcome metrics. Receives `onOptimizationChange` callback from orchestrator. |
| `DeadheadTab.tsx` | Deadhead tab — pure display. Deadhead metrics, heatmap, and high-deadhead trip tables. |
| `ImportMapperWizard.tsx` | Event-based import wizard with template management, field mapping, and validation. Used by `ImportTab`. |
| `ClearcutLandingClient.tsx` | Landing page for creating new sessions and returning to existing ones via edit token. |

**Data flow:** The orchestrator computes `ClearcutMetrics` (exported from `lib/clearcut/metrics.ts`) using the session state and current filter selections. This single metrics object is passed as a prop to each tab component, providing a clean data contract. The filter bar (day-of-week pills, time range slider) remains in the orchestrator since it affects all tabs via the `computeClearcutMetrics` call.

## 3.2 Backend / API

> **FILL IN:** *Specify: backend language/framework, API design (REST, GraphQL), data processing pipeline, optimization solver (if server-side), database requirements, file storage for imports.*

## 3.3 Performance Requirements

> **FILL IN:** *Define: maximum acceptable load time for import processing, chart render performance targets, optimization computation time limits, maximum supported dataset size (trips per day, routes).*

## 3.4 Browser Support

> **FILL IN:** *List supported browsers and minimum versions. Note any canvas/WebGL requirements for the map view.*

## 3.5 Accessibility

> **FILL IN:** *Define WCAG compliance target, keyboard navigation requirements, screen reader support, color-blind-safe palette requirements.*

# 4. Session Model & Persistence

RunCut uses a lightweight, account-free persistence model. There is no user registration or login. Each saved run cut is identified by a unique 12-digit hexadecimal edit token embedded in the URL. A separate read-only token allows sharing without granting write access. Sessions can optionally be password-protected.

## 4.1 How It Works

1. A user visits the tool at the root URL and lands on the Import tab. At this point, no session exists and all work is ephemeral (browser memory only).

2. The user imports data and works through the analysis. When they are ready to save, they click "Save Run Cut."

3. The backend generates two tokens: a 12-digit hex **edit token** and a separate 12-digit hex **read-only token**. A new SQLite database file is provisioned for the session, and all imported data, settings, and optimization state are persisted to it.

4. The URL updates to include the edit token (e.g., `/s/a3f8c1d902b7`). The user is prompted to name their run cut and optionally set a password. The read-only link (`/r/e7b204f1c8a9`) is displayed in the header for easy copying and sharing.

5. Returning to the edit URL loads all persisted data and restores the full application state with write access. Returning to the read-only URL loads the same data in a view-only mode.

## 4.2 Token Specification

### 4.2.1 Edit Token

| **Property**         | Detail                                                        |
|----------------------|---------------------------------------------------------------|
| **Format**           | 12-digit lowercase hexadecimal string (48-bit keyspace)       |
| **Example**          | `a3f8c1d902b7`                                                |
| **URL Pattern**      | `/s/{edit_token}`                                             |
| **Generation**       | Cryptographically random; generated server-side on first save |
| **Uniqueness**       | Globally unique; collision check on generation                |
| **Access Level**     | Full read-write; all API mutations are authorized             |

### 4.2.2 Read-Only Token

| **Property**         | Detail                                                               |
|----------------------|----------------------------------------------------------------------|
| **Format**           | 12-digit lowercase hexadecimal string (48-bit keyspace)              |
| **Example**          | `e7b204f1c8a9`                                                       |
| **URL Pattern**      | `/r/{readonly_token}`                                                |
| **Generation**       | Cryptographically random; generated alongside the edit token         |
| **Uniqueness**       | Globally unique; independent from the edit token                     |
| **Access Level**     | Read-only; all mutating API calls are rejected                       |

The edit and read-only tokens are generated independently — knowing one does not reveal the other. Both use a 48-bit keyspace (~281 trillion possibilities each), making brute-force enumeration impractical.

> **FILL IN:** *Evaluate whether the 48-bit keyspace is adequate for the expected number of sessions. Consider whether tokens should be longer (e.g., 16 hex digits / 64-bit) for additional security margin. Specify whether tokens should be human-readable (e.g., word-based encoding) or remain hex.*

## 4.3 Password Protection

Sessions can optionally be password-protected. When a password is set, any user accessing the edit URL must authenticate before gaining write access. Read-only access via the `/r/` URL is never password-gated.

### 4.3.1 Setting a Password

The user can set a password during the initial save dialog or at any time from the session menu in the header. The password is hashed server-side before storage.

| **Property**         | Detail                                                               |
|----------------------|----------------------------------------------------------------------|
| **When Set**         | Optional during first save; can be added or changed later            |
| **Storage**          | Bcrypt hash stored in the session registry                           |
| **Minimum Length**   | 6 characters; no other complexity requirements                       |
| **Removal**          | The user can remove password protection from the session menu        |

### 4.3.2 Authentication Flow

1. User navigates to `/s/{edit_token}` for a password-protected session.

2. The server responds with a `401` and the client displays a password prompt. The session name is shown so the user can confirm they have the right run cut.

3. The user enters the password. The server validates it against the stored bcrypt hash.

4. On success, the server issues a JWT scoped to that specific edit token. The JWT is stored in browser memory (not localStorage) and included as a `Bearer` token on all subsequent API requests for that session.

5. On failure, the user can retry. Rate limiting is enforced: more than 5 failed attempts within 30 seconds from the same session/IP triggers a 5-minute lockout for that session/IP combination.

JWTs expire after 3 days. On expiration, the user is prompted to re-enter the password (or a new anonymous JWT is issued for unprotected sessions). JWTs are stored in browser memory (not localStorage) and passed as Bearer tokens.

> **FILL IN:** *Specify the JWT signing algorithm (e.g., HS256) and server secret management. Define whether the 3-day expiration should be refreshed on activity (sliding window) or fixed from issuance.*

### 4.3.3 Anonymous JWT (Unprotected Sessions)

For sessions without a password, the server still issues a JWT on first access. This anonymous JWT carries the same permission scope as an authenticated JWT — full read-write access for the edit token. The purpose is to maintain a uniform authorization model across all API calls, whether the session is protected or not.

| **Scenario**                    | **JWT Issued**                                      | **Permissions**        |
|---------------------------------|-----------------------------------------------------|------------------------|
| Edit URL, no password           | Anonymous JWT issued automatically on load          | Full read-write        |
| Edit URL, password set          | JWT issued after successful password validation     | Full read-write        |
| Read-only URL, no password      | Read-only JWT issued automatically on load          | Read-only              |
| Read-only URL, password set     | Read-only JWT issued automatically (no prompt)      | Read-only              |

All JWTs include the session key, access level (edit or readonly), and an expiration timestamp. The API validates the JWT on every mutating request (POST, PUT, PATCH, DELETE) and rejects calls where the JWT does not carry edit-level access.

### 4.3.4 JWT Structure

| **Claim**     | **Description**                                                      |
|---------------|----------------------------------------------------------------------|
| `sub`         | The edit token (session identifier)                                  |
| `access`      | `edit` or `readonly`                                                 |
| `iat`         | Issued-at timestamp                                                  |
| `exp`         | Expiration timestamp                                                 |

JWTs are signed with a single server-level secret. Password changes do not invalidate existing JWTs — tokens simply expire after their 3-day TTL. This simplifies the implementation by avoiding token blacklists or per-session secrets.

> **FILL IN:** *Specify the signing algorithm (e.g., HS256) and secret rotation policy. Define whether IP binding should be added as a claim for additional security.*

## 4.4 Backend Storage Model

### 4.4.1 Architecture: SQLite per Session

Each saved run cut is stored as an independent SQLite database file on the server. This provides full isolation between sessions — one file per run cut, no shared tables, no multi-tenant query complexity.

| **Property**            | Detail                                                                      |
|-------------------------|-----------------------------------------------------------------------------|
| **File Location**       | `/data/sessions/{edit_token}.db`                                            |
| **Format**              | SQLite 3 database file                                                      |
| **Provisioning**        | Created on first save; schema applied from a template                       |
| **Deletion**            | File is deleted from disk when the session is deleted                       |
| **Backup**              | Individual files can be backed up or archived independently                 |
| **Max Size**            | No enforced limit                                                           |

This approach is chosen for its simplicity and isolation. Each session's data is self-contained: it can be backed up, restored, or deleted by operating on a single file. Corruption in one session cannot affect another. The tradeoff is that cross-session queries (e.g., "how many total sessions exist") require scanning the registry rather than a single database query, which is acceptable for this use case.

### 4.4.2 Session Registry (System Database)

The session registry is a single, persistent SQLite database that acts as the system-level index for all sessions. It is the only database that runs continuously — the server holds a connection to it at all times. It stores tokens, metadata, and password hashes, but never trip or route data. All URL routing decisions start here.

**File location:** `/data/registry.db`

**Request flow:** When a request arrives for `/s/a3f8c1d902b7`, the server queries the registry (`SELECT * FROM sessions WHERE edit_token = ?`). The result tells the server whether the session exists, whether it requires a password, and where to find the session data file (`/data/sessions/a3f8c1d902b7.db`). Read-only requests at `/r/` query on `readonly_token` instead. If no row is found, the server returns a 404.

```sql
CREATE TABLE sessions (
    edit_token      TEXT NOT NULL PRIMARY KEY,
    readonly_token  TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL DEFAULT 'Untitled Run Cut',
    password_hash   TEXT,  -- bcrypt hash; NULL if unprotected
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    accessed_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    trip_count      INTEGER NOT NULL DEFAULT 0,
    route_count     INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX idx_readonly_token ON sessions(readonly_token);
CREATE INDEX idx_accessed_at ON sessions(accessed_at);
```

The `edit_token` is the primary key. The `readonly_token` has a unique index for fast lookups from `/r/` URLs. The `accessed_at` index supports the cleanup query that identifies stale sessions.

> **FILL IN:** *Define whether additional registry-level fields are needed (e.g., file_size_bytes for monitoring storage, source_filename for the original upload name). Specify whether the registry should include a schema_version field to support future migrations.*

### 4.4.3 Per-Session Database Schema

Each session's SQLite file contains the imported data and current tool state. These files are opened on demand when a user loads their session and closed when the request completes — the server does not hold persistent connections to session databases, keeping memory usage low regardless of how many sessions exist.

**File location:** `/data/sessions/{edit_token}.db`

```sql
-- Imported trip data (one row per trip, schema per Section 8.1.1)
CREATE TABLE trips (
    trip_id                     TEXT NOT NULL PRIMARY KEY,
    scheduled_pickup_time       TEXT NOT NULL,
    scheduled_appointment_time  TEXT NOT NULL,
    pickup_arrive_time          TEXT,
    pickup_leave_time           TEXT,
    dropoff_arrive_time         TEXT,
    dropoff_leave_time          TEXT,
    route_id                    TEXT NOT NULL,
    pickup_address              TEXT,
    pickup_lat                  TEXT,
    pickup_lon                  TEXT,
    dropoff_address             TEXT,
    dropoff_lat                 TEXT,
    dropoff_lon                 TEXT,
    status                      TEXT NOT NULL,
    passenger_count             TEXT,
    pick_odometer               TEXT,
    drop_odometer               TEXT
);

CREATE INDEX idx_trips_route ON trips(route_id);
CREATE INDEX idx_trips_pickup_time ON trips(scheduled_pickup_time);

-- Imported route data (one row per route, schema per Section 8.1.2)
CREATE TABLE routes (
    route_id              TEXT NOT NULL PRIMARY KEY,
    scheduled_start_time  TEXT NOT NULL,
    scheduled_end_time    TEXT NOT NULL,
    actual_start_time     TEXT,
    actual_end_time       TEXT
);

-- Tool configuration (single row, upserted on save)
CREATE TABLE settings (
    id                      INTEGER NOT NULL PRIMARY KEY CHECK (id = 1),
    avg_ride_time_min       INTEGER NOT NULL DEFAULT 28,
    otp_target_pct          REAL NOT NULL DEFAULT 85.0,
    productivity_baseline   REAL NOT NULL DEFAULT 1.8,
    deadhead_threshold_pct  REAL NOT NULL DEFAULT 60.0,
    service_day_start       TEXT NOT NULL DEFAULT '04:00',
    service_day_end         TEXT NOT NULL DEFAULT '21:00',
    day_type                TEXT NOT NULL DEFAULT 'weekday',
    time_range_start        TEXT,
    time_range_end          TEXT
);

-- Optimization state (single row for parameters; runs stored as JSON)
CREATE TABLE optimization (
    id                      INTEGER NOT NULL PRIMARY KEY CHECK (id = 1),
    target_productivity     REAL,
    min_otp_target          REAL,
    max_driver_spread_hrs   REAL,
    peak_vehicles           INTEGER,
    run_structure_json      TEXT  -- serialized array of run objects
);
```

The `settings` and `optimization` tables use a `CHECK (id = 1)` constraint to enforce single-row semantics — the application always upserts row 1 rather than inserting new rows. The optimization `run_structure_json` field stores the generated run cut as a JSON array since the structure is variable-length and read/written atomically.

> **FILL IN:** *Define the JSON schema for `run_structure_json` (e.g., array of objects with run_id, type, start_time, end_time, vehicle_id, trip_count). Specify whether additional indexes are needed on the trips table (e.g., on status for filtering completed vs. canceled trips). Define whether actual datetime fields in trips should be indexed for ride-time calculations.*

### 4.4.4 Persisted State Summary

| **Data**                | **Storage Location**          | **Description**                                                                              |
|-------------------------|-------------------------------|----------------------------------------------------------------------------------------------|
| Session metadata        | Session registry              | Tokens, name, password hash, timestamps, counts                                             |
| Trip data               | Per-session SQLite (`trips`)  | Full imported trip dataset as normalized rows                                                |
| Route data              | Per-session SQLite (`routes`) | Full imported route dataset as normalized rows                                               |
| Settings configuration  | Per-session SQLite (`settings`) | Average ride time, OTP target, productivity baseline, deadhead threshold, service day bounds |
| Day type / time range   | Per-session SQLite (`settings`) | Last active day type and time window                                                        |
| Optimization parameters | Per-session SQLite (`optimization`) | Target productivity, minimum OTP, max driver spread, peak vehicles                      |
| Optimized run structure | Per-session SQLite (`optimization`) | Generated run cut results at time of last save                                          |

## 4.5 Anonymous (Unsaved) Usage

Users can use the full tool without saving. In this mode, the URL remains at the root path, no tokens exist, and all data lives in browser memory. No data is transmitted to the server. The tool displays a prompt encouraging the user to save their work, which becomes more visible after the user runs an optimization.

If the user closes the browser tab or navigates away, all unsaved work is lost. There is no auto-save or recovery mechanism for anonymous sessions.

> **FILL IN:** *Define whether browser-level persistence (localStorage/sessionStorage) should be used to survive accidental page refreshes for unsaved sessions, even though the data would not be on the server.*

## 4.6 Session Lifecycle & Cleanup

Saved sessions persist indefinitely by default. A background cleanup process may be implemented to remove sessions that have not been accessed within a defined retention window. The `accessed_at` timestamp in the registry is updated on every page load (edit or read-only) to track activity.

Cleanup queries the registry to find stale sessions, then deletes both the registry row and the corresponding SQLite file:

```sql
-- Find sessions inactive for more than 90 days
SELECT edit_token FROM sessions
WHERE accessed_at < strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-90 days');
```

For each result, the cleanup process deletes `/data/sessions/{edit_token}.db` from disk and then removes the row from the registry. Both operations should be atomic per session — if the file deletion fails, the registry row is retained for retry.

| **Policy**               | Detail                                                                              |
|--------------------------|-------------------------------------------------------------------------------------|
| **Default Retention**    | Indefinite (no automatic deletion)                                                  |
| **Inactivity Threshold** | 90 days since last `updated_at` timestamp (configurable via server settings)         |
| **Deletion**             | Removes the registry record and deletes the per-session SQLite file from disk       |
| **Warning**              | No warning is sent before automatic cleanup (no email on file)                      |

The 90-day threshold is configurable via a server environment variable. Cleanup runs as a daily scheduled job. Deleted sessions return a "Session Not Found" page with an option to create a new run cut.

> **FILL IN:** *Define whether a backup/archive step should occur before deletion. Specify the exact cleanup schedule (e.g., daily at 3:00 AM UTC).*

# 5. Session API

The backend exposes a REST API for session management. All mutating endpoints require a valid JWT with edit-level access. Read endpoints accept either edit or read-only JWTs. JWT is passed as a `Bearer` token in the `Authorization` header.

| **Method** | **Endpoint**                  | **Auth Required**   | **Description**                                                                                |
|------------|-------------------------------|---------------------|------------------------------------------------------------------------------------------------|
| POST       | `/api/sessions`               | None                | Create a new session. Generates tokens, provisions SQLite file. Returns edit and readonly tokens, and a JWT. |
| GET        | `/api/sessions/{token}`       | JWT (edit or readonly) | Retrieve session state. The token can be either the edit or read-only token; the server resolves which. |
| PUT        | `/api/sessions/{edit_token}`  | JWT (edit)          | Update session state. Overwrites the SQLite database contents. Refreshes `updated_at`.         |
| PATCH      | `/api/sessions/{edit_token}/name` | JWT (edit)      | Rename the session.                                                                            |
| DELETE     | `/api/sessions/{edit_token}`  | JWT (edit)          | Delete the session. Removes registry record and SQLite file.                                   |
| POST       | `/api/sessions/{edit_token}/clone` | JWT (edit)     | Clone session to a new token pair and SQLite file. Returns new tokens and JWT.                 |
| GET        | `/api/sessions/{token}/trips` | JWT (edit or readonly) | Retrieve imported trip data. Supports pagination.                                           |
| GET        | `/api/sessions/{token}/routes`| JWT (edit or readonly) | Retrieve imported route data.                                                               |
| POST       | `/api/sessions/{edit_token}/auth` | None            | Authenticate with password. Returns a JWT with edit access on success. Returns `401` on failure. |
| PUT        | `/api/sessions/{edit_token}/password` | JWT (edit)  | Set or change the session password. Invalidates existing JWTs.                                 |
| DELETE     | `/api/sessions/{edit_token}/password` | JWT (edit)  | Remove password protection. Invalidates existing JWTs.                                         |

Rate limiting on the `/auth` endpoint: more than 5 failed authentication attempts within 30 seconds from the same session/IP combination triggers a 5-minute lockout. The server returns `429 Too Many Requests` with a `Retry-After` header during the lockout window.

> **FILL IN:** *Define request/response schemas for each endpoint. Specify file upload handling — are trip and route data uploaded as part of the initial POST body or as separate multipart file upload endpoints? Define maximum request size and error response format. Specify whether the GET endpoint should accept both edit and readonly tokens on the same path or use separate paths.*

# 6. Global Layout & Navigation

## 6.1 Application Header

A fixed header bar at the top of the viewport displays the application name (RunCut) with a subtitle, and a status indicator showing whether data has been loaded along with a summary count of trips and routes.

| **Element**          | Specification                                                             |
|----------------------|---------------------------------------------------------------------------|
| **App Name**         | RunCut — displayed as primary brand element, left-aligned                 |
| **Subtitle**         | Run Cutting & Optimization Tool                                           |
| **Status Indicator** | Green dot with trip/route count when data is loaded; hidden before import |

> **FILL IN:** *Specify any additional header elements: user avatar, logout, help link, environment indicator (dev/staging/prod)*

## 6.2 System Settings Bar

Visible only after data is imported. This bar sits between the header and the tab navigation and contains global controls that affect all downstream tabs.

### 6.2.1 Day of Week Selection

The day selection controls allow filtering imported data by time period. If the imported dataset spans multiple days, weeks, or months, the system settings bar provides filtering at multiple levels: by date range (month picker or custom range), by day of week (Monday through Sunday multi-select), and by day type (Weekday vs. Weekend toggle). All analysis views show averages across the selected filter. The imported file contains all days and is filtered client-side based on these selections.

> **FILL IN:** *Define the default filter on load (e.g., all weekdays in the most recent complete month). Specify whether individual date selection (pick a specific day) should be supported alongside range/filter selection. Define how the UI adapts when the dataset contains only a single day vs. a full year.*

### 6.2.2 Time Range Slider

A dual-handle range slider that controls the visible time window across all tabs. The full range spans the service day. Both handles are draggable, and the selected range is displayed as a label to the right of the slider (e.g., “5:00 AM — 8:15 PM”). A minimum gap of one hour is enforced between handles.

| **Parameter**      | Detail                           |
|--------------------|----------------------------------|
| **Full Range**     | 4:00 AM — 9:00 PM (configurable) |
| **Increment**      | 15-minute blocks                 |
| **Minimum Window** | 1 hour (4 blocks)                |
| **Default**        | Full range on load               |

> **FILL IN:** *Define whether the full range bounds are fixed or configurable per client/contract. Specify if the time range should persist across day-type changes or reset to full range.*

## 6.3 Tab Navigation

Seven horizontal tabs provide access to the main functional areas. Tabs other than Import are disabled until data is loaded. The active tab is indicated with an underline accent and text weight change.

| **Tab** | **Label**     | **Purpose**                                |
|---------|---------------|--------------------------------------------|
| 1       | Import        | File upload and data loading               |
| 2       | Demand        | Demand visualization with vehicle overlay  |
| 3       | Performance   | OTP and productivity metrics               |
| 4       | Trip Map      | Geographic heatmap with time scrubber      |
| 5       | Run Structure | Current vs. optimized run Gantt charts     |
| 6       | Optimize      | Parameter sliders with live cost estimates |
| 7       | Deadhead      | Deadhead analysis and high-DH trip review  |

> **FILL IN:** *Define whether tab order is fixed or if tabs can be reordered/hidden based on user role or configuration*

# 7. Landing & Session Management

The tool's entry point serves two purposes: starting a new run cut and returning to a previously saved one.

## 7.1 Root Landing Page

When a user visits the root URL (no session key), they see the Import tab with the standard file upload interface. A secondary panel or section below the upload area shows a way to access a previous session.

### 7.1.1 Return to Previous Session

A text input allows the user to paste or type a 12-digit edit token to navigate to an existing run cut. The input validates the hex format in real time and provides a "Load Session" button. On submission, the browser navigates to `/s/{edit_token}`.

Alternatively, users can simply bookmark or share the full session URL directly. The token input is a convenience for users who have the key but not the full URL.

> **FILL IN:** *Define whether the landing page should also display recently accessed sessions using browser localStorage (a local-only list of edit tokens and names the user has visited). This would provide a "recent sessions" list without requiring server-side user accounts.*

## 7.2 Session URL Behavior

### 7.2.1 Edit URL (`/s/{edit_token}`)

| **Scenario**                     | **Behavior**                                                                                 |
|----------------------------------|----------------------------------------------------------------------------------------------|
| Valid token, no password         | Anonymous JWT issued; full state restored with write access                                   |
| Valid token, password set        | Password prompt displayed; JWT issued on success; full state restored with write access       |
| Invalid/unknown token            | "Session Not Found" message with option to create a new run cut                              |
| Expired/deleted session          | Same as invalid token                                                                        |

### 7.2.2 Read-Only URL (`/r/{readonly_token}`)

| **Scenario**                     | **Behavior**                                                                                 |
|----------------------------------|----------------------------------------------------------------------------------------------|
| Valid token                      | Read-only JWT issued; full state loaded; all editing controls disabled                       |
| Invalid/unknown token            | "Session Not Found" message                                                                  |

In read-only mode, the UI disables all mutating controls: the save button, optimization sliders, settings panel, rename, and delete. The user can view all tabs, hover for tooltips, and interact with charts, but cannot change any data. A banner at the top of the page indicates read-only access and provides context (e.g., "Viewing [session name] — read-only").

## 7.3 Save & Update Flow

The save action differs depending on whether a session already exists.

### 7.3.1 First Save (New Session)

1. User clicks "Save Run Cut" from the header or the Optimize tab.

2. A dialog prompts the user to enter a name for the run cut and optionally set a password.

3. On confirmation, the backend generates edit and read-only tokens, creates a new SQLite database file, and persists all current state.

4. The URL updates to `/s/{edit_token}`. The read-only link is displayed in the header. A confirmation message encourages the user to bookmark the page.

### 7.3.2 Subsequent Saves (Existing Session)

If the user is already in an edit session, the save action overwrites the existing SQLite database contents. The edit token does not change. The `updated_at` timestamp is refreshed. A brief confirmation toast confirms the save.

### 7.3.3 Save As New

A "Save As New" option in the save dialog creates a new session with new edit and read-only tokens from the current state. A new SQLite file is created. The original session remains unchanged, and the URL updates to the new edit token.

## 7.4 Read-Only Link Display

When a user is in an edit session, the read-only URL is visible in the header area. It is displayed as a compact monospace string with a copy-to-clipboard button. Clicking the button copies the full read-only URL (e.g., `https://runcut.app/r/e7b204f1c8a9`) to the clipboard with a brief confirmation toast.

The read-only link is only visible in the edit view — it is not shown when accessing the session via the read-only URL itself.

> **FILL IN:** *Define the exact placement and visual treatment of the read-only link in the header. Specify whether the link should be always visible or tucked behind a "Share" button/menu.*

## 7.5 Rename

The session name is displayed in the header next to the app title when a session is active. Clicking the name opens an inline edit field to rename it. The rename is saved immediately to the session registry.

## 7.6 Password Management

From the session menu in the header, the user can set, change, or remove the session password. Changing the password invalidates all existing JWTs for that session — any other browser with an active edit session will need to re-authenticate on their next API call.

| **Action**          | **Behavior**                                                                                |
|---------------------|---------------------------------------------------------------------------------------------|
| Set password        | Prompts for new password; stores bcrypt hash in registry                                    |
| Change password     | Prompts for current password and new password; updates hash; invalidates existing JWTs      |
| Remove password     | Prompts for current password to confirm; clears hash; session becomes unprotected           |

Removing a password requires the current password for confirmation. JWT invalidation is not performed on password change — existing tokens expire naturally after their 3-day TTL. This avoids the complexity of token blacklists or per-session signing secrets.

> **FILL IN:** *Evaluate whether the 3-day natural expiration window is acceptable for the security model, or if password changes should force re-authentication sooner.*

## 7.7 Delete Session

A "Delete This Run Cut" option is available in the session menu when in an edit session. Deletion is permanent.

1. User clicks "Delete This Run Cut" from the session menu.

2. A confirmation dialog states that this action is permanent and all data will be removed.

3. On confirmation, the server deletes the registry record and removes the SQLite file from disk. The user is redirected to the root landing page.

| **Data Deleted**             | Detail                                                          |
|------------------------------|-----------------------------------------------------------------|
| **Registry record**          | Edit token, read-only token, name, password hash, timestamps    |
| **Session database file**    | The SQLite file and all trip, route, settings, and results data |

> **FILL IN:** *Define whether deletion should have a grace period or undo window (e.g., 30-second undo toast), or if it is immediately irreversible.*

## 7.8 Header State by Session Context

The application header adapts based on the current session context.

| **State**                       | **Header Display**                                                                                                          |
|---------------------------------|-----------------------------------------------------------------------------------------------------------------------------|
| Root URL, no data               | App name and subtitle only                                                                                                  |
| Root URL, data loaded (unsaved) | App name, subtitle, data status indicator, "Save Run Cut" button                                                            |
| Edit session, data loaded       | App name, session name (editable), data status indicator, read-only link (copyable), "Save" button, session menu            |
| Read-only session               | App name, session name (not editable), data status indicator, "Read-Only" banner, no save/edit/delete controls              |
| Password prompt                 | App name, session name, password input field, "Unlock" button                                                               |

# 8. Import Tab

The Import tab is the entry point for the application. It presents two file upload zones and a settings panel.

## 8.1 File Upload Areas

Two distinct drop zones are provided, each with a dashed border and helper text indicating the expected file type and column structure.

### 8.1.1 Trip Data Upload

Accepts the trip manifest file containing individual trip records.

| **Field**            | Specification                                                                 |
|----------------------|-------------------------------------------------------------------------------|
| **Accepted Formats** | CSV, XLSX                                                                     |
| **Interaction**      | Drag-and-drop or click-to-browse                                              |
| **Validation**       | Column header matching on upload; error display for missing/malformed columns |

The trip data file must contain the following columns. All time fields use datetime format (YYYY-MM-DD HH:MM:SS). All other fields are strings.

| **Column**                 | **Type** | **Description**                                                          |
|----------------------------|----------|--------------------------------------------------------------------------|
| trip_id                    | String   | Unique identifier for the trip                                           |
| scheduled_pickup_time      | Datetime | Scheduled time for vehicle arrival at pickup location                    |
| scheduled_appointment_time | Datetime | Passenger’s appointment time at the destination                          |
| pickup_arrive_time         | Datetime | Actual time vehicle arrived at the pickup address                        |
| pickup_leave_time          | Datetime | Actual time vehicle departed the pickup address with passenger           |
| dropoff_arrive_time        | Datetime | Actual time vehicle arrived at the dropoff address                       |
| dropoff_leave_time         | Datetime | Actual time vehicle departed the dropoff address after passenger exit    |
| route_id                   | String   | Route assignment for the trip; foreign key to route data                 |
| pickup_address             | String   | Full street address of the pickup location                               |
| pickup_lat                 | String   | Latitude of the pickup location                                          |
| pickup_lon                 | String   | Longitude of the pickup location                                         |
| dropoff_address            | String   | Full street address of the dropoff location                              |
| dropoff_lat                | String   | Latitude of the dropoff location                                         |
| dropoff_lon                | String   | Longitude of the dropoff location                                        |
| status                     | String   | Trip completion status (e.g., completed, no-show, canceled, late cancel) |
| passenger_count            | String   | Number of passengers on the trip                                         |
| pick_odometer              | String   | Vehicle odometer reading at pickup                                       |
| drop_odometer              | String   | Vehicle odometer reading at dropoff                                      |

Trip miles are derived from the odometer readings: drop_odometer minus pick_odometer. Deadhead miles between consecutive trips on the same route can be calculated from the prior trip’s drop_odometer to the current trip’s pick_odometer.

> **FILL IN:** *Define validation rules: how are null/missing datetime fields handled? Which fields are strictly required vs. optional? Specify accepted status values and how each status type is treated in calculations (e.g., are no-shows counted in demand but excluded from OTP?). Define how duplicate trip_ids are handled. Specify expected precision for lat/lon fields.*

### 8.1.2 Route Schedule Upload

Accepts the route schedule file defining route assignments and their scheduled versus actual time windows.

| **Field**            | Specification                                                             |
|----------------------|---------------------------------------------------------------------------|
| **Accepted Formats** | CSV, XLSX                                                                 |
| **Interaction**      | Drag-and-drop or click-to-browse                                          |
| **Validation**       | Cross-referencing route_ids against trip data; datetime format validation |

The route data file must contain the following columns. All time fields use datetime format (YYYY-MM-DD HH:MM:SS). All other fields are strings.

| **Column**           | **Type** | **Description**                                               |
|----------------------|----------|---------------------------------------------------------------|
| route_id             | String   | Unique route identifier; primary key, referenced by trip data |
| scheduled_start_time | Datetime | Planned start time for the route (first pull-out)             |
| scheduled_end_time   | Datetime | Planned end time for the route (last pull-in)                 |
| actual_start_time    | Datetime | Actual time the route began service                           |
| actual_end_time      | Datetime | Actual time the route ended service                           |

Service hours are derived from actual_end_time minus actual_start_time. Revenue hours are calculated by subtracting deadhead time from service hours. Scheduled versus actual comparisons enable schedule adherence analysis across the run structure.

> **FILL IN:** *Define how orphaned routes (routes with no matching trips) are handled. Specify how routes that span midnight are treated. Define whether additional route-level fields are needed (e.g., vehicle_id, driver_id, base/depot assignment, route type). Clarify how revenue hours are distinguished from service hours in practice.*

## 8.2 Settings Panel

The Settings button opens a configuration panel that controls how imported data is processed and how calculations are performed throughout the tool.

### 8.2.1 Service Parameters

1.  **Average Ride Time** — Used for the demand carry-forward calculation. Default: 28 minutes. The number of prior 15-minute blocks whose pickups are added to the current block’s on-board count is derived from this value (e.g., 28 min = 2 prior blocks).

2.  **OTP Target** — The on-time performance threshold used as the target line on the Performance tab. Default: 85%.

3.  **Productivity Baseline** — The trips-per-revenue-hour value considered acceptable. Used for color-coding productivity charts.

4.  **Service Day Bounds** — The earliest and latest times that define the full service day. Controls the available range of the time range slider. Default: 4:00 AM — 9:00 PM.

5.  **Deadhead Threshold** — The percentage of trip miles attributable to deadhead above which a trip is flagged as “high deadhead.” Used in the Deadhead Review tab. Default: 60%.

> **FILL IN:** *Add any additional settings: timezone handling, on-time window definition (e.g., 0-15 min late = on time), fare/cost inputs for revenue calculations, contract-specific parameters, client/site selection if multi-tenant*

### 8.2.2 Display Preferences

1.  **Time Format** — 12-hour (default) or 24-hour display.

2.  **Distance Unit** — Miles (default) or kilometers.

> **FILL IN:** *Add any additional display/export preferences, color-blind mode toggle, chart density options, etc.*

## 8.3 Import Actions

After files are staged, the primary action button processes both uploads, validates data, and transitions the user to the Demand tab. A demo dataset option is available for evaluation and testing purposes, loading a synthetic dataset (847 weekday trips across 32 routes) with a single click.

> **FILL IN:** *Define error handling: what happens if only one file is uploaded? Is partial data usable? Specify any file size limits, processing time expectations, and whether import is async with a progress indicator.*

# 9. Demand Analysis Tab

Displays the service demand profile broken into 15-minute increments, with an active vehicle overlay and deadhead heatmap.

## 9.1 Summary Metrics

Four metric cards are displayed at the top of the tab:

| **Metric**    | **Description**                                            | **Source**                             |
|---------------|------------------------------------------------------------|----------------------------------------|
| Peak Pickups  | Highest pickup count in any single 15-min block            | Trip data, pickup_time field           |
| Peak On-Board | Highest estimated concurrent passengers                    | Derived from carry-forward calculation |
| Peak Vehicles | Highest active vehicle count in any block                  | Route data, vehicle_id + time overlap  |
| Total Trips   | Count of all trips in the selected day type and time range | Trip data, filtered                    |

> **FILL IN:** *Define how each metric is calculated from the raw data. Specify whether canceled/no-show trips are included or excluded. Clarify the exact carry-forward formula and how partial overlaps are handled.*

## 9.2 Demand and Active Vehicles Chart

A composite chart combining a bar chart (demand) with a line overlay (active vehicles). The x-axis represents 15-minute time blocks within the selected time range. The y-axis is shared and auto-scaled to the higher of peak demand or peak vehicles.

### 9.2.1 Bar Layer — Demand

Each time block shows two overlapping bars. The primary bar (solid, foreground) represents new pickups in that block. The secondary bar (translucent, background) represents the estimated on-board count, which includes pickups from the current block plus carry-forward passengers from prior blocks based on the average ride time setting.

| **Parameter**           | Detail                                                                         |
|-------------------------|--------------------------------------------------------------------------------|
| **Carry-Forward Logic** | Avg ride time of 28 min = pickups from 2 prior blocks added to current block   |
| **Visual**              | Primary bar: solid accent blue; Secondary bar: translucent blue behind primary |

> **FILL IN:** *Define the precise carry-forward formula. Is it a flat add of prior block totals, or a decay function? How are dropoffs factored in? Should the average ride time be per-route or system-wide?*

### 9.2.2 Line Layer — Active Vehicles

A dashed line graph overlaid on the bar chart showing the number of vehicles in revenue service during each time block. Dots appear on hover at the data point under the cursor.

> **FILL IN:** *Define how active vehicles are counted — is it based on route schedule start/end times, or actual trip assignment? Are vehicles in deadhead counted as active?*

### 9.2.3 Tooltip

Hovering any time block displays a tooltip showing: the time label, pickup count, estimated on-board count, and active vehicle count for that block.

## 9.3 Deadhead Intensity Heatmap

A horizontal heatmap bar spanning the selected time range. Each cell represents one 15-minute block, colored by the percentage of total miles in that block attributable to deadhead. Darker shading indicates higher deadhead. A tooltip appears on hover showing the exact percentage.

| **Parameter**   | Detail                                  |
|-----------------|-----------------------------------------|
| **Color Scale** | Light (low DH%) to dark blue (high DH%) |
| **Tooltip**     | Time label + deadhead percentage        |
| **Legend**      | Three-level: Low, Medium, High          |

> **FILL IN:** *Define deadhead calculation: total deadhead miles / total trip miles per block? Or deadhead miles / total miles (DH + revenue)? Specify color scale breakpoints.*

# 10. Performance Tab

Displays on-time performance and productivity metrics by 15-minute block.

## 10.1 Summary Metrics

| **Metric**          | **Description**                                              |
|---------------------|--------------------------------------------------------------|
| Avg OTP             | Weighted average on-time percentage across all active blocks |
| Blocks Below Target | Count of 15-min blocks falling below the OTP target          |
| Avg Productivity    | Average trips per revenue hour across all active blocks      |
| Peak Productivity   | Highest trips-per-revenue-hour value in any single block     |

> **FILL IN:** *Define OTP calculation: on-time window (e.g., 0–15 min after scheduled pickup), how early arrivals are treated, how no-shows factor in. Define productivity: trips completed / revenue hours, or trips assigned / service hours?*

## 10.2 On-Time Performance Chart

A bar chart where each bar represents one 15-minute block’s OTP percentage. Bars are color-coded by severity: green for 90%+, amber for 85–90%, and red for below 85%. A horizontal reference line is drawn at the OTP target (default 85%). Blocks with no trips show as empty.

> **FILL IN:** *Specify whether the 85% target line value comes from Settings or is hard-coded. Define how blocks with fewer than N trips are handled (suppress for statistical insignificance?).*

## 10.3 Productivity Chart

A bar chart showing trips per revenue hour for each 15-minute block. Blocks at the start and end of service typically show lower productivity, which is highlighted in the UI with a contextual note about potential over-allocation.

> **FILL IN:** *Define the trips-per-revenue-hour formula precisely. Is it (trips completed in block) / (sum of active vehicle-hours in block)? How are split runs counted during gaps?*

# 11. Trip Map Tab

A geographic heatmap showing trip pickup density that updates dynamically as the user scrubs through 15-minute time blocks.

## 11.1 Heatmap Canvas

The map renders trip pickup locations as heat blooms on a canvas element. Red indicates high density in the selected block; blue ambient glow shows activity from adjacent 30-minute windows for context. Individual pickup points are rendered as small dots at the center of each heat bloom.

| **Parameter**     | Detail                                                 |
|-------------------|--------------------------------------------------------|
| **Primary Layer** | Red heat blooms for trips in the selected 15-min block |
| **Context Layer** | Blue glow for trips in adjacent blocks (±30 min)       |
| **Point Layer**   | Small dots at pickup coordinates                       |
| **Background**    | Grid overlay with cardinal direction labels            |

Geocoding is not handled within this tool in the first pass — the imported data is expected to include lat/lon coordinates. The map view uses the coordinates as provided. If lat/lon fields are empty for a trip, that trip is excluded from the map visualization.

> **FILL IN:** *Define whether this should use a real mapping library (Mapbox, Leaflet, Google Maps) or remain a canvas-based abstract view. Define the geographic bounds — auto-fit to data extent, or configurable? Specify whether a future phase should add geocoding for trips with addresses but no coordinates.*

## 11.2 Time Scrubber

A single-handle slider below the map that spans the full service day (4:00 AM — 9:00 PM). Dragging the slider updates the heatmap in real time. The current time block label and trip count for that block are displayed alongside the slider.

> **FILL IN:** *Specify whether the map time scrubber should respect the global time range filter or always show the full day. Define animation/playback capability (auto-play through the day).*

## 11.3 Legend and Context

A side panel displays a color legend (high/medium density, adjacent blocks) along with a description of how the visualization works.

> **FILL IN:** *Add any additional map features: route path overlays, depot/base locations, zone boundaries, click-to-inspect individual trips*

# 12. Run Structure Tab

A side-by-side comparison of the current run structure and the optimized recommendation, displayed as Gantt-style timelines with a detailed table below.

## 12.1 Summary Metrics

| **Metric**              | **Description**                                      |
|-------------------------|------------------------------------------------------|
| Current Runs            | Total number of runs in the imported schedule        |
| Optimized Runs          | Total number of runs in the optimized recommendation |
| Imported Service Hours  | Total service hours from imported route data         |
| Optimized Service Hours | Estimated service hours from the optimized run cut   |

## 12.2 Gantt Charts

Two horizontally-stacked Gantt charts are displayed, one for the current structure and one for the optimized recommendation. Each run is a horizontal bar positioned by its start and end time. The y-axis lists run IDs. Hour markers are displayed along the x-axis. Full-time runs are shown at full opacity; split runs are shown at reduced opacity.

| **Feature**       | Detail                                                          |
|-------------------|-----------------------------------------------------------------|
| **Hover Tooltip** | Run ID, type (Full/Split), start time, end time, trip count     |
| **Color Coding**  | Current runs: neutral gray; Optimized runs: accent blue         |
| **Opacity**       | Full runs: 85%; Split runs: 60%                                 |
| **Time Axis**     | Aligned to the selected time range from the system settings bar |

The optimized run structure is generated server-side. The client sends the optimization parameters to the API, the server computes the result against the session's trip and route data, and returns the optimized run set.

> **FILL IN:** *Define how runs are identified and categorized (Full vs. Split). Define how pull-out/pull-in deadhead is represented on the Gantt (separate bars, different color at ends of run bar?). Specify expected computation time and whether a loading/progress indicator is needed.*

## 12.3 Detail Comparison Table

A scrollable table showing each run side by side: current type, start, end, and trip count alongside the optimized recommendation for the same run. The table is truncated at 12 rows with an indicator showing total run count.

> **FILL IN:** *Define whether all runs are exportable as CSV/XLSX. Specify sorting options (by start time, by trip count, by delta). Define how new/removed runs in the optimized set are displayed.*

# 13. Optimize Run Cut Tab

The optimization interface provides four parameter sliders that drive a real-time estimation model. As sliders are adjusted, the estimated outcomes and comparison metrics update immediately.

## 13.1 Optimization Parameters

| **Slider**          | **Range**          | **Default** | **Description**                                                                            |
|---------------------|--------------------|-------------|--------------------------------------------------------------------------------------------|
| Target Productivity | 1.0 – 3.5 trips/hr | 2.0         | Desired trips per revenue hour. Higher values reduce vehicle needs but may impact OTP.     |
| Minimum OTP Target  | 75% – 98%          | 85%         | Floor for acceptable on-time performance. Values above 90% may require more service hours. |
| Max Driver Spread   | 8 – 14 hrs         | 12          | Maximum elapsed time between a driver’s first pull-out and last pull-in.                   |
| Peak Vehicles       | 12 – 36            | 24          | Maximum number of vehicles in revenue service during peak demand.                          |

The optimization model runs server-side against the session's SQLite database. The client sends parameter values via the API; the server computes the result and returns the optimized run structure.

Additional parameters to be supported for labor/union compliance:

| **Parameter** | **Description** |
|---|---|
| **Break Duration** | Required break length (e.g., 30 minutes) after a defined number of work hours |
| **Max Hours Before Break** | Maximum consecutive work hours before a break is required (e.g., 5 hours) |
| **Max Shift Duration** | Maximum total shift length including breaks |

> **FILL IN:** *Define the optimization algorithm (heuristic, linear program, constraint solver). Specify computation time expectations and whether a progress indicator is needed. Define additional labor constraints: overtime thresholds, minimum gap between shifts, base/depot pull-out/pull-in requirements.*

## 13.2 Estimated Outcomes Panel

A highlighted card displaying six estimated metrics that update in real time as sliders change:

1.  **Est. Service Hours** — Total estimated hours including deadhead and breaks.

2.  **Est. Revenue Hours** — Hours spent in active passenger service.

3.  **Est. OTP** — Predicted on-time performance. Color-coded green (≥85%) or red (\<85%).

4.  **Est. Deadhead %** — Predicted deadhead as a percentage of total miles.

5.  **Est. Productivity** — Predicted trips per revenue hour.

6.  **Peak Vehicles** — Reflects the slider value directly.

> **FILL IN:** *Define which of these are direct slider reflections vs. computed outputs. Specify confidence intervals or ranges if applicable. Define whether the user can lock certain estimates and let the solver adjust the others.*

## 13.3 Comparison Panel

A comparison card showing imported baseline values versus optimized estimates for service hours, revenue hours, and average trip miles. Each row shows the original value, an arrow, the new value, and a percentage delta. Positive deltas (increases) are shown in red; negative deltas (reductions) are shown in green.

> **FILL IN:** *Add additional comparison metrics: cost per trip, cost per revenue hour, total daily cost estimate. Define whether the user can export the optimized parameters as a report.*

# 14. Deadhead Review Tab

Focuses on deadhead analysis with mileage breakdowns and identification of the highest-deadhead trips at service bookends.

## 14.1 Summary Metrics

| **Metric**           | **Description**                                         |
|----------------------|---------------------------------------------------------|
| Avg Trip Miles       | Mean total miles per trip across the service day        |
| Avg DH Miles (Start) | Mean deadhead miles during the first 2 hours of service |
| Avg DH Miles (End)   | Mean deadhead miles during the last 2 hours of service  |

> **FILL IN:** *Define what constitutes “first 2 hours” and “last 2 hours” — is it clock time (e.g., 4:00–6:00 AM) or relative to the first/last trip? Specify whether DH miles include travel to/from depot.*

## 14.2 Deadhead Ratio Heatmap

The same heatmap component used in the Demand tab, repeated here for context. Shows deadhead percentage by 15-minute block.

## 14.3 High Deadhead Trip Tables

Two tables listing individual trips where deadhead exceeds the configured threshold (default 60% of total trip miles). One table covers the start-of-service window; the other covers end-of-service.

| **Column** | **Description**                                 |
|------------|-------------------------------------------------|
| Trip ID    | Unique trip identifier from imported data       |
| Route      | Route assignment for the trip                   |
| Trip Miles | Total miles for the trip (revenue + deadhead)   |
| DH Miles   | Deadhead miles for the trip, highlighted in red |
| Area       | Geographic area or zone of the trip             |

The area/zone field is derived from the imported data (not geocoded within the tool in the first pass). Trips are sorted by deadhead miles descending.

> **FILL IN:** *Define the maximum number of rows displayed and whether the full list is exportable. Add any trip-level actions: click to view on map, click to reassign.*

# 15. Export & Reporting

> **FILL IN:** *Define all export capabilities: exportable views (which tabs can be exported?), file formats (CSV, XLSX, PDF report), what data is included in each export. Specify any scheduled reporting, email delivery, or integration with other systems.*

# 16. Resolved Questions

Decisions made during scope review:

| **#** | **Question** | **Resolution** |
|-------|-------------|----------------|
| 1 | Should the optimization model run client-side or server-side? | Server-side. Client sends parameters via API; server computes against session data. |
| 2 | Is multi-day analysis in scope? | Yes. Users may upload a year of data. The tool supports filtering by date range, month, day of week, and weekday/weekend. All views show averages across the selected filter. |
| 3 | Should the tool support A/B comparison of datasets? | No. Single dataset per session. |
| 4 | Maximum dataset size (trips per day)? | No enforced limit. |
| 5 | Union/labor agreement constraints? | Yes. The optimization model must support configurable break duration, max hours before break, and max shift duration. |
| 6 | Is geocoding handled in this tool? | Not in the first pass. Imported data is expected to include lat/lon. Trips without coordinates are excluded from the map view. |
| 7 | Maximum SQLite file size per session? | No enforced limit. |
| 8 | Session retention for inactive sessions? | 90 days from last `updated_at` timestamp. Configurable via server environment variable. |
| 9 | Is 48-bit hex keyspace sufficient? | Yes. 48-bit (12 hex digits) is sufficient for both edit and read-only tokens. |
| 10 | JWT invalidation on password change? | No active invalidation. JWTs expire naturally after 3 days. No token blacklist or per-session secrets. |
| 11 | Rate limiting on `/auth`? | Yes. 5 failed attempts in 30 seconds from the same session/IP triggers a 5-minute lockout. Server returns `429` with `Retry-After` header. |
| 12 | Session registry storage? | Single SQLite database (`registry.db`). Sufficient for the expected scale. |

# 17. Remaining Open Questions

Items still requiring resolution:

1. What optimization algorithm should be used (heuristic, linear program, constraint solver)?

2. Should the day/date filter default to all weekdays in the most recent complete month, or the full dataset?

3. Should the map view use a real mapping library (Mapbox, Leaflet, Google Maps) or remain canvas-based?

4. What are the specific labor constraint defaults (break duration, max hours before break, max shift)?

5. Should the JWT 3-day expiration use a sliding window (refreshed on activity) or fixed from issuance?

6. Should a future phase add geocoding for trips with addresses but no lat/lon coordinates?

7. What is the expected server-side computation time for the optimization model, and is a progress indicator needed?

> **FILL IN:** *Add additional open questions as they arise during development*