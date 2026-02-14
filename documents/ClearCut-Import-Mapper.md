# ClearCut Import Mapper

## Overview

ClearCut now supports a guided import mapper workflow for CSV/XLSX uploads. The mapper lets users:

- preview the first 100 rows before import
- map source event values to canonical event types
- map source fields to ClearCut trip and route schema fields
- configure matching keys for trip/route updates
- save reusable import templates with source system metadata
- apply mapped imports and review import outcomes

## UI Flow

Within `ClearCut > Import`:

1. Select import option:
   - **Trip Import Wizard**
   - **Flat File Import**
2. If Trip Import Wizard:
   - select file (`.csv`, `.xlsx`, `.xls`)
   - preview first 100 rows
   - map event column + event values
   - map source columns to trip/route fields
   - configure match keys + create-missing behavior
   - validate + apply import
   - save/load/delete reusable templates
   - use Back to return to import options
3. If Flat File Import:
   - upload flat trip file
   - upload flat route file
   - download sample CSV templates for both
   - use Back to return to import options

## Derived System Settings Display

The Import tab service-hour summary is display-only and auto-derived from imported trip data:

- Start = earliest pickup/event timestamp minus 1 hour
- End = latest dropoff/event timestamp plus 1 hour
- Timestamp precedence: **actual times first**, then scheduled fallback
- If resulting span crosses midnight, service hours are displayed as `24:00`

Import tab also includes collapsible data viewers for existing trips and routes.

## Canonical Event Types

- `pullout`
- `pullin`
- `pickup`
- `dropoff`
- `break`
- `other`

## API Endpoints

### Session-scoped mapper endpoints

- `POST /api/clearcut/sessions/[token]/import/preview`
  - multipart: `file`
  - returns headers, first 100 rows, total row count

- `POST /api/clearcut/sessions/[token]/import/validate-mapping`
  - json: `{ preview, config }`
  - returns `valid`, `errors`, `warnings`, summary

- `POST /api/clearcut/sessions/[token]/import/apply`
  - multipart: `file`, `config` (JSON string)
  - applies mapping and matching to trips/routes
  - returns created/updated/skipped/error summary

### Import template endpoints

- `GET /api/clearcut/import-templates?token=<edit_token>`
- `POST /api/clearcut/import-templates`
- `PATCH /api/clearcut/import-templates/[id]`
- `DELETE /api/clearcut/import-templates/[id]`

Template records include:

- `template_name`
- `source_system`
- `notes`
- serialized event mapping
- serialized field mapping
- serialized match rules

## Notes

- Mapper is edit-auth protected and requires a valid edit JWT.
- Existing legacy trip/route import controls remain available in the Import tab.
- Matching supports both trip and route entities in v1.
