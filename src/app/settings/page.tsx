'use client'
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { Eye, EyeOff, Pencil, Trash2 } from 'lucide-react'
import { useSettingsStore } from '@/lib/store/settingsStore'
import { useToastStore } from '@/lib/store/toastStore'
import { SETTING_KEYS } from '@shared/types'
import type { Quote } from '@shared/types'
import {
  listQuotes,
  createQuote,
  updateQuote,
  deleteQuote,
  toggleQuoteHidden,
  testNotification,
  exportData,
  getAppVersion,
  getDbPath,
  testOpenAiKey,
} from '@/lib/ipc'

// ─── Design system tokens ────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-input)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
  padding: '8px 12px',
  color: 'var(--text-primary)',
  fontSize: 14,
  outline: 'none',
}

const primaryButtonStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 8,
  border: 'none',
  backgroundColor: 'var(--accent)',
  color: 'white',
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
}

const ghostButtonStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid var(--border-subtle)',
  backgroundColor: 'transparent',
  color: 'var(--text-secondary)',
  fontSize: 14,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
}

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  margin: '0 0 16px',
}

const settingRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 16px',
  backgroundColor: 'var(--bg-surface)',
  borderRadius: 8,
  border: '1px solid var(--border-subtle)',
}

const labelStyle: React.CSSProperties = {
  fontSize: 14,
  color: 'var(--text-primary)',
  fontWeight: 500,
}

const descStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-tertiary)',
  marginTop: 2,
}

// ─── ToggleSwitch ─────────────────────────────────────────────────────────────

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <div
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onClick={onChange}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          onChange()
        }
      }}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        flexShrink: 0,
        backgroundColor: checked ? 'var(--accent)' : 'var(--bg-surface-2)',
        border: '1px solid var(--border-subtle)',
        cursor: 'pointer',
        transition: 'background-color 200ms',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 22 : 3,
          width: 16,
          height: 16,
          borderRadius: '50%',
          backgroundColor: 'white',
          transition: 'left 200ms',
        }}
      />
    </div>
  )
}

// ─── ShortcutsSection ────────────────────────────────────────────────────────

const SHORTCUT_DEFS = [
  { key: SETTING_KEYS.SHORTCUT_ADD, label: 'Add new item', defaultValue: 'Ctrl+N' },
  { key: SETTING_KEYS.SHORTCUT_NAV_HABITS, label: 'Go to Habits', defaultValue: 'Ctrl+1' },
  { key: SETTING_KEYS.SHORTCUT_NAV_TASKS, label: 'Go to Tasks', defaultValue: 'Ctrl+2' },
  { key: SETTING_KEYS.SHORTCUT_NAV_WISHLIST, label: 'Go to Wish List', defaultValue: 'Ctrl+3' },
  { key: SETTING_KEYS.SHORTCUT_NAV_PROJECTS, label: 'Go to Projects', defaultValue: 'Ctrl+4' },
  { key: SETTING_KEYS.SHORTCUT_NAV_GOALS, label: 'Go to Goals', defaultValue: 'Ctrl+5' },
  { key: SETTING_KEYS.SHORTCUT_NAV_SETTINGS, label: 'Open Settings', defaultValue: 'Ctrl+,' },
  { key: SETTING_KEYS.SHORTCUT_QUIT, label: 'Quit', defaultValue: 'Ctrl+Q' },
] as const

function ShortcutsSection({
  settings,
  setSetting,
}: {
  settings: Record<string, string>
  setSetting: (key: string, value: string) => Promise<void>
}) {
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [conflict, setConflict] = useState<string | null>(null)
  const captureRef = useRef<HTMLDivElement | null>(null)

  const startEdit = (key: string) => {
    setEditingKey(key)
    setConflict(null)
    setTimeout(() => captureRef.current?.focus(), 30)
  }

  const handleKeyCapture = useCallback(
    (e: React.KeyboardEvent, settingKey: string) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.key === 'Escape') { setEditingKey(null); setConflict(null); return }

      const parts: string[] = []
      if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
      if (e.altKey) parts.push('Alt')
      if (e.shiftKey) parts.push('Shift')
      const rawKey = e.key
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(rawKey)) return
      parts.push(rawKey.length === 1 ? rawKey.toUpperCase() : rawKey)

      if (parts.length < 2) return // need at least one modifier

      const combo = parts.join('+')

      // Check for conflicts with other shortcuts
      const conflicting = SHORTCUT_DEFS.find((s) => {
        if (s.key === settingKey) return false
        return (settings[s.key] || s.defaultValue) === combo
      })

      if (conflicting) {
        setConflict(`Already used by "${conflicting.label}"`)
        return
      }

      setSetting(settingKey, combo).catch(() => {})
      setEditingKey(null)
      setConflict(null)
    },
    [settings, setSetting]
  )

  const resetToDefault = useCallback(
    (settingKey: string, defaultValue: string) => {
      setSetting(settingKey, defaultValue).catch(() => {})
    },
    [setSetting]
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {SHORTCUT_DEFS.map(({ key, label, defaultValue }) => {
        const current = settings[key] || defaultValue
        const isEditing = editingKey === key
        const isDefault = current === defaultValue

        return (
          <div key={key} style={{ ...settingRowStyle, gap: 12 }}>
            <span style={labelStyle}>{label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {isEditing ? (
                <div
                  ref={captureRef}
                  tabIndex={0}
                  onKeyDown={(e) => handleKeyCapture(e, key)}
                  onBlur={() => { setEditingKey(null); setConflict(null) }}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 6,
                    border: `1px solid ${conflict ? '#F87171' : 'var(--accent)'}`,
                    backgroundColor: 'var(--bg-input)',
                    color: conflict ? '#F87171' : 'var(--text-tertiary)',
                    fontSize: 12,
                    fontFamily: 'monospace',
                    cursor: 'default',
                    minWidth: 148,
                    textAlign: 'center',
                    outline: 'none',
                    userSelect: 'none',
                  }}
                >
                  {conflict ?? 'Press keys…'}
                </div>
              ) : (
                <>
                  <kbd
                    style={{
                      padding: '3px 9px',
                      borderRadius: 5,
                      border: '1px solid var(--border-strong)',
                      backgroundColor: 'var(--bg-surface-2)',
                      color: 'var(--text-primary)',
                      fontSize: 12,
                      fontFamily: 'monospace',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {current}
                  </kbd>
                  <button onClick={() => startEdit(key)} style={{ ...ghostButtonStyle, padding: '3px 10px', fontSize: 12 }}>
                    Edit
                  </button>
                  {!isDefault && (
                    <button
                      onClick={() => resetToDefault(key, defaultValue)}
                      title="Reset to default"
                      style={{ ...ghostButtonStyle, padding: '3px 8px', fontSize: 11, color: 'var(--text-tertiary)' }}
                    >
                      Reset
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )
      })}
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', paddingLeft: 4 }}>
        Click Edit, then press your desired key combination. Press Escape to cancel.
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const loadSettings = useSettingsStore((s) => s.loadSettings)
  const setSetting = useSettingsStore((s) => s.set)
  const get = useSettingsStore((s) => s.get)
  const settings = useSettingsStore((s) => s.settings)
  const showToast = useToastStore((s) => s.show)

  const [quotes, setQuotes] = useState<Quote[]>([])
  const [quotesTab, setQuotesTab] = useState<'Goggins' | 'Hormozi'>('Goggins')
  const [newQuoteText, setNewQuoteText] = useState('')
  const [newQuoteSource, setNewQuoteSource] = useState('')
  const [addingQuote, setAddingQuote] = useState(false)
  const [appVersion, setAppVersion] = useState('')
  const [dbPath, setDbPath] = useState('')
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [apiKeyVisible, setApiKeyVisible] = useState(false)
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editSource, setEditSource] = useState('')

  // Notification active hours local state
  const [activeStart, setActiveStart] = useState('08:00')
  const [activeEnd, setActiveEnd] = useState('22:00')
  const [minHours, setMinHours] = useState(1)
  const [maxHours, setMaxHours] = useState(4)

  useEffect(() => {
    loadSettings()
    listQuotes().then(setQuotes).catch(() => {})
    getAppVersion().then(setAppVersion).catch(() => {})
    getDbPath().then(setDbPath).catch(() => {})
  }, [loadSettings])

  // Initialize API key + notification inputs from settings
  useEffect(() => {
    const key = settings[SETTING_KEYS.OPENAI_API_KEY] ?? ''
    setApiKeyInput(key)

    const start = settings[SETTING_KEYS.NOTIFY_ACTIVE_START] ?? '08:00'
    const end = settings[SETTING_KEYS.NOTIFY_ACTIVE_END] ?? '22:00'
    setActiveStart(start)
    setActiveEnd(end)

    const min = parseInt(settings[SETTING_KEYS.NOTIFY_MIN_HOURS] ?? '1', 10)
    const max = parseInt(settings[SETTING_KEYS.NOTIFY_MAX_HOURS] ?? '4', 10)
    setMinHours(isNaN(min) ? 1 : min)
    setMaxHours(isNaN(max) ? 4 : max)
  }, [settings])

  const toggleSetting = useCallback(
    async (key: string) => {
      const current = get(key) ?? 'false'
      await setSetting(key, current === 'true' ? 'false' : 'true').catch((err: unknown) =>
        showToast(String(err), 'error')
      )
    },
    [get, setSetting, showToast]
  )

  const isOn = useCallback((key: string) => get(key) === 'true', [get])

  // ── Quotes ──────────────────────────────────────────────────────────────────

  const visibleQuotes = useMemo(
    () => quotes.filter((q) => q.author === quotesTab),
    [quotes, quotesTab]
  )

  const handleAddQuote = useCallback(async () => {
    if (!newQuoteText.trim()) return
    setAddingQuote(true)
    try {
      await createQuote({
        author: quotesTab,
        text: newQuoteText.trim(),
        source: newQuoteSource.trim() || 'User added',
      })
      const updated = await listQuotes()
      setQuotes(updated)
      setNewQuoteText('')
      setNewQuoteSource('')
      showToast('Quote added!', 'success')
    } catch (err) {
      showToast(String(err), 'error')
    } finally {
      setAddingQuote(false)
    }
  }, [newQuoteText, newQuoteSource, quotesTab, showToast])

  const handleToggleHidden = useCallback(
    async (id: string) => {
      try {
        await toggleQuoteHidden(id)
        const updated = await listQuotes()
        setQuotes(updated)
      } catch (err) {
        showToast(String(err), 'error')
      }
    },
    [showToast]
  )

  const handleDeleteQuote = useCallback(
    async (id: string) => {
      try {
        await deleteQuote(id)
        const updated = await listQuotes()
        setQuotes(updated)
        showToast('Quote deleted', 'info')
      } catch (err) {
        showToast(String(err), 'error')
      }
    },
    [showToast]
  )

  const startEditQuote = useCallback((q: Quote) => {
    setEditingQuoteId(q.id)
    setEditText(q.text)
    setEditSource(q.source)
  }, [])

  const handleSaveEditQuote = useCallback(
    async (id: string) => {
      try {
        await updateQuote(id, { text: editText.trim(), source: editSource.trim() })
        const updated = await listQuotes()
        setQuotes(updated)
        setEditingQuoteId(null)
        showToast('Quote updated', 'success')
      } catch (err) {
        showToast(String(err), 'error')
      }
    },
    [editText, editSource, showToast]
  )

  // ── API Key ─────────────────────────────────────────────────────────────────

  const handleSaveApiKey = useCallback(async () => {
    try {
      await setSetting(SETTING_KEYS.OPENAI_API_KEY, apiKeyInput.trim())
      showToast('API key saved', 'success')
    } catch (err) {
      showToast('Failed to save API key: ' + String(err), 'error')
    }
  }, [apiKeyInput, setSetting, showToast])

  const handleTestApiKey = useCallback(async () => {
    if (!apiKeyInput.trim()) {
      showToast('Enter an API key first', 'error')
      return
    }
    showToast('Testing connection…', 'info')
    try {
      const result = await testOpenAiKey(apiKeyInput.trim())
      if (result.ok) {
        showToast('OpenAI connection successful!', 'success')
      } else {
        showToast('Connection failed: ' + (result.error ?? 'Unknown error'), 'error')
      }
    } catch (err) {
      showToast('Connection failed: ' + String(err), 'error')
    }
  }, [apiKeyInput, showToast])

  // ── Data ────────────────────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    try {
      await exportData()
      showToast('Data exported successfully', 'success')
    } catch (err) {
      showToast('Export failed: ' + String(err), 'error')
    }
  }, [showToast])

  // ── Test notification ───────────────────────────────────────────────────────

  const handleTestNotification = useCallback(async () => {
    try {
      await testNotification()
      showToast('Test notification sent!', 'success')
    } catch (err) {
      showToast('Failed: ' + String(err), 'error')
    }
  }, [showToast])

  // ── Notification time/range save ────────────────────────────────────────────

  const handleActiveStartBlur = useCallback(async () => {
    await setSetting(SETTING_KEYS.NOTIFY_ACTIVE_START, activeStart).catch(() => {})
  }, [activeStart, setSetting])

  const handleActiveEndBlur = useCallback(async () => {
    await setSetting(SETTING_KEYS.NOTIFY_ACTIVE_END, activeEnd).catch(() => {})
  }, [activeEnd, setSetting])

  const handleMinHoursChange = useCallback(
    async (val: number) => {
      const clamped = Math.min(val, maxHours)  // can't exceed max
      setMinHours(clamped)
      await setSetting(SETTING_KEYS.NOTIFY_MIN_HOURS, String(clamped)).catch(() => {})
    },
    [maxHours, setSetting]
  )

  const handleMaxHoursChange = useCallback(
    async (val: number) => {
      const clamped = Math.max(val, minHours)  // can't go below min
      setMaxHours(clamped)
      await setSetting(SETTING_KEYS.NOTIFY_MAX_HOURS, String(clamped)).catch(() => {})
    },
    [minHours, setSetting]
  )

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-base)',
        overflowY: 'auto',
      }}
    >
      {/* Page header */}
      <div
        style={{
          padding: '20px 32px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
          Settings
        </h2>
      </div>

      <div
        style={{
          padding: '24px 32px',
          width: '100%',
          maxWidth: 900,
          margin: '0 auto',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 40,
        }}
      >
        {/* ── Section 1: Notifications ────────────────────────────────────── */}
        <section>
          <h3 style={sectionHeadingStyle}>Notifications</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={settingRowStyle}>
              <div>
                <div style={labelStyle}>Enable Notifications</div>
                <div style={descStyle}>Master toggle for all in-app notifications</div>
              </div>
              <ToggleSwitch
                checked={isOn(SETTING_KEYS.NOTIFICATIONS_ENABLED)}
                onChange={() => toggleSetting(SETTING_KEYS.NOTIFICATIONS_ENABLED)}
              />
            </div>

            <div style={settingRowStyle}>
              <div>
                <div style={labelStyle}>Notify about Habits</div>
                <div style={descStyle}>Daily reminders for your habit schedule</div>
              </div>
              <ToggleSwitch
                checked={isOn(SETTING_KEYS.NOTIFY_HABITS)}
                onChange={() => toggleSetting(SETTING_KEYS.NOTIFY_HABITS)}
              />
            </div>

            <div style={settingRowStyle}>
              <div>
                <div style={labelStyle}>Notify about Tasks</div>
                <div style={descStyle}>Reminders for overdue and upcoming tasks</div>
              </div>
              <ToggleSwitch
                checked={isOn(SETTING_KEYS.NOTIFY_TASKS)}
                onChange={() => toggleSetting(SETTING_KEYS.NOTIFY_TASKS)}
              />
            </div>

            <div style={settingRowStyle}>
              <div>
                <div style={labelStyle}>Notify about Goals</div>
                <div style={descStyle}>Periodic reminders about your active goals</div>
              </div>
              <ToggleSwitch
                checked={isOn(SETTING_KEYS.NOTIFY_GOALS)}
                onChange={() => toggleSetting(SETTING_KEYS.NOTIFY_GOALS)}
              />
            </div>

            {/* Active hours */}
            <div
              style={{
                ...settingRowStyle,
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={labelStyle}>Active Hours</div>
                <div style={descStyle}>Only send notifications during this window</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="time"
                  value={activeStart}
                  onChange={(e) => setActiveStart(e.target.value)}
                  onBlur={handleActiveStartBlur}
                  style={{ ...inputStyle, width: 110 }}
                />
                <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>to</span>
                <input
                  type="time"
                  value={activeEnd}
                  onChange={(e) => setActiveEnd(e.target.value)}
                  onBlur={handleActiveEndBlur}
                  style={{ ...inputStyle, width: 110 }}
                />
              </div>
            </div>

            {/* Min/max hours */}
            <div style={{ ...settingRowStyle, flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
              <div style={labelStyle}>
                Notify between {minHours} and {maxHours} hour{maxHours !== 1 ? 's' : ''}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={descStyle}>Min</span>
                  <input
                    type="range"
                    min={1}
                    max={8}
                    step={1}
                    value={minHours}
                    onChange={(e) => handleMinHoursChange(Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: 14, color: 'var(--text-primary)', minWidth: 16 }}>
                    {minHours}h
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={descStyle}>Max</span>
                  <input
                    type="range"
                    min={1}
                    max={8}
                    step={1}
                    value={maxHours}
                    onChange={(e) => handleMaxHoursChange(Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: 14, color: 'var(--text-primary)', minWidth: 16 }}>
                    {maxHours}h
                  </span>
                </div>
              </div>
            </div>

            {/* Test notification */}
            <div>
              <button onClick={handleTestNotification} style={ghostButtonStyle}>
                Send test notification
              </button>
            </div>
          </div>
        </section>

        {/* ── Section 1b: Habits ──────────────────────────────────────────── */}
        <section>
          <h3 style={sectionHeadingStyle}>Habits</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={settingRowStyle}>
              <div>
                <div style={labelStyle}>Allow backfilling past days</div>
                <div style={descStyle}>When enabled, you can mark previous days as done in the current month</div>
              </div>
              <ToggleSwitch
                checked={isOn(SETTING_KEYS.BACKFILL_HABITS)}
                onChange={() => toggleSetting(SETTING_KEYS.BACKFILL_HABITS)}
              />
            </div>
          </div>
        </section>

        {/* ── Section 1c: Keyboard Shortcuts ──────────────────────────────── */}
        <section>
          <h3 style={sectionHeadingStyle}>Keyboard Shortcuts</h3>
          <ShortcutsSection settings={settings} setSetting={setSetting} />
        </section>

        {/* ── Section 2: Startup Behavior ─────────────────────────────────── */}
        <section>
          <h3 style={sectionHeadingStyle}>Startup Behavior</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={settingRowStyle}>
              <div>
                <div style={labelStyle}>Launch on Windows startup</div>
                <div style={descStyle}>Start Habit Tracker automatically when you log in</div>
              </div>
              <ToggleSwitch
                checked={isOn(SETTING_KEYS.LAUNCH_ON_STARTUP)}
                onChange={() => toggleSetting(SETTING_KEYS.LAUNCH_ON_STARTUP)}
              />
            </div>

            <div style={settingRowStyle}>
              <div>
                <div style={labelStyle}>Start minimized to tray</div>
                <div style={descStyle}>Launch in the background without opening the window</div>
              </div>
              <ToggleSwitch
                checked={isOn(SETTING_KEYS.START_MINIMIZED)}
                onChange={() => toggleSetting(SETTING_KEYS.START_MINIMIZED)}
              />
            </div>

            <div style={settingRowStyle}>
              <div>
                <div style={labelStyle}>Close to tray (instead of quit)</div>
                <div style={descStyle}>Clicking X minimizes to tray rather than exiting</div>
              </div>
              <ToggleSwitch
                checked={isOn(SETTING_KEYS.CLOSE_TO_TRAY)}
                onChange={() => toggleSetting(SETTING_KEYS.CLOSE_TO_TRAY)}
              />
            </div>
          </div>
        </section>

        {/* ── Section 3: Quotes ───────────────────────────────────────────── */}
        <section>
          <h3 style={sectionHeadingStyle}>Quotes</h3>

          {/* Tab selector */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {(['Goggins', 'Hormozi'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setQuotesTab(tab)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 20,
                  border: '1px solid var(--border-subtle)',
                  backgroundColor:
                    quotesTab === tab ? 'var(--accent)' : 'transparent',
                  color: quotesTab === tab ? 'white' : 'var(--text-secondary)',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background-color 150ms',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Quote list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visibleQuotes.map((q) => {
              if (editingQuoteId === q.id && !q.bundled) {
                return (
                  <div
                    key={q.id}
                    style={{
                      padding: 12,
                      backgroundColor: 'var(--bg-surface)',
                      borderRadius: 8,
                      border: '1px solid var(--accent)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      style={{ ...inputStyle, minHeight: 72, resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
                    />
                    <input
                      value={editSource}
                      onChange={(e) => setEditSource(e.target.value)}
                      placeholder="Source"
                      style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleSaveEditQuote(q.id)}
                        style={primaryButtonStyle}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingQuoteId(null)}
                        style={ghostButtonStyle}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={q.id}
                  style={{
                    padding: '10px 14px',
                    backgroundColor: 'var(--bg-surface)',
                    borderRadius: 8,
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    opacity: q.hidden ? 0.45 : 1,
                    transition: 'opacity 150ms',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                      {q.text}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                      {q.source}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {q.bundled ? (
                      // Eye toggle for bundled quotes
                      <button
                        onClick={() => handleToggleHidden(q.id)}
                        title={q.hidden ? 'Show quote' : 'Hide quote'}
                        style={{
                          ...ghostButtonStyle,
                          padding: '4px 8px',
                        }}
                      >
                        {q.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                    ) : (
                      // Edit + Delete for custom quotes
                      <>
                        <button
                          onClick={() => startEditQuote(q)}
                          title="Edit quote"
                          style={{
                            ...ghostButtonStyle,
                            padding: '4px 8px',
                          }}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteQuote(q.id)}
                          title="Delete quote"
                          style={{
                            ...ghostButtonStyle,
                            padding: '4px 8px',
                            color: '#F87171',
                            borderColor: '#7F1D1D',
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Add new quote */}
          <div
            style={{
              marginTop: 16,
              padding: 16,
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 8,
              border: '1px solid var(--border-subtle)',
            }}
          >
            <textarea
              placeholder={`New ${quotesTab} quote...`}
              value={newQuoteText}
              onChange={(e) => setNewQuoteText(e.target.value)}
              style={{
                ...inputStyle,
                minHeight: 80,
                resize: 'vertical',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
            <input
              placeholder="Source (e.g. Can't Hurt Me, Ch. 4)"
              value={newQuoteSource}
              onChange={(e) => setNewQuoteSource(e.target.value)}
              style={{ ...inputStyle, marginTop: 8, width: '100%', boxSizing: 'border-box' }}
            />
            <button
              onClick={handleAddQuote}
              disabled={addingQuote || !newQuoteText.trim()}
              style={{ ...primaryButtonStyle, marginTop: 8, opacity: addingQuote || !newQuoteText.trim() ? 0.5 : 1 }}
            >
              {addingQuote ? 'Adding...' : 'Add Quote'}
            </button>
          </div>
        </section>

        {/* ── Section 4: OpenAI API ────────────────────────────────────────── */}
        <section>
          <h3 style={sectionHeadingStyle}>OpenAI API</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type={apiKeyVisible ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="sk-..."
                style={{ flex: 1, ...inputStyle }}
              />
              <button
                onClick={() => setApiKeyVisible((v) => !v)}
                style={ghostButtonStyle}
              >
                {apiKeyVisible ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSaveApiKey} style={primaryButtonStyle}>
                Save Key
              </button>
              <button onClick={handleTestApiKey} style={ghostButtonStyle}>
                Test Connection
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              Used for generating monthly narrative reports (GPT-4.1 mini). Key is stored locally only.
            </div>
          </div>
        </section>

        {/* ── Section 5: Data ──────────────────────────────────────────────── */}
        <section>
          <h3 style={sectionHeadingStyle}>Data</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={settingRowStyle}>
              <div>
                <div style={labelStyle}>Database Location</div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-tertiary)',
                    fontFamily: 'monospace',
                    marginTop: 4,
                    wordBreak: 'break-all',
                  }}
                >
                  {dbPath || 'Loading...'}
                </div>
              </div>
            </div>
            <button onClick={handleExport} style={{ ...primaryButtonStyle, alignSelf: 'flex-start' }}>
              Export All Data
            </button>
          </div>
        </section>

        {/* ── Section 6: About ─────────────────────────────────────────────── */}
        <section>
          <h3 style={sectionHeadingStyle}>About</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              Habit Tracker {appVersion ? `v${appVersion}` : ''}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              Built with Electron + Next.js. Your data stays local.
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  showToast('Report issues at: github.com/your-repo', 'info')
                }}
                style={{ color: 'var(--accent)', textDecoration: 'none' }}
              >
                Report an issue
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
