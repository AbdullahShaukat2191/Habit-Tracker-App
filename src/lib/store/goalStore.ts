'use client'
import { create } from 'zustand'
import type { Goal, CreateGoalInput, UpdateGoalInput } from '../../../shared/types'
import * as ipc from '../ipc'

interface GoalStore {
  goals: Goal[]
  loading: boolean
  error: string | null

  loadGoals: () => Promise<void>
  createGoal: (input: CreateGoalInput) => Promise<Goal>
  updateGoal: (id: string, input: UpdateGoalInput) => Promise<void>
  reorderGoals: (ids: string[]) => Promise<void>
  completeGoal: (id: string) => Promise<Goal>
  uncompleteGoal: (id: string) => Promise<Goal>
  deleteGoal: (id: string) => Promise<void>
}

export const useGoalStore = create<GoalStore>((set, get) => ({
  goals: [],
  loading: false,
  error: null,

  loadGoals: async () => {
    set({ loading: true, error: null })
    try {
      const goals = await ipc.listGoals()
      set({ goals, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  createGoal: async (input) => {
    const goal = await ipc.createGoal(input)
    set((s) => ({ goals: [...s.goals, goal] }))
    return goal
  },

  updateGoal: async (id, input) => {
    const updated = await ipc.updateGoal(id, input)
    set((s) => ({ goals: s.goals.map((g) => (g.id === id ? updated : g)) }))
  },

  reorderGoals: async (ids) => {
    await ipc.reorderGoals(ids)
    const current = get().goals
    const ordered = ids.map((id, i) => {
      const g = current.find((g) => g.id === id)!
      return { ...g, sortOrder: i }
    })
    set({ goals: ordered })
  },

  completeGoal: async (id) => {
    const updated = await ipc.completeGoal(id)
    set((s) => ({ goals: s.goals.map((g) => (g.id === id ? updated : g)) }))
    return updated
  },

  uncompleteGoal: async (id) => {
    const updated = await ipc.uncompleteGoal(id)
    set((s) => ({ goals: s.goals.map((g) => (g.id === id ? updated : g)) }))
    return updated
  },

  deleteGoal: async (id) => {
    await ipc.deleteGoal(id)
    set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }))
  },
}))
