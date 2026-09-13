'use client'
import { create } from 'zustand'
import type { TimerSession, TimerSettings, TimerSegment } from '../../../shared/types'
import { useProjectStore } from './projectStore'
import * as ipc from '../ipc'

interface TimerStore {
  sessions: TimerSession[]
  activeSession: TimerSession | null
  settings: TimerSettings | null
  segmentsBySessionId: Record<string, TimerSegment[]>
  loading: boolean
  error: string | null

  loadSessions: () => Promise<void>
  loadActiveSession: () => Promise<void>
  loadSettings: () => Promise<void>
  loadSegmentsForSessions: (sessionIds: string[]) => Promise<void>
  createSession: (projectId: string, name?: string) => Promise<TimerSession>
  pauseSession: (id: string) => Promise<TimerSession>
  resumeSession: (id: string) => Promise<TimerSession>
  stopSession: (id: string) => Promise<TimerSession>
  renameSession: (id: string, name: string) => Promise<TimerSession>
  deleteSession: (id: string) => Promise<void>
  updateSettings: (hourlyRate: number, currency: string) => Promise<TimerSettings>
  setProjectRate: (projectId: string, rate: number | null) => Promise<void>
}

export const useTimerStore = create<TimerStore>((set, get) => ({
  sessions: [],
  activeSession: null,
  settings: null,
  segmentsBySessionId: {},
  loading: false,
  error: null,

  loadSessions: async () => {
    set({ loading: true, error: null })
    try {
      const sessions = await ipc.getTimerSessions()
      set({ sessions, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  loadActiveSession: async () => {
    const activeSession = await ipc.getActiveSession()
    set({ activeSession })
  },

  loadSettings: async () => {
    const settings = await ipc.getTimerSettings()
    set({ settings })
  },

  createSession: async (projectId, name) => {
    const previouslyActiveId = get().activeSession?.id
    const session = await ipc.createTimerSession(projectId, name)
    set((s) => ({
      sessions: [
        session,
        ...s.sessions.map((sess) =>
          sess.id === previouslyActiveId ? { ...sess, status: 'stopped' as const } : sess
        ),
      ],
      activeSession: session,
    }))
    return session
  },

  pauseSession: async (id) => {
    const updated = await ipc.pauseTimerSession(id)
    set((s) => ({
      sessions: s.sessions.map((sess) => (sess.id === id ? updated : sess)),
      activeSession: updated,
    }))
    return updated
  },

  resumeSession: async (id) => {
    const previouslyActiveId = get().activeSession?.id
    const updated = await ipc.resumeTimerSession(id)
    set((s) => ({
      sessions: s.sessions.map((sess) => {
        if (sess.id === id) return updated
        if (previouslyActiveId && sess.id === previouslyActiveId && previouslyActiveId !== id) {
          return { ...sess, status: 'stopped' as const }
        }
        return sess
      }),
      activeSession: updated,
    }))
    return updated
  },

  stopSession: async (id) => {
    const updated = await ipc.stopTimerSession(id)
    set((s) => ({
      sessions: s.sessions.map((sess) => (sess.id === id ? updated : sess)),
      activeSession: get().activeSession?.id === id ? null : get().activeSession,
    }))
    return updated
  },

  renameSession: async (id, name) => {
    const updated = await ipc.renameTimerSession(id, name)
    set((s) => ({ sessions: s.sessions.map((sess) => (sess.id === id ? updated : sess)) }))
    return updated
  },

  deleteSession: async (id) => {
    await ipc.deleteTimerSession(id)
    set((s) => ({ sessions: s.sessions.filter((sess) => sess.id !== id) }))
  },

  updateSettings: async (hourlyRate, currency) => {
    const settings = await ipc.updateTimerSettings(hourlyRate, currency)
    set({ settings })
    return settings
  },

  loadSegmentsForSessions: async (sessionIds) => {
    if (sessionIds.length === 0) return
    const segments = await ipc.getSegmentsForSessions(sessionIds)
    set((s) => {
      const next = { ...s.segmentsBySessionId }
      for (const id of sessionIds) next[id] = []
      for (const seg of segments) next[seg.sessionId] = [...(next[seg.sessionId] ?? []), seg]
      return { segmentsBySessionId: next }
    })
  },

  setProjectRate: async (projectId, rate) => {
    await ipc.setProjectHourlyRate(projectId, rate)
    await useProjectStore.getState().loadProjects()
  },
}))
