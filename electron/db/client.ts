import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import { runMigrations } from './migrate'
import { seedQuotes, seedDefaultSettings, seedQuoteAssignments } from './seed'
import path from 'path'
import { app } from 'electron'

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null
let _dbPath = ''

export function initDb() {
  const userData = app.getPath('userData')
  _dbPath = path.join(userData, 'habit-tracker.db')

  const sqlite = new Database(_dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  runMigrations(sqlite)

  _db = drizzle(sqlite, { schema })

  // Resolve data/ dir: beside project root in dev, in resources in prod
  const appResourcePath = app.isPackaged
    ? process.resourcesPath
    : path.join(__dirname, '../..')

  seedQuotes(_db, appResourcePath)
  seedDefaultSettings(_db)
  seedQuoteAssignments(_db)

  return _db
}

export function getDb() {
  if (!_db) throw new Error('Database not initialized. Call initDb() first.')
  return _db
}

export function getDbPath() {
  return _dbPath
}
