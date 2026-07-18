# Bugs & Features Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 bugs and implement 7 new features: boot animation, purple bullet removal, Wish List section, colored project dropdown, backfill toggle fix, task uncomplete, task sort/group, optional habits, and past-month button corrections.

**Architecture:** Changes touch all three layers — SQLite DB (schema migrations for `is_optional` column + new `wishlist_items` table), Electron main process (new query functions + IPC handlers), and Next.js renderer (new page, stores, and UI components). The IPC bridge flows: `electron/db/queries/` → `electron/ipc/handlers.ts` → `electron/preload.ts` → `src/lib/ipc.ts` → Zustand stores → React components.

**Tech Stack:** Electron 34, Next.js 14 App Router, TypeScript, better-sqlite3, Drizzle ORM, Zustand, Framer Motion, Tailwind CSS, lucide-react, date-fns

---

## File Map

| Status | Path | What changes |
|--------|------|--------------|
| Modify | `electron/db/migrate.ts` | Add `is_optional` column to habits; create `wishlist_items` table |
| Modify | `electron/db/schema.ts` | Add `isOptional` field to habits; add `wishlistItems` table |
| Modify | `electron/db/queries/habits.ts` | Pass `isOptional` in create/update/list |
| Create | `electron/db/queries/wishlist.ts` | CRUD for wishlist items |
| Modify | `electron/db/queries/tasks.ts` | Add `uncompleteTask` |
| Modify | `electron/ipc/handlers.ts` | Register wishlist + uncomplete handlers |
| Modify | `electron/preload.ts` | Expose wishlist + uncomplete via contextBridge |
| Modify | `shared/types.ts` | Add `isOptional` to Habit; add WishlistItem types |
| Modify | `src/lib/ipc.ts` | Typed wrappers for wishlist + uncomplete |
| Create | `src/lib/store/wishlistStore.ts` | Zustand store for wishlist |
| Modify | `src/lib/store/taskStore.ts` | Add `uncompleteTask` action |
| Modify | `src/components/layout/GlobalShortcuts.tsx` | Load settings on mount (backfill bug fix); add wishlist shortcut |
| Modify | `src/components/layout/Sidebar.tsx` | Add Wish List nav item |
| Modify | `src/components/habit-grid/HabitRow.tsx` | Remove purple bullet dot |
| Modify | `src/components/habit-grid/HabitModal.tsx` | Add Optional toggle |
| Modify | `src/components/habit-grid/PerfectDayDialog.tsx` | Exclude optional habits from perfect-day check |
| Modify | `src/components/tasks/TaskCard.tsx` | Allow uncomplete for tasks completed today |
| Modify | `src/components/tasks/AddTaskModal.tsx` | Replace `<select>` with custom colored-dot dropdown |
| Modify | `src/app/page.tsx` | Hide Add Habit on past months; reposition Today button |
| Modify | `src/app/tasks/page.tsx` | Sort asc/desc + group-by-date controls + uncomplete handler |
| Create | `src/app/wishlist/page.tsx` | Wish List page (mirrors tasks page without projects) |
| Create | `src/components/ui/BootAnimation.tsx` | 2-second splash screen |
| Modify | `src/app/layout.tsx` | Mount BootAnimation |

---

### Task 1: DB schema — `is_optional` column + `wishlist_items` table

Add the two schema additions via safe ALTER TABLE / CREATE TABLE IF NOT EXISTS so existing databases upgrade automatically.

**Files:**
- Modify: `electron/db/migrate.ts`
- Modify: `electron/db/schema.ts`

- [ ] **Step 1: Add migrations to `electron/db/migrate.ts`**

At the bottom of `runMigrations`, before the closing `}`, add:

```typescript
  // Add is_optional to habits for existing databases
  try {
    sqlite.exec('ALTER TABLE habits ADD COLUMN is_optional INTEGER NOT NULL DEFAULT 0')
  } catch {
    // Column already exists — safe to ignore
  }

  // Wishlist items table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS wishlist_items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL,
      completed_at INTEGER,
      archived_at INTEGER
    )
  `)
```

- [ ] **Step 2: Update `electron/db/schema.ts` — add `isOptional` to habits**

Find the `habits` table definition and add `isOptional` field:

```typescript
export const habits = sqliteTable('habits', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  schedule: text('schedule').notNull(),
  sortOrder: integer('sort_order').notNull(),
  createdAt: integer('created_at').notNull(),
  archivedAt: integer('archived_at'),
  isOptional: integer('is_optional', { mode: 'boolean' }).notNull().default(false),
})
```

- [ ] **Step 3: Add `wishlistItems` table to `electron/db/schema.ts`**

After the `quotes` table definition, append:

```typescript
export const wishlistItems = sqliteTable('wishlist_items', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  createdAt: integer('created_at').notNull(),
  completedAt: integer('completed_at'),
  archivedAt: integer('archived_at'),
})
```

---

### Task 2: Shared types — add `isOptional`, WishlistItem types

All IPC-facing types live in `shared/types.ts`. This is the single source of truth used by both Electron and the renderer.

**Files:**
- Modify: `shared/types.ts`

- [ ] **Step 1: Add `isOptional` to the `Habit` interface**

Find:
```typescript
export interface Habit {
  id: string
  name: string
  schedule: DayAbbreviation[]
  sortOrder: number
  createdAt: number
  archivedAt: number | null
}
```

Replace with:
```typescript
export interface Habit {
  id: string
  name: string
  schedule: DayAbbreviation[]
  sortOrder: number
  createdAt: number
  archivedAt: number | null
  isOptional: boolean
}
```

- [ ] **Step 2: Add `isOptional` to habit input types**

Find:
```typescript
export interface CreateHabitInput {
  name: string
  schedule: DayAbbreviation[]
}

export interface UpdateHabitInput {
  name?: string
  schedule?: DayAbbreviation[]
}
```

Replace with:
```typescript
export interface CreateHabitInput {
  name: string
  schedule: DayAbbreviation[]
  isOptional?: boolean
}

export interface UpdateHabitInput {
  name?: string
  schedule?: DayAbbreviation[]
  isOptional?: boolean
}
```

- [ ] **Step 3: Add WishlistItem types**

After the `Goal` interface, add:

```typescript
export interface WishlistItem {
  id: string
  title: string
  description: string | null
  createdAt: number
  completedAt: number | null
  archivedAt: number | null
}

export interface CreateWishlistInput {
  title: string
  description?: string
}

export interface UpdateWishlistInput {
  title?: string
  description?: string
}
```

---

### Task 3: Backend query functions

**Files:**
- Modify: `electron/db/queries/habits.ts`
- Modify: `electron/db/queries/tasks.ts`
- Create: `electron/db/queries/wishlist.ts`

- [ ] **Step 1: Update `electron/db/queries/habits.ts` — thread `isOptional` through**

Replace the entire file:

```typescript
import { eq, isNull, asc } from 'drizzle-orm'
import { getDb } from '../client'
import { habits, habitCompletions } from '../schema'
import type { Habit, HabitCompletion, CreateHabitInput, UpdateHabitInput } from '../../../shared/types'
import { randomUUID } from 'crypto'

function rowToHabit(row: typeof habits.$inferSelect): Habit {
  return {
    id: row.id,
    name: row.name,
    schedule: JSON.parse(row.schedule),
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    archivedAt: row.archivedAt ?? null,
    isOptional: row.isOptional ?? false,
  }
}

export function listHabits(): Habit[] {
  const db = getDb()
  return db.select().from(habits).orderBy(asc(habits.sortOrder)).all().map(rowToHabit)
}

export function createHabit(input: CreateHabitInput): Habit {
  const db = getDb()
  const maxOrder = db.select().from(habits).all().reduce((m, h) => Math.max(m, h.sortOrder), -1)
  const row = {
    id: randomUUID(),
    name: input.name,
    schedule: JSON.stringify(input.schedule),
    sortOrder: maxOrder + 1,
    createdAt: Date.now(),
    archivedAt: null,
    isOptional: input.isOptional ?? false,
  }
  db.insert(habits).values(row).run()
  return rowToHabit(db.select().from(habits).where(eq(habits.id, row.id)).get()!)
}

export function updateHabit(id: string, input: UpdateHabitInput): Habit {
  const db = getDb()
  const updates: Partial<typeof habits.$inferInsert> = {}
  if (input.name !== undefined) updates.name = input.name
  if (input.schedule !== undefined) updates.schedule = JSON.stringify(input.schedule)
  if (input.isOptional !== undefined) updates.isOptional = input.isOptional

  db.update(habits).set(updates).where(eq(habits.id, id)).run()
  return rowToHabit(db.select().from(habits).where(eq(habits.id, id)).get()!)
}

export function deleteHabit(id: string): void {
  const db = getDb()
  db.update(habits).set({ archivedAt: Date.now() }).where(eq(habits.id, id)).run()
}

export function reorderHabits(ids: string[]): void {
  const db = getDb()
  for (let i = 0; i < ids.length; i++) {
    db.update(habits).set({ sortOrder: i }).where(eq(habits.id, ids[i]!)).run()
  }
}

export function getHabitCompletions(month: string): HabitCompletion[] {
  const db = getDb()
  const prefix = `${month}-`
  return db
    .select()
    .from(habitCompletions)
    .all()
    .filter((r) => r.date.startsWith(prefix))
    .map((r) => ({ habitId: r.habitId, date: r.date, completedAt: r.completedAt }))
}

export function toggleHabitCompletion(habitId: string, date: string): 'completed' | 'uncompleted' {
  const db = getDb()
  const existing = db
    .select()
    .from(habitCompletions)
    .where(eq(habitCompletions.habitId, habitId))
    .all()
    .find((r) => r.date === date)

  if (existing) {
    db.delete(habitCompletions).where(eq(habitCompletions.habitId, habitId)).run()
    return 'uncompleted'
  } else {
    db.insert(habitCompletions).values({ habitId, date, completedAt: Date.now() }).run()
    return 'completed'
  }
}
```

- [ ] **Step 2: Add `uncompleteTask` to `electron/db/queries/tasks.ts`**

At the end of the file, append:

```typescript
export function uncompleteTask(id: string): Task {
  const db = getDb()
  db.update(tasks).set({ completedAt: null }).where(eq(tasks.id, id)).run()
  return rowToTask(db.select().from(tasks).where(eq(tasks.id, id)).get()!)
}
```

- [ ] **Step 3: Create `electron/db/queries/wishlist.ts`**

Create the file with full content:

```typescript
import { eq, isNull, asc, or, isNotNull } from 'drizzle-orm'
import { getDb } from '../client'
import { wishlistItems } from '../schema'
import type { WishlistItem, CreateWishlistInput, UpdateWishlistInput } from '../../../shared/types'
import { randomUUID } from 'crypto'

function rowToItem(row: typeof wishlistItems.$inferSelect): WishlistItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    createdAt: row.createdAt,
    completedAt: row.completedAt ?? null,
    archivedAt: row.archivedAt ?? null,
  }
}

export function listWishlistItems(): WishlistItem[] {
  const db = getDb()
  return db
    .select()
    .from(wishlistItems)
    .where(or(isNull(wishlistItems.archivedAt), isNotNull(wishlistItems.completedAt)))
    .orderBy(asc(wishlistItems.createdAt))
    .all()
    .map(rowToItem)
}

export function createWishlistItem(input: CreateWishlistInput): WishlistItem {
  const db = getDb()
  const row = {
    id: randomUUID(),
    title: input.title,
    description: input.description ?? null,
    createdAt: Date.now(),
    completedAt: null,
    archivedAt: null,
  }
  db.insert(wishlistItems).values(row).run()
  return rowToItem(db.select().from(wishlistItems).where(eq(wishlistItems.id, row.id)).get()!)
}

export function updateWishlistItem(id: string, input: UpdateWishlistInput): WishlistItem {
  const db = getDb()
  const updates: Partial<typeof wishlistItems.$inferInsert> = {}
  if (input.title !== undefined) updates.title = input.title
  if (input.description !== undefined) updates.description = input.description ?? null
  db.update(wishlistItems).set(updates).where(eq(wishlistItems.id, id)).run()
  return rowToItem(db.select().from(wishlistItems).where(eq(wishlistItems.id, id)).get()!)
}

export function completeWishlistItem(id: string): WishlistItem {
  const db = getDb()
  db.update(wishlistItems).set({ completedAt: Date.now() }).where(eq(wishlistItems.id, id)).run()
  return rowToItem(db.select().from(wishlistItems).where(eq(wishlistItems.id, id)).get()!)
}

export function uncompleteWishlistItem(id: string): WishlistItem {
  const db = getDb()
  db.update(wishlistItems).set({ completedAt: null }).where(eq(wishlistItems.id, id)).run()
  return rowToItem(db.select().from(wishlistItems).where(eq(wishlistItems.id, id)).get()!)
}

export function deleteWishlistItem(id: string): void {
  const db = getDb()
  db.update(wishlistItems).set({ archivedAt: Date.now() }).where(eq(wishlistItems.id, id)).run()
}

export function hardDeleteWishlistItem(id: string): void {
  const db = getDb()
  db.delete(wishlistItems).where(eq(wishlistItems.id, id)).run()
}
```

---

### Task 4: IPC handlers + preload + ipc.ts bridge

Wire the new backend functions through the Electron IPC bridge to the renderer.

**Files:**
- Modify: `electron/ipc/handlers.ts`
- Modify: `electron/preload.ts`
- Modify: `src/lib/ipc.ts`

- [ ] **Step 1: Register new handlers in `electron/ipc/handlers.ts`**

Add this import at the top (after the existing imports):

```typescript
import * as wishlistQueries from '../db/queries/wishlist'
```

Inside `registerAllHandlers()`, after the Tasks block, add:

```typescript
  // Wishlist
  handle('wishlist:list', () => wishlistQueries.listWishlistItems())
  handle('wishlist:create', (input) => wishlistQueries.createWishlistItem(input))
  handle('wishlist:update', (id, input) => wishlistQueries.updateWishlistItem(id, input))
  handle('wishlist:complete', (id) => wishlistQueries.completeWishlistItem(id))
  handle('wishlist:uncomplete', (id) => wishlistQueries.uncompleteWishlistItem(id))
  handle('wishlist:delete', (id) => wishlistQueries.deleteWishlistItem(id))
  handle('wishlist:hard-delete', (id) => wishlistQueries.hardDeleteWishlistItem(id))
```

After the existing Tasks block handlers, add:

```typescript
  handle('tasks:uncomplete', (id) => taskQueries.uncompleteTask(id))
```

- [ ] **Step 2: Expose new channels in `electron/preload.ts`**

Add `WishlistItem`, `CreateWishlistInput`, `UpdateWishlistInput` to the import at the top:

```typescript
import type {
  Habit, HabitCompletion, Task, Project, Goal, MonthlyReport, Quote,
  WishlistItem,
  CreateHabitInput, UpdateHabitInput,
  CreateTaskInput, UpdateTaskInput,
  CreateProjectInput, UpdateProjectInput,
  CreateGoalInput, UpdateGoalInput,
  CreateQuoteInput, UpdateQuoteInput,
  CreateWishlistInput, UpdateWishlistInput,
  SettingsMap, ToggleResult,
} from '../shared/types'
```

Inside the `api` object, after the Tasks block, add:

```typescript
  // --- Wishlist ---
  listWishlistItems: (): Promise<WishlistItem[]> =>
    ipcRenderer.invoke('wishlist:list'),
  createWishlistItem: (input: CreateWishlistInput): Promise<WishlistItem> =>
    ipcRenderer.invoke('wishlist:create', input),
  updateWishlistItem: (id: string, input: UpdateWishlistInput): Promise<WishlistItem> =>
    ipcRenderer.invoke('wishlist:update', id, input),
  completeWishlistItem: (id: string): Promise<WishlistItem> =>
    ipcRenderer.invoke('wishlist:complete', id),
  uncompleteWishlistItem: (id: string): Promise<WishlistItem> =>
    ipcRenderer.invoke('wishlist:uncomplete', id),
  deleteWishlistItem: (id: string): Promise<void> =>
    ipcRenderer.invoke('wishlist:delete', id),
  hardDeleteWishlistItem: (id: string): Promise<void> =>
    ipcRenderer.invoke('wishlist:hard-delete', id),
```

After the existing `completeTask` line, add:

```typescript
  uncompleteTask: (id: string): Promise<Task> =>
    ipcRenderer.invoke('tasks:uncomplete', id),
```

- [ ] **Step 3: Add typed wrappers to `src/lib/ipc.ts`**

Add `WishlistItem`, `CreateWishlistInput`, `UpdateWishlistInput` to the import:

```typescript
import type {
  Habit, HabitCompletion, Task, Project, Goal, MonthlyReport, Quote,
  WishlistItem,
  CreateHabitInput, UpdateHabitInput,
  CreateTaskInput, UpdateTaskInput,
  CreateProjectInput, UpdateProjectInput,
  CreateGoalInput, UpdateGoalInput,
  CreateQuoteInput, UpdateQuoteInput,
  CreateWishlistInput, UpdateWishlistInput,
  SettingsMap, ToggleResult,
} from '../../shared/types'
```

After the `hardDeleteTask` line, add:

```typescript
export const uncompleteTask = (id: string): Promise<Task> => api().uncompleteTask(id)
```

At the end of the file, add:

```typescript
// Wishlist
export const listWishlistItems = (): Promise<WishlistItem[]> => api().listWishlistItems()
export const createWishlistItem = (input: CreateWishlistInput): Promise<WishlistItem> => api().createWishlistItem(input)
export const updateWishlistItem = (id: string, input: UpdateWishlistInput): Promise<WishlistItem> => api().updateWishlistItem(id, input)
export const completeWishlistItem = (id: string): Promise<WishlistItem> => api().completeWishlistItem(id)
export const uncompleteWishlistItem = (id: string): Promise<WishlistItem> => api().uncompleteWishlistItem(id)
export const deleteWishlistItem = (id: string): Promise<void> => api().deleteWishlistItem(id)
export const hardDeleteWishlistItem = (id: string): Promise<void> => api().hardDeleteWishlistItem(id)
```

---

### Task 5: Zustand stores — wishlistStore + taskStore uncomplete

**Files:**
- Create: `src/lib/store/wishlistStore.ts`
- Modify: `src/lib/store/taskStore.ts`

- [ ] **Step 1: Create `src/lib/store/wishlistStore.ts`**

```typescript
'use client'
import { create } from 'zustand'
import type { WishlistItem, CreateWishlistInput, UpdateWishlistInput } from '../../../shared/types'
import * as ipc from '../ipc'

interface WishlistStore {
  items: WishlistItem[]
  loading: boolean
  error: string | null

  loadItems: () => Promise<void>
  createItem: (input: CreateWishlistInput) => Promise<WishlistItem>
  updateItem: (id: string, input: UpdateWishlistInput) => Promise<void>
  completeItem: (id: string) => Promise<WishlistItem>
  uncompleteItem: (id: string) => Promise<WishlistItem>
  deleteItem: (id: string) => Promise<void>
  hardDeleteItem: (id: string) => Promise<void>
}

export const useWishlistStore = create<WishlistStore>((set) => ({
  items: [],
  loading: false,
  error: null,

  loadItems: async () => {
    set({ loading: true, error: null })
    try {
      const items = await ipc.listWishlistItems()
      set({ items, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  createItem: async (input) => {
    const item = await ipc.createWishlistItem(input)
    set((s) => ({ items: [...s.items, item] }))
    return item
  },

  updateItem: async (id, input) => {
    const updated = await ipc.updateWishlistItem(id, input)
    set((s) => ({ items: s.items.map((i) => (i.id === id ? updated : i)) }))
  },

  completeItem: async (id) => {
    const updated = await ipc.completeWishlistItem(id)
    set((s) => ({ items: s.items.map((i) => (i.id === id ? updated : i)) }))
    return updated
  },

  uncompleteItem: async (id) => {
    const updated = await ipc.uncompleteWishlistItem(id)
    set((s) => ({ items: s.items.map((i) => (i.id === id ? updated : i)) }))
    return updated
  },

  deleteItem: async (id) => {
    await ipc.deleteWishlistItem(id)
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, archivedAt: Date.now() } : i)),
    }))
  },

  hardDeleteItem: async (id) => {
    await ipc.hardDeleteWishlistItem(id)
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }))
  },
}))
```

- [ ] **Step 2: Add `uncompleteTask` to `src/lib/store/taskStore.ts`**

In the `TaskStore` interface, add:
```typescript
  uncompleteTask: (id: string) => Promise<Task>
```

In the store implementation, after `completeTask`, add:
```typescript
  uncompleteTask: async (id) => {
    const updated = await ipc.uncompleteTask(id)
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? updated : t)) }))
    return updated
  },
```

---

### Task 6: Fix backfill toggle bug (settings not loaded globally)

The bug: `useSettingsStore` starts with `settings: {}`. `loadSettings()` is only called inside `SettingsPage`. When the user is on the Habit Scorecard, `backfillEnabled` always reads as `false` until they visit Settings first and toggle it.

Fix: call `loadSettings()` inside `GlobalShortcuts` (always mounted in layout) so settings are ready for all pages.

**Files:**
- Modify: `src/components/layout/GlobalShortcuts.tsx`

- [ ] **Step 1: Add `loadSettings` call in `GlobalShortcuts.tsx`**

Find the import of `useSettingsStore`:
```typescript
import { useSettingsStore } from '@/lib/store/settingsStore'
```

Below the existing `const settings = useSettingsStore((s) => s.settings)` line, add:
```typescript
  const loadSettings = useSettingsStore((s) => s.loadSettings)
```

Add a new `useEffect` immediately after the existing router/settings sync effects:
```typescript
  useEffect(() => {
    loadSettings()
  }, [loadSettings])
```

---

### Task 7: Quick UI fixes — purple bullet, past-month buttons

**Files:**
- Modify: `src/components/habit-grid/HabitRow.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Remove the "never miss twice" purple dot from `HabitRow.tsx`**

Find the `showNudge` variable declaration (around line 80):
```typescript
  const showNudge = useMemo(
    () => isCurrentMonth && missedYesterday(habit.schedule, completedDates),
    [isCurrentMonth, habit.schedule, completedDates]
  )
```
Delete those 4 lines.

Find the `{showNudge && (...)}` JSX block (the dot div, around line 177):
```tsx
        {/* Never-miss-twice dot */}
        {showNudge && (
          <div
            title="Don't miss twice — get this one today."
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor: 'var(--accent)',
              flexShrink: 0,
            }}
          />
        )}
```
Delete those 11 lines.

Also remove the unused `missedYesterday` import from `@shared/habitLogic` at the top of the file.

- [ ] **Step 2: Fix past-month buttons in `src/app/page.tsx`**

The current `page.tsx` top bar has:
- Left: prev arrow
- Center: month heading + Today pill (when not current month)
- Right: Add Habit button
- Far right: next arrow

Change so that:
- When on a **past month**: hide Add Habit; show a "↩ Today" button in the Add Habit slot (right zone)
- When on **current month**: show Add Habit as normal; Today pill hidden (already)

Find the right zone div (contains Add Habit button):
```tsx
        {/* Right flex spacer — balances left spacer; Add Habit sits in right zone */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <button
            onClick={() => setModalState({ type: 'add' })}
            ...
          >
            + Add Habit
          </button>
        </div>
```

Replace the entire right zone `<div>` block with:
```tsx
        {/* Right: Add Habit (current month) OR Today (past month) */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          {currentMonth === thisMonth ? (
            <button
              onClick={() => setModalState({ type: 'add' })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 8,
                border: '1px solid var(--accent)',
                backgroundColor: 'transparent',
                color: 'var(--accent)',
                fontSize: 14,
                fontWeight: 500,
                transition: 'background-color 150ms',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--accent-soft)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
              }}
              aria-label="Add habit"
            >
              + Add Habit
            </button>
          ) : (
            <button
              onClick={handleGoToToday}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: '1px solid var(--accent)',
                backgroundColor: 'transparent',
                color: 'var(--accent)',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background-color 150ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--accent-soft)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              ↩ Today
            </button>
          )}
        </div>
```

Also remove the inline Today pill from the center group (it's now in the right zone). Find and delete:
```tsx
          {/* Today pill — only when viewing a non-current month */}
          {currentMonth !== thisMonth && (
            <button
              onClick={handleGoToToday}
              aria-label="Go to current month"
              style={{
                padding: '3px 10px',
                borderRadius: 20,
                border: '1px solid var(--accent)',
                backgroundColor: 'transparent',
                color: 'var(--accent)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background-color 150ms',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--accent-soft)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              ↩ Today
            </button>
          )}
```

---

### Task 8: Boot animation

A full-screen overlay that appears on first mount, shows the logo + an animated progress bar, then fades out after ~2.2 seconds.

**Files:**
- Create: `src/components/ui/BootAnimation.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create `src/components/ui/BootAnimation.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export function BootAnimation() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    // Dismiss after 2.2s (2s bar fill + 0.2s fade buffer)
    const t = setTimeout(() => setVisible(false), 2200)
    return () => clearTimeout(t)
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="boot"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: '#150B1F',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 32,
          }}
        >
          {/* Logo */}
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: 48,
                fontWeight: 700,
                color: '#FFFFFF',
                letterSpacing: '0.12em',
                lineHeight: 1,
              }}
            >
              HT
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 14,
                fontWeight: 500,
                color: '#B8A8C8',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
              }}
            >
              Habit Tracker
            </div>
            {/* Pink accent underline */}
            <div
              style={{
                marginTop: 10,
                height: 2,
                width: 40,
                borderRadius: 2,
                backgroundColor: '#E879B9',
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            />
          </div>

          {/* Loading bar */}
          <div
            style={{
              width: 200,
              height: 3,
              borderRadius: 2,
              backgroundColor: '#2A1838',
              overflow: 'hidden',
            }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 1.8, ease: [0.4, 0, 0.2, 1] }}
              style={{
                height: '100%',
                borderRadius: 2,
                backgroundColor: '#E879B9',
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Mount `BootAnimation` in `src/app/layout.tsx`**

Add the import at the top:
```tsx
import { BootAnimation } from '@/components/ui/BootAnimation'
```

Inside the `<body>`, before `<Toast />`, add:
```tsx
        <BootAnimation />
```

The full body should look like:
```tsx
      <body>
        <div className="flex flex-col h-screen overflow-hidden">
          <TitleBar />
          <div className="flex flex-1 overflow-hidden">
            <Sidebar />
            <main
              className="flex-1 min-w-0"
              style={{
                background: 'linear-gradient(180deg, var(--sidebar-from) 0%, var(--sidebar-to) 100%)',
                paddingRight: 4,
                paddingBottom: 4,
                overflow: 'hidden',
              }}
            >
              <div style={{ height: '100%', borderTopLeftRadius: 10, overflow: 'hidden' }}>
                {children}
              </div>
            </main>
          </div>
        </div>
        <BootAnimation />
        <Toast />
        <GlobalShortcuts />
      </body>
```

---

### Task 9: Custom project dropdown in AddTaskModal

HTML `<option>` elements cannot render colored dots. Replace the `<select>` with a custom div-based dropdown.

**Files:**
- Modify: `src/components/tasks/AddTaskModal.tsx`

- [ ] **Step 1: Replace the project `<select>` with a custom dropdown**

Replace the entire file content with:

```tsx
'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import type { Project, Task, CreateTaskInput } from '@shared/types'

interface AddTaskModalProps {
  projects: Project[]
  initialTask?: Task
  onSave: (input: CreateTaskInput) => Promise<void>
  onClose: () => void
}

export function AddTaskModal({ projects, initialTask, onSave, onClose }: AddTaskModalProps) {
  const [title, setTitle] = useState(initialTask?.title ?? '')
  const [description, setDescription] = useState(initialTask?.description ?? '')
  const [projectId, setProjectId] = useState(initialTask?.projectId ?? '')
  const [titleError, setTitleError] = useState('')
  const [saving, setSaving] = useState(false)
  const [titleFocused, setTitleFocused] = useState(false)
  const [descriptionFocused, setDescriptionFocused] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const titleInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = setTimeout(() => titleInputRef.current?.focus(), 50)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.isComposing) {
        if (dropdownOpen) { setDropdownOpen(false); return }
        onClose()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, dropdownOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!dropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownOpen])

  const handleSave = useCallback(async () => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setTitleError('Task title is required')
      titleInputRef.current?.focus()
      return
    }
    setTitleError('')
    setSaving(true)
    try {
      const input: CreateTaskInput = { title: trimmedTitle }
      if (description.trim()) input.description = description.trim()
      if (projectId) input.projectId = projectId
      await onSave(input)
      onClose()
    } finally {
      setSaving(false)
    }
  }, [title, description, projectId, onSave, onClose])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose]
  )

  const selectedProject = projects.find((p) => p.id === projectId) ?? null

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: 'var(--bg-input)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 14,
    color: 'var(--text-primary)',
    outline: 'none',
    transition: 'border-color 150ms',
    fontFamily: 'inherit',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: 6,
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-task-modal-title"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 12,
          border: '1px solid var(--border-subtle)',
          padding: 28,
          width: 480,
          maxWidth: '90vw',
          boxSizing: 'border-box',
        }}
      >
        <h2
          id="add-task-modal-title"
          style={{ margin: 0, marginBottom: 20, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}
        >
          {initialTask ? 'Edit Task' : 'Add Task'}
        </h2>

        {/* Title */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Title</label>
          <input
            ref={titleInputRef}
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); if (titleError) setTitleError('') }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
            placeholder="What needs to be done?"
            style={{ ...inputStyle, border: `1px solid ${titleError ? '#F87171' : titleFocused ? 'var(--border-strong)' : 'var(--border-subtle)'}` }}
            onFocus={() => setTitleFocused(true)}
            onBlur={() => setTitleFocused(false)}
          />
          {titleError && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#f87171' }}>{titleError}</p>}
        </div>

        {/* Description */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>
            Description{' '}
            <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--text-tertiary)' }}>(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add details..."
            rows={3}
            style={{
              ...inputStyle,
              resize: 'vertical',
              minHeight: 80,
              border: `1px solid ${descriptionFocused ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
            }}
            onFocus={() => setDescriptionFocused(true)}
            onBlur={() => setDescriptionFocused(false)}
          />
        </div>

        {/* Project — custom dropdown with colored dots */}
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>
            Project{' '}
            <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--text-tertiary)' }}>(optional)</span>
          </label>
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            {/* Trigger */}
            <button
              type="button"
              onClick={() => setDropdownOpen((o) => !o)}
              style={{
                ...inputStyle,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                border: `1px solid ${dropdownOpen ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
                textAlign: 'left',
              }}
            >
              {selectedProject ? (
                <>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: selectedProject.color,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1 }}>{selectedProject.name}</span>
                </>
              ) : (
                <span style={{ flex: 1, color: 'var(--text-tertiary)' }}>None</span>
              )}
              <ChevronDown size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            </button>

            {/* Dropdown list */}
            {dropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  right: 0,
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 8,
                  zIndex: 10,
                  overflow: 'hidden',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}
              >
                {/* None option */}
                <button
                  type="button"
                  onClick={() => { setProjectId(''); setDropdownOpen(false) }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 14px',
                    background: projectId === '' ? 'var(--bg-surface-2)' : 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    fontSize: 14,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-surface-2)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = projectId === '' ? 'var(--bg-surface-2)' : 'transparent' }}
                >
                  None
                </button>
                {projects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setProjectId(p.id); setDropdownOpen(false) }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 14px',
                      background: projectId === p.id ? 'var(--bg-surface-2)' : 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontSize: 14,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-surface-2)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = projectId === p.id ? 'var(--bg-surface-2)' : 'transparent' }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor: p.color,
                        flexShrink: 0,
                      }}
                    />
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'border-color 150ms, color 150ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: 'var(--accent)',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 500,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
              transition: 'opacity 150ms',
            }}
          >
            {saving ? 'Saving...' : initialTask ? 'Save Changes' : 'Save'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
```

---

### Task 10: Tasks page — uncomplete + sort + group-by-date

Three enhancements to `src/app/tasks/page.tsx` and `TaskCard.tsx`.

**Files:**
- Modify: `src/app/tasks/page.tsx`
- Modify: `src/components/tasks/TaskCard.tsx`

- [ ] **Step 1: Update `TaskCard.tsx` — allow uncomplete for tasks completed today**

The card currently disables clicking when `isCompleted`. Allow clicking the completed checkbox to uncomplete if the task was completed today (not yesterday or earlier — those stay final).

Replace the full `TaskCard` component:

```tsx
'use client'
import React, { useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Trash2, Pencil } from 'lucide-react'
import { format } from 'date-fns'
import type { Task, Project } from '@shared/types'
import { taskConfetti } from '@/lib/confetti'

interface TaskCardProps {
  task: Task
  project?: Project
  onComplete: (id: string) => void
  onUncomplete?: (id: string) => void
  onDelete: (id: string) => void
  onEdit?: (task: Task) => void
}

const TaskCard = React.memo(function TaskCard({ task, project, onComplete, onUncomplete, onDelete, onEdit }: TaskCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const wasCompletedOnMount = useRef(task.completedAt !== null)
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const isCompleted = task.completedAt !== null
  const completedToday = isCompleted && format(new Date(task.completedAt as number), 'yyyy-MM-dd') === todayStr
  const canUncomplete = isCompleted && completedToday && !!onUncomplete
  const shouldAnimate = isCompleted && !wasCompletedOnMount.current

  const handleCheckboxClick = useCallback(() => {
    if (!isCompleted) {
      taskConfetti()
      onComplete(task.id)
    } else if (canUncomplete) {
      onUncomplete!(task.id)
    }
  }, [isCompleted, canUncomplete, onComplete, onUncomplete, task.id])

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(task.id)
  }, [onDelete, task.id])

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit?.(task)
  }, [onEdit, task])

  const checkboxCursor = !isCompleted || canUncomplete ? 'pointer' : 'default'

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: `1px solid ${isHovered ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
        borderRadius: 10,
        padding: '12px 16px',
        marginBottom: 8,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        transition: 'border-color 150ms',
      }}
    >
      {/* Checkbox */}
      <div
        role="checkbox"
        aria-checked={isCompleted}
        tabIndex={0}
        aria-label={isCompleted ? (canUncomplete ? `Unmark "${task.title}"` : task.title) : `Mark "${task.title}" as complete`}
        onClick={handleCheckboxClick}
        onKeyDown={(e) => {
          if ((e.key === ' ' || e.key === 'Enter') && (!isCompleted || canUncomplete)) {
            e.preventDefault()
            handleCheckboxClick()
          }
        }}
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          border: isCompleted ? 'none' : '1px solid var(--border-strong)',
          backgroundColor: isCompleted ? 'var(--accent)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          cursor: checkboxCursor,
          transition: 'background-color 150ms, border-color 150ms, opacity 150ms',
          marginTop: 1,
          opacity: isCompleted && !canUncomplete ? 0.6 : 1,
        }}
        title={canUncomplete ? 'Click to undo (completed today)' : undefined}
      >
        {isCompleted && (
          <span style={{ color: '#ffffff', fontSize: 14, fontWeight: 700, lineHeight: 1 }}>✓</span>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <span style={{ color: isCompleted ? 'var(--text-tertiary)' : 'var(--text-primary)', fontSize: 14, fontWeight: 500 }}>
              {task.title}
            </span>
            {isCompleted && (
              <motion.div
                initial={shouldAnimate ? { scaleX: 0 } : { scaleX: 1 }}
                animate={{ scaleX: 1 }}
                transition={shouldAnimate ? { duration: 0.2, ease: 'linear' } : { duration: 0 }}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: 0,
                  right: 0,
                  height: 1.5,
                  backgroundColor: 'var(--text-secondary)',
                  transformOrigin: 'left center',
                  transform: 'translateY(-50%)',
                }}
              />
            )}
          </div>

          {project && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '2px 8px',
                borderRadius: 12,
                backgroundColor: 'var(--bg-surface-2)',
                flexShrink: 0,
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: project.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{project.name}</span>
            </div>
          )}
        </div>

        {task.description && (
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 12,
              color: 'var(--text-tertiary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              lineHeight: 1.4,
            }}
          >
            {task.description}
          </p>
        )}
      </div>

      {onEdit && !isCompleted && (
        <button
          onClick={handleEdit}
          title="Edit task"
          style={{
            background: 'none', border: 'none', padding: 4, cursor: 'pointer',
            color: 'var(--text-tertiary)', opacity: isHovered ? 1 : 0,
            transition: 'opacity 150ms, color 150ms', display: 'flex',
            alignItems: 'center', justifyContent: 'center', borderRadius: 4,
            alignSelf: 'center', flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
        >
          <Pencil size={14} />
        </button>
      )}

      <button
        onClick={handleDelete}
        title="Delete task"
        style={{
          background: 'none', border: 'none', padding: 4, cursor: 'pointer',
          color: 'var(--text-tertiary)', opacity: isHovered ? 1 : 0,
          transition: 'opacity 150ms, color 150ms', display: 'flex',
          alignItems: 'center', justifyContent: 'center', borderRadius: 4,
          alignSelf: 'center', flexShrink: 0,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
})

export default TaskCard
```

- [ ] **Step 2: Update `src/app/tasks/page.tsx` — add sort, group-by-date, uncomplete**

Replace the entire `TasksPage` component and sub-components:

```tsx
'use client'
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { format, isYesterday } from 'date-fns'
import type { Quote, CreateTaskInput, Task } from '@shared/types'
import { useTaskStore } from '@/lib/store/taskStore'
import { useProjectStore } from '@/lib/store/projectStore'
import { listQuotes } from '@/lib/ipc'
import TaskCard from '@/components/tasks/TaskCard'
import { AddTaskModal } from '@/components/tasks/AddTaskModal'
import { AllTasksDoneDialog } from '@/components/tasks/AllTasksDoneDialog'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'

function buildGroupLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  if (isYesterday(date)) return 'Yesterday — ' + format(date, 'EEE MMM d')
  return format(date, 'EEE MMM d')
}

type DeletePending = { taskId: string; action: () => Promise<void> } | null

type SortOrder = 'asc' | 'desc'

export default function TasksPage() {
  const [activeTab, setActiveTab] = useState<'today' | 'completed'>('today')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [randomQuote, setRandomQuote] = useState<Quote | null>(null)
  const [showAllDoneDialog, setShowAllDoneDialog] = useState(false)
  const [deletePending, setDeletePending] = useState<DeletePending>(null)
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [groupByDate, setGroupByDate] = useState(false)
  const hasShownDialogRef = useRef(false)

  const { tasks, loadTasks, createTask, updateTask, completeTask, uncompleteTask, deleteTask, hardDeleteTask } = useTaskStore()
  const { projects, loadProjects } = useProjectStore()

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [])
  const dateHeading = useMemo(() => format(new Date(), 'EEEE, MMMM d, yyyy'), [])

  useEffect(() => {
    loadTasks()
    loadProjects()
    listQuotes()
      .then((q) => {
        const visible = q.filter((x) => !x.hidden)
        setQuotes(visible)
        if (visible.length > 0) setRandomQuote(visible[Math.floor(Math.random() * visible.length)])
      })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])

  const todayTasks = useMemo(() => {
    const filtered = tasks.filter((t) => {
      if (t.archivedAt !== null) return false
      if (t.completedAt === null) return true
      return format(new Date(t.completedAt), 'yyyy-MM-dd') === todayStr
    })
    return filtered.sort((a, b) => {
      const aComplete = a.completedAt !== null
      const bComplete = b.completedAt !== null
      if (aComplete !== bComplete) return aComplete ? 1 : -1
      // Within the same completion state, apply user sort order
      const diff = a.createdAt - b.createdAt
      return sortOrder === 'asc' ? diff : -diff
    })
  }, [tasks, todayStr, sortOrder])

  useEffect(() => {
    if (todayTasks.length > 0 && todayTasks.every((t) => t.completedAt !== null) && !hasShownDialogRef.current) {
      hasShownDialogRef.current = true
      setShowAllDoneDialog(true)
    }
    if (todayTasks.some((t) => t.completedAt === null)) {
      hasShownDialogRef.current = false
    }
  }, [todayTasks])

  useEffect(() => {
    const handleOpenAdd = () => setShowAddModal(true)
    window.addEventListener('open-add-modal', handleOpenAdd)
    return () => window.removeEventListener('open-add-modal', handleOpenAdd)
  }, [])

  const completedGroups = useMemo(() => {
    const filtered = tasks.filter((t) => {
      if (t.completedAt === null) return false
      const completedDate = format(new Date(t.completedAt as number), 'yyyy-MM-dd')
      if (completedDate === todayStr && t.archivedAt === null) return false
      return true
    })
    const groups = new Map<string, Task[]>()
    for (const t of filtered) {
      const key = format(new Date(t.completedAt as number), 'yyyy-MM-dd')
      const existing = groups.get(key)
      if (existing) existing.push(t)
      else groups.set(key, [t])
    }
    for (const [, groupTasks] of groups) {
      groupTasks.sort((a, b) => (b.completedAt as number) - (a.completedAt as number))
    }
    const sortedKeys = Array.from(groups.keys()).sort((a, b) => b.localeCompare(a))
    return sortedKeys.map((key) => ({ key, label: buildGroupLabel(key), tasks: groups.get(key) as Task[] }))
  }, [tasks, todayStr])

  const handleSaveTask = useCallback(async (input: CreateTaskInput) => {
    if (editingTask) { await updateTask(editingTask.id, input); setEditingTask(null) }
    else await createTask(input)
  }, [createTask, updateTask, editingTask])

  const handleEditTask = useCallback((task: Task) => { setEditingTask(task); setShowAddModal(true) }, [])
  const handleCompleteTask = useCallback(async (id: string) => { await completeTask(id) }, [completeTask])
  const handleUncompleteTask = useCallback(async (id: string) => { await uncompleteTask(id) }, [uncompleteTask])
  const handleDeleteFromToday = useCallback((id: string) => { setDeletePending({ taskId: id, action: () => deleteTask(id) }) }, [deleteTask])
  const handleDeleteFromCompleted = useCallback((id: string) => { setDeletePending({ taskId: id, action: () => hardDeleteTask(id) }) }, [hardDeleteTask])
  const handleConfirmDelete = useCallback(async () => { if (!deletePending) return; await deletePending.action(); setDeletePending(null) }, [deletePending])
  const handleCancelDelete = useCallback(() => setDeletePending(null), [])

  const isTodayEmpty = todayTasks.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-base)', maxWidth: 1100, width: '100%', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ padding: '20px 32px 0', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{dateHeading}</h2>
          <button
            onClick={() => setShowAddModal(true)}
            style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--accent)', backgroundColor: 'transparent', color: 'var(--accent)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'background-color 150ms' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-soft)' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            + Add Task
          </button>
        </div>

        {/* Tabs + sort/group controls */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['today', 'completed'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '6px 16px',
                  borderRadius: '8px 8px 0 0',
                  border: 'none',
                  backgroundColor: activeTab === tab ? 'var(--bg-surface-2)' : 'transparent',
                  color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: activeTab === tab ? 500 : 400,
                  fontSize: 14,
                  cursor: 'pointer',
                  transition: 'background-color 150ms, color 150ms',
                }}
              >
                {tab === 'today' ? 'Today' : 'Completed'}
              </button>
            ))}
          </div>

          {/* Sort + Group controls (Today tab only) */}
          {activeTab === 'today' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 6 }}>
              <button
                onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
                title={sortOrder === 'asc' ? 'Oldest first — click for newest first' : 'Newest first — click for oldest first'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)',
                  backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
                  transition: 'border-color 150ms, color 150ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              >
                {sortOrder === 'asc' ? '↑ Oldest' : '↓ Newest'}
              </button>
              <button
                onClick={() => setGroupByDate((g) => !g)}
                title={groupByDate ? 'Ungroup' : 'Group by date added'}
                style={{
                  padding: '4px 10px', borderRadius: 6,
                  border: `1px solid ${groupByDate ? 'var(--accent)' : 'var(--border-subtle)'}`,
                  backgroundColor: groupByDate ? 'var(--accent-soft)' : 'transparent',
                  color: groupByDate ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: 12, cursor: 'pointer', transition: 'all 150ms',
                }}
              >
                Group
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 32px' }}>
        {activeTab === 'today' ? (
          <TodayView
            tasks={todayTasks}
            isEmpty={isTodayEmpty}
            randomQuote={randomQuote}
            projectMap={projectMap}
            groupByDate={groupByDate}
            onComplete={handleCompleteTask}
            onUncomplete={handleUncompleteTask}
            onDelete={handleDeleteFromToday}
            onEdit={handleEditTask}
            onAddTask={() => setShowAddModal(true)}
          />
        ) : (
          <CompletedView
            groups={completedGroups}
            projectMap={projectMap}
            onComplete={handleCompleteTask}
            onDelete={handleDeleteFromCompleted}
          />
        )}
      </div>

      {showAddModal && (
        <AddTaskModal
          projects={projects}
          initialTask={editingTask ?? undefined}
          onSave={handleSaveTask}
          onClose={() => { setShowAddModal(false); setEditingTask(null) }}
        />
      )}

      <AnimatePresence>
        {showAllDoneDialog && (
          <AllTasksDoneDialog quote={randomQuote} onClose={() => setShowAllDoneDialog(false)} />
        )}
      </AnimatePresence>

      {deletePending && (
        <ConfirmDeleteModal
          title="Delete Task?"
          message="This action cannot be undone."
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface TodayViewProps {
  tasks: Task[]
  isEmpty: boolean
  randomQuote: Quote | null
  projectMap: Map<string, import('@shared/types').Project>
  groupByDate: boolean
  onComplete: (id: string) => void
  onUncomplete: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (task: Task) => void
  onAddTask: () => void
}

function TodayView({ tasks, isEmpty, randomQuote, projectMap, groupByDate, onComplete, onUncomplete, onDelete, onEdit, onAddTask }: TodayViewProps) {
  if (isEmpty) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 300 }}>
        <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 16, padding: 40, textAlign: 'center', maxWidth: 480, width: '100%' }}>
          <p style={{ margin: 0, marginBottom: randomQuote ? 8 : 32, fontSize: 18, color: 'var(--text-primary)', lineHeight: 1.5, fontStyle: randomQuote ? 'italic' : 'normal' }}>
            {randomQuote ? `"${randomQuote.text}"` : 'Get after it.'}
          </p>
          {randomQuote && <p style={{ margin: 0, marginBottom: 32, fontSize: 14, color: 'var(--text-tertiary)' }}>— {randomQuote.author}</p>}
          <button
            onClick={onAddTask}
            style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--accent)', backgroundColor: 'transparent', color: 'var(--accent)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'background-color 150ms' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-soft)' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            Add your first task →
          </button>
        </div>
      </div>
    )
  }

  if (!groupByDate) {
    return (
      <div>
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            project={task.projectId ? projectMap.get(task.projectId) : undefined}
            onComplete={onComplete}
            onUncomplete={onUncomplete}
            onDelete={onDelete}
            onEdit={onEdit}
          />
        ))}
      </div>
    )
  }

  // Group by creation date
  const groups = new Map<string, Task[]>()
  for (const t of tasks) {
    const key = format(new Date(t.createdAt), 'yyyy-MM-dd')
    const existing = groups.get(key)
    if (existing) existing.push(t)
    else groups.set(key, [t])
  }
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b))

  return (
    <div>
      {sortedKeys.map((key) => (
        <div key={key} style={{ marginBottom: 20 }}>
          <h3 style={{ margin: 0, marginBottom: 8, fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            {buildGroupLabel(key)}
          </h3>
          {(groups.get(key) as Task[]).map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              project={task.projectId ? projectMap.get(task.projectId) : undefined}
              onComplete={onComplete}
              onUncomplete={onUncomplete}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

interface CompletedGroup { key: string; label: string; tasks: Task[] }
interface CompletedViewProps {
  groups: CompletedGroup[]
  projectMap: Map<string, import('@shared/types').Project>
  onComplete: (id: string) => void
  onDelete: (id: string) => void
}

function CompletedView({ groups, projectMap, onComplete, onDelete }: CompletedViewProps) {
  if (groups.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200, color: 'var(--text-tertiary)', fontSize: 14 }}>
        No completed tasks yet.
      </div>
    )
  }
  return (
    <div>
      {groups.map((group) => (
        <div key={group.key} style={{ marginBottom: 24 }}>
          <h3 style={{ margin: 0, marginBottom: 10, fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            {group.label}
          </h3>
          {group.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              project={task.projectId ? projectMap.get(task.projectId) : undefined}
              onComplete={onComplete}
              onDelete={onDelete}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
```

---

### Task 11: Optional habits — UI (HabitModal + HabitRow + PerfectDayDialog)

**Files:**
- Modify: `src/components/habit-grid/HabitModal.tsx`
- Modify: `src/components/habit-grid/HabitRow.tsx`
- Modify: `src/components/habit-grid/PerfectDayDialog.tsx`
- Modify: `src/lib/store/habitStore.ts`

- [ ] **Step 1: Add `isOptional` to `habitStore` create/update calls**

Read `src/lib/store/habitStore.ts`. Find the `createHabit` function. Its signature likely takes `(name, schedule)`. Add `isOptional` parameter:

Find:
```typescript
  createHabit: async (name: string, schedule: DayAbbreviation[]) => {
    const habit = await ipc.createHabit({ name, schedule })
```
Replace with:
```typescript
  createHabit: async (name: string, schedule: DayAbbreviation[], isOptional = false) => {
    const habit = await ipc.createHabit({ name, schedule, isOptional })
```

Find the `updateHabit` function similarly and add `isOptional`:
```typescript
  updateHabit: async (id: string, name: string, schedule: DayAbbreviation[], isOptional = false) => {
    const habit = await ipc.updateHabit(id, { name, schedule, isOptional })
```

Also update the `HabitStore` interface to match:
```typescript
  createHabit: (name: string, schedule: DayAbbreviation[], isOptional?: boolean) => Promise<void>
  updateHabit: (id: string, name: string, schedule: DayAbbreviation[], isOptional?: boolean) => Promise<void>
```

- [ ] **Step 2: Update `HabitModal.tsx` — add Optional toggle**

In `HabitModalProps`, add `habit?: Habit` already exists. Add state and UI for `isOptional`.

At the top of `HabitModal`, add state:
```typescript
  const [isOptional, setIsOptional] = useState(
    mode === 'edit' && habit ? (habit.isOptional ?? false) : false
  )
```

Update `handleSave` to pass `isOptional`:
```typescript
      await onSave(trimmed, schedule, isOptional)
```

Update the `onSave` prop type in `HabitModalProps`:
```typescript
  onSave: (name: string, schedule: DayAbbreviation[], isOptional: boolean) => Promise<void>
```

Add the Optional toggle UI inside the modal, between the Schedule pills block and the Delete section (or action buttons if no delete). Insert after the schedule pills `</div>`:

```tsx
          {/* Optional toggle */}
          <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>Optional</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                Won't count against Perfect Day if missed
              </div>
            </div>
            <div
              role="switch"
              aria-checked={isOptional}
              tabIndex={0}
              onClick={() => setIsOptional((v) => !v)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setIsOptional((v) => !v) }
              }}
              style={{
                width: 44, height: 24, borderRadius: 12, flexShrink: 0,
                backgroundColor: isOptional ? 'var(--accent)' : 'var(--bg-surface-2)',
                border: '1px solid var(--border-subtle)', cursor: 'pointer',
                transition: 'background-color 200ms', position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute', top: 3, left: isOptional ? 22 : 3,
                  width: 16, height: 16, borderRadius: '50%',
                  backgroundColor: 'white', transition: 'left 200ms',
                }}
              />
            </div>
          </div>
```

- [ ] **Step 3: Update `HabitRow.tsx` — show "(opt)" label for optional habits**

In `HabitRow.tsx`, update the habit name button to show a dim "(opt)" suffix when `habit.isOptional` is true. Find the `<button>` that renders `{habit.name}` and update to:

```tsx
        <button
          onClick={() => onEditHabit(habit)}
          title={habit.name}
          style={{
            background: 'none', border: 'none', padding: 0, margin: 0, fontSize: 14,
            color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden',
            textOverflow: 'ellipsis', cursor: 'pointer', textAlign: 'left', width: '100%', minWidth: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline' }}
          onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none' }}
        >
          {habit.name}
          {habit.isOptional && (
            <span style={{ marginLeft: 4, fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 400 }}>
              (opt)
            </span>
          )}
        </button>
```

- [ ] **Step 4: Update `HabitPage` (`src/app/page.tsx`) — pass `isOptional` through modal handlers**

The `handleModalSave` callback calls `createHabit` / `updateHabit`. Update the signature to accept the third argument:

Find:
```typescript
  const handleModalSave = useCallback(
    async (name: string, schedule: DayAbbreviation[]) => {
      if (modalState?.type === 'add') {
        await createHabit(name, schedule)
      } else if (modalState?.type === 'edit') {
        await updateHabit(modalState.habit.id, name, schedule)
      }
    },
    [modalState, createHabit, updateHabit]
  )
```

Replace with:
```typescript
  const handleModalSave = useCallback(
    async (name: string, schedule: DayAbbreviation[], isOptional: boolean) => {
      if (modalState?.type === 'add') {
        await createHabit(name, schedule, isOptional)
      } else if (modalState?.type === 'edit') {
        await updateHabit(modalState.habit.id, name, schedule, isOptional)
      }
    },
    [modalState, createHabit, updateHabit]
  )
```

- [ ] **Step 5: Update `PerfectDayDialog.tsx` — exclude optional habits from perfect-day check**

Read `src/components/habit-grid/PerfectDayDialog.tsx` first to understand its current structure. The dialog is triggered from `HabitGrid` or `page.tsx` via `onPerfectDay`. Update however it checks "all habits complete" to exclude optional ones. If the trigger is in `HabitGrid.tsx`, find the relevant check and add `.filter(h => !h.isOptional)` before checking all are done.

Read `src/components/habit-grid/HabitGrid.tsx` and find the `onPerfectDay` trigger logic. The perfect-day check will look like "all today's applicable habits are completed". Update that filter to also exclude optional habits:

In `HabitGrid.tsx`, find the perfect-day trigger (will be something like):
```typescript
const allDoneToday = visibleHabits.every((h) => { ... })
```

Add `&& !h.isOptional` to the filter so optional habits are ignored in the perfect-day check.

---

### Task 12: Wish List page + sidebar

**Files:**
- Create: `src/app/wishlist/page.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/GlobalShortcuts.tsx`

- [ ] **Step 1: Create `src/app/wishlist/page.tsx`**

```tsx
'use client'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { motion } from 'framer-motion'
import { Trash2, Pencil } from 'lucide-react'
import type { WishlistItem, CreateWishlistInput } from '@shared/types'
import { useWishlistStore } from '@/lib/store/wishlistStore'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { goalConfetti } from '@/lib/confetti'

// ─── Add/Edit Modal ───────────────────────────────────────────────────────────

interface WishlistModalProps {
  initialItem?: WishlistItem
  onSave: (input: CreateWishlistInput) => Promise<void>
  onClose: () => void
}

function WishlistModal({ initialItem, onSave, onClose }: WishlistModalProps) {
  const [title, setTitle] = useState(initialItem?.title ?? '')
  const [description, setDescription] = useState(initialItem?.description ?? '')
  const [titleError, setTitleError] = useState('')
  const [saving, setSaving] = useState(false)
  const titleRef = React.useRef<HTMLInputElement>(null)

  useEffect(() => { const t = setTimeout(() => titleRef.current?.focus(), 50); return () => clearTimeout(t) }, [])
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const handleSave = useCallback(async () => {
    const trimmed = title.trim()
    if (!trimmed) { setTitleError('Title is required'); titleRef.current?.focus(); return }
    setSaving(true)
    try {
      await onSave({ title: trimmed, description: description.trim() || undefined })
      onClose()
    } finally { setSaving(false) }
  }, [title, description, onSave, onClose])

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', backgroundColor: 'var(--bg-input)',
    border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '10px 14px',
    fontSize: 14, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 500,
    color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em',
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border-subtle)', padding: 28, width: 480, maxWidth: '90vw', boxSizing: 'border-box' }}
      >
        <h2 style={{ margin: 0, marginBottom: 20, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
          {initialItem ? 'Edit Wish' : 'Add to Wish List'}
        </h2>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>What do you want?</label>
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); if (titleError) setTitleError('') }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
            placeholder="e.g. Tokyo Ghoul Vol 6 & 7"
            style={{ ...inputStyle, border: `1px solid ${titleError ? '#F87171' : 'var(--border-subtle)'}` }}
          />
          {titleError && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#f87171' }}>{titleError}</p>}
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Note <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--text-tertiary)' }}>(optional)</span></label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Where to get it, why you want it..."
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', backgroundColor: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Saving...' : initialItem ? 'Save' : 'Add'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Wish Card ────────────────────────────────────────────────────────────────

interface WishCardProps {
  item: WishlistItem
  onComplete: (id: string) => void
  onUncomplete: (id: string) => void
  onEdit: (item: WishlistItem) => void
  onDelete: (id: string) => void
}

function WishCard({ item, onComplete, onUncomplete, onEdit, onDelete }: WishCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const wasCompletedOnMount = React.useRef(item.completedAt !== null)
  const isCompleted = item.completedAt !== null
  const shouldAnimate = isCompleted && !wasCompletedOnMount.current
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const completedToday = isCompleted && format(new Date(item.completedAt as number), 'yyyy-MM-dd') === todayStr

  const handleCheck = useCallback(() => {
    if (!isCompleted) { goalConfetti(); onComplete(item.id) }
    else if (completedToday) { onUncomplete(item.id) }
  }, [isCompleted, completedToday, onComplete, onUncomplete, item.id])

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: `1px solid ${isHovered ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
        borderRadius: 10, padding: '12px 16px', marginBottom: 8,
        display: 'flex', gap: 12, alignItems: 'flex-start', transition: 'border-color 150ms',
      }}
    >
      <div
        role="checkbox"
        aria-checked={isCompleted}
        tabIndex={0}
        onClick={handleCheck}
        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleCheck() } }}
        style={{
          width: 24, height: 24, borderRadius: '50%', flexShrink: 0, marginTop: 1,
          border: isCompleted ? 'none' : '1px solid var(--border-strong)',
          backgroundColor: isCompleted ? 'var(--accent)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: !isCompleted || completedToday ? 'pointer' : 'default',
          opacity: isCompleted && !completedToday ? 0.6 : 1,
          transition: 'background-color 150ms',
        }}
        title={completedToday ? 'Click to undo' : undefined}
      >
        {isCompleted && <span style={{ color: '#fff', fontSize: 14, fontWeight: 700, lineHeight: 1 }}>✓</span>}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <span style={{ color: isCompleted ? 'var(--text-tertiary)' : 'var(--text-primary)', fontSize: 14, fontWeight: 500 }}>
            {item.title}
          </span>
          {isCompleted && (
            <motion.div
              initial={shouldAnimate ? { scaleX: 0 } : { scaleX: 1 }}
              animate={{ scaleX: 1 }}
              transition={shouldAnimate ? { duration: 0.35, ease: 'linear' } : { duration: 0 }}
              style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1.5, backgroundColor: 'var(--text-secondary)', transformOrigin: 'left center', transform: 'translateY(-50%)' }}
            />
          )}
        </div>
        {item.description && (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.4 }}>
            {item.description}
          </p>
        )}
      </div>

      {!isCompleted && (
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(item) }}
          title="Edit" style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--text-tertiary)', opacity: isHovered ? 1 : 0, transition: 'opacity 150ms, color 150ms', display: 'flex', alignItems: 'center', alignSelf: 'center', flexShrink: 0 }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
        >
          <Pencil size={14} />
        </button>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(item.id) }}
        title="Delete" style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--text-tertiary)', opacity: isHovered ? 1 : 0, transition: 'opacity 150ms, color 150ms', display: 'flex', alignItems: 'center', alignSelf: 'center', flexShrink: 0 }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type DeletePending = { id: string; action: () => Promise<void> } | null

export default function WishlistPage() {
  const { items, loadItems, createItem, updateItem, completeItem, uncompleteItem, deleteItem, hardDeleteItem } = useWishlistStore()
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null)
  const [activeTab, setActiveTab] = useState<'active' | 'got'>('active')
  const [deletePending, setDeletePending] = useState<DeletePending>(null)

  useEffect(() => { loadItems() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const h = () => setShowModal(true)
    window.addEventListener('open-add-modal', h)
    return () => window.removeEventListener('open-add-modal', h)
  }, [])

  const activeItems = useMemo(() => items.filter((i) => i.completedAt === null && i.archivedAt === null), [items])
  const gotItems = useMemo(() => items.filter((i) => i.completedAt !== null), [items])

  const handleSave = useCallback(async (input: CreateWishlistInput) => {
    if (editingItem) { await updateItem(editingItem.id, input); setEditingItem(null) }
    else await createItem(input)
  }, [createItem, updateItem, editingItem])

  const handleEdit = useCallback((item: WishlistItem) => { setEditingItem(item); setShowModal(true) }, [])

  const handleDelete = useCallback((id: string) => {
    const item = items.find((i) => i.id === id)!
    if (item.completedAt !== null) {
      setDeletePending({ id, action: () => hardDeleteItem(id) })
    } else {
      setDeletePending({ id, action: () => deleteItem(id) })
    }
  }, [items, deleteItem, hardDeleteItem])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-base)', maxWidth: 1100, width: '100%', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ padding: '20px 32px 0', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Wish List</h2>
          <button
            onClick={() => setShowModal(true)}
            style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--accent)', backgroundColor: 'transparent', color: 'var(--accent)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'background-color 150ms' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-soft)' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            + Add Wish
          </button>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['active', 'got'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '6px 16px', borderRadius: '8px 8px 0 0', border: 'none',
                backgroundColor: activeTab === tab ? 'var(--bg-surface-2)' : 'transparent',
                color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === tab ? 500 : 400, fontSize: 14, cursor: 'pointer',
              }}
            >
              {tab === 'active' ? 'Want' : 'Got It ✓'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 32px' }}>
        {activeTab === 'active' ? (
          activeItems.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200, color: 'var(--text-tertiary)', fontSize: 14 }}>
              Nothing on your list yet — add something that'll make you smile.
            </div>
          ) : (
            <div>
              {activeItems.map((item) => (
                <WishCard
                  key={item.id}
                  item={item}
                  onComplete={completeItem}
                  onUncomplete={uncompleteItem}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )
        ) : (
          gotItems.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200, color: 'var(--text-tertiary)', fontSize: 14 }}>
              Nothing checked off yet.
            </div>
          ) : (
            <div>
              {gotItems.map((item) => (
                <WishCard
                  key={item.id}
                  item={item}
                  onComplete={completeItem}
                  onUncomplete={uncompleteItem}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )
        )}
      </div>

      {showModal && (
        <WishlistModal
          initialItem={editingItem ?? undefined}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingItem(null) }}
        />
      )}

      {deletePending && (
        <ConfirmDeleteModal
          title="Remove wish?"
          message="This cannot be undone."
          onConfirm={async () => { await deletePending.action(); setDeletePending(null) }}
          onCancel={() => setDeletePending(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add Wish List to `Sidebar.tsx`**

Find:
```typescript
const NAV_ITEMS = [
  { href: '/',           icon: LayoutGrid,  label: 'Habit Scorecard' },
  { href: '/tasks',      icon: CheckSquare, label: 'Current Tasks' },
  { href: '/projects',   icon: FolderOpen,  label: 'Projects' },
  { href: '/goals',      icon: Target,      label: 'Long-Term Goals' },
]
```

Replace with (add Heart import from lucide-react at the top of the file too):
```typescript
const NAV_ITEMS = [
  { href: '/',           icon: LayoutGrid,  label: 'Habit Scorecard' },
  { href: '/tasks',      icon: CheckSquare, label: 'Current Tasks' },
  { href: '/wishlist',   icon: Heart,       label: 'Wish List' },
  { href: '/projects',   icon: FolderOpen,  label: 'Projects' },
  { href: '/goals',      icon: Target,      label: 'Long-Term Goals' },
]
```

Add `Heart` to the lucide-react import:
```typescript
import { LayoutGrid, CheckSquare, FolderOpen, Target, Settings, Heart } from 'lucide-react'
```

- [ ] **Step 3: Add Wish List shortcut to `GlobalShortcuts.tsx`**

In the `SETTING_KEYS` there's no wishlist key yet. Use a hardcoded Ctrl+3 for wishlist (shift projects to Ctrl+4, goals to Ctrl+5). Update the navigation block in `GlobalShortcuts.tsx`:

```typescript
      if (combo === get(SETTING_KEYS.SHORTCUT_NAV_TASKS, 'Ctrl+2')) {
        e.preventDefault(); routerRef.current.push('/tasks'); return
      }
      if (combo === 'Ctrl+3') {
        e.preventDefault(); routerRef.current.push('/wishlist'); return
      }
      if (combo === get(SETTING_KEYS.SHORTCUT_NAV_PROJECTS, 'Ctrl+3')) {
        e.preventDefault(); routerRef.current.push('/projects'); return
      }
      if (combo === get(SETTING_KEYS.SHORTCUT_NAV_GOALS, 'Ctrl+4')) {
        e.preventDefault(); routerRef.current.push('/goals'); return
      }
```

Note: This changes the hardcoded Ctrl+3 default for Projects to Ctrl+4 and Goals to Ctrl+5, as the new Wish List takes Ctrl+3. Update the `SHORTCUT_DEFS` in `settings/page.tsx` accordingly, and update the defaults in `GlobalShortcuts` to use Ctrl+4 for Projects and Ctrl+5 for Goals.

Specifically, in `GlobalShortcuts.tsx`, update:
```typescript
      if (combo === get(SETTING_KEYS.SHORTCUT_NAV_PROJECTS, 'Ctrl+4')) {
        e.preventDefault(); routerRef.current.push('/projects'); return
      }
      if (combo === get(SETTING_KEYS.SHORTCUT_NAV_GOALS, 'Ctrl+5')) {
        e.preventDefault(); routerRef.current.push('/goals'); return
      }
```

Also update `SHORTCUT_DEFS` in `src/app/settings/page.tsx`:
```typescript
  { key: SETTING_KEYS.SHORTCUT_NAV_PROJECTS, label: 'Go to Projects', defaultValue: 'Ctrl+4' },
  { key: SETTING_KEYS.SHORTCUT_NAV_GOALS,    label: 'Go to Goals',    defaultValue: 'Ctrl+5' },
```

And add a Wish List entry (hardcoded, since it has no SETTING_KEY yet):
```typescript
  { key: 'shortcut_nav_wishlist', label: 'Go to Wish List', defaultValue: 'Ctrl+3' },
```

Add `SHORTCUT_NAV_WISHLIST` to `shared/types.ts` SETTING_KEYS:
```typescript
  SHORTCUT_NAV_WISHLIST: 'shortcut_nav_wishlist',
```

And wire it in `GlobalShortcuts.tsx`:
```typescript
      if (combo === get(SETTING_KEYS.SHORTCUT_NAV_WISHLIST, 'Ctrl+3')) {
        e.preventDefault(); routerRef.current.push('/wishlist'); return
      }
```

Also add the wishlist navigate path in the `sectionToPath` map:
```typescript
    const sectionToPath: Record<string, string> = {
      habits: '/', tasks: '/tasks', wishlist: '/wishlist', projects: '/projects', goals: '/goals', settings: '/settings',
    }
```

---

### Task 13: TypeScript check + verify

- [ ] **Step 1: Run TypeScript compiler**

```
npx tsc --noEmit
```

Expected: 0 errors. Fix any reported type mismatches (most likely `isOptional` not threaded through, or missing IPC methods on `Window['electronAPI']`).

- [ ] **Step 2: Start dev mode and smoke-test each change**

```
npm run dev
```

Check:
- Boot animation appears for ~2 seconds then fades
- Habit grid: no purple bullet on any habit name
- Past month view: no Add Habit button; ↩ Today button appears in its place
- Backfill toggle in Settings works immediately on next app open without needing to cycle it
- Add Task modal: project dropdown shows colored dots
- Task Today view: sort ↑/↓ button swaps task order; Group button groups by creation date
- Checking a task today shows a ✓ circle; clicking it again unmarks it (only works for today's completions)
- Add Habit modal: Optional toggle saves; optional habits show "(opt)" label in grid
- Wish List appears in sidebar between Tasks and Projects; adding/completing wishes works; Got It tab shows completed wishes

---

## Self-Review

**Spec coverage:**
- ✅ Boot animation: Task 8
- ✅ Purple bullet fix: Task 7
- ✅ Wish List section: Tasks 3, 4, 5, 12
- ✅ Colored project dropdown: Task 9
- ✅ Backfill toggle bug: Task 6
- ✅ Uncomplete today tasks: Tasks 4, 5, 10
- ✅ Sort today tasks asc/desc: Task 10
- ✅ Group today tasks by date: Task 10
- ✅ Optional habits: Tasks 1, 2, 3, 11
- ✅ Past month: no Add Habit button: Task 7
- ✅ Past month: show Today button instead: Task 7

**Placeholder scan:** No TBDs. All code blocks are complete. `goalConfetti` is used in wishlist page — verify it exists in `src/lib/confetti.ts` (it was already used by goals page); if not, use `taskConfetti` instead.

**Type consistency:**
- `isOptional` added to `Habit` (Task 2) → threaded through queries (Task 3) → store (Task 11 Step 1) → modal (Task 11 Step 2) → row (Task 11 Step 3) → page handler (Task 11 Step 4)
- `WishlistItem` defined in types (Task 2) → queries (Task 3) → preload (Task 4) → ipc.ts (Task 4) → store (Task 5) → page (Task 12)
- `uncompleteTask` in queries (Task 3) → handler (Task 4) → preload (Task 4) → ipc.ts (Task 4) → store (Task 5) → TaskCard + page (Task 10)
- `onUncomplete` prop added to `TaskCard` — passed in TodayView but NOT CompletedView (intentional)
- `SHORTCUT_NAV_WISHLIST` added to SETTING_KEYS (Task 12 Step 3) and used in GlobalShortcuts (Task 12 Step 3)
