# Streak Carryover Across Months — 2026-08-03

## Overview

A habit's displayed streak (the 🔥N next to each row) should reflect the true number of consecutive completed days, even when that run spans a month boundary — e.g. 60 consecutive days across July and August should show "60", not reset or truncate at the 1st. No visual/formatting changes; the streak badge looks and behaves exactly as it does today, it just becomes numerically correct across months.

## Root cause

`computeStreak` (`shared/habitLogic.ts`) is already month-agnostic — it walks backward day by day from today through an arbitrary `completedDates: Set<string>` with no concept of month boundaries, breaking only on an actual missed applicable day. The bug is entirely on the caller side: every current caller only ever supplies one month's worth of completions.

- `HabitRow.tsx` builds its `completedDates` from the `completions` prop, which is whatever `habitStore.loadCompletions(month)` last loaded for the *currently viewed* month only.
- `reports.ts`'s `computeMonthStats` has the same shape of limitation via its own `getHabitCompletions(month)` call.

So when `computeStreak` walks backward past day 1 of the viewed month, it finds no data at all for earlier months and treats those days as missed, truncating the streak at the month boundary — even though the underlying algorithm has no such limitation.

## Fix: give the streak calculation the full history

Add an "all completions" fetch (no date filtering) used specifically for streak math, while every existing month-scoped fetch keeps driving the grid display and month score exactly as today. Given this is a personal single-user local SQLite app, fetching the full `habit_completions` table is simplest and correct — no need for a rolling window or magic day cutoff, and the data volume for one person's habits over any realistic number of years is trivial.

### New data path (mirrors the existing `getHabitCompletions(month)` wiring exactly)

- `electron/db/queries/habits.ts`: `getAllHabitCompletions(): HabitCompletion[]` — plain `select().from(habitCompletions).all()`, no `where`.
- `electron/ipc/handlers.ts`: `handle('habits:allCompletions', () => habitQueries.getAllHabitCompletions())`
- `electron/preload.ts` / `src/types/electron.d.ts` / `src/lib/ipc.ts`: matching `getAllHabitCompletions` entries, same pattern as `getHabitCompletions`.
- `src/lib/store/habitStore.ts`: new `allCompletions: HabitCompletion[]` state + `loadAllCompletions()` action, loaded once on app mount (`src/app/page.tsx`, alongside the existing `loadHabits()` call). `toggleCompletion` is updated to mirror its optimistic add/remove into `allCompletions` as well as `completions`, so the streak stays live-accurate immediately after a toggle without needing a refetch.

### Consumer change

- `HabitRow.tsx`: reads `allCompletions` from the store and builds a second completed-dates set (filtered to the row's habit) used *only* as the input to `computeStreak`. The existing `completedDates` built from the month-scoped `completions` prop is untouched and still drives `computeScore` (the month's completed/applicable counts) and the grid cell fill states — no visual change to anything except the streak number itself.

## Explicitly out of scope

- `reports.ts`'s `computeMonthStats` "longest streak achieved during the month" stat is a different, narrower metric with its own pre-existing, unrelated bug: it computes an `endDate` capped at month-end but never actually passes it to `computeStreak` (which always anchors to real "now" internally, no `asOf` parameter exists). This means past-month report streaks are already inaccurate today, independent of the carryover issue. Not fixed here — flagging only, since fixing it would require changing `computeStreak`'s signature, which is a separate, more invasive change than what was asked for.
- No new settings, no schema changes (no persisted streak column — still computed live from raw completions, per the existing pattern), no changes to how the grid cells themselves render.

## Testing

- Existing `computeStreak` unit tests in `electron/db/queries/__tests__/habits.test.ts` are unaffected (the function itself doesn't change).
- Manual verification: seed completions spanning a month boundary (e.g. last few days of one month + first few days of the next, all consecutive), confirm the streak badge shows the full combined count when viewing either month, and confirm toggling a day updates the streak immediately without a page reload.
- `tsc --noEmit` on both configs and `next build` as the baseline correctness check (no new pure-logic module this time, so no new unit test file — the change is entirely in data plumbing).

## Revision — same day: a day only breaks the streak once it's permanently unfixable

The plumbing fix above was necessary but not sufficient. Real-world testing surfaced a second issue in `computeStreak` itself: it only ever gave *today* a pass for being incomplete — any other incomplete day, including one that's still well within the current month and fully backfillable, broke the streak immediately. So filling in July 31 and Aug 1 (with today being Aug 3) showed a broken streak, because the walk hit the still-unfilled Aug 2 first and stopped there, never reaching July's completed run at all.

**Fix**: generalize the "today gets a pass" special case into "a day gets a pass as long as you could still go back and fill it in right now." Concretely: today is always a pass; any day in the current month is a pass when backfill is enabled (matching that the current month is always backfill-editable); the previous month is a pass only while its 24-hour grace window (from the backfill grace feature) is still open. Once none of those apply, an incomplete day is a genuine, permanent miss and the streak breaks there — exactly as before.

This is implemented as a new `isDayStillEditable(dateStr, today, backfillEnabled, now)` in `shared/backfillLogic.ts`, and `computeStreak` (`shared/habitLogic.ts`) gains an optional third parameter, `{ now?, backfillEnabled? }`, defaulting to `backfillEnabled: false` — which reproduces the *exact* original behavior (only today gets a pass), so every existing caller (`reports.ts`, existing tests) is unaffected without any changes. Only `HabitRow.tsx`'s live streak display opts in, passing the real `backfillEnabled` setting.

Verified with unit tests covering: the default-false path staying identical to old behavior, the exact reported scenario (a 26-day July run + Aug 1, with Aug 2/3 unfilled, on Aug 3 → streak 27), and a genuine still-permanent miss inside the locked previous month still breaking the streak correctly. Plus `tsc --noEmit` on both configs, full `next build`, and the full jest suite (34/34 passing).
