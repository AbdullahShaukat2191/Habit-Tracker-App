# Habit Tracker App — Blueprint

## 1. Tech Stack

**Language/Framework/Runtime**
- TypeScript throughout (renderer, main process, shared code)
- Next.js 14.2.21 (App Router) for the UI, statically exported (`output: 'export'`)
- React 18.3.1
- Electron 34 as the desktop shell/runtime
- Package manager: npm (`package-lock.json` present)

**Key dependencies**
| Package | Purpose |
|---|---|
| `better-sqlite3` | Synchronous local SQLite driver |
| `drizzle-orm` + `drizzle-kit` | Typed SQL schema/query builder over SQLite |
| `zustand` | Client-side state stores (one per domain) |
| `date-fns` | All date-range/month/week math |
| `framer-motion` | Modal/page/boot transitions |
| `@dnd-kit/core`, `/sortable`, `/utilities` | Drag-and-drop reordering (habits, tasks, goals, wishlist, projects) |
| `canvas-confetti` | Celebration bursts |
| `lucide-react` | Icon set |
| `openai` | Monthly AI report narrative generation (`gpt-4.1-mini`) |
| `auto-launch` | "Launch on startup" OS integration |
| `electron-builder` + `@electron/rebuild` | Packaging & native module rebuild |
| `jest` + `ts-jest` | Unit tests (Node env only, no jsdom) |
| `tailwindcss` | Utility classes for layout only; most styling is inline `style={}` + CSS vars |

**Build/dev tooling**
- `next dev` (port 3000, hardcoded) + `tsc -p tsconfig.electron.json` run concurrently in dev, with Electron loading `http://localhost:3000`
- Production: `next build` → static export to `out/` → Electron serves it via a custom `app://` protocol handler (not `file://`, to keep fetch/routing working) → `electron-builder` packages everything
- Two parallel `tsconfig`s: `tsconfig.json` (renderer, bundler resolution) and `tsconfig.electron.json` (main process, CommonJS, compiles to `dist-electron/`)

**Database/storage**
- Local file-based SQLite at `app.getPath('userData')/habit-tracker.db`, WAL mode, FK constraints on
- No cloud/remote storage, no auth, single-user/single-machine
- Bundled seed data: `data/quotes.json` (64 motivational quotes) seeded idempotently on every launch

**External APIs**
- OpenAI (`gpt-4.1-mini`) for monthly report narratives — optional, falls back to a deterministic template if no key/failure
- No other external services

## 2. Architecture

**App type:** Desktop app via Electron, frameless window, custom title bar, system tray, single-instance lock. The renderer is a statically-exported Next.js SPA-style app (not a web app — no server-side rendering at runtime).

**Folder structure (2 levels):**
```
src/
├── app/            (finance, goals, layout.tsx, page.tsx, projects, settings, tasks, wishlist — Next.js routes)
├── components/     (finance, goals, habit-grid, layout, payments, projects, tasks, ui)
├── lib/            (confetti.ts, ipc.ts, store/)
├── styles/         (globals.css)
└── types/          (electron.d.ts)

electron/
├── db/             (client.ts, migrate.ts, schema.ts, seed.ts, queries/)
├── ipc/            (handlers.ts)
├── types/          (auto-launch.d.ts)
└── autoLaunch.ts, main.ts, notifications.ts, preload.ts, tray.ts

shared/
├── __tests__/
└── backfillLogic.ts, financeLogic.ts, habitLogic.ts, types.ts
```

**Data flow:**
1. All persistence lives in the Electron main process (`electron/db/queries/*.ts`, using Drizzle over `better-sqlite3`).
2. `electron/ipc/handlers.ts` registers one `ipcMain.handle` per operation, wrapping each query function, catching/logging/rethrowing errors.
3. `electron/preload.ts` exposes a typed `window.electronAPI` bridge via `contextBridge` (contextIsolation on, nodeIntegration off).
4. `src/lib/ipc.ts` is the single typed wrapper the renderer imports — no component calls `window.electronAPI` directly.
5. Nine `zustand` stores (`src/lib/store/*Store.ts` — habit, task, project, goal, wishlist, payment, finance, settings, toast) each `loadAll()` their full dataset on mount and optimistically patch local state after every mutating IPC call (no diffing/subscriptions — full in-memory arrays).
6. Pure calculation logic (streaks, scores, date-range math, backfill grace windows) lives in `shared/*.ts` — deliberately Node/Electron-free so it's reusable and unit-testable from both the main process (report generation) and the renderer (live UI display) without duplication.

**Data model / schema** (Drizzle tables in `electron/db/schema.ts`, 15 tables total):

| Table | Fields | Relationships |
|---|---|---|
| `habits` | id, name, schedule (JSON `DayAbbreviation[]`), sortOrder, createdAt, archivedAt, isOptional | — |
| `habit_completions` | habitId, date ('YYYY-MM-DD'), completedAt — composite PK (habitId, date) | → habits |
| `tasks` | id, title, description, projectId, createdAt, completedAt, archivedAt, isOptional | → projects (nullable) |
| `projects` | id, name, color, sortOrder, createdAt | — |
| `goals` | id, title, description, sortOrder, createdAt, completedAt, archivedAt | — |
| `wishlist_items` | id, title, description, createdAt, completedAt, archivedAt | — (no sortOrder) |
| `payment_projects` | id, sourceProjectId, name, color, totalAmount, developer, createdAt | → projects (nullable, "imported from") |
| `payment_milestones` | id, paymentProjectId, title, description, amount, paid, paidAt, sortOrder, createdAt | → payment_projects |
| `payment_records` | id, paymentProjectId, milestoneId (nullable), amount, note, paidAt, createdAt | → payment_projects, payment_milestones |
| `finance_categories` | id, name, color, sortOrder, createdAt, archivedAt | — |
| `finance_transactions` | id, title, amount, categoryId (nullable), date, createdAt | → finance_categories |
| `finance_savings_entries` | id, amount (can be negative), note, date, createdAt | — |
| `monthly_reports` | id, month (unique), generatedAt, tier (1–6), completionPct, narrative, statsJson | — |
| `settings` | key (PK), value | generic key/value store |
| `quotes` | id, author ('Goggins'\|'Hormozi'), text, source, bundled, hidden, addedAt | — |

All IDs are UUID text; timestamps are epoch-ms integers; money is `real`; soft-delete is a nullable `archivedAt` epoch-ms column, used everywhere except `wishlist_items`/`finance_savings_entries` for hard-delete-only cases and `finance_categories`/`monthly_reports` where it's the sole delete mechanism.

**Storage format:** Single SQLite file, WAL journal mode. No JSON files/IndexedDB/localStorage for domain data — though the renderer does use `localStorage` for *view-preference* state only (task/payment-history sort order and group-by-date toggles).

**Sync/backup/export:** No sync of any kind (single local file, single machine). One-way JSON export via Settings → "Export All Data" (`app:exportData` IPC), dumping habits/tasks/projects/goals/settings/custom quotes to a user-chosen `.json` file. No import path exists for that export. No automated backups.

## 3. Feature Map

### Habits (`/`, Habit Scorecard)
- CRUD (create/edit/soft-delete/reorder via drag), day-of-week `schedule` (no time-of-day or interval recurrence), optional-habit flag that excludes a habit from scoring
- Toggle daily completion per cell; clicking today is always allowed, clicking a past day requires the "Allow backfilling" setting, and only the immediately-previous month is backfillable, closing at midnight on the 2nd of the following month (`shared/backfillLogic.ts`)
- Derived data: monthly completed/applicable score (`computeScore`), running streak capped at 365 days (`computeStreak`, counts backward, skips non-scheduled days, doesn't break on an unfinished *today*), Top-3 habits by %, "Perfect Day" detection (every active non-optional scheduled habit done that day)
- Visualization: calendar-style grid (one row per habit, one column per day, up to 31 cols), month-slide transition, per-row streak/score column, progress bars for Top-3
- Celebrations: confetti fired from the exact click point on completion; a full-screen "Perfect Day" dialog with confetti, fired once per qualifying day

### Tasks (`/tasks`)
- CRUD, complete/uncomplete (same-day-only undo), optional flag, soft-delete (Today/Optional tabs) or hard-delete (from Completed tab)
- No streaks/scores. Client-side grouping (by date or by project) and sortable order (asc/desc/by-project), persisted to `localStorage`, not the DB
- Drag-and-drop reorder only in the Today tab, non-persisted for order beyond session
- Confetti on individual completion; a full-screen "All tasks done" dialog (once per day, random quote) when every task for today is complete

### Goals (`/goals`)
- CRUD, one-way completion (no `uncompleteGoal` at all — irreversible from the UI once checked), soft-delete
- No streaks, scores, or scheduling. Drag reorder is **not persisted** (no `reorderGoals` IPC despite a `sortOrder` column existing)
- Confetti (delayed ~400ms) + a "Goal completed" full-screen dialog with a random quote, fired independently (two separate, unsynchronized celebration triggers on the same action)

### Wishlist (`/wishlist`)
- CRUD, full complete/uncomplete round-trip (same-day-only undo), soft- or hard-delete depending on tab
- No `sortOrder` column at all — list order is `createdAt` only; drag reorder is local-state-only, lost on reload
- Confetti fires immediately on check; no completion dialog (unlike Goals)

### Projects (`/projects`, "Projects" tab)
- CRUD + persisted drag-reorder (`reorderProjects`), color picker (8-swatch preset + free custom color via native color input)
- Deleting a project un-assigns (not deletes) its tasks
- Per-project active/completed task counts computed client-side each render (not stored)
- No charts

### Payments (`/projects`, "Payments" tab)
- Payment Projects: create manually or bulk-import from existing Projects (copies name/color); milestones (title/description/amount) toggle paid ↔ unpaid, which inserts/deletes a corresponding payment record so ledger and milestone state stay in sync by construction; ad-hoc manual payment records also supported
- Derived: paid total (sum of records), remaining = total − paid (**unclamped**, can go negative), % paid (clamped to 100 for the bar)
- Visualization: hand-rolled SVG donut (paid vs. remaining, 2-slice) per project dashboard; a separate flat Payment History tab lists/sorts/groups all records across projects
- Currency formatting: `$value.toLocaleString()` — no `Rs.`, unlike Finance

### Finance (`/finance`)
- Dashboard tab: monthly budget (single editable settings value), spending log (title/amount/category/date), custom color-tagged categories (soft-delete/archive only), month navigation
- Derived (all in `shared/financeLogic.ts`, unit-tested, pure functions): month/week sums, remaining-vs-budget (unclamped), 6-month trend series, per-weekday totals for the current week, category breakdown (sorted desc, "Uncategorized" always last)
- Visualizations: hand-rolled SVG — 6-month line+area trend chart with per-point hover tooltips, a 7-day rounded-bar chart with per-bar hover tooltips, and a category-breakdown donut (no hover)
- Savings tab: a simple running-sum ledger (amounts can be negative = withdrawal), no goals/targets, no edit capability (create/delete only), no date picker (always "today")
- Currency formatting: `Rs. value.toLocaleString()`, exclusively

### Settings (`/settings`)
Not a "feature" with its own data model, but a control panel over the generic `settings` key/value table: notifications (master + per-domain toggles, active-hours window, min/max interval sliders, test button), habit backfill toggle, 8 rebindable keyboard shortcuts with conflict detection, startup behavior (launch on boot / start minimized / close to tray), a full quotes CRUD/hide panel (bundled quotes can be hidden but never deleted), OpenAI API key entry + connection test, DB path display, JSON export, and app version/about.

### AI Monthly Reports (cross-cutting, surfaced on the Habit Scorecard)
- Auto-generated on every app launch for the previous month if missing (gated by the backfill grace window)
- Computes overall completion %, best/worst habit, longest streak, tasks completed (+ by-project breakdown), and delta vs. the prior stored report
- Maps completion % to a 6-tier system (Reset/Stirring/Building/Climbing/Crushing/Untouchable) and either calls OpenAI for a short narrative or falls back to a deterministic template

## 4. UI/UX

**Screens/pages:** Habit Scorecard (`/`), Current Tasks (`/tasks`), Wish List (`/wishlist`), Finance (`/finance`, Dashboard + Savings inner tabs), Projects (`/projects`, Projects + Payments outer tabs, Payments has Projects/History inner tabs and a drill-down dashboard), Long-Term Goals (`/goals`), Settings (`/settings`).

**Navigation:** Fixed 240px left sidebar (`Sidebar.tsx`) with 6 top-level nav items + a footer Settings link; active route highlighted via left accent border. Some pages layer their own tab bars (pill-style) for sub-views. Keyboard shortcuts mirror the sidebar (Ctrl+1..5 by default, customizable).

**Theming:** Custom title bar (frameless window), dark violet sidebar/title bar. **Notable inconsistency:** two independent, non-synced color systems exist — CSS custom properties in `globals.css` define a *light* palette (`--bg-base:#F8F7FF` etc.) used via inline `style={{...var(--x)}}`, while `tailwind.config.ts` defines a *differently-named dark* palette (`bg-bg-base:#150B1F` etc.) used via Tailwind utility classes; several components also hardcode dark hex literals directly. No dark/light mode toggle exists — the app is single-themed in practice but stitched together from three uncoordinated sources of truth. Font: Inter (Google Fonts import). Styling is predominantly inline `style={}` objects, Tailwind used mainly for layout flexbox classes.

**Animations:** `framer-motion` for modals (scale+opacity), toasts (slide+fade), a month-slide transition on the habit grid, and a 2.2s full-screen boot animation shown on every launch/reload. `canvas-confetti` for 4 distinct celebration patterns (cell-click, task-complete, all-tasks-done, goal-complete). Cell-fill has a scale-pulse micro-animation.

**Layout:** Fixed, non-scrolling app shell (`overflow:hidden` on html/body); individual page bodies scroll internally. Window: 1280×800 default, 900×600 minimum, freely resizable, no maximum. The one genuinely responsive element is habit-grid cell width (`clamp()`), tuned to fit 31 columns at 1280px. Not designed for mobile/narrow viewports.

## 5. Platform Dependencies

- **Desktop-only, hard dependencies on Electron/Node:** `better-sqlite3` (native binding, rebuilt per-Electron-ABI via `electron-rebuild`), `fs`/`path` file export, frameless custom window chrome + native window controls (minimize/maximize/close via Electron `BrowserWindow` methods), system tray with context menu, OS-level global shortcut (Ctrl+Q), OS notifications (`Notification` API), `auto-launch` for "start on boot," single-instance lock, custom `app://` protocol registration for serving the static export in production.
- **Would break in a browser/webview:** the entire IPC bridge (`window.electronAPI`) — every data operation throws if `window.electronAPI` is undefined; no server API exists as a fallback. The app cannot run as a plain website without a substantial backend rewrite.
- **Hardcoded assumptions:** dev server port 3000 (no env override); production asset path `process.resourcesPath/out`; DB path fixed to `userData/habit-tracker.db`; two **conflicting** electron-builder configs exist simultaneously (`package.json`'s `build` field vs. standalone `electron-builder.config.js`, different `buildResources` dirs, different icon paths, different `oneClick` settings) — the standalone file wins, so the `package.json` block is dead configuration that could confuse a future maintainer.

## 6. Current Limitations & Tech Debt

**Confirmed bugs:**
- `Sidebar`/settings default shortcut for "Add" (Ctrl+N) dispatches a `window` `CustomEvent`, but only the Projects page listens for it — other pages have no global "add" affordance despite the shortcut being labeled generically.

**Inconsistencies:**
- Currency formatting: Finance uses `Rs.`, Payments uses `$` — same app, two money-tracking areas, no shared formatter, no `Intl.NumberFormat` (decimals not normalized, e.g. `"1,234.5"`).
- The 8-color preset swatch array is copy-pasted verbatim across 4 files (`ProjectModal`, `AddPaymentProjectModal`, `PaymentProjectDashboard`, `TransactionModal`) with no shared constant.
- Donut chart math (circumference/dasharray/offset) is independently reimplemented in `CategoryDonut.tsx` and `PaymentProjectDashboard.tsx`'s inline `PaymentDonut`; axis-rounding logic is duplicated between `SpendingTrendChart.tsx` and `WeeklySpendingChart.tsx`.
- Reorder persistence is inconsistent across near-identical features: Habits and Projects persist drag order via a `reorderX` IPC + `sortOrder` column; Goals *have* a `sortOrder` column but no persistence path exists; Wishlist has neither.
- "Undo completion" rules differ per feature with no stated rationale: Tasks/Wishlist allow same-day-only undo, Goals allow none, Habits allow full toggle (bounded only by the backfill window).

**Missing error handling/validation:**
- `PaymentProjectDashboard`'s total-amount and milestone-amount inputs silently fall back to `0` on invalid input — no inline error shown (contrast with `TransactionModal`, which does show one for the equivalent case).
- No duplicate-name checks anywhere (projects, payment projects, categories can collide).
- `reorderProjects` issues N sequential UPDATE statements with no transaction wrapper.
- `getReport` failures are swallowed silently (`.catch(() => {})`) — a missing/failed report just doesn't render, with no user-facing indication.
- `computeStreak` hard-caps at 365 iterations, silently truncating longer unbroken streaks with no UI signal that truncation occurred.

**Security:**
- OpenAI API key is stored **in plaintext** in the SQLite `settings` table — no OS keychain/DPAPI encryption. The Settings UI only masks it visually (password-type input with a show/hide toggle).
- No authentication/access control of any kind (single local user, by design — not necessarily a defect for this app's scope, but worth noting as an absolute).

**Performance:** Every store loads its *entire* table into memory on mount with no pagination — acceptable at personal-use data volumes but would degrade with years of dense transaction/completion history (e.g., `getWeekdayTotals` does 7 full-array passes instead of one).

## 7. Raw Stats

- **Total source files:** 89 TypeScript/TSX files (excluding `node_modules`, `.next`, `dist-electron`, `out`, `release`)
- **Total lines of code (rough, `src`+`electron`+`shared`):** ~14,331 lines — `src/` 11,137 lines (59 files), `electron/` 2,482 lines (22 files), `shared/` 712 lines (6 files)
- **React components:** ~50 (under `src/components/`, spanning finance, goals, habit-grid, layout, payments, projects, tasks, ui)
- **App routes/pages:** 7 (`/`, `/tasks`, `/wishlist`, `/finance`, `/projects`, `/goals`, `/settings`)
- **Zustand stores:** 9
- **Distinct persisted data entities (DB tables):** 15
- **IPC channels registered:** ~65 handlers across habits, tasks, wishlist, projects, payment projects/milestones/records, finance categories/transactions/savings, goals, settings, reports, quotes, window controls, and app utilities
