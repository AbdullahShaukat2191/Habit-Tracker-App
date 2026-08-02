# Backfill Grace Window — 2026-08-03

## Overview

Today, backfilling is only possible within the current calendar month — the instant a month rolls over, every prior day locks read-only, even for the very last day of that month. This adds a 24-hour grace window after a month ends during which the previous month stays editable (if the "Allow backfilling past days" setting is on), so a day missed right at month-end can still be filled in and reviewed. Once the window closes, the previous month locks exactly as it does today.

## Problem being solved

The user reported: after August began, they could no longer check off habits for July 31st, even though they'd simply forgotten to do so before midnight. There's currently no leeway at all across the month boundary.

## Grace window definition

For a month `M`, the grace deadline is 24 hours after `M` ends — i.e., midnight local time on the 2nd day of the month following `M`. Example: for July 2026, the deadline is `2026-08-02T00:00:00` local time.

This is a fixed wall-clock deadline, not tied to app launches or session state — if the app is closed for the entire window, the grace period still lapses on schedule. It is intentionally not a rolling/movable window.

## Scope: gated on the backfill setting

The grace window only applies when `SETTING_KEYS.BACKFILL_HABITS` is `'true'`. If backfill is disabled:
- The previous month remains immediately read-only after rollover (unchanged from today).
- Monthly report generation is **not** delayed — it continues to generate on first launch after month-end exactly as it does today.

## Behavior changes

### 1. Shared grace-period logic (new file: `shared/backfillLogic.ts`)

A new pure module (no Node/Electron imports, following the same convention as `shared/habitLogic.ts`) so both the renderer and the Electron main process use identical logic:

- `getPreviousMonth(month: string): string` — returns the `'YYYY-MM'` string for the month immediately before `month`.
- `getGraceDeadline(month: string): Date` — returns the Date at which `month`'s grace window closes (midnight local, 2nd of the following month).
- `isWithinGracePeriod(month: string, now?: Date): boolean` — `now < getGraceDeadline(month)`.
- `getGraceRemainingMs(month: string, now?: Date): number` — `max(0, getGraceDeadline(month) - now)`.

### 2. Editability (`src/components/habit-grid/HabitRow.tsx`)

Current logic:
```ts
const isCurrentMonth = currentMonth === today.slice(0, 7)
const allowPastDays = backfillEnabled && isCurrentMonth
```

New logic:
```ts
const todayMonth = today.slice(0, 7)
const isCurrentMonth = currentMonth === todayMonth
const isGraceEligible =
  backfillEnabled &&
  currentMonth === getPreviousMonth(todayMonth) &&
  isWithinGracePeriod(currentMonth)
const allowPastDays = backfillEnabled && (isCurrentMonth || isGraceEligible)
```

No changes needed in `HabitCell.tsx` — its existing `isClickable = state !== 'disabled' && (isToday || (allowPastDays && isPastDay))` already unlocks every day in the grace-eligible previous month once `allowPastDays` is true, since every day of a prior month is necessarily `< today`.

### 3. UI countdown (new file: `src/components/habit-grid/GraceCountdown.tsx`)

Replaces the static `"Past month — read only"` text in `HabitGrid.tsx`'s Daily Progress panel (currently line 270) when viewing a grace-eligible month:

- Ticks every second via `setInterval`, recomputing `getGraceRemainingMs(month)` from wall-clock time on every tick (so it's correct immediately on reopen, not dependent on how long the timer has been running in-session).
- Renders `HH:MM:SS` in monospace, bold, colored `#F87171` — the same red already used for destructive/error states elsewhere in the app (e.g. `HabitRow.tsx`'s delete icon, `GoalModal.tsx`'s validation error text).
- When remaining time hits zero, the component itself falls back to rendering the plain `"Past month — read only"` text — no parent-level state needed.

`HabitGrid.tsx` decides *whether* to render `<GraceCountdown>` at all with a structural (non-ticking) check: `backfillEnabled && !isCurrentMonth && currentMonth === getPreviousMonth(todayMonth)`. This requires `HabitGrid` to read the backfill setting via `useSettingsStore`, which it doesn't currently do.

### 4. Report generation delay (`electron/main.ts`)

`checkAndGenerateMonthlyReport` currently generates last month's report unconditionally on every launch if one doesn't exist yet. It gains one early-return:

```ts
const lastMonth = format(subMonths(new Date(), 1), 'yyyy-MM')
const existing = getReport(lastMonth)
if (existing) return

const backfillEnabled = getSetting(SETTING_KEYS.BACKFILL_HABITS) === 'true'
if (backfillEnabled && isWithinGracePeriod(lastMonth)) return // retry on next launch

// ...existing generation logic, unchanged
```

If the app isn't reopened until well after the window closes, generation proceeds normally on that later launch — this mirrors the existing "only checks one month back, once per launch" behavior, which is unchanged.

## Out of scope

- The existing bug where `checkAndGenerateMonthlyReport` reads the API key under `'claude_api_key'` instead of the actual saved `'openai_api_key'` key is a pre-existing, unrelated issue. Not touched by this change.
- No changes to how far back backfilling can ever reach (still capped at the current month, now extended by the grace window into the single prior month only — never two months back).
- No new settings UI; the feature is entirely gated on the existing `BACKFILL_HABITS` toggle.

## Testing

- New unit tests for `shared/backfillLogic.ts` (`getPreviousMonth`, `getGraceDeadline`, `isWithinGracePeriod`, `getGraceRemainingMs`), mirroring the existing test conventions in `electron/db/queries/__tests__/habits.test.ts`.
- Manual verification: `tsc --noEmit` on both configs, `next build`, and interactively confirming (via system clock or code inspection) that a previous-month day becomes clickable/editable when backfill is on and within the window, and reverts to read-only display once the deadline check returns false.
