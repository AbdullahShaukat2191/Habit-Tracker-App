# Timer Page Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Timer page into a Projects-style Tab→Quote→Sub-tabs layout with three sub-tabs (Timer, Timesheet, Sessions), add per-project hourly rates with rate snapshotting on sessions, add segment-level pause/resume tracking, and rebuild the stats bar, session rows, work diary calendar, and invoice modal to match the supplied reference screenshots.

**Architecture:** Additive schema changes (nullable `projects.hourly_rate`, `timer_sessions.rate_snapshot`, new `timer_segments` table) computed inside the existing query functions inside DB transactions so a session and its segments never drift. The Timer page becomes a thin shell that renders one of three sub-tab components, each importing shared `SessionRow`/`StatBar`/formatting primitives so nothing is duplicated. `totalElapsed` remains the authoritative running total everywhere it's already used; segments are purely additive detail for the From/To/work-periods UI.

**Tech Stack:** Next.js 14 (static export) + Electron 34, Drizzle ORM / better-sqlite3, Zustand, date-fns, lucide-react, framer-motion. No new dependencies.

**Spec:** This plan implements the "Timer Page Restructure — Master Prompt" given directly in the conversation (Parts 1–5 + scope boundary), matched against 5 reference screenshots (Projects page tab/quote/subtabs layout, a session row, the 4-card stats bar, the Work diary calendar + breakdown, and the 3-card Recent transactions bar).

## Global Constraints

- Touch only: the Timer page and its new sub-components, `timerStore`, `timerQueries`, the timer IPC handlers and their preload/`electron.d.ts`/`ipc.ts` wiring, the schema and migration for the three Part 1 changes, `shared/types.ts`, and the invoice modal.
- One explicit, approved exception: `electron/db/queries/projects.ts`'s `rowToProject` mapper gains a one-line read of the new `hourlyRate` column (see Task 2). No other line in that file, and no Projects UI file, changes.
- Do not touch Tasks, Habits, Goals, Wishlist, Finance, Payments, the sidebar, `ConfirmDeleteModal`, or `src/lib/currency.ts`.
- The `hourlyRate` column on `projects` must never be read, written, or displayed by any Projects-page UI file (`src/app/projects/page.tsx`, `ProjectCard.tsx`, `ProjectModal.tsx`) — it flows through the shared `projects` table and `projectStore` only because that's the existing single source of truth for project data; the Timer feature is the only *writer* (via a Timer-only IPC channel) and the only UI *reader*.
- Colors/spacing must use this app's existing CSS variable tokens (`var(--bg-surface)`, `var(--text-primary)`, `var(--accent)`, etc.) — the reference screenshots' literal colors are not copied.
- No zero-padded hours and no 24-hour cap in the `H:MM hrs` formatter (e.g. `334:40 hrs` is correct, not `13:22:40`).
- Verify after every task: `npx tsc --noEmit -p tsconfig.json`, `npx tsc --noEmit -p tsconfig.electron.json`, `npx jest`, `npx next build`. All 44 pre-existing tests must keep passing throughout.
- Commit after every task.

---

### Task 1: Schema + migration (Part 1a, 1b, 1c, 1d)

**Files:**
- Modify: `electron/db/schema.ts`
- Modify: `electron/db/migrate.ts`

**Interfaces:**
- Produces: `projects.hourlyRate` (nullable real), `timerSessions.rateSnapshot` (NOT NULL real), new `timerSegments` table (`id`, `sessionId`, `startedAt`, `endedAt` nullable, `createdAt`).

- [ ] **Step 1: Add columns/table to `electron/db/schema.ts`**

Add to the `projects` table definition (after `sortOrder`):
```ts
  hourlyRate: real('hourly_rate'), // Timer-scoped only — never read/written outside the Timer feature
```

Add to the `timerSessions` table definition (after `createdAt`):
```ts
  // Effective hourly rate resolved at session-creation time (project rate, or the
  // global default if unset). Earnings for this session always use this value, never
  // the project's live rate — so a later rate change never retroactively rewrites history.
  rateSnapshot: real('rate_snapshot').notNull(),
```

Add a new table after `timerSettings`:
```ts
// Detailed pause/resume breakdown for a session. totalElapsed on timer_sessions
// remains the authoritative running total everywhere it's already used — segments
// are additive detail for the From/To/"N work periods" UI, not a replacement.
export const timerSegments = sqliteTable('timer_segments', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => timerSessions.id),
  startedAt: integer('started_at').notNull(),
  endedAt: integer('ended_at'), // null = this segment is currently running
  createdAt: integer('created_at').notNull(),
})
```

- [ ] **Step 2: Add migration statements to `electron/db/migrate.ts`**

Add right after the existing `timer_settings` `CREATE TABLE IF NOT EXISTS` block:
```ts
  // Per-project hourly rate (Timer feature only — nullable, falls back to the
  // global timer_settings.hourly_rate when unset)
  try {
    sqlite.exec('ALTER TABLE projects ADD COLUMN hourly_rate REAL')
  } catch {
    // Column already exists — safe to ignore
  }

  // Rate snapshot on sessions — existing pre-migration sessions get 0 since their
  // real historical rate was never recorded; this only affects earnings display
  // for sessions tracked before this update shipped.
  try {
    sqlite.exec('ALTER TABLE timer_sessions ADD COLUMN rate_snapshot REAL NOT NULL DEFAULT 0')
  } catch {
    // Column already exists — safe to ignore
  }

  // Segment-level pause/resume detail. Sessions created before this migration have
  // no rows here — every read path must fall back to startedAt/stoppedAt for From/To.
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS timer_segments (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES timer_sessions(id)
    )
  `)
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit -p tsconfig.json`, `npx tsc --noEmit -p tsconfig.electron.json`, `npx jest`, `npx next build`.
Expected: all clean, 44/44 tests pass (schema-only change, no new tests here).

- [ ] **Step 4: Commit**

```bash
git add electron/db/schema.ts electron/db/migrate.ts
git commit -m "Add per-project hourly rate, session rate snapshot, and timer segments schema"
```

---

### Task 2: Shared types + query-layer (Part 1e)

**Files:**
- Modify: `shared/types.ts`
- Modify: `electron/db/queries/timerQueries.ts`
- Modify: `electron/db/queries/projects.ts` (one line — see Global Constraints exception)

**Interfaces:**
- Consumes: Task 1's schema (`timerSegments`, `projects.hourlyRate`, `timerSessions.rateSnapshot`).
- Produces: `TimerSegment` type; `TimerSession.rateSnapshot`; `Project.hourlyRate`; query functions `getSegmentsBySession(sessionId): TimerSegment[]`, `getSegmentsForSessions(sessionIds: string[]): TimerSegment[]`, `setProjectHourlyRate(projectId: string, rate: number | null): void`; `createTimerSession`/`pauseTimerSession`/`resumeTimerSession`/`stopTimerSession` now also maintain segments and `rateSnapshot` inside a transaction.

- [ ] **Step 1: `shared/types.ts`**

Add `hourlyRate: number | null` to the `Project` interface (after `sortOrder`).
Add `rateSnapshot: number` to `TimerSession` (after `createdAt`).
Add after `TimerSettings`:
```ts
export interface TimerSegment {
  id: string
  sessionId: string
  startedAt: number
  endedAt: number | null
  createdAt: number
}
```

- [ ] **Step 2: `electron/db/queries/projects.ts` — read-only addition**

In `rowToProject`, add one line:
```ts
    hourlyRate: row.hourlyRate ?? null,
```
Do not touch `CreateProjectInput`, `UpdateProjectInput`, `updateProject`, or anything else in this file — the general project-edit path must never be able to set this field.

- [ ] **Step 3: `electron/db/queries/timerQueries.ts` — imports and mappers**

```ts
import { eq, or, desc, and, isNull, inArray } from 'drizzle-orm'
import { timerSessions, timerSettings, timerSegments, projects } from '../schema'
import type { TimerSession, TimerSettings, TimerSegment } from '../../../shared/types'
```
Update `rowToSession` to add `rateSnapshot: row.rateSnapshot`.
Add:
```ts
function rowToSegment(row: typeof timerSegments.$inferSelect): TimerSegment {
  return {
    id: row.id,
    sessionId: row.sessionId,
    startedAt: row.startedAt,
    endedAt: row.endedAt ?? null,
    createdAt: row.createdAt,
  }
}

function resolveEffectiveRate(projectId: string): number {
  const db = getDb()
  const project = db.select({ hourlyRate: projects.hourlyRate }).from(projects).where(eq(projects.id, projectId)).get()
  if (project?.hourlyRate != null) return project.hourlyRate
  return getTimerSettings().hourlyRate
}
```

- [ ] **Step 4: Rewrite `createTimerSession` to snapshot the rate and open the first segment**

```ts
export function createTimerSession(projectId: string, name?: string): TimerSession {
  const db = getDb()
  const active = getActiveSession()
  if (active) {
    stopTimerSession(active.id)
  }
  const rateSnapshot = resolveEffectiveRate(projectId)
  const id = randomUUID()
  const startedAt = Date.now()
  const row = {
    id,
    projectId,
    name: name ?? null,
    startedAt,
    totalElapsed: 0,
    status: 'running' as const,
    pausedAt: null,
    stoppedAt: null,
    createdAt: Date.now(),
    rateSnapshot,
  }
  db.transaction((tx) => {
    tx.insert(timerSessions).values(row).run()
    tx.insert(timerSegments).values({ id: randomUUID(), sessionId: id, startedAt, endedAt: null, createdAt: Date.now() }).run()
  })
  return rowToSession(db.select().from(timerSessions).where(eq(timerSessions.id, id)).get()!)
}
```

- [ ] **Step 5: Wrap `pauseTimerSession`, `resumeTimerSession`, `stopTimerSession` to also maintain segments**

`pauseTimerSession` — after computing `totalElapsed`, replace the single `db.update` with:
```ts
  const now = Date.now()
  db.transaction((tx) => {
    tx.update(timerSessions).set({ totalElapsed, pausedAt: now, status: 'paused' }).where(eq(timerSessions.id, id)).run()
    tx.update(timerSegments).set({ endedAt: now }).where(and(eq(timerSegments.sessionId, id), isNull(timerSegments.endedAt))).run()
  })
```

`resumeTimerSession` — replace the single `db.update` with:
```ts
  const now = Date.now()
  db.transaction((tx) => {
    tx.update(timerSessions).set({ startedAt: now, pausedAt: null, status: 'running' }).where(eq(timerSessions.id, id)).run()
    tx.insert(timerSegments).values({ id: randomUUID(), sessionId: id, startedAt: now, endedAt: null, createdAt: now }).run()
  })
```

`stopTimerSession` — replace the single `db.update` with (closes an open segment if one exists; a no-op `and(...)` match is harmless when the session was already paused with no open segment):
```ts
  const now = Date.now()
  db.transaction((tx) => {
    tx.update(timerSessions).set({ totalElapsed, stoppedAt: now, status: 'stopped' }).where(eq(timerSessions.id, id)).run()
    tx.update(timerSegments).set({ endedAt: now }).where(and(eq(timerSegments.sessionId, id), isNull(timerSegments.endedAt))).run()
  })
```

- [ ] **Step 6: Add segment queries and the project-rate setter**

```ts
export function getSegmentsBySession(sessionId: string): TimerSegment[] {
  const db = getDb()
  return db.select().from(timerSegments).where(eq(timerSegments.sessionId, sessionId)).orderBy(timerSegments.startedAt).all().map(rowToSegment)
}

export function getSegmentsForSessions(sessionIds: string[]): TimerSegment[] {
  if (sessionIds.length === 0) return []
  const db = getDb()
  return db.select().from(timerSegments).where(inArray(timerSegments.sessionId, sessionIds)).orderBy(timerSegments.startedAt).all().map(rowToSegment)
}

export function setProjectHourlyRate(projectId: string, rate: number | null): void {
  const db = getDb()
  db.update(projects).set({ hourlyRate: rate }).where(eq(projects.id, projectId)).run()
}
```

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit -p tsconfig.json`, `npx tsc --noEmit -p tsconfig.electron.json`, `npx jest`, `npx next build`.
Expected: all clean, 44/44 pass. (No new DB-integration tests here — this codebase has no precedent for mocking `electron.app`/`better-sqlite3` in jest; Task 2's transaction logic is verified manually against the real app's live database in Task 7/9's manual-verification steps, per this codebase's established practice.)

- [ ] **Step 8: Commit**

```bash
git add shared/types.ts electron/db/queries/timerQueries.ts electron/db/queries/projects.ts
git commit -m "Add rate snapshotting and segment tracking to timer query layer"
```

---

### Task 3: IPC + preload + electron.d.ts + ipc.ts wiring

**Files:**
- Modify: `electron/ipc/handlers.ts`
- Modify: `electron/preload.ts`
- Modify: `src/types/electron.d.ts`
- Modify: `src/lib/ipc.ts`

**Interfaces:**
- Consumes: Task 2's `getSegmentsBySession`, `getSegmentsForSessions`, `setProjectHourlyRate`.
- Produces: renderer-callable `ipc.getSegmentsBySession(sessionId)`, `ipc.getSegmentsForSessions(sessionIds)`, `ipc.setProjectHourlyRate(projectId, rate)`.

- [ ] **Step 1: `electron/ipc/handlers.ts`** — add under the existing `// Timer` block:
```ts
  handle('timer:getSegmentsBySession', (sessionId) => timerQueries.getSegmentsBySession(sessionId))
  handle('timer:getSegmentsForSessions', (sessionIds) => timerQueries.getSegmentsForSessions(sessionIds))
  handle('timer:setProjectRate', (projectId, rate) => timerQueries.setProjectHourlyRate(projectId, rate))
```

- [ ] **Step 2: `electron/preload.ts`** — add `TimerSegment` to the type import from `../shared/types`, and add to the Timer section of `api`:
```ts
  getSegmentsBySession: (sessionId: string): Promise<TimerSegment[]> =>
    ipcRenderer.invoke('timer:getSegmentsBySession', sessionId),
  getSegmentsForSessions: (sessionIds: string[]): Promise<TimerSegment[]> =>
    ipcRenderer.invoke('timer:getSegmentsForSessions', sessionIds),
  setProjectHourlyRate: (projectId: string, rate: number | null): Promise<void> =>
    ipcRenderer.invoke('timer:setProjectRate', projectId, rate),
```

- [ ] **Step 3: `src/types/electron.d.ts`** — add `TimerSegment` to the type import, and add the same three method signatures to the `ElectronAPI` interface (this file is a separate, hand-maintained contract from `preload.ts` — both must be updated or renderer `tsc` fails).

- [ ] **Step 4: `src/lib/ipc.ts`** — add `TimerSegment` to the type import, and add:
```ts
export const getSegmentsBySession = (sessionId: string): Promise<TimerSegment[]> => api().getSegmentsBySession(sessionId)
export const getSegmentsForSessions = (sessionIds: string[]): Promise<TimerSegment[]> => api().getSegmentsForSessions(sessionIds)
export const setProjectHourlyRate = (projectId: string, rate: number | null): Promise<void> => api().setProjectHourlyRate(projectId, rate)
```

- [ ] **Step 5: Verify** — `tsc` both configs, `jest`, `next build`. All clean, 44/44.

- [ ] **Step 6: Commit**
```bash
git add electron/ipc/handlers.ts electron/preload.ts src/types/electron.d.ts src/lib/ipc.ts
git commit -m "Wire timer segment queries and project-rate setter through IPC"
```

---

### Task 4: `timerStore` updates

**Files:**
- Modify: `src/lib/store/timerStore.ts`

**Interfaces:**
- Consumes: Task 3's `ipc.getSegmentsForSessions`, `ipc.setProjectHourlyRate`; `useProjectStore.getState().loadProjects` (existing, unmodified — called, not edited).
- Produces: `segmentsBySessionId: Record<string, TimerSegment[]>`, `loadSegmentsForSessions(sessionIds: string[]): Promise<void>`, `setProjectRate(projectId: string, rate: number | null): Promise<void>`.

- [ ] **Step 1: Add state + import**
```ts
import { useProjectStore } from './projectStore'
import type { TimerSession, TimerSettings, TimerSegment } from '../../../shared/types'
```
Add to `TimerStore` interface: `segmentsBySessionId: Record<string, TimerSegment[]>`, and to state: `segmentsBySessionId: {}`.

- [ ] **Step 2: Add actions**
```ts
  loadSegmentsForSessions: async (sessionIds: string[]) => {
    if (sessionIds.length === 0) return
    const segments = await ipc.getSegmentsForSessions(sessionIds)
    set((s) => {
      const next = { ...s.segmentsBySessionId }
      for (const id of sessionIds) next[id] = []
      for (const seg of segments) next[seg.sessionId] = [...(next[seg.sessionId] ?? []), seg]
      return { segmentsBySessionId: next }
    })
  },

  setProjectRate: async (projectId: string, rate: number | null) => {
    await ipc.setProjectHourlyRate(projectId, rate)
    await useProjectStore.getState().loadProjects()
  },
```
Add both signatures to the `TimerStore` interface (`loadSegmentsForSessions: (sessionIds: string[]) => Promise<void>`, `setProjectRate: (projectId: string, rate: number | null) => Promise<void>`).

- [ ] **Step 3: Verify** — `tsc` both configs, `jest`, `next build`. All clean, 44/44.

- [ ] **Step 4: Commit**
```bash
git add src/lib/store/timerStore.ts
git commit -m "Add segment loading and per-project rate action to timerStore"
```

---

### Task 5: Shared Timer formatting helpers

**Files:**
- Create: `src/lib/timerFormat.ts`
- Create: `src/lib/__tests__/timerFormat.test.ts`

**Interfaces:**
- Produces: `formatElapsed(ms): string` (HH:MM:SS, moved here from `page.tsx`), `formatHoursMinutes(ms): string` (`H:MM hrs`, uncapped hours, zero-padded minutes only), `formatRelativeAgo(timestampMs): string`, `formatSessionTimestamp(ms, includeDate: boolean): string`, `getWeekRange(date, weekStartsOn: 1)`, `getMonthGridWeeks(monthDate)` (Monday-first calendar grid including leading/trailing days from adjacent months).

- [ ] **Step 1: Write the helpers**

```ts
import { format, formatDistanceToNow, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, isSameMonth } from 'date-fns'

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

// Uncapped hours (no 24h wrap), zero-padded minutes only — e.g. "334:40 hrs", "0:00 hrs".
export function formatHoursMinutes(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}:${String(minutes).padStart(2, '0')} hrs`
}

export function formatRelativeAgo(timestampMs: number): string {
  return formatDistanceToNow(timestampMs, { addSuffix: true })
}

export function formatSessionTimestamp(ms: number, includeDate: boolean): string {
  return includeDate ? format(ms, 'MMM d, h:mm a') : format(ms, 'h:mm a')
}

export function getWeekRange(date: Date) {
  return { start: startOfWeek(date, { weekStartsOn: 1 }), end: endOfWeek(date, { weekStartsOn: 1 }) }
}

// Monday-first grid of full weeks covering the given month, including leading/trailing
// days from adjacent months so every row has 7 days.
export function getMonthGridWeeks(monthDate: Date): { date: Date; inMonth: boolean }[][] {
  const monthStart = startOfMonth(monthDate)
  const monthEnd = endOfMonth(monthDate)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days: { date: Date; inMonth: boolean }[] = []
  let cursor = gridStart
  while (cursor <= gridEnd) {
    days.push({ date: cursor, inMonth: isSameMonth(cursor, monthDate) })
    cursor = addDays(cursor, 1)
  }

  const weeks: { date: Date; inMonth: boolean }[][] = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
  return weeks
}
```

- [ ] **Step 2: Write tests**

```ts
import { formatHoursMinutes, getMonthGridWeeks, getWeekRange } from '../timerFormat'

describe('formatHoursMinutes', () => {
  test('formats zero', () => {
    expect(formatHoursMinutes(0)).toBe('0:00 hrs')
  })
  test('does not zero-pad hours', () => {
    expect(formatHoursMinutes(9 * 60 * 1000)).toBe('0:09 hrs')
  })
  test('is not capped at 24 hours', () => {
    // 334 hours 40 minutes, matching the reference screenshot's "Since start" value
    const ms = (334 * 60 + 40) * 60 * 1000
    expect(formatHoursMinutes(ms)).toBe('334:40 hrs')
  })
  test('rounds down partial minutes', () => {
    expect(formatHoursMinutes(90 * 1000)).toBe('0:01 hrs')
  })
})

describe('getWeekRange', () => {
  test('Monday-first: a Wednesday resolves to that week\'s Monday and Sunday', () => {
    // 2026-06-03 is a Wednesday
    const { start, end } = getWeekRange(new Date('2026-06-03T12:00:00'))
    expect(start.getDay()).toBe(1) // Monday
    expect(end.getDay()).toBe(0) // Sunday
    expect(start.getDate()).toBe(1)
    expect(end.getDate()).toBe(7)
  })
})

describe('getMonthGridWeeks', () => {
  test('every week has exactly 7 days', () => {
    const weeks = getMonthGridWeeks(new Date('2026-06-15T12:00:00'))
    for (const week of weeks) expect(week).toHaveLength(7)
  })
  test('first grid day is a Monday, last is a Sunday', () => {
    const weeks = getMonthGridWeeks(new Date('2026-06-15T12:00:00'))
    expect(weeks[0][0].date.getDay()).toBe(1)
    expect(weeks[weeks.length - 1][6].date.getDay()).toBe(0)
  })
  test('marks leading/trailing days from adjacent months as not in-month', () => {
    const weeks = getMonthGridWeeks(new Date('2026-06-15T12:00:00'))
    const flat = weeks.flat()
    const inMonthCount = flat.filter((d) => d.inMonth).length
    expect(inMonthCount).toBe(30) // June has 30 days
    expect(flat.some((d) => !d.inMonth)).toBe(true)
  })
})
```

- [ ] **Step 3: Run and verify**

Run: `npx jest src/lib/__tests__/timerFormat.test.ts`
Expected: all pass.

- [ ] **Step 4: Commit**
```bash
git add src/lib/timerFormat.ts src/lib/__tests__/timerFormat.test.ts
git commit -m "Add shared Timer formatting/date-window helpers"
```

---

### Task 6: Shared `SessionRow` and `StatBar` components

**Files:**
- Create: `src/components/timer/SessionRow.tsx`
- Create: `src/components/timer/StatBar.tsx`

**Interfaces:**
- Consumes: `formatElapsed`, `formatHoursMinutes`, `formatSessionTimestamp` from Task 5; `formatCurrency` from `src/lib/currency.ts`; `TimerSession`, `TimerSegment`, `Project` from `shared/types.ts`.
- Produces: `<SessionRow session project segments? onContinue onRename onDeleteRequest selectable? isSelected? onToggleSelect? />`; `<StatBar cards={{label, value, subtitle?}[]} />`.

- [ ] **Step 1: `StatBar.tsx`** — generic N-card container matching the reference's "single wide rounded container, light background, evenly spaced columns, muted label / bold value / optional muted subtitle":
```tsx
'use client'
import React from 'react'

export interface StatBarCard {
  label: string
  value: string
  subtitle?: string
}

export function StatBar({ cards }: { cards: StatBarCard[] }) {
  return (
    <div style={{
      display: 'flex', backgroundColor: 'var(--bg-surface-2)', borderRadius: 12,
      padding: '18px 24px', marginBottom: 24,
    }}>
      {cards.map((card, i) => (
        <div key={card.label} style={{ flex: '1 1 0', paddingLeft: i === 0 ? 0 : 24 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{card.label}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{card.value}</div>
          {card.subtitle && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{card.subtitle}</div>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: `SessionRow.tsx`** — port the existing row from `src/app/timer/page.tsx` (rename/continue/delete + hover-reveal action buttons, unchanged interaction logic) and extend it:
  - Accepts `segments: TimerSegment[]` (may be empty). Compute:
    - `firstStart = segments[0]?.startedAt ?? session.startedAt`
    - `lastEnd = session.status !== 'stopped' ? null : (segments[segments.length - 1]?.endedAt ?? session.stoppedAt)`
    - `spansMultipleDays = firstStart and (lastEnd ?? Date.now()) fall on different calendar days` (via `date-fns` `isSameDay`)
    - From label: `formatSessionTimestamp(firstStart, spansMultipleDays)`; To label: `session.status !== 'stopped' ? 'Running' : formatSessionTimestamp(lastEnd!, spansMultipleDays)`.
    - If `segments.length > 1`, render a small muted line: `${segments.length} work periods`.
  - Earnings: `(session.totalElapsed / 3600000) * session.rateSnapshot`, formatted via `formatCurrency(currency, amount)`, rendered in `var(--accent)` at `fontSize: 20, fontWeight: 700` — larger than the elapsed-time text (`fontSize: 13`, `var(--text-secondary)`), so earnings reads as the row's headline number per spec.
  - Optional props `selectable?: boolean`, `isSelected?: boolean`, `onToggleSelect?: (id) => void` — when `selectable` is true and the session is stopped, render the existing checkbox; Recent Sessions (Task 7) passes `selectable={false}` (or omits it), Sessions tab (Task 9) passes `selectable={true}`.
  - Keep the existing running/paused colored-dot indicator, inline rename editor, and hover-revealed Continue/Rename/Delete icons exactly as they work today.

- [ ] **Step 3: Verify** — `tsc` both configs (component not yet wired anywhere, so this mainly checks the files themselves compile once imported by a `.tsx` — defer full verification to Task 7 where it's first consumed; run `tsc` anyway to catch obvious syntax/type errors in isolation via a scratch import if needed).

- [ ] **Step 4: Commit**
```bash
git add src/components/timer/SessionRow.tsx src/components/timer/StatBar.tsx
git commit -m "Add shared SessionRow and StatBar components for the Timer sub-tabs"
```

---

### Task 7: Page shell + Timer sub-tab (Part 2 + Part 3)

**Files:**
- Rewrite: `src/app/timer/page.tsx` (shell only)
- Create: `src/components/timer/TimerTab.tsx`

**Interfaces:**
- Consumes: `PageQuote` (`pageId="timer"`, unmodified, reused exactly as Projects uses it), `SessionRow`, `StatBar` from Task 6, `formatElapsed`/`formatHoursMinutes`/`formatRelativeAgo`/`getWeekRange` from Task 5, `useTimerStore`, `useProjectStore`.
- Produces: the page shell renders one of `<TimerTab />` / `<TimesheetTab />` (Task 8) / `<SessionsTab />` (Task 9) based on local `activeTab` state, default `'timer'`.

- [ ] **Step 1: Rewrite `src/app/timer/page.tsx` as a shell mirroring `src/app/projects/page.tsx`'s header exactly**

Title "Timer" (no top-right button — Timer has no page-level "add" action equivalent to "+ Add Project"), `<PageQuote pageId="timer" />`, then a 3-tab row (`Timer` / `Timesheet` / `Sessions`) styled identically to the Projects/Payments tab row. Content area renders the active sub-tab component.

- [ ] **Step 2: `TimerTab.tsx` — Active timer section (3a)**

Port the existing Active Timer block (project select, session-name input, live HH:MM:SS display, Start/Pause/Resume/Stop) unchanged in mechanics, with two additions:
- Project `<option>` label becomes `${p.name} — ${formatCurrency(settings?.currency, p.hourlyRate ?? settings?.hourlyRate ?? 0)}/hr`.
- Next to the selector: an inline numeric rate field labeled "Project rate" (not "Hourly Rate") bound to the *currently selected* project (or the active session's project if one is running), pre-filled with its effective rate, calling `setProjectRate(projectId, parsedValue)` on change. Directly beside it, a clearly-separate "Default rate" field + currency `<select>` (the block that used to live in the page header) bound to `settings.hourlyRate`/`settings.currency` via the existing `updateSettings` action — labeled "Default rate (used when a project has no rate of its own)".
- Starting remains blocked without a selected project (`disabled={!selectedProjectId}`, unchanged gate).

- [ ] **Step 3: `TimerTab.tsx` — Stats bar (3b)**

Compute, all keyed off `now` (ticking every 1s while a session is running, same `useEffect` pattern as today):
```ts
const last24hMs = sum of sessionElapsedNow(s, now) for sessions with (their most recent activity) within [now - 24h, now]
const thisWeekMs = sum over getWeekRange(now)
const lastWeekMs = sum over getWeekRange(subWeeks(now, 1))
const sinceStartMs = sum of sessionElapsedNow(s, now) over all sessions
const lastActivityAt = sessions.length === 0 ? null : Math.max(...sessions.map(s => s.status === 'stopped' ? (s.stoppedAt ?? s.createdAt) : now))
```
Render via `<StatBar cards={[
  { label: 'Last 24 hours', value: formatHoursMinutes(last24hMs), subtitle: lastActivityAt === null ? 'No sessions yet' : `Last worked ${formatRelativeAgo(lastActivityAt)}` },
  { label: 'This week', value: formatHoursMinutes(thisWeekMs) },
  { label: 'Last week', value: formatHoursMinutes(lastWeekMs) },
  { label: 'Since start', value: formatHoursMinutes(sinceStartMs) },
]} />`.
(For "Last 24 hours" windowing, filter sessions the same way `sessionElapsedNow` totals are filtered elsewhere in this codebase today: by whether the session's `createdAt` falls in `[now - 24*3600*1000, now]` — consistent with how "Today"/"This Week" were computed in the pre-restructure page.)

- [ ] **Step 4: `TimerTab.tsx` — Recent Sessions (3c)**

- Heading "Recent Sessions" (was "Sessions").
- Filter to `createdAt >= now - 14 days`, sorted active-first then `createdAt` DESC (same ordering rule as today).
- No filter tabs, no checkboxes (`selectable={false}` on `SessionRow`).
- On mount and whenever the visible session list changes, call `loadSegmentsForSessions(visibleIds)` and pass `segmentsBySessionId[session.id] ?? []` into each `SessionRow`.
- Empty state: "No sessions in the last 14 days."

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit -p tsconfig.json`, `npx tsc --noEmit -p tsconfig.electron.json`, `npx jest`, `npx next build`. All clean, 44/44.

Manual verification (this codebase's established practice for Timer UI, per the whole prior conversation): launch the real dev build against the live app database via Playwright (`electron.launch`), navigate to Timer, confirm the shell/quote/tabs render, start/pause/resume/stop a real session against an existing real project, confirm segments are written correctly by querying the live sqlite db directly (`ELECTRON_RUN_AS_NODE=1 electron script.js`), confirm the stats bar and Recent Sessions render and update live. Clean up all temp scripts/screenshots afterward, confirm `git status` shows only intended files.

- [ ] **Step 6: Commit**
```bash
git add src/app/timer/page.tsx src/components/timer/TimerTab.tsx
git commit -m "Restructure Timer page into tab shell; rebuild Timer sub-tab per spec"
```

---

### Task 8: Timesheet sub-tab (Part 4)

**Files:**
- Create: `src/components/timer/TimesheetTab.tsx`

**Interfaces:**
- Consumes: `getMonthGridWeeks`, `getWeekRange`, `formatHoursMinutes` from Task 5; `StatBar` from Task 6; `useTimerStore`.

- [ ] **Step 1: Work diary — month calendar (left)**

- Local state: `viewedMonth: Date` (default: current month), `selectedWeekStart: Date` (default: `getWeekRange(new Date()).start`).
- Bordered rounded card (`var(--bg-surface)` / `var(--border-subtle)`), header row: back-chevron button (always enabled, decrements `viewedMonth`), centered `"MMMM yyyy"` label, forward-chevron button **disabled** when `isSameMonth(viewedMonth, new Date()) || isAfter(viewedMonth, new Date())` — never navigate into a future month.
- Column headers `Mon Tue Wed Thu Fri Sat Sun`.
- Render `getMonthGridWeeks(viewedMonth)`; each day cell shows the date number (muted color when `!inMonth`), and a small colored dot beneath it (`var(--accent)`) when any session's `createdAt` falls on that date.
- Selected-week highlight: for the week whose Monday equals `selectedWeekStart`, that row's Monday and Sunday cells get a solid filled circle background (`var(--text-primary)` background, white/`var(--bg-surface)` text) and the five days between get a lighter connecting band (`var(--bg-surface-2)`).
- Clicking any day cell sets `selectedWeekStart = getWeekRange(that day's date).start` and, if that day's month differs from `viewedMonth`, also updates `viewedMonth` to match.
- Legend beneath the grid: one dot + the label "Tracked" (no Manual/Overtime entries — this app has neither).

- [ ] **Step 2: Day-by-day breakdown (right)**

- Heading: `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`.
- Seven rows Monday→Sunday. For each day, sum `totalElapsed` (using `sessionElapsedNow` for a still-active session, so a live session's day is accurate) across sessions whose `createdAt` falls on that date.
- Bar scale: `maxDayMs = Math.max(...sevenDayTotals, 0)`; each bar's width = `maxDayMs === 0 ? 0 : (dayMs / maxDayMs) * 100%` — guarding the zero-max case so all seven render as empty tracks with no division by zero.
- Bar: green fill (`#22C55E`-equivalent app token — since none exists, use a literal green consistent with the two other green usages already in this Timer feature's running-session dot, `#4ADE80`) over a light grey track (`var(--bg-surface-2)`).
- Rows for future dates within the selected week (`isAfter(dayDate, new Date())`) render muted (`var(--text-tertiary)` for both the label and value, reduced-opacity bar track).
- Right-aligned value per row: `formatHoursMinutes(dayMs)`.

- [ ] **Step 3: Recent transactions (4b)**

Heading "Recent transactions" directly beneath the work diary.
```ts
const last7DaysAmount = sum over sessions with createdAt >= now - 7d of (sessionElapsedNow(s, now) / 3600000) * s.rateSnapshot
const last30DaysAmount = same over 30 days
const sinceStartAmount = same over all sessions
```
Render via `<StatBar cards={[
  { label: 'Last 7 days', value: formatCurrency(settings?.currency, last7DaysAmount) },
  { label: 'Last 30 days', value: formatCurrency(settings?.currency, last30DaysAmount) },
  { label: 'Since start', value: formatCurrency(settings?.currency, sinceStartAmount) },
]} />` — same `StatBar` component as Task 6/7, now with 3 cards instead of 4, confirming it generalizes correctly.

- [ ] **Step 4: Verify**

`tsc` both configs, `jest`, `next build`. All clean, 44/44. Manual visual check against the live app (per Task 7's established method) — click through several weeks/months, confirm the forward-chevron disables on the current month, confirm dots appear only on days with real tracked sessions, confirm the bar chart and Recent transactions figures look correct against known real session data.

- [ ] **Step 5: Commit**
```bash
git add src/components/timer/TimesheetTab.tsx
git commit -m "Add Timesheet sub-tab: work diary calendar, day breakdown, recent transactions"
```

---

### Task 9: Sessions sub-tab + bulk actions (Part 5) + Invoice modal update

**Files:**
- Create: `src/components/timer/SessionsTab.tsx`
- Modify: `src/components/timer/InvoiceModal.tsx`

**Interfaces:**
- Consumes: `SessionRow` (Task 6, `selectable={true}`), `ConfirmDeleteModal` (unmodified), `InvoiceModal`.
- Produces: full session archive with All/This Week/This Month filters (moved here from the old single-page Timer tab), a bulk-action bar, and an invoice modal that handles mixed per-session rates.

- [ ] **Step 1: `SessionsTab.tsx` — archive list**

Port the pre-restructure filter-tab logic (`SessionFilter = 'all' | 'week' | 'month'`, default `'all'` per this task's spec — note this differs from the old page's `'week'` default, since Part 5 explicitly says "Default to All") verbatim from the current `src/app/timer/page.tsx`, sorted newest-first (active-first ordering is dropped here since this is a flat archive, not a "what's happening now" view — active sessions still appear, just in normal `createdAt` DESC order like every other session). Each row is `<SessionRow selectable isSelected={...} onToggleSelect={...} segments={segmentsBySessionId[id] ?? []} />`.

- [ ] **Step 2: Selection + bulk-action bar**

Local state: `selectedIds: string[]`. Reset to `[]` whenever `sessionFilter` changes (`useEffect` on `[sessionFilter]`).
Bar renders directly below the sub-tab row, only when `selectedIds.length > 0`, styled as a horizontal panel (`var(--bg-surface-2)` background, rounded, padded) spanning the content width:
- "Selected N" — `var(--text-primary)` label + small rounded badge (`var(--accent-soft)` background, `var(--accent)` text) showing `N`.
- "Select all T" — badge shows count of selectable (stopped) sessions in the current filtered view; clicking sets `selectedIds` to all of their ids.
- "Generate Invoice N" button → opens `InvoiceModal` with the selected sessions.
- "Delete N" button → opens `ConfirmDeleteModal` with `title="Delete N sessions?"` and `message="These sessions and their tracked time will be removed permanently. This cannot be undone."`; on confirm, calls `deleteSession` for each selected id, then clears `selectedIds`.
- "X" icon button → clears `selectedIds` (hides the bar).

- [ ] **Step 3: `InvoiceModal.tsx` update — per-session rate**

Replace the single `hourlyRate: number` prop with `sessions: TimerSession[]` driving its own per-line rate (each session already carries `rateSnapshot`), dropping the separate `hourlyRate` prop entirely:
```ts
const rates = new Set(sessions.map((s) => s.rateSnapshot))
const uniformRate = rates.size === 1 ? sessions[0]?.rateSnapshot : null
```
- Per-line item: amount = `(session.totalElapsed / 3600000) * session.rateSnapshot`, unchanged rendering otherwise.
- If `uniformRate !== null`: keep the existing single "Hourly Rate: {formatCurrency(currency, uniformRate)}" line.
- If `uniformRate === null` (mixed rates): remove that line, and instead render each line item's rate inline beneath its elapsed-time sub-line, e.g. `formatCurrency(currency, session.rateSnapshot)}/hr`, same muted small styling as the elapsed-time text.
- Total remains `sessions.reduce((sum, s) => sum + (s.totalElapsed / 3600000) * s.rateSnapshot, 0)` — already correct in the existing implementation once each line uses its own rate instead of the single passed-in `hourlyRate`.
- Leave the zigzag clip-path logic, backdrop, close mechanism, and all other styling untouched.
- Update the call site in `SessionsTab.tsx` accordingly (`<InvoiceModal sessions={selectedSessions} currency={settings?.currency} onClose={...} />`, no `hourlyRate` prop).

- [ ] **Step 4: Verify**

`tsc` both configs, `jest`, `next build`. All clean, 44/44. Manual visual check (per Task 7's method): select sessions with a single rate (confirm the single "Hourly Rate" line appears), then change one selected session's project's rate and start a fresh session on that project to get a second `rateSnapshot`, select sessions spanning both rates, confirm the invoice switches to per-line inline rates and the Total still sums correctly. Exercise Select all, bulk Delete (with the ConfirmDeleteModal wording), and the X clear button.

- [ ] **Step 5: Commit**
```bash
git add src/components/timer/SessionsTab.tsx src/components/timer/InvoiceModal.tsx
git commit -m "Add Sessions archive tab with bulk actions; update invoice for per-session rates"
```

---

## Final full-suite verification (after Task 9)

- [ ] Run `npx tsc --noEmit -p tsconfig.json`, `npx tsc --noEmit -p tsconfig.electron.json`, `npx jest`, `npx next build` one final time on the fully assembled branch.
- [ ] Full manual walkthrough of all three sub-tabs against the live app database, confirming nothing from the pre-restructure Timer page silently regressed (rename/continue/delete still work; pause/resume still accumulates `totalElapsed` correctly; the invoice's zigzag still renders).
- [ ] Confirm `git status` is clean (no stray temp/verification files) and `git log` shows one commit per task.
