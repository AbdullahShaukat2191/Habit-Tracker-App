'use client'
import { create } from 'zustand'
import type { SettingsMap } from '../../../shared/types'
import * as ipc from '../ipc'

interface SettingsStore {
  settings: SettingsMap
  loaded: boolean
  error: string | null

  loadSettings: () => Promise<void>
  set: (key: string, value: string) => Promise<void>
  get: (key: string) => string | undefined
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: {},
  loaded: false,
  error: null,

  loadSettings: async () => {
    try {
      const settings = await ipc.getAllSettings()
      set({ settings, loaded: true })
    } catch (e) {
      set({ error: String(e) })
    }
  },

  set: async (key: string, value: string) => {
    await ipc.setSetting(key, value)
    set((s) => ({ settings: { ...s.settings, [key]: value } }))
  },

  get: (key: string) => get().settings[key],
}))
