'use client'
import { create } from 'zustand'
import type { Habit, HabitCompletion } from '../../../shared/types'
import * as ipc from '../ipc'
import { format } from 'date-fns'

interface HabitStore {
  habits: Habit[]
  completions: HabitCompletion[]
  currentMonth: string // 'YYYY-MM'
  loading: boolean
  error: string | null

  loadHabits: () => Promise<void>
  loadCompletions: (month: string) => Promise<void>
  setCurrentMonth: (month: string) => void
  createHabit: (name: string, schedule: Habit['schedule'], isOptional?: boolean) => Promise<void>
  updateHabit: (id: string, name: string, schedule: Habit['schedule'], isOptional?: boolean) => Promise<void>
  deleteHabit: (id: string) => Promise<void>
  reorderHabits: (ids: string[]) => Promise<void>
  toggleCompletion: (habitId: string, date: string) => Promise<void>
}

export const useHabitStore = create<HabitStore>((set, get) => ({
  habits: [],
  completions: [],
  currentMonth: format(new Date(), 'yyyy-MM'),
  loading: false,
  error: null,

  loadHabits: async () => {
    set({ loading: true, error: null })
    try {
      const habits = await ipc.listHabits()
      set({ habits, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  loadCompletions: async (month: string) => {
    try {
      const completions = await ipc.getHabitCompletions(month)
      set({ completions })
    } catch (e) {
      set({ error: String(e) })
    }
  },

  setCurrentMonth: (month: string) => {
    set({ currentMonth: month })
    get().loadCompletions(month)
  },

  createHabit: async (name, schedule, isOptional = false) => {
    const habit = await ipc.createHabit({ name, schedule, isOptional })
    set((s) => ({ habits: [...s.habits, habit] }))
  },

  updateHabit: async (id, name, schedule, isOptional = false) => {
    const updated = await ipc.updateHabit(id, { name, schedule, isOptional })
    set((s) => ({ habits: s.habits.map((h) => (h.id === id ? updated : h)) }))
  },

  deleteHabit: async (id) => {
    await ipc.deleteHabit(id)
    set((s) => ({ habits: s.habits.filter((h) => h.id !== id) }))
  },

  reorderHabits: async (ids) => {
    await ipc.reorderHabits(ids)
    const ordered = ids.map((id, i) => {
      const h = get().habits.find((h) => h.id === id)!
      return { ...h, sortOrder: i }
    })
    set({ habits: ordered })
  },

  toggleCompletion: async (habitId, date) => {
    const result = await ipc.toggleHabitCompletion(habitId, date)
    if (result === 'completed') {
      set((s) => ({
        completions: [...s.completions, { habitId, date, completedAt: Date.now() }],
      }))
    } else {
      set((s) => ({
        completions: s.completions.filter((c) => !(c.habitId === habitId && c.date === date)),
      }))
    }
  },
}))
