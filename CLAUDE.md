# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

There are no tests. No test runner is configured.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```
TURSO_CONNECTION_URL=libsql://...
TURSO_AUTH_TOKEN=...
BETTER_AUTH_SECRET=...   # Used as JWT secret — must be ≥ 32 chars
ADMIN_USERNAME=admin     # Seed admin username (only used on first run)
ADMIN_PASSWORD=admin123  # Seed admin password (only used on first run)
```

## Architecture Overview

This is a **Next.js 16 App Router** inventory and discount management system for a retail chain. It is deployed on Vercel with a Turso (cloud LibSQL) database.

### User Roles & Route Layout

Three roles gate two separate sections:

| Role | Access |
|---|---|
| `client` | `/client/*` only |
| `admin` | `/admin/*` (module-gated) |
| `administrador_general` | All `/admin/*` + permisos page |

- `/(auth)/login` — public login page
- `/admin/*` — admin section; layout calls `initDatabase()` on every render (idempotent)
- `/client/*` — client section; lighter layout, no DB init

### Auth

Custom JWT auth — **not** the `better-auth` package (it is installed but unused). The `BETTER_AUTH_SECRET` env var is repurposed as the JWT signing secret via `jose`.

- Token stored in `session-token` httpOnly cookie (24h)
- `getSession()` in `src/lib/actions.ts` is the entry point for reading the session in Server Components and Actions
- `getSessionFromRequest(request)` in `src/lib/auth.ts` is used inside API route handlers
- Admins have per-module access controlled by the `admin_modules` join table; `requireModule(moduleId)` enforces it
- `administrador_general` bypasses all module checks

### Database

Turso singleton in `src/lib/turso.ts` — use the exported `turso` object, not `getTurso()` directly.

Schema is managed in `src/lib/db-schema.ts`. `initDatabase()` is idempotent: it runs `CREATE TABLE IF NOT EXISTS` for every table, then applies column-level migrations via `PRAGMA table_info`. Never add schema changes by hand — add them as a migration block inside `initDatabase()`.

**Core tables:**
- `productos` — keyed by `(cod_universal, genero)`
- `variantes` — keyed by `cod_barras`; FK → `productos`
- `producto_imagenes` — override table for product images; `source` is `'archivo'` (from upload) or `'sistema'` (admin-set URL)
- `descuento_updates` — in-progress discount changes for the current cycle
- `descuento_updates_historial` — closed cycles with `ciclo_id` grouping
- `tiendas`, `users`, `modules`, `admin_modules` — auth/management

Batch writes use 2 000-row chunks to stay within Turso's batch limits.

### Data Flow

**Reading:** Pages are Server Components that query Turso directly with `turso.execute(...)`.

**Writing:** Mutations go through Next.js Server Actions (`"use server"`). All actions return `ActionResult<T>` from `src/types/index.ts`:
```ts
type ActionResult<T = void> = { success: boolean; msg: string; data?: T }
```

**Client table state** (search, filters, pagination) is synced to URL params via `useTableUrlState` hook (`src/hooks/use-table-url-state.ts`). It uses `window.history.replaceState` — no navigation, no Server Component re-fetch.

**Pending discount edits** accumulate in localStorage via `src/lib/pending-storage.ts` and are committed to the DB in bulk when the admin clicks "Guardar".

### Stock Upload Flow

`src/lib/actions/products.ts` (server) and `src/lib/client-parse.ts` (browser) handle file ingestion:

- **Stock file** (Excel `.xlsx`): required. Columns that matter: `COD.UNIV.`, `GENERO`, `IZQ`, `DER`, `COD.PROD`, `COD.BARRAS`, `TALLA`, `COMPRA`, `LISTA`, `MARCA`, `MODELO`, `CATEGORIA`, `GRUPO`, `COLOR`. Only rows where `IZQ` is in `ALMACENES_VALIDOS` (`src/lib/constants.ts`) are imported.
- **Images file** (HTML export): optional. Maps `cod_universal` → image URL by parsing `<table>` rows.
- **Discount files** (multiple Excel): optional. Each file's name must contain the discount % (e.g. `30` for 30%). Column: `COD. UNIVERSAL.`

Uploading stock **drops and recreates** `productos` and `variantes` tables — it is a full replace, not an upsert.

### Rate Limiting

In-memory, per-IP via `src/lib/rate-limit.ts`. Not persistent across restarts. Applied in all mutating Server Actions and API routes.

### Image Proxy

`/api/proxy-image?url=<https://...>` proxies external product images through the server (session required, SSRF-safe: blocks private IPs).

### Key Directories

```
src/
  app/
    (auth)/login/          # Public login
    admin/                 # Admin section
      gestion/actions.ts   # Tiendas + Users CRUD
      gestion/permisos/actions.ts  # Module permissions (admin_general only)
    client/                # Client section
    api/auth/              # Login / logout / register route handlers
    api/proxy-image/       # Image proxy
  components/
    admin/                 # Admin-specific tables and modals
    client/                # Client-specific tables
    ui/                    # shadcn/ui primitives — do not modify directly
  lib/
    actions/               # Server Actions grouped by domain
    auth.ts                # JWT + password + user helpers
    turso.ts               # DB client
    db-schema.ts           # Schema + migrations + seed
    client-parse.ts        # Browser-side file parsing (Excel/HTML)
    pending-storage.ts     # localStorage for pending discount edits
    rate-limit.ts          # In-memory rate limiter
    constants.ts           # ALMACENES_VALIDOS warehouse code set
  hooks/
    use-table-url-state.ts # URL-synced table state (no navigation side-effects)
  types/index.ts           # Shared types and ActionResult
```

### Design Tokens

`DESIGN-airtable.md` is the design reference. Key values used throughout the UI:

- Primary ink: `#181d26` — headings, primary buttons
- Muted text: `#41454d`
- Hairline border: `#dddddd`
- Soft surface: `#f8fafc` (page backgrounds)

UI primitives come from **shadcn/ui** (`src/components/ui/`) — add new ones with `npx shadcn add <component>`, never hand-write them.
