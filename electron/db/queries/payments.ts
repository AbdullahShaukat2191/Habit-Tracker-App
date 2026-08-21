import { eq, asc, inArray } from 'drizzle-orm'
import { getDb } from '../client'
import { paymentProjects, paymentMilestones, paymentRecords, projects } from '../schema'
import type {
  PaymentProject, CreatePaymentProjectInput, UpdatePaymentProjectInput,
  PaymentMilestone, CreatePaymentMilestoneInput, UpdatePaymentMilestoneInput,
  PaymentRecord, CreatePaymentRecordInput,
} from '../../../shared/types'
import { randomUUID } from 'crypto'

function rowToPaymentProject(row: typeof paymentProjects.$inferSelect): PaymentProject {
  return {
    id: row.id,
    sourceProjectId: row.sourceProjectId,
    name: row.name,
    color: row.color,
    totalAmount: row.totalAmount,
    developer: row.developer,
    currency: row.currency,
    createdAt: row.createdAt,
  }
}

function rowToMilestone(row: typeof paymentMilestones.$inferSelect): PaymentMilestone {
  return {
    id: row.id,
    paymentProjectId: row.paymentProjectId,
    title: row.title,
    description: row.description,
    amount: row.amount,
    paid: row.paid,
    paidAt: row.paidAt,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
  }
}

function rowToRecord(row: typeof paymentRecords.$inferSelect): PaymentRecord {
  return {
    id: row.id,
    paymentProjectId: row.paymentProjectId,
    milestoneId: row.milestoneId,
    amount: row.amount,
    note: row.note,
    paidAt: row.paidAt,
    createdAt: row.createdAt,
  }
}

// ─── Payment Projects ────────────────────────────────────────────────────────

export function listPaymentProjects(): PaymentProject[] {
  const db = getDb()
  return db.select().from(paymentProjects).orderBy(asc(paymentProjects.createdAt)).all().map(rowToPaymentProject)
}

export function createPaymentProject(input: CreatePaymentProjectInput): PaymentProject {
  const db = getDb()
  const row = {
    id: randomUUID(),
    sourceProjectId: null,
    name: input.name,
    color: input.color,
    totalAmount: input.totalAmount ?? 0,
    developer: input.developer ?? null,
    currency: input.currency ?? 'USD',
    createdAt: Date.now(),
  }
  db.insert(paymentProjects).values(row).run()
  return rowToPaymentProject(db.select().from(paymentProjects).where(eq(paymentProjects.id, row.id)).get()!)
}

export function importPaymentProjects(projectIds: string[]): PaymentProject[] {
  const db = getDb()
  if (projectIds.length === 0) return []
  const sourceRows = db.select().from(projects).where(inArray(projects.id, projectIds)).all()
  const now = Date.now()
  const created: PaymentProject[] = []
  for (const source of sourceRows) {
    const row = {
      id: randomUUID(),
      sourceProjectId: source.id,
      name: source.name,
      color: source.color,
      totalAmount: 0,
      developer: null,
      currency: 'USD',
      createdAt: now,
    }
    db.insert(paymentProjects).values(row).run()
    created.push(rowToPaymentProject(db.select().from(paymentProjects).where(eq(paymentProjects.id, row.id)).get()!))
  }
  return created
}

export function updatePaymentProject(id: string, input: UpdatePaymentProjectInput): PaymentProject {
  const db = getDb()
  const updates: Partial<typeof paymentProjects.$inferInsert> = {}
  if (input.name !== undefined) updates.name = input.name
  if (input.color !== undefined) updates.color = input.color
  if (input.totalAmount !== undefined) updates.totalAmount = input.totalAmount
  if (input.developer !== undefined) updates.developer = input.developer
  if (input.currency !== undefined) updates.currency = input.currency
  db.update(paymentProjects).set(updates).where(eq(paymentProjects.id, id)).run()
  return rowToPaymentProject(db.select().from(paymentProjects).where(eq(paymentProjects.id, id)).get()!)
}

export function deletePaymentProject(id: string): void {
  const db = getDb()
  db.delete(paymentRecords).where(eq(paymentRecords.paymentProjectId, id)).run()
  db.delete(paymentMilestones).where(eq(paymentMilestones.paymentProjectId, id)).run()
  db.delete(paymentProjects).where(eq(paymentProjects.id, id)).run()
}

// ─── Payment Milestones ──────────────────────────────────────────────────────

export function listPaymentMilestones(): PaymentMilestone[] {
  const db = getDb()
  return db.select().from(paymentMilestones).orderBy(asc(paymentMilestones.sortOrder), asc(paymentMilestones.createdAt)).all().map(rowToMilestone)
}

export function createPaymentMilestone(paymentProjectId: string, input: CreatePaymentMilestoneInput): PaymentMilestone {
  const db = getDb()
  const existing = db.select({ sortOrder: paymentMilestones.sortOrder }).from(paymentMilestones).where(eq(paymentMilestones.paymentProjectId, paymentProjectId)).all()
  const maxOrder = existing.reduce((max, m) => Math.max(max, m.sortOrder ?? 0), -1)
  const row = {
    id: randomUUID(),
    paymentProjectId,
    title: input.title,
    description: input.description ?? null,
    amount: input.amount,
    paid: false,
    paidAt: null,
    sortOrder: maxOrder + 1,
    createdAt: Date.now(),
  }
  db.insert(paymentMilestones).values(row).run()
  return rowToMilestone(db.select().from(paymentMilestones).where(eq(paymentMilestones.id, row.id)).get()!)
}

export function updatePaymentMilestone(id: string, input: UpdatePaymentMilestoneInput): PaymentMilestone {
  const db = getDb()
  const updates: Partial<typeof paymentMilestones.$inferInsert> = {}
  if (input.title !== undefined) updates.title = input.title
  if (input.description !== undefined) updates.description = input.description
  if (input.amount !== undefined) updates.amount = input.amount
  db.update(paymentMilestones).set(updates).where(eq(paymentMilestones.id, id)).run()
  return rowToMilestone(db.select().from(paymentMilestones).where(eq(paymentMilestones.id, id)).get()!)
}

export function deletePaymentMilestone(id: string): void {
  const db = getDb()
  db.delete(paymentRecords).where(eq(paymentRecords.milestoneId, id)).run()
  db.delete(paymentMilestones).where(eq(paymentMilestones.id, id)).run()
}

export function togglePaymentMilestonePaid(id: string): PaymentMilestone {
  const db = getDb()
  const milestone = db.select().from(paymentMilestones).where(eq(paymentMilestones.id, id)).get()
  if (!milestone) throw new Error(`Milestone ${id} not found`)

  if (milestone.paid) {
    db.delete(paymentRecords).where(eq(paymentRecords.milestoneId, id)).run()
    db.update(paymentMilestones).set({ paid: false, paidAt: null }).where(eq(paymentMilestones.id, id)).run()
  } else {
    const now = Date.now()
    db.insert(paymentRecords).values({
      id: randomUUID(),
      paymentProjectId: milestone.paymentProjectId,
      milestoneId: id,
      amount: milestone.amount,
      note: null,
      paidAt: now,
      createdAt: now,
    }).run()
    db.update(paymentMilestones).set({ paid: true, paidAt: now }).where(eq(paymentMilestones.id, id)).run()
  }

  return rowToMilestone(db.select().from(paymentMilestones).where(eq(paymentMilestones.id, id)).get()!)
}

// ─── Payment Records ─────────────────────────────────────────────────────────

export function listPaymentRecords(): PaymentRecord[] {
  const db = getDb()
  return db.select().from(paymentRecords).orderBy(asc(paymentRecords.paidAt)).all().map(rowToRecord)
}

export function createPaymentRecord(paymentProjectId: string, input: CreatePaymentRecordInput): PaymentRecord {
  const db = getDb()
  const now = Date.now()
  const row = {
    id: randomUUID(),
    paymentProjectId,
    milestoneId: null,
    amount: input.amount,
    note: input.note ?? null,
    paidAt: now,
    createdAt: now,
  }
  db.insert(paymentRecords).values(row).run()
  return rowToRecord(db.select().from(paymentRecords).where(eq(paymentRecords.id, row.id)).get()!)
}

export function deletePaymentRecord(id: string): void {
  const db = getDb()
  db.delete(paymentRecords).where(eq(paymentRecords.id, id)).run()
}
