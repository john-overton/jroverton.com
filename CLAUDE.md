# CLAUDE.md

## Project Overview

Next.js 16 monorepo hosting two distinct apps under `website/`:
- **jroverton.com** — Personal portfolio and blog
- **Parallax** — Operations management and route visualization tool

## Directory Structure

```
website/
  app/                          Main site pages (home, blog) + root layout
    components/                 Main site components (React Bootstrap)
    blog/                       Blog pages
    parallax/                   Parallax app (pages, components, theme)
      components/               Parallax components (shadcn/ui + custom)
      theme/                    ClearCut design system (provider + palettes)
      admin/                    Admin panel
    api/parallax/               All API routes (session-token-based)
  lib/parallax/                 Server-side logic (auth, DB, import, algorithms)
  public/                       Static assets
  scripts/                      Shell scripts (setup, dev, build, clean)
documents/                      Detailed documentation and specs
```

## Build & Dev Commands

All commands run from `website/`:

```sh
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # ESLint
npm start        # Start production server
```

## Theming — Two Separate Systems

The main site and Parallax use completely different styling stacks. Do not mix them.

**Main site (jroverton.com):**
- Bootstrap 5 + React Bootstrap
- CSS variables in `app/globals.css` (paper/ink color palette)
- EB Garamond font
- Components in `app/components/ui/` use React Bootstrap

**Parallax (ClearCut Design System):**
- Tailwind CSS 4 + shadcn/ui
- Theme provider: `app/parallax/theme/ClearcutThemeProvider.tsx`
- 4 switchable palettes: `app/parallax/theme/palettes.ts`
- CSS config: `app/parallax/parallax.css`
- shadcn/ui config: `components.json`
- Fonts: Inter, JetBrains Mono, Outfit, DM Sans, DM Serif Display
- Components in `app/parallax/components/` use shadcn/ui primitives

## API Routes

All under `app/api/parallax/`. Session-token-based routing pattern:
`/api/parallax/sessions/[token]/...`

Covers: trips, routes, import, auth, admin, metrics, demo data.

## Database

SQLite via better-sqlite3 (server-side only).
- Schema: `lib/parallax/schema.ts`
- Session DB: `lib/parallax/session-db.ts`

## Environment Variables

Required env vars live in `website/.env.local` (not committed). Key variables:
- `NEXT_PUBLIC_MAPBOX_TOKEN` — Mapbox GL public token
- `NEXT_PUBLIC_MAPBOX_STYLE` — Custom Mapbox style URL
- `CLEARCUT_JWT_SECRET` — JWT signing secret for Parallax auth
- `PARALLAX_ADMIN_PASSWORD` — Admin panel password

## Documentation

Detailed specs live in `documents/`:
- `ClearCut.md` — Main Parallax specification
- `ARCHITECTURE.md` — System architecture
- `ClearCut-Schema-API-Auth.md` — Database schema and auth details
- `ClearCut-Import-Mapper.md` — Import mapping logic
- `ClearCut-RunStructure.md` — Run/route data structure
