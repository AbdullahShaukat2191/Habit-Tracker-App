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
  reorderItems: (ids: string[]) => Promise<void>
  completeItem: (id: string) => Promise<WishlistItem>
  uncompleteItem: (id: string) => Promise<WishlistItem>
  deleteItem: (id: string) => Promise<void>
  hardDeleteItem: (id: string) => Promise<void>
}

export const useWishlistStore = create<WishlistStore>((set, get) => ({
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

  reorderItems: async (ids) => {
    await ipc.reorderWishlistItems(ids)
    const current = get().items
    const ordered = ids.map((id, i) => {
      const item = current.find((item) => item.id === id)!
      return { ...item, sortOrder: i }
    })
    set({ items: ordered })
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
