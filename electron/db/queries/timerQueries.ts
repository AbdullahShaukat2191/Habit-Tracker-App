import { eq, or, desc } from 'drizzle-orm'
import { getDb } from '../client'
import { timerSessions, timerSettings } from '../schema'
import type { TimerSession, TimerSettings } from '../../../shared/types'
import { randomUUID } from 'crypto'

const DEFAULT_TIMER_SETTINGS_ID = 'default'

function rowToSession(row: typeof timerSessions.$inferSelect): TimerSession {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name ?? null,
    startedAt: row.startedAt,
    totalElapsed: row.totalElapsed,
    status: row.status as TimerSession['status'],
    pausedAt: row.pausedAt ?? null,
    stoppedAt: row.stoppedAt ?? null,
    createdAt: row.createdAt,
  }
}

function rowToSettings(row: typeof timerSettings.$inferSelect): TimerSettings {
  return {
    id: row.id,
    hourlyRate: row.hourlyRate,
    currency: row.currency,
  }
}

export function getTimerSessions(): TimerSession[] {
  const db = getDb()
  return db
    .select()
    .from(timerSessions)
    .orderBy(desc(timerSessions.createdAt))
    .all()
    .map(rowToSession)
}

export function getTimerSessionsByProject(projectId: string): TimerSession[] {
  const db = getDb()
  return db
    .select()
    .from(timerSessions)
    .where(eq(timerSessions.projectId, projectId))
    .orderBy(desc(timerSessions.createdAt))
    .all()
    .map(rowToSession)
}

export function getActiveSession(): TimerSession | null {
  const db = getDb()
  const row = db
    .select()
    .from(timerSessions)
    .where(or(eq(timerSessions.status, 'running'), eq(timerSessions.status, 'paused')))
    .get()
  return row ? rowToSession(row) : null
}

export function createTimerSession(projectId: string, name?: string): TimerSession {
  const db = getDb()
  const active = getActiveSession()
  if (active) {
    stopTimerSession(active.id)
  }
  const row = {
    id: randomUUID(),
    projectId,
    name: name ?? null,
    startedAt: Date.now(),
    totalElapsed: 0,
    status: 'running' as const,
    pausedAt: null,
    stoppedAt: null,
    createdAt: Date.now(),
  }
  db.insert(timerSessions).values(row).run()
  return rowToSession(db.select().from(timerSessions).where(eq(timerSessions.id, row.id)).get()!)
}

export function pauseTimerSession(id: string): TimerSession {
  const db = getDb()
  const row = db.select().from(timerSessions).where(eq(timerSessions.id, id)).get()
  if (!row) throw new Error(`Timer session ${id} not found`)
  const session = rowToSession(row)
  if (session.status !== 'running') {
    throw new Error(`Cannot pause a session with status "${session.status}"`)
  }
  const totalElapsed = session.totalElapsed + (Date.now() - session.startedAt)
  db.update(timerSessions).set({ totalElapsed, pausedAt: Date.now(), status: 'paused' }).where(eq(timerSessions.id, id)).run()
  return rowToSession(db.select().from(timerSessions).where(eq(timerSessions.id, id)).get()!)
}

export function resumeTimerSession(id: string): TimerSession {
  const db = getDb()
  const row = db.select().from(timerSessions).where(eq(timerSessions.id, id)).get()
  if (!row) throw new Error(`Timer session ${id} not found`)
  const session = rowToSession(row)
  if (session.status !== 'paused') {
    throw new Error(`Cannot resume a session with status "${session.status}"`)
  }
  db.update(timerSessions).set({ startedAt: Date.now(), pausedAt: null, status: 'running' }).where(eq(timerSessions.id, id)).run()
  return rowToSession(db.select().from(timerSessions).where(eq(timerSessions.id, id)).get()!)
}

export function stopTimerSession(id: string): TimerSession {
  const db = getDb()
  const row = db.select().from(timerSessions).where(eq(timerSessions.id, id)).get()
  if (!row) throw new Error(`Timer session ${id} not found`)
  const session = rowToSession(row)
  const totalElapsed = session.status === 'running'
    ? session.totalElapsed + (Date.now() - session.startedAt)
    : session.totalElapsed
  db.update(timerSessions).set({ totalElapsed, stoppedAt: Date.now(), status: 'stopped' }).where(eq(timerSessions.id, id)).run()
  return rowToSession(db.select().from(timerSessions).where(eq(timerSessions.id, id)).get()!)
}

export function renameTimerSession(id: string, name: string): TimerSession {
  const db = getDb()
  db.update(timerSessions).set({ name }).where(eq(timerSessions.id, id)).run()
  return rowToSession(db.select().from(timerSessions).where(eq(timerSessions.id, id)).get()!)
}

export function deleteTimerSession(id: string): void {
  const db = getDb()
  db.delete(timerSessions).where(eq(timerSessions.id, id)).run()
}

export function getTimerSettings(): TimerSettings {
  const db = getDb()
  let row = db.select().from(timerSettings).where(eq(timerSettings.id, DEFAULT_TIMER_SETTINGS_ID)).get()
  if (!row) {
    db.insert(timerSettings).values({ id: DEFAULT_TIMER_SETTINGS_ID, hourlyRate: 0, currency: 'PKR' }).run()
    row = db.select().from(timerSettings).where(eq(timerSettings.id, DEFAULT_TIMER_SETTINGS_ID)).get()
  }
  return rowToSettings(row!)
}

export function updateTimerSettings(hourlyRate: number, currency: string): TimerSettings {
  getTimerSettings() // ensures the default row exists before updating it
  const db = getDb()
  db.update(timerSettings).set({ hourlyRate, currency }).where(eq(timerSettings.id, DEFAULT_TIMER_SETTINGS_ID)).run()
  return rowToSettings(db.select().from(timerSettings).where(eq(timerSettings.id, DEFAULT_TIMER_SETTINGS_ID)).get()!)
}
