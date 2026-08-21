import { eq, isNull, asc } from 'drizzle-orm'
import { getDb } from '../client'
import { goals } from '../schema'
import type { Goal, CreateGoalInput, UpdateGoalInput } from '../../../shared/types'
import { randomUUID } from 'crypto'

function rowToGoal(row: typeof goals.$inferSelect): Goal {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    completedAt: row.completedAt ?? null,
    archivedAt: row.archivedAt ?? null,
  }
}

export function listGoals(): Goal[] {
  const db = getDb()
  return db
    .select()
    .from(goals)
    .where(isNull(goals.archivedAt))
    .orderBy(asc(goals.sortOrder), asc(goals.createdAt))
    .all()
    .map(rowToGoal)
}

export function createGoal(input: CreateGoalInput): Goal {
  const db = getDb()
  const existing = db.select().from(goals).where(isNull(goals.archivedAt)).all()
  const maxOrder = existing.reduce((max, g) => Math.max(max, g.sortOrder ?? 0), -1)
  const row = {
    id: randomUUID(),
    title: input.title,
    description: input.description ?? null,
    sortOrder: maxOrder + 1,
    createdAt: Date.now(),
    completedAt: null,
    archivedAt: null,
  }
  db.insert(goals).values(row).run()
  return rowToGoal(db.select().from(goals).where(eq(goals.id, row.id)).get()!)
}

export function updateGoal(id: string, input: UpdateGoalInput): Goal {
  const db = getDb()
  const updates: Partial<typeof goals.$inferInsert> = {}
  if (input.title !== undefined) updates.title = input.title
  if (input.description !== undefined) updates.description = input.description ?? null
  db.update(goals).set(updates).where(eq(goals.id, id)).run()
  return rowToGoal(db.select().from(goals).where(eq(goals.id, id)).get()!)
}

export function reorderGoals(ids: string[]): void {
  const db = getDb()
  db.transaction((tx) => {
    ids.forEach((id, index) => {
      tx.update(goals).set({ sortOrder: index }).where(eq(goals.id, id)).run()
    })
  })
}

export function completeGoal(id: string): Goal {
  const db = getDb()
  db.update(goals).set({ completedAt: Date.now() }).where(eq(goals.id, id)).run()
  return rowToGoal(db.select().from(goals).where(eq(goals.id, id)).get()!)
}

export function uncompleteGoal(id: string): Goal {
  const db = getDb()
  db.update(goals).set({ completedAt: null }).where(eq(goals.id, id)).run()
  return rowToGoal(db.select().from(goals).where(eq(goals.id, id)).get()!)
}

export function deleteGoal(id: string): void {
  const db = getDb()
  db.update(goals).set({ archivedAt: Date.now() }).where(eq(goals.id, id)).run()
}
