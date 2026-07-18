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
