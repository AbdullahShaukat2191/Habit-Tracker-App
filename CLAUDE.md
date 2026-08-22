# CLAUDE.md

Guidance for Claude Code sessions resuming work on this project. For full architectural detail, see `docs/BLUEPRINT.md` — this file is a working summary plus a record of what changed recently and why.

## What this app is

A personal, local-first desktop habit tracker: Electron 34 + Next.js 14 (App Router, statically exported) + TypeScript. Single user, single machine, no cloud sync, no auth — by design (see "Intentional design decisions" below).

**Stack:** React 18, Drizzle ORM over `better-sqlite3`, Zustand (9 stores, one per domain), `date-fns`, `framer-motion`, `@dnd-kit` for drag-and-drop, `canvas-confetti`, OpenAI (`gpt-4.1-mini`) for optional AI-generated monthly report narratives (falls back to a deterministic template with no key).

**Database:** SQLite, WAL mode, foreign keys on, single file at `app.getPath('userData')/habit-tracker.db`. **16 tables** via Drizzle (`electron/db/schema.ts`) — note this corrects a long-standing "15 tables" figure in `BLUEPRINT.md`'s history; a `quote_assignments` table (per-page/tab quote pinning) existed in code but was never added to that count until this pass.

## Key architectural patterns

- **IPC bridge, one direction only:** `electron/db/queries/*.ts` (Drizzle queries) → `electron/ipc/handlers.ts` (one `ipcMain.handle` per operation, catches/logs/rethrows) → `electron/preload.ts` (typed `contextBridge` surface, `contextIsolation` on) → `src/lib/ipc.ts` (the *only* renderer-side entry point — no component ever touches `window.electronAPI` directly) → Zustand stores (`src/lib/store/*Store.ts`, each `loadAll()`s its full table on mount, optimistically patches local state after every mutation).
- **`shared/` is a pure logic layer:** `shared/*.ts` (habit scoring/streaks, backfill-window math, finance aggregation, shared types) has zero Node/Electron imports, so the same functions run identically in the main process (report generation) and the renderer (live UI) with no duplication. Any new derived calculation belongs here, not inline in a component or a query file.
- **Sub-agent–verified refactors:** the mechanical-cleanup pass this session (color-array/DonutChart/axis-math extraction, dead build-config removal) was executed via Superpowers' subagent-driven-development flow — a fresh implementer subagent per task, a fresh reviewer subagent per task (spec compliance + quality, independently re-deriving risky math by hand rather than trusting the implementer's claims), and a final whole-branch review on the most capable model before merge. If you're doing similarly mechanical, behavior-preserving work, that workflow is available and already proven on this codebase (see `.superpowers/sdd/` scratch dir usage, though its per-run contents are cleaned up after each plan finishes).

## Recently completed (this session)

**Fixes:**
- Auto-generated monthly reports were reading a stale `claude_api_key` setting instead of the real `openai_api_key` — fixed; removed the now-unused `@anthropic-ai/sdk` dependency entirely.
- Habit progress, perfect-day, and streak calculations no longer penalize days before a habit's own `createdAt` — a habit created mid-month used to count every prior day as "missed."
- Notifications no longer fire for archived, off-schedule, or optional habits/tasks.
- `getReport` failures were silently swallowed (`.catch(() => {})`); now logs to console and shows a toast ("Failed to generate report").
- `computeStreak`'s hard 365-iteration cap is removed — streaks of any length now compute correctly (verified directly with a 400-day case).
- `reorderProjects` (and now `reorderHabits`/`reorderGoals`/`reorderWishlistItems`) wrap their batch UPDATEs in a DB transaction — previously unwrapped.
- `PaymentProjectDashboard`'s total-amount and milestone-amount inputs used to silently fall back to `0` on invalid input; now show an inline error (matches `TransactionModal`'s existing pattern) and block submission.
- The global Ctrl+N "add" shortcut only opened the Finance page's add-modal after this pass — every other page (Habits, Tasks, Goals, Wishlist, Projects) already had it wired from earlier work; Finance was the one gap.

**Features:**
- User-selectable currency (PKR/USD/EUR/GBP) via a shared `Intl.NumberFormat`-based formatter (`src/lib/currency.ts`). Finance has one currency setting; each Payments project has its own independent currency field.
- Persisted drag-reorder for Goals and Wishlist (previously local-state-only — reset on every reload). Added a `sortOrder` column to `wishlist_items` with a one-time migration that backfills existing rows from `createdAt` order.
- Same-day undo for Goal completion, mirroring the existing Tasks/Wishlist pattern (previously Goal completion was one-way).
- Duplicate-name validation (case-insensitive, trimmed, archived items excluded) on Project creation, Payment Project creation, and Finance Category creation.
- macOS build target added to `electron-builder`'s config (untested on real Mac hardware — see limitations).

**Cleanup:**
- Extracted three duplicated code blocks: the 8-color swatch array → `src/lib/constants.ts`; donut-chart SVG rendering skeleton → `src/components/ui/DonutChart.tsx` (the two callers' gap/offset *math* is genuinely different between Finance's category donut and Payments' paid/remaining donut — deliberately **not** unified, only the shared rendering shell was extracted); chart axis-ceiling rounding → `src/lib/chartUtils.ts`.
- Deleted `electron-builder.config.js` — empirically proven dead (a real build's log line confirms `package.json`'s `build` field is what electron-builder actually loads; the standalone file's name was never in electron-builder's config auto-discovery list, and `package.json`'s own `build` key short-circuits that discovery before the list is ever checked).

**Not authored this session, but bundled into its first commit** (pre-existing uncommitted work from an earlier session, carried in because later changes touched the same files): a quotes-system rework (free-text `author` field, dropped `source` field), per-page/tab quote assignments (the `quote_assignments` table), a quote viewer in Settings, and a zoom-level indicator overlay.

## Intentional design decisions (not bugs)

- **Finance defaults to PKR, Payments defaults to USD.** Per-context currency by design — these are two independent money-tracking areas serving different purposes, not meant to share one global currency.
- **Boot animation is 2.2s on every launch.** Intentional, not a perf issue to fix.
- **No cloud sync.** Local-first by design — single SQLite file, single machine.
- **No authentication.** Single-user by design — this is a personal tool, not multi-tenant software.
- **OpenAI API key stored in plaintext** in the `settings` table (no OS keychain/DPAPI encryption). Accepted tradeoff for a personal-use local app; the Settings UI only masks it visually.

## Known remaining limitations / tech debt

Not fixed this session — noted here rather than fixed, per this pass's documentation-only scope:

- Duplicate-name validation covers only Projects, Payment Projects, and Finance Categories. Habit names, Task titles, Goal titles, and Wishlist item titles can still collide with no warning.
- `PaymentProjectDashboard`'s "Add Payment" (payment-record) amount field still silently blocks invalid/zero input with no visible message — the validation fix this session covered only the total-amount and milestone-amount fields, not this one.
- Completion "undo" rules are now more consistent (Tasks/Wishlist/Goals all allow same-day-only undo) but Habits still allow full toggle bounded only by the backfill window — a different model, likely intentional given how backfilling works, but never explicitly reconciled with the others.
- The chart Y-axis tick-label `k`-suffix formatter (`value >= 1000 ? ... 'k' : value`) is still duplicated between `SpendingTrendChart.tsx` and `WeeklySpendingChart.tsx` — deliberately left alone when the adjacent axis-*rounding* math was extracted, since it wasn't in that task's scope.
- `electron/tray.ts` resolves its tray icon from a `buildResources/` directory that is empty and untracked (`package.json`'s actual build config uses `build/`, which has the real icons). The tray silently falls back to a blank icon. Pre-existing, unrelated to this session, surfaced by a final-review subagent while checking that removing `electron-builder.config.js` was safe.
- `src/lib/constants.ts` is a generic filename currently holding one specific constant (`PRESET_COLORS`). Minor naming debt; not worth the churn given 4 existing import sites.
- A handful of unused imports predate this session and were left alone (confirmed via a one-off `tsc --noUnusedLocals` pass, cross-checked against the pre-session commit to rule out anything my own changes caused): `format` in `src/app/goals/page.tsx`, `AnimatePresence` in `src/app/wishlist/page.tsx`, plus a few others in files this session never touched (`tasks/page.tsx`, `ProjectCard.tsx`, `MonthlyReportCard.tsx`, `taskStore.ts`).
- macOS packaging is configured but never actually built/tested on real Mac hardware or CI.
- Everything else already catalogued in `BLUEPRINT.md`'s §6 (two uncoordinated color-token systems, no pagination on any store's full-table load, no import path for the JSON export feature) still applies unchanged.

## File structure (top level)

```
src/
├── app/            Next.js routes: /, /tasks, /wishlist, /finance, /projects, /goals, /settings
├── components/     finance, goals, habit-grid, layout, payments, projects, settings, tasks, ui
├── lib/            ipc.ts (renderer's only IPC entry point), confetti.ts, currency.ts, constants.ts,
│                   chartUtils.ts, store/ (9 Zustand stores)
├── styles/         globals.css
└── types/          electron.d.ts (window.electronAPI contract)

electron/
├── db/             client.ts, migrate.ts, schema.ts, seed.ts, queries/ (one file per domain)
├── ipc/            handlers.ts (all ipcMain.handle registrations)
├── types/          auto-launch.d.ts
└── autoLaunch.ts, main.ts, notifications.ts, preload.ts, tray.ts, zoom.ts

shared/             backfillLogic.ts, financeLogic.ts, habitLogic.ts, types.ts, __tests__/
```
