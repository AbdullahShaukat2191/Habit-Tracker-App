'use client'
import { create } from 'zustand'
import type { Project, CreateProjectInput, UpdateProjectInput } from '../../../shared/types'
import * as ipc from '../ipc'

interface ProjectStore {
  projects: Project[]
  loading: boolean
  error: string | null

  loadProjects: () => Promise<void>
  createProject: (input: CreateProjectInput) => Promise<Project>
  updateProject: (id: string, input: UpdateProjectInput) => Promise<void>
  reorderProjects: (ids: string[]) => Promise<void>
  deleteProject: (id: string) => Promise<void>
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  loading: false,
  error: null,

  loadProjects: async () => {
    set({ loading: true, error: null })
    try {
      const projects = await ipc.listProjects()
      set({ projects, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  createProject: async (input) => {
    const project = await ipc.createProject(input)
    set((s) => ({ projects: [...s.projects, project] }))
    return project
  },

  updateProject: async (id, input) => {
    const updated = await ipc.updateProject(id, input)
    set((s) => ({ projects: s.projects.map((p) => (p.id === id ? updated : p)) }))
  },

  reorderProjects: async (ids) => {
    await ipc.reorderProjects(ids)
    const current = get().projects
    const ordered = ids.map((id, i) => {
      const p = current.find((p) => p.id === id)!
      return { ...p, sortOrder: i }
    })
    set({ projects: ordered })
  },

  deleteProject: async (id) => {
    await ipc.deleteProject(id)
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }))
  },
}))
