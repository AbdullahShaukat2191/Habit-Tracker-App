'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useToastStore } from '@/lib/store/toastStore'
import { useSettingsStore } from '@/lib/store/settingsStore'
import { SETTING_KEYS } from '@shared/types'
import * as ipc from '@/lib/ipc'

function buildCombo(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  const key = e.key
  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
    parts.push(key.length === 1 ? key.toUpperCase() : key)
  }
  return parts.join('+')
}

export function GlobalShortcuts() {
  const router = useRouter()
  const routerRef = useRef(router)
  const showToastRef = useRef(useToastStore.getState().show)
  const settings = useSettingsStore((s) => s.settings)
  const loadSettings = useSettingsStore((s) => s.loadSettings)
  const settingsRef = useRef(settings)

  useEffect(() => { loadSettings() }, [loadSettings])
  useEffect(() => { routerRef.current = router }, [router])
  useEffect(() => { settingsRef.current = settings }, [settings])
  useEffect(() => {
    showToastRef.current = useToastStore.getState().show
    return useToastStore.subscribe((s) => { showToastRef.current = s.show })
  }, [])

  useEffect(() => {
    const get = (key: string, def: string) => settingsRef.current[key] || def

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept shortcuts while typing in form inputs
      const tag = (e.target as Element)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      const combo = buildCombo(e)
      if (!combo || combo === 'Ctrl' || combo === 'Alt' || combo === 'Shift') return

      if (combo === get(SETTING_KEYS.SHORTCUT_NAV_HABITS, 'Ctrl+1')) {
        e.preventDefault(); routerRef.current.push('/'); return
      }
      if (combo === get(SETTING_KEYS.SHORTCUT_NAV_TASKS, 'Ctrl+2')) {
        e.preventDefault(); routerRef.current.push('/tasks'); return
      }
      if (combo === get(SETTING_KEYS.SHORTCUT_NAV_WISHLIST, 'Ctrl+3')) {
        e.preventDefault(); routerRef.current.push('/wishlist'); return
      }
      if (combo === get(SETTING_KEYS.SHORTCUT_NAV_PROJECTS, 'Ctrl+4')) {
        e.preventDefault(); routerRef.current.push('/projects'); return
      }
      if (combo === get(SETTING_KEYS.SHORTCUT_NAV_GOALS, 'Ctrl+5')) {
        e.preventDefault(); routerRef.current.push('/goals'); return
      }
      if (combo === get(SETTING_KEYS.SHORTCUT_NAV_SETTINGS, 'Ctrl+,')) {
        e.preventDefault(); routerRef.current.push('/settings'); return
      }
      if (combo === get(SETTING_KEYS.SHORTCUT_ADD, 'Ctrl+N')) {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('open-add-modal'))
        return
      }
      if (combo === get(SETTING_KEYS.SHORTCUT_QUIT, 'Ctrl+Q')) {
        e.preventDefault()
        ipc.quit().catch(() => {})
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, []) // intentionally [] — uses settingsRef for live values without re-registering

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI) return
    const sectionToPath: Record<string, string> = {
      habits: '/', tasks: '/tasks', wishlist: '/wishlist', projects: '/projects', goals: '/goals', settings: '/settings',
    }
    ipc.onNavigate((section) => {
      const path = sectionToPath[section] ?? '/'
      routerRef.current.push(path)
    })
    return () => ipc.removeNavigateListener()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI) return
    ipc.onReportReady((month) => {
      showToastRef.current(
        `Your Monthly Summary for ${month} is ready. Navigate to Habit Scorecard to view it.`,
        'success'
      )
    })
    return () => ipc.removeReportReadyListener()
  }, [])

  return null
}
