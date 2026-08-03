# Finance Tab — 2026-08-03

## Overview

A new top-level "Finance" tab (sidebar, between Wish List and Projects) — a personal finance manager: monthly budget, spending log with titles/categories/amounts in Rupees, a manual savings pool, weekly/monthly totals, a spending trend chart, a this-week bar chart, and a category breakdown donut. Structural layout (stat-tile row, full-width strip, side-by-side charts) is loosely inspired by a reference dashboard image the user supplied, but colors, copy, and specific widgets follow this app's own existing style exactly — reusing the Payments feature's conventions (full-width strips, explicit Edit/Delete icon buttons, inline expanders, hand-rolled SVG donut) rather than the reference image's look.

## Scope decisions (confirmed with the user)

- **Single wallet** — one overall balance/spending pool, no multi-account model.
- **Custom, color-tagged categories** — user-created (name + color), same convention as Projects/Payment Projects. Reuses the app's existing 8-color preset swatch.
- **Manual savings pool** — a simple ledger of amounts moved to savings, entirely decoupled from spending. No income tracking anywhere in this feature.
- **Manual transaction entry only** — no recurring/scheduled expenses.
- **Currency**: Rupees, formatted `Rs. ${amount.toLocaleString()}`, matching the existing `${amount.toLocaleString()}` convention used for dollar amounts in Payments.

## Data model

Three new tables (`electron/db/schema.ts` + DDL in `electron/db/migrate.ts`), following this codebase's conventions (`text` UUID ids, `integer` epoch-ms timestamps, `real` for money, soft-delete via nullable `archivedAt` where historical resolution matters):

- **`finance_categories`** — `name`, `color`, `sortOrder`, `archivedAt` (nullable — archiving hides a category from new-transaction pickers but keeps resolving name/color for existing transactions, matching the habits/goals soft-delete pattern).
- **`finance_transactions`** — `title`, `amount`, `categoryId` (nullable FK, `ON DELETE SET NULL` in application code per this codebase's existing style — deleting a category never deletes its transactions), `date` (`'YYYY-MM-DD'`).
- **`finance_savings_entries`** — `amount`, `note` (nullable), `date`. Total saved is always the live sum of entries — never stored. A negative amount represents a withdrawal from savings; no separate "goal/target" concept was requested, so none is built.

**Monthly budget** is a single value reusing the existing generic `settings` key/value table (`SETTING_KEYS.MONTHLY_BUDGET`), exactly like `BACKFILL_HABITS` — no new table needed, since it's one number, not a per-month record.

## Pure calculation layer

A new `shared/financeLogic.ts` (no Node/Electron imports, mirrors `shared/habitLogic.ts`'s existing pattern) holds all the date-range math as pure, unit-tested functions: month/week range totals, the last-N-months trend series, per-weekday totals for the current week, and the category breakdown for a month. Every component consumes these instead of recomputing date logic inline — keeps the pure logic testable independent of Electron/React, matching this codebase's established separation.

## Navigation & page structure

`src/components/layout/Sidebar.tsx`'s `NAV_ITEMS` gains a `Finance` entry (route `/finance`, `Wallet` icon) between Wish List and Projects.

`src/app/finance/page.tsx` follows the same header shape as every other page (title + "+ Add Spending" button, tab row beneath) — a single-level tab bar, **Dashboard | Savings** (Finance is now its own top-level page, so it doesn't need the two-level nesting Payments has inside Projects).

- **Dashboard tab**: month prev/next arrows (same convention as the Habit grid) → 4 stat tiles (Monthly Budget, Spent This Month, Remaining, Weekly Spend) → a full-width budget-progress strip (percent-of-budget-used bar, editable budget via an Edit pencil icon — matching the explicit-Edit-button convention Payments settled on, not click-to-edit) → two side-by-side charts (Spending Trend: last 6 months, line; This Week: Mon–Sun, bar) → a category-breakdown donut → a transaction list for the viewed month (title, category dot, amount, date; Edit/Delete icon buttons per row, matching Payments' row convention).
- **Savings tab**: total saved as a large stat display, an inline "+ Add to Savings" expander (matching the Payments dashboard's inline milestone/payment-add pattern, not a modal), and a deletable ledger list.

## Charts (per the dataviz skill)

Both are hand-rolled inline SVG, no charting library — matching the existing `PaymentDonut` precedent (this codebase's only prior chart).

- **Spending Trend** (line, single series): 2px line + ~10% opacity area wash in `var(--accent)`, ≥8px end-markers with a 2px surface ring, hairline recessive gridlines, y-axis ticks rounded to clean Rs. amounts. No legend (single series). Hover: since there are only 6 sparse monthly points, each point gets its own enlarged (24px) hit-circle showing a tooltip on hover/focus — a deliberate simplification of the skill's crosshair guidance, appropriate for a small discrete-category x-axis rather than a dense continuous series.
- **This Week** (bar, single series): ≤24px bars, 4px rounded tops, single `var(--accent)` fill, 2px gap between bars, per-bar hover tooltip (day + amount), no inline value labels (kept to hover + y-axis per the "label selectively" rule).
- **Category donut**: adapted from `PaymentDonut` to N slices instead of 2 — each slice uses the category's own user-picked color (not a generated categorical palette, since identity here already comes from the user's own color choice, same as the rest of the app), sorted descending by amount, with "Uncategorized" (muted gray) always last if present.

## Plumbing

`electron/db/queries/finance.ts` (CRUD for categories/transactions/savings entries) → registered in `electron/ipc/handlers.ts` under `financeCategories:*`, `financeTransactions:*`, `financeSavings:*` → exposed via `electron/preload.ts` and `src/lib/ipc.ts` (typed in `src/types/electron.d.ts`) → `src/lib/store/financeStore.ts` (zustand, loads all three arrays in full on mount, mirrors `paymentStore.ts` exactly). The monthly budget itself uses the existing generic `useSettingsStore().get/set` mechanism — no new store needed for it.

## Out of scope

- No income tracking, no multi-account support, no recurring transactions, no savings goals/targets — all explicitly declined during scoping.
- No changes to any existing page, table, or feature.

## Testing

- `shared/financeLogic.ts`'s pure functions get full unit test coverage (range math, weekly/monthly totals, trend series, category breakdown), following the existing `shared/__tests__/` convention.
- Electron query/IPC/store layers are verified by `tsc --noEmit` on both configs (this codebase has no existing unit tests for its CRUD/IPC layers either — e.g. `payments.ts` has none — so Finance follows the same precedent rather than introducing a new one).
- Full `next build` clean.
- Manual end-to-end smoke test of the running app: add a category, add a transaction, confirm stat tiles/charts/donut update, add a savings entry, edit the monthly budget, delete a transaction — mirroring how the Payments feature was manually verified.
