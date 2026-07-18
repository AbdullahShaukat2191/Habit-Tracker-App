import { eq, isNull, and, isNotNull, asc, desc, or } from 'drizzle-orm'
import { getDb } from '../client'
import { tasks } from '../schema'
import type { Task, CreateTaskInput, UpdateTaskInput } from '../../../shared/types'
import { randomUUID } from 'crypto'

function rowToTask(row: typeof tasks.$inferSelect): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    projectId: row.projectId ?? null,
    createdAt: row.createdAt,
    completedAt: row.completedAt ?? null,
    archivedAt: row.archivedAt ?? null,
    isOptional: row.isOptional ?? false,
  }
}

export function listTasks(): Task[] {
  const db = getDb()
  // Return non-archived tasks + completed tasks (even if archived, so they persist in history)
  return db
    .select()
    .from(tasks)
    .where(or(isNull(tasks.archivedAt), isNotNull(tasks.completedAt)))
    .orderBy(asc(tasks.createdAt))
    .all()
    .map(rowToTask)
}

export function createTask(input: CreateTaskInput): Task {
  const db = getDb()
  const row = {
    id: randomUUID(),
    title: input.title,
    description: input.description ?? null,
    projectId: input.projectId ?? null,
    createdAt: Date.now(),
    completedAt: null,
    archivedAt: null,
    isOptional: false,
  }
  db.insert(tasks).values(row).run()
  return rowToTask(db.select().from(tasks).where(eq(tasks.id, row.id)).get()!)
}

export function updateTask(id: string, input: UpdateTaskInput): Task {
  const db = getDb()
  const updates: Partial<typeof tasks.$inferInsert> = {}
  if (input.title !== undefined) updates.title = input.title
  if (input.description !== undefined) updates.description = input.description ?? null
  if ('projectId' in input) updates.projectId = input.projectId ?? null
  if (input.isOptional !== undefined) updates.isOptional = input.isOptional

  db.update(tasks).set(updates).where(eq(tasks.id, id)).run()
  return rowToTask(db.select().from(tasks).where(eq(tasks.id, id)).get()!)
}

export function completeTask(id: string): Task {
  const db = getDb()
  db.update(tasks).set({ completedAt: Date.now() }).where(eq(tasks.id, id)).run()
  return rowToTask(db.select().from(tasks).where(eq(tasks.id, id)).get()!)
}

export function deleteTask(id: string): void {
  const db = getDb()
  db.update(tasks).set({ archivedAt: Date.now() }).where(eq(tasks.id, id)).run()
}

export function hardDeleteTask(id: string): void {
  const db = getDb()
  db.delete(tasks).where(eq(tasks.id, id)).run()
}

export function uncompleteTask(id: string): Task {
  const db = getDb()
  db.update(tasks).set({ completedAt: null }).where(eq(tasks.id, id)).run()
  return rowToTask(db.select().from(tasks).where(eq(tasks.id, id)).get()!)
}
