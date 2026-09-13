'use client'
import { create } from 'zustand'
import type { Task, CreateTaskInput, UpdateTaskInput } from '../../../shared/types'
import * as ipc from '../ipc'

interface TaskStore {
  tasks: Task[]
  loading: boolean
  error: string | null

  loadTasks: () => Promise<void>
  createTask: (input: CreateTaskInput) => Promise<Task>
  updateTask: (id: string, input: UpdateTaskInput) => Promise<void>
  completeTask: (id: string) => Promise<Task>
  uncompleteTask: (id: string) => Promise<Task>
  pinTask: (id: string) => Promise<Task>
  unpinTask: (id: string) => Promise<Task>
  deleteTask: (id: string) => Promise<void>
  hardDeleteTask: (id: string) => Promise<void>
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  loading: false,
  error: null,

  loadTasks: async () => {
    set({ loading: true, error: null })
    try {
      const tasks = await ipc.listTasks()
      set({ tasks, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  createTask: async (input) => {
    const task = await ipc.createTask(input)
    set((s) => ({ tasks: [...s.tasks, task] }))
    return task
  },

  updateTask: async (id: string, input: UpdateTaskInput) => {
    const updated = await ipc.updateTask(id, input)
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? updated : t)) }))
  },

  completeTask: async (id) => {
    const updated = await ipc.completeTask(id)
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? updated : t)) }))
    return updated
  },

  uncompleteTask: async (id) => {
    const updated = await ipc.uncompleteTask(id)
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? updated : t)) }))
    return updated
  },

  pinTask: async (id) => {
    const updated = await ipc.pinTask(id)
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? updated : t)) }))
    return updated
  },

  unpinTask: async (id) => {
    const updated = await ipc.unpinTask(id)
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? updated : t)) }))
    return updated
  },

  deleteTask: async (id) => {
    await ipc.deleteTask(id)
    // Mark archived in local state so completed+archived tasks stay in Completed tab
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, archivedAt: Date.now() } : t)),
    }))
  },

  hardDeleteTask: async (id) => {
    await ipc.hardDeleteTask(id)
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }))
  },
}))
