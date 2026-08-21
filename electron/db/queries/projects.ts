import { eq, asc } from 'drizzle-orm'
import { getDb } from '../client'
import { projects, tasks } from '../schema'
import type { Project, CreateProjectInput, UpdateProjectInput } from '../../../shared/types'
import { randomUUID } from 'crypto'

function rowToProject(row: typeof projects.$inferSelect): Project {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    sortOrder: row.sortOrder ?? 0,
    createdAt: row.createdAt,
  }
}

export function listProjects(): Project[] {
  const db = getDb()
  return db.select().from(projects).orderBy(asc(projects.sortOrder), asc(projects.createdAt)).all().map(rowToProject)
}

export function createProject(input: CreateProjectInput): Project {
  const db = getDb()
  const existing = db.select({ sortOrder: projects.sortOrder }).from(projects).all()
  const maxOrder = existing.reduce((max, p) => Math.max(max, p.sortOrder ?? 0), -1)
  const row = {
    id: randomUUID(),
    name: input.name,
    color: input.color,
    sortOrder: maxOrder + 1,
    createdAt: Date.now(),
  }
  db.insert(projects).values(row).run()
  return rowToProject(db.select().from(projects).where(eq(projects.id, row.id)).get()!)
}

export function updateProject(id: string, input: UpdateProjectInput): Project {
  const db = getDb()
  const updates: Partial<typeof projects.$inferInsert> = {}
  if (input.name !== undefined) updates.name = input.name
  if (input.color !== undefined) updates.color = input.color
  db.update(projects).set(updates).where(eq(projects.id, id)).run()
  return rowToProject(db.select().from(projects).where(eq(projects.id, id)).get()!)
}

export function reorderProjects(ids: string[]): void {
  const db = getDb()
  db.transaction((tx) => {
    ids.forEach((id, index) => {
      tx.update(projects).set({ sortOrder: index }).where(eq(projects.id, id)).run()
    })
  })
}

export function deleteProject(id: string): void {
  const db = getDb()
  db.update(tasks).set({ projectId: null }).where(eq(tasks.projectId, id)).run()
  db.delete(projects).where(eq(projects.id, id)).run()
}
