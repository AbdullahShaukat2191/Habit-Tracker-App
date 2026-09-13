# Timer Fixes Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix a data-loss bug in `resumeTimerSession` (must land first, alone), then a set of layout/behavior/data fixes across the Timer page's three sub-tabs and the shared `SessionRow` component.

**Architecture:** Task 1 extracts `stopTimerSession`'s core mutation into a `tx`-scoped helper shared with a fixed `resumeTimerSession`, so stopping a stray active session and resuming the target session happen in one transaction instead of two independent ones. Tasks 2-5 are UI/behavior fixes confined to the Timer feature's existing component files, plus one new CSS custom property and one quote-seed row — no schema, IPC, or store-shape changes beyond Task 1's `resumeSession` action.

**Tech Stack:** Next.js 14 (static export) + Electron 34, Drizzle ORM / better-sqlite3, Zustand, date-fns, lucide-react. No new dependencies.

**Spec:** `timer-fixes-round2.md` (project root) — the user's "Round 2" fixes list, Parts 1–5 plus its Scope boundary. This plan also documents two things traced beyond that file's literal text: (1) Part 2a's "missing quote" is not a missing `<PageQuote>` call — `src/app/timer/page.tsx` already renders `<PageQuote pageId="timer" />` correctly; the real cause is that `electron/db/seed.ts`'s `seedQuoteAssignments()` never seeded a `pageId: 'timer'` row, so the component's `if (!quote) return null` always fires. (2) Part 2c's literal instruction ("find the token... increase its contrast") can't be satisfied by editing `--border-subtle` in place, since that token is used pervasively outside the Timer feature (every page's card/divider borders) — doing so would violate the Scope boundary's "do not change tokens used outside the Timer feature." A new, Timer-scoped token is added instead.

## Global Constraints

- Task 1 (Part 1) is standalone: implemented, verified, and committed before any other task starts.
- Touch only: `electron/db/queries/timerQueries.ts`, `src/lib/store/timerStore.ts`, `src/components/timer/SessionRow.tsx`, `src/components/timer/StatBar.tsx` (read-only reference; not expected to need edits), `src/app/timer/page.tsx` (read-only reference; not expected to need edits — the quote line already exists there), `src/components/timer/TimerTab.tsx`, `src/components/timer/TimesheetTab.tsx`, `src/components/timer/SessionsTab.tsx`, `src/components/timer/InvoiceModal.tsx` (only if a `SessionRow` shape change requires it), `electron/db/seed.ts` (one new seed row, for the quote-assignment gap traced above), `src/styles/globals.css` (one new CSS custom property, for the border-token gap traced above).
- Do not change Tasks, Habits, Goals, Wishlist, Finance, Payments, or Projects. Do not alter the schema, the currency formatter, `ConfirmDeleteModal`, or the `PageQuote` component itself (reuse it exactly as-is). Do not restyle the clock or the Start/Pause/Resume/Stop transport buttons. Do not add dependencies.
- The new CSS token in Part 2c must not replace or alter `--border-subtle`'s own value, and must only be applied to genuine `<input>`/`<select>` form elements within the Timer feature — not to card borders, dividers, or buttons.
- Verify after every task: `npx tsc --noEmit -p tsconfig.json`, `npx tsc --noEmit -p tsconfig.electron.json`, `npx jest`, `npx next build`. All 57 pre-existing tests must keep passing throughout.
- Commit after every task.

---

### Task 1: Fix `resumeTimerSession` data-loss bug (Part 1 — standalone, first)

**Files:**
- Modify: `electron/db/queries/timerQueries.ts`
- Modify: `src/lib/store/timerStore.ts`

**Interfaces:**
- Consumes: existing `getActiveSession()`, `timerSessions`/`timerSegments` schema (unchanged).
- Produces: `resumeTimerSession(id)` now also stops any other active session in the same transaction; `timerStore.resumeSession(id)` now patches both the resumed session and the implicitly-stopped one in local state.

- [ ] **Step 1: Extract `stopTimerSession`'s core mutation into a shared, `tx`-scoped helper**

In `electron/db/queries/timerQueries.ts`, add a private helper above `stopTimerSession` and rewrite `stopTimerSession` to use it:

```ts
// Core "stop" mutation, shared by stopTimerSession and resumeTimerSession's
// implicit-stop-of-a-different-session path — both callers wrap this in their
// own single db.transaction() using the same tx handle passed in here.
function stopSessionInTx(tx: Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0], session: TimerSession, now: number): void {
  const totalElapsed = session.status === 'running'
    ? session.totalElapsed + (now - session.startedAt)
    : session.totalElapsed
  tx.update(timerSessions).set({ totalElapsed, stoppedAt: now, status: 'stopped' }).where(eq(timerSessions.id, session.id)).run()
  tx.update(timerSegments).set({ endedAt: now }).where(and(eq(timerSegments.sessionId, session.id), isNull(timerSegments.endedAt))).run()
}

export function stopTimerSession(id: string): TimerSession {
  const db = getDb()
  const row = db.select().from(timerSessions).where(eq(timerSessions.id, id)).get()
  if (!row) throw new Error(`Timer session ${id} not found`)
  const session = rowToSession(row)
  const now = Date.now()
  db.transaction((tx) => {
    stopSessionInTx(tx, session, now)
  })
  return rowToSession(db.select().from(timerSessions).where(eq(timerSessions.id, id)).get()!)
}
```

If the `Parameters<Parameters<...>>` type gymnastics for `tx` don't resolve cleanly against this project's installed Drizzle version, a pragmatic fallback is acceptable: type the parameter as the same type `db` itself has (`ReturnType<typeof getDb>`) — better-sqlite3's Drizzle transaction callback's `tx` is structurally compatible with `db` for `.update()`/`.insert()`/`.select()` calls. Use whichever compiles cleanly; do not use `any`.

- [ ] **Step 2: Fix `resumeTimerSession` to stop any other active session, in one transaction**

Replace the existing `resumeTimerSession` with:

```ts
export function resumeTimerSession(id: string): TimerSession {
  const db = getDb()
  const row = db.select().from(timerSessions).where(eq(timerSessions.id, id)).get()
  if (!row) throw new Error(`Timer session ${id} not found`)
  const session = rowToSession(row)
  if (session.status !== 'paused') {
    throw new Error(`Cannot resume a session with status "${session.status}"`)
  }
  // Another session may be running/paused right now (e.g. the user started a new
  // session while this one was paused). Resuming must never leave two sessions
  // active — stop that other session and resume this one in a single transaction.
  const other = getActiveSession()
  const otherToStop = other && other.id !== id ? other : null
  const now = Date.now()
  db.transaction((tx) => {
    if (otherToStop) {
      stopSessionInTx(tx, otherToStop, now)
    }
    tx.update(timerSessions).set({ startedAt: now, pausedAt: null, status: 'running' }).where(eq(timerSessions.id, id)).run()
    tx.insert(timerSegments).values({ id: randomUUID(), sessionId: id, startedAt: now, endedAt: null, createdAt: now }).run()
  })
  return rowToSession(db.select().from(timerSessions).where(eq(timerSessions.id, id)).get()!)
}
```

Note `getActiveSession()` is called and evaluated *before* the transaction opens — this is safe and still correct because better-sqlite3 is fully synchronous and single-connection (nothing else can run between that read and the transaction that acts on it in this single-threaded main process). Do not restructure this into a query run *inside* the transaction — the pre-read is intentional and simpler.

- [ ] **Step 3: Update `timerStore.resumeSession` to patch both sessions**

In `src/lib/store/timerStore.ts`, replace the existing `resumeSession` action:

```ts
resumeSession: async (id) => {
  const previouslyActiveId = get().activeSession?.id
  const updated = await ipc.resumeTimerSession(id)
  set((s) => ({
    sessions: s.sessions.map((sess) => {
      if (sess.id === id) return updated
      if (previouslyActiveId && sess.id === previouslyActiveId && previouslyActiveId !== id) {
        return { ...sess, status: 'stopped' as const }
      }
      return sess
    }),
    activeSession: updated,
  }))
  return updated
},
```

This mirrors `createSession`'s existing pattern of optimistically marking the previously-active session `stopped` locally (a shallow patch, not a full reload) — consistent with this store's established convention.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit -p tsconfig.json`, `npx tsc --noEmit -p tsconfig.electron.json`, `npx jest` (57/57), `npx next build`. All clean.

- [ ] **Step 5: Manual verification against the live database**

Follow this codebase's established method (used throughout the original Timer restructure plan): first check no `Habit Tracker.exe`/`electron.exe` process is already running (`tasklist`) — if the user's real packaged app is running, do NOT touch it; instead build an isolated verification harness the same way prior rounds did (a real file-backed SQLite DB built via the actual compiled `runMigrations()`, driven directly via better-sqlite3/Drizzle under `ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron.exe`, since this project's better-sqlite3 native binary is ABI-matched to Electron, not plain Node/Jest). If no real app instance is running, a live `next dev` + Playwright pass against the real app is also acceptable. Either way, exercise exactly the scenario in the spec: start session A, let it run briefly, start session B (confirm A is now stopped with its elapsed time correctly saved, not discarded), pause B, resume A, and confirm B is now stopped with its full elapsed time intact and its segments closed, and A is running with a fresh open segment. Query the segments/sessions tables directly to confirm `totalElapsed` and segment `endedAt` values agree with what the UI would show for both sessions. Clean up any scratch files/directories afterward. Document exactly what was done and observed in the task report — this is a data-loss bug fix; "the code looks right" is not sufficient evidence.

- [ ] **Step 6: Commit**

```bash
git add electron/db/queries/timerQueries.ts src/lib/store/timerStore.ts
git commit -m "Fix resumeTimerSession discarding a different session's elapsed time

resumeTimerSession did not stop a different running/paused session before
resuming its target, unlike createTimerSession which already handles this
case. Extracted stopTimerSession's core mutation into a shared, transaction-
scoped helper so resuming now stops any other active session and resumes
the target in one atomic transaction — the two sessions can never both end
up active, and the stopped session's elapsed time is correctly preserved
instead of discarded.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Timer tab — quote, panel layout, input borders, start validation (Part 2)

**Files:**
- Modify: `electron/db/seed.ts`
- Modify: `src/components/timer/TimerTab.tsx`
- Modify: `src/styles/globals.css`

**Interfaces:**
- Consumes: `PageQuote` (unmodified, already correctly wired in `page.tsx` — no change needed there), existing `timerStore`/`projectStore` actions (unchanged shapes).
- Produces: a new CSS custom property `--timer-input-border`; a seeded `timer` quote assignment; a restructured Active Timer panel; Start-button validation with an inline error message.

- [ ] **Step 1: Seed a default quote assignment for the Timer page (Part 2a)**

In `electron/db/seed.ts`'s `seedQuoteAssignments`, add one entry to the `defaults` array (matching the existing style of the other 7 entries exactly):
```ts
{ pageId: 'timer', tabId: '', quoteId: 'h002' },
```
(`h002` = Hormozi, "You don't need more time. You need less bullshit." — already a bundled quote in `data/quotes.json`.) The function's existing `if (!existing)` guard means this is safe to add unconditionally — it will only insert on databases that don't already have a `('timer', '')` assignment, and does nothing to any other page's assignment.

- [ ] **Step 2: Add a Timer-scoped, higher-contrast input-border token (Part 2c)**

In `src/styles/globals.css`, under the existing `/* Borders */` section (which currently has `--border-subtle: #EDE9FE;` and `--border-strong: #DDD6FE;`), add:
```css
/* Timer-feature-only: --border-subtle reads as nearly invisible against the
   white panel background behind the Timer page's rate/project inputs. This
   token is deliberately higher-contrast and used ONLY by Timer's form inputs
   (never card/divider borders, never buttons) — --border-subtle itself is
   left untouched since it's used pervasively outside the Timer feature. */
--timer-input-border: #A78BFA;
```
This sits between `--border-strong` (#DDD6FE) and `--accent` (#6D28D9) in the same violet family, giving clearly visible contrast against `--bg-surface` (#FFFFFF) without clashing with the palette.

Then, in `src/components/timer/TimerTab.tsx`, replace `var(--border-subtle)` with `var(--timer-input-border)` in exactly these four places (all genuine form inputs — do not touch any card/panel/button border in this file):
- `secondaryButtonStyle` — **do not touch this one**, it's a button (the Stop button), explicitly out of scope per "do not restyle... the transport buttons."
- `selectStyle` (used by the project `<select>` and, after Step 3 below, the currency `<select>`)
- `rateInputStyle` (used by the project-rate input and, after Step 3, the default-rate input)
- the session-name `<input type="text">`'s inline style

Also update `src/components/timer/SessionRow.tsx`'s inline-rename `<input>` (the one text input inside that file) to use `var(--timer-input-border)` instead of `var(--border-subtle)` — the outer row `<div>`'s own border is a different concern (Part 3a, Task 3) and must NOT be touched here.

- [ ] **Step 3: Restructure the Active Timer panel layout (Part 2b)**

Current layout has: a centered row with the project `<select>` and session-name `<input>`, then a centered row with "Project rate" and "Default rate + currency" side by side, then the clock, then the transport buttons.

New layout — the clock and transport buttons (lines currently rendering `formatElapsed(elapsedMs)` and the Start/Pause/Resume/Stop buttons) keep their exact current JSX, styling, and central position, completely untouched. Restructure only the two rows above them into a layout with:

**Left-aligned column** (stacked vertically, in this order):
1. Session name `<input>` (move above the project select)
2. Project `<select>`
3. Project-rate input, with the currency symbol moved *inside* the input as a visual prefix rather than a separate `<span>` floating to its left — implement this the same way currency-prefixed inputs are typically done: wrap the input in a `position: relative` container, absolutely-position the currency symbol inside it on the left with left padding, and add matching `paddingLeft` to the `<input>` itself so typed text never overlaps the symbol.

**Upper-right column** (stacked vertically, positioned in the panel's top-right corner via the panel becoming `position: relative` and this column `position: absolute; top: ...; right: ...` — or via a flex row splitting the panel's top area into a left block and this right block, whichever produces cleaner, more maintainable JSX; use your judgment, the visual result is what matters):
1. A "Currency" label, with the currency `<select>` beneath it
2. Beneath that, a "Default rate" label with its input beneath it — remove the "(used when a project has no rate of its own)" description text entirely (it was there before; delete it, don't just visually hide it)

Preserve every existing piece of *behavior* exactly (disabled states while a session is active, the `projectRateInput`/`defaultRateInput`/`seededProjectIdRef` seeding logic, `handleProjectRateChange`/`handleDefaultRateChange`/`handleCurrencyChange`, the project `<option>` labels showing effective rate) — this step is a pure layout/JSX restructure, not a behavior change.

- [ ] **Step 4: Start-button validation (Part 2d)**

Currently the Start button is `disabled={!selectedProjectId}` with an opacity/not-allowed-cursor treatment. Change this:
- The Start button is always enabled/clickable (remove the `disabled` prop and its associated opacity/cursor styling — restore it to `primaryButtonStyle` unmodified, matching Pause/Resume/Stop's plain styling).
- Add local state `const [startError, setStartError] = useState('')`.
- Rewrite `handleStart`:
```ts
const handleStart = useCallback(async () => {
  const trimmedName = sessionNameInput.trim()
  if (!selectedProjectId || !trimmedName) {
    setStartError('Please select a project and enter a session name.')
    return
  }
  setStartError('')
  await createSession(selectedProjectId, trimmedName)
  setSessionNameInput('')
}, [selectedProjectId, sessionNameInput, createSession])
```
- Clear the error as soon as the missing field is supplied: add `if (startError) setStartError('')` (or equivalent) to the `onChange` handlers for both the project `<select>` and the session-name `<input>` — whichever field changes, clear the error if one is currently shown (simplest: just always clear `startError` on either field's change, regardless of whether that specific field was the missing one).
- Render the error message near the bottom of the timer panel (below the transport buttons, still inside the panel's outer container) only when `startError` is non-empty. Find this app's existing error-text convention (check how validation errors are styled elsewhere in this codebase, e.g. search for existing inline form-error patterns in Payments/Finance modals) and match it — do not invent a new error style.
- Note: `createSession` now always receives a real (non-empty, trimmed) name, so the `sessionNameInput.trim() || undefined` fallback that made the name optional is no longer reachable in the valid-submission path — that's fine, it's a direct consequence of the new requirement that a name is mandatory to start.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit -p tsconfig.json`, `npx tsc --noEmit -p tsconfig.electron.json`, `npx jest` (57/57), `npx next build`. All clean.

Manual visual check (skip if the user's real packaged app is running, per this codebase's established practice — do not disrupt it): confirm the quote now appears beneath the Timer page title, confirm the new panel layout matches the described left/upper-right split, confirm the rate input borders are now visibly readable, confirm clicking Start with no project/name shows the inline error and it clears correctly.

- [ ] **Step 6: Commit**

```bash
git add electron/db/seed.ts src/components/timer/TimerTab.tsx src/components/timer/SessionRow.tsx src/styles/globals.css
git commit -m "Fix Timer tab: seed page quote, restructure panel layout, fix input borders and Start validation

- Seeded a default quote assignment for the Timer page (PageQuote itself
  was already correctly wired in; no assignment existed so it rendered
  nothing)
- Added a Timer-scoped --timer-input-border token (--border-subtle is
  used pervasively outside Timer and can't be bumped in place) and
  applied it to Timer's form inputs only
- Restructured the Active Timer panel: session name / project / project
  rate (currency symbol now an inline prefix) on the left; Currency and
  Default rate stacked in the upper right, with the default-rate
  description text removed
- Start is now always clickable; missing project or session name shows
  an inline error instead of a disabled button

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: SessionRow — dot removal, alignment, paused label, time/earnings swap (Part 3)

**Files:**
- Modify: `src/components/timer/SessionRow.tsx`
- Modify: `src/components/timer/InvoiceModal.tsx` (only if inspection in Step 1 shows it depends on `SessionRow`'s internal layout — it currently renders its own independent receipt line items, not `SessionRow` itself, so no change is expected; confirm and skip if so)

**Interfaces:**
- Consumes: nothing new.
- Produces: no prop-shape changes to `SessionRowProps` — this task is purely internal to the component's rendering.

- [ ] **Step 1: Remove the status dot; add active-row highlighting (Part 3a)**

Remove this block entirely:
```tsx
{isActive && (
  <span
    className={isRunning ? 'animate-pulse' : ''}
    style={{
      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
      backgroundColor: isRunning ? '#4ADE80' : '#FBBF20',
    }}
  />
)}
```
Change the outer row `<div>`'s style so an active (running or paused) session gets a distinctly highlighted card treatment instead:
```ts
style={{
  backgroundColor: isActive ? 'var(--accent-soft)' : 'var(--bg-surface)',
  border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border-subtle)'}`,
  borderRadius: 10, padding: '12px 16px', marginBottom: 8,
  display: 'flex', alignItems: 'center', gap: 12,
}}
```
The project's own color dot (the small `<div>` next to the project name, further down) stays exactly as-is — only the separate running/paused status dot is removed.

- [ ] **Step 2: Align the title's left edge to the project name's left edge (Part 3b)**

The project name sits after an 8px-diameter color dot plus a 6px gap (14px total offset) inside its own flex row. The session-name/title `<div>` (and its edit-mode `<input>` sibling) currently has no matching offset, so it starts 14px to the left of where the project name text begins. Add `marginLeft: 14` (or `paddingLeft: 14` — whichever composes more cleanly with the surrounding flex layout, your judgment) to the title `<div>` (both the display-mode text version and the edit-mode `<input>`) so its left edge lines up exactly with the project name text's left edge, not with the project dot.

- [ ] **Step 3: Fix the Running/Paused label bug (Part 3c)**

Replace:
```ts
const toLabel = session.status !== 'stopped' ? 'Running' : formatSessionTimestamp(lastEnd!, spansMultipleDays)
```
with:
```ts
const toLabel = session.status === 'running'
  ? 'Running'
  : session.status === 'paused'
    ? 'Paused'
    : formatSessionTimestamp(lastEnd!, spansMultipleDays)
```

- [ ] **Step 4: Swap the elapsed-time and earnings visual treatment (Part 3d)**

Currently:
```tsx
<div style={{ textAlign: 'right', flexShrink: 0 }}>
  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
    {formatCurrency(currency, earnings)}
  </div>
  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
    {formatElapsed(session.totalElapsed)}
  </div>
</div>
```
Swap which value gets which treatment (time now bold/accent/on top; earnings now plain/smaller/beneath) — combine with Step 5's prominence change below in the same edit:
```tsx
<div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 24 }}>
  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
    {formatElapsed(session.totalElapsed)}
  </div>
  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
    {formatCurrency(currency, earnings)}
  </div>
</div>
```

- [ ] **Step 5: Increase right-column prominence (Part 3e)**

Already folded into Step 4's snippet above: `fontSize` on the elapsed-time line bumped from 20 to 24, and `marginLeft: 24` added to push the whole right-hand block further from the row's text content. If, once rendered, this doesn't read as clearly "further right" (e.g. the row's `gap: 12` between the text-content flex div and this right column still makes it look close), also increase that row-level `gap` — use your judgment on the exact values; the goal stated in the spec is deliberate visual weight and separation, not a specific pixel value.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit -p tsconfig.json`, `npx tsc --noEmit -p tsconfig.electron.json`, `npx jest` (57/57), `npx next build`. All clean.

Manual visual check (skip if the real app is running): confirm a running session's row shows no separate dot, has the accent-tinted border/background, confirm a paused session's row correctly reads "Paused" not "Running", confirm the title and project name are flush-aligned, confirm elapsed time is now the bold headline figure with earnings beneath it in plain text, and confirm the right column reads as clearly emphasized/separated from the row's text content.

- [ ] **Step 7: Commit**

```bash
git add src/components/timer/SessionRow.tsx
git commit -m "Fix SessionRow: remove redundant status dot, alignment, paused label, time/earnings swap

- Removed the separate green/amber running/paused dot (redundant with the
  project's own color dot); active sessions now get a distinctly
  highlighted card border/background instead
- Aligned the session title's left edge to the project name's left edge
  (previously offset by the project dot's width)
- Fixed a bug where a paused session's To-timestamp displayed 'Running'
  (any non-stopped status rendered that literal string) — now derived
  correctly from the session's actual status
- Swapped elapsed time and earnings prominence: time is now the bold
  accent-colored headline figure, earnings the plain secondary line
- Increased the right column's font size and separation from the row's
  text content for clearer visual weight

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Timesheet tab — calendar navigation and spacing (Part 4)

**Files:**
- Modify: `src/components/timer/TimesheetTab.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: no prop/behavior changes visible outside this component.

- [ ] **Step 1: Stop adjacent-month day clicks from changing the displayed month (Part 4a)**

Replace:
```ts
const handleSelectDay = (date: Date) => {
  const range = getWeekRange(date)
  setSelectedWeekStart(range.start)
  if (!isSameMonth(date, viewedMonth)) {
    setViewedMonth(isAfter(date, now) ? now : date)
  }
}
```
with:
```ts
const handleSelectDay = (date: Date) => {
  const range = getWeekRange(date)
  setSelectedWeekStart(range.start)
}
```
Clicking any day (in-month or a leading/trailing adjacent-month day) still selects that day's week and updates the breakdown — it just never changes `viewedMonth` anymore. Only the chevron buttons do. (This also makes the previously-known "future month via adjacent-day click" edge case moot, since `viewedMonth` can no longer change from a click at all — the `isAfter`/`now` import may become unused as a result of this change; if so, remove the now-dead import rather than leaving it.)

- [ ] **Step 2: Tighten the calendar widget's density (Part 4b, calendar half)**

Reduce the day cell's vertical padding and the circle/dot area's footprint so the grid reads denser, closer to the reference screenshot (`timer-fixes-round2.md`'s Image 6 — a compact grid where 5-6 week rows plus the header fit in noticeably less vertical space than the current implementation). Concretely, as a starting point (adjust based on your own visual read against the reference, this is a density target, not an exact spec):
- Day cell padding: reduce from `'4px 0'` toward something tighter, e.g. `'2px 0'`.
- The day-number circle: consider reducing from `28×28` slightly, e.g. `24×24`, if that reads closer to the reference without making the tap/click target uncomfortably small.
- The dot-slot height beneath each number: reduce from `6px` toward `4-5px` if it helps density.
- The header's `marginBottom: 16` before the grid starts: consider tightening slightly, e.g. `12`.

- [ ] **Step 3: Add breathing room to the day-by-day breakdown (Part 4b, breakdown half)**

For each of the seven day rows:
- Increase vertical spacing — either bump `marginBottom` from `10` to something larger (e.g. `14-16`), or switch to padding plus a visible separator (next bullet) — whichever produces cleaner, more even spacing against the reference.
- Add a thin horizontal rule between rows, e.g. `borderBottom: '1px solid var(--border-subtle)'` on each row except (optionally) the last, matching the reference's visible thin dividers between "24 Monday" / "25 Tuesday" / etc.
- Increase the row label's `fontSize` (currently `13`) and the hours value's `fontSize` (currently `13`) — bump both by a small, matching amount (e.g. to `14-15`) so the two halves of the page feel visually balanced once the calendar side becomes denser.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit -p tsconfig.json`, `npx tsc --noEmit -p tsconfig.electron.json`, `npx jest` (57/57), `npx next build`. All clean.

Manual visual check against the Image 6 reference (skip only the parts requiring the real app if it's running — this task's spacing changes can also be sanity-checked via a `next dev` + Playwright screenshot of the Timesheet tab, comparing side-by-side with the reference image): confirm the calendar reads denser, confirm the breakdown rows have visible dividers and more generous spacing, confirm clicking a trailing/leading adjacent-month day selects its week without moving the displayed month.

- [ ] **Step 5: Commit**

```bash
git add src/components/timer/TimesheetTab.tsx
git commit -m "Fix Timesheet tab: stop month-jump on adjacent-day click, tighten calendar, add breakdown spacing

- Clicking a leading/trailing adjacent-month day now only selects its
  week — it no longer changes the displayed calendar month. Only the
  chevrons change months.
- Reduced calendar cell padding/circle size for a denser grid, closer to
  the Work diary reference
- Added more vertical padding and a thin divider between day-by-day
  breakdown rows, and increased their label/value font size for balance
  against the now-tighter calendar

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Sessions tab — Today filter (Part 5)

**Files:**
- Modify: `src/components/timer/SessionsTab.tsx`

**Interfaces:**
- Consumes: `SessionRow` (unchanged props — this task only verifies Task 3's changes render correctly here).
- Produces: a new `'today'` filter option.

- [ ] **Step 1: Add the Today filter**

Change `SessionFilter` and `FILTERS`:
```ts
type SessionFilter = 'today' | 'week' | 'month' | 'all'

const FILTERS: { id: SessionFilter; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'all', label: 'All' },
]
```
Keep the default filter state as `'all'` (`useState<SessionFilter>('all')` — unchanged). Add the `'today'` filtering branch to `filteredSortedSessions`'s logic — a session's `createdAt` falls on the current calendar day. Use `date-fns`'s `isSameDay` (already imported in this codebase's Timer files, e.g. `SessionRow.tsx`/`TimesheetTab.tsx` — add the import to `SessionsTab.tsx` if not already present) against `new Date()`:
```ts
if (sessionFilter === 'today') {
  list = list.filter((s) => isSameDay(new Date(s.createdAt), new Date()))
} else if (sessionFilter !== 'all') {
  const reference = new Date()
  const interval = sessionFilter === 'week' ? getWeekRange(reference) : { start: startOfMonth(reference), end: endOfMonth(reference) }
  list = list.filter((s) => isWithinInterval(new Date(s.createdAt), interval))
}
```
(Adjust the exact `if`/`else if` structure to fit cleanly with the existing code around it — the logic above is the requirement, not literal copy-paste-required code.)

- [ ] **Step 2: Verify Task 3's SessionRow changes render correctly here, including in the bulk-selection state**

This tab already renders `SessionRow` with `selectable` — no prop changes are needed from this task. Manually confirm (visually, per this codebase's established skip-if-real-app-running practice) that: the active-row highlighting, alignment fix, paused label fix, and time/earnings swap all appear correctly in this tab's rows; and that a selected (checked) row's checkbox plus the new row highlighting/alignment don't visually collide or overlap awkwardly.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit -p tsconfig.json`, `npx tsc --noEmit -p tsconfig.electron.json`, `npx jest` (57/57), `npx next build`. All clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/timer/SessionsTab.tsx
git commit -m "Add Today filter to Sessions tab

Sessions tab filter tabs now read Today / This Week / This Month / All
(default unchanged at All). Today filters to sessions created on the
current calendar day.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Final verification (after Task 5)

- [ ] Run `npx tsc --noEmit -p tsconfig.json`, `npx tsc --noEmit -p tsconfig.electron.json`, `npx jest`, `npx next build` one final time on the fully assembled set of changes.
- [ ] Full manual walkthrough of all three sub-tabs (skip the live-app parts if the real packaged app is running), confirming nothing from the prior Timer restructure silently regressed.
- [ ] Confirm `git status` is clean (no stray temp/verification files) and `git log` shows one commit per task.
