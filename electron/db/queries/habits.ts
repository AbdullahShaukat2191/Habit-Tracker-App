import { eq, isNull, and, gte, lte, asc } from 'drizzle-orm'
import { getDb } from '../client'
import { habits, habitCompletions } from '../schema'
import type { Habit, HabitCompletion, DayAbbreviation, CreateHabitInput, UpdateHabitInput, ToggleResult } from '../../../shared/types'
import { isApplicableDay, computeScore, computeStreak, missedYesterday } from '../../../shared/habitLogic'
import { randomUUID } from 'crypto'
import { getDaysInMonth } from 'date-fns'

// getDaysInMonth used in getHabitCompletions below
function parseSchedule(raw: string): DayAbbreviation[] {
  return JSON.parse(raw) as DayAbbreviation[]
}

function rowToHabit(row: typeof habits.$inferSelect): Habit {
  return {
    id: row.id,
    name: row.name,
    schedule: parseSchedule(row.schedule),
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    archivedAt: row.archivedAt ?? null,
    isOptional: row.isOptional ?? false,
  }
}

export function listHabits(): Habit[] {
  const db = getDb()
  // Returns ALL habits (active + archived) so past-month views can show historical data.
  // Frontend filters by archivedAt relative to the viewed month.
  return db
    .select()
    .from(habits)
    .orderBy(asc(habits.sortOrder))
    .all()
    .map(rowToHabit)
}

export function createHabit(input: CreateHabitInput): Habit {
  const db = getDb()
  const existing = db.select().from(habits).where(isNull(habits.archivedAt)).all()
  const maxOrder = existing.reduce((max, h) => Math.max(max, h.sortOrder), -1)

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
  // Soft delete — keeps historical completion data
  db.update(habits).set({ archivedAt: Date.now() }).where(eq(habits.id, id)).run()
}

export function reorderHabits(ids: string[]): void {
  const db = getDb()
  db.transaction((tx) => {
    ids.forEach((id, index) => {
      tx.update(habits).set({ sortOrder: index }).where(eq(habits.id, id)).run()
    })
  })
}

export function getHabitCompletions(month: string): HabitCompletion[] {
  // month = 'YYYY-MM'
  const db = getDb()
  const start = `${month}-01`
  const daysInMonth = getDaysInMonth(new Date(`${month}-01`))
  const end = `${month}-${String(daysInMonth).padStart(2, '0')}`

  return db
    .select()
    .from(habitCompletions)
    .where(and(gte(habitCompletions.date, start), lte(habitCompletions.date, end)))
    .all()
    .map((row) => ({
      habitId: row.habitId,
      date: row.date,
      completedAt: row.completedAt,
    }))
}

export function getAllHabitCompletions(): HabitCompletion[] {
  const db = getDb()
  return db
    .select()
    .from(habitCompletions)
    .all()
    .map((row) => ({
      habitId: row.habitId,
      date: row.date,
      completedAt: row.completedAt,
    }))
}

export function toggleHabitCompletion(habitId: string, date: string): ToggleResult {
  const db = getDb()
  const existing = db
    .select()
    .from(habitCompletions)
    .where(and(eq(habitCompletions.habitId, habitId), eq(habitCompletions.date, date)))
    .get()

  if (existing) {
    db.delete(habitCompletions)
      .where(and(eq(habitCompletions.habitId, habitId), eq(habitCompletions.date, date)))
      .run()
    return 'uncompleted'
  } else {
    db.insert(habitCompletions).values({ habitId, date, completedAt: Date.now() }).run()
    return 'completed'
  }
}

// Re-export shared logic for callers that import from this module
export { isApplicableDay, computeScore, computeStreak, missedYesterday } from '../../../shared/habitLogic'
