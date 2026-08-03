'use client'
import { create } from 'zustand'
import type {
  FinanceCategory, FinanceTransaction, FinanceSavingsEntry,
  CreateFinanceCategoryInput, UpdateFinanceCategoryInput,
  CreateFinanceTransactionInput, UpdateFinanceTransactionInput,
  CreateFinanceSavingsEntryInput,
} from '../../../shared/types'
import * as ipc from '../ipc'

interface FinanceStore {
  categories: FinanceCategory[]
  transactions: FinanceTransaction[]
  savingsEntries: FinanceSavingsEntry[]
  loading: boolean
  error: string | null

  loadAll: () => Promise<void>

  createCategory: (input: CreateFinanceCategoryInput) => Promise<FinanceCategory>
  updateCategory: (id: string, input: UpdateFinanceCategoryInput) => Promise<void>
  archiveCategory: (id: string) => Promise<void>

  createTransaction: (input: CreateFinanceTransactionInput) => Promise<void>
  updateTransaction: (id: string, input: UpdateFinanceTransactionInput) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>

  createSavingsEntry: (input: CreateFinanceSavingsEntryInput) => Promise<void>
  deleteSavingsEntry: (id: string) => Promise<void>
}

export const useFinanceStore = create<FinanceStore>((set) => ({
  categories: [],
  transactions: [],
  savingsEntries: [],
  loading: false,
  error: null,

  loadAll: async () => {
    set({ loading: true, error: null })
    try {
      const [categories, transactions, savingsEntries] = await Promise.all([
        ipc.listFinanceCategories(),
        ipc.listFinanceTransactions(),
        ipc.listFinanceSavingsEntries(),
      ])
      set({ categories, transactions, savingsEntries, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  createCategory: async (input) => {
    const category = await ipc.createFinanceCategory(input)
    set((s) => ({ categories: [...s.categories, category] }))
    return category
  },

  updateCategory: async (id, input) => {
    const updated = await ipc.updateFinanceCategory(id, input)
    set((s) => ({ categories: s.categories.map((c) => (c.id === id ? updated : c)) }))
  },

  archiveCategory: async (id) => {
    await ipc.archiveFinanceCategory(id)
    set((s) => ({
      categories: s.categories.map((c) => (c.id === id ? { ...c, archivedAt: Date.now() } : c)),
    }))
  },

  createTransaction: async (input) => {
    const transaction = await ipc.createFinanceTransaction(input)
    set((s) => ({ transactions: [...s.transactions, transaction] }))
  },

  updateTransaction: async (id, input) => {
    const updated = await ipc.updateFinanceTransaction(id, input)
    set((s) => ({ transactions: s.transactions.map((t) => (t.id === id ? updated : t)) }))
  },

  deleteTransaction: async (id) => {
    await ipc.deleteFinanceTransaction(id)
    set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }))
  },

  createSavingsEntry: async (input) => {
    const entry = await ipc.createFinanceSavingsEntry(input)
    set((s) => ({ savingsEntries: [...s.savingsEntries, entry] }))
  },

  deleteSavingsEntry: async (id) => {
    await ipc.deleteFinanceSavingsEntry(id)
    set((s) => ({ savingsEntries: s.savingsEntries.filter((e) => e.id !== id) }))
  },
}))
