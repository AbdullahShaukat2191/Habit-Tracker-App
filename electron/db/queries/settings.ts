import { eq } from 'drizzle-orm'
import { getDb } from '../client'
import { settings } from '../schema'
import type { SettingsMap } from '../../../shared/types'

export function getAllSettings(): SettingsMap {
  const db = getDb()
  const rows = db.select().from(settings).all()
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

export function setSetting(key: string, value: string): void {
  const db = getDb()
  db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run()
}

export function getSetting(key: string): string | undefined {
  const db = getDb()
  return db.select().from(settings).where(eq(settings.key, key)).get()?.value
}
