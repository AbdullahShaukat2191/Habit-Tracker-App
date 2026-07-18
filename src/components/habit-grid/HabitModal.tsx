'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Trash2 } from 'lucide-react'
import type { DayAbbreviation, Habit } from '@shared/types'

interface HabitModalProps {
  mode: 'add' | 'edit'
  habit?: Habit
  onSave: (name: string, schedule: DayAbbreviation[], isOptional: boolean) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}

const ALL_DAYS: DayAbbreviation[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const DAY_LABELS: Record<DayAbbreviation, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
}

export function HabitModal({ mode, habit, onSave, onDelete, onClose }: HabitModalProps) {
  const [name, setName] = useState(mode === 'edit' && habit ? habit.name : '')
  const [schedule, setSchedule] = useState<DayAbbreviation[]>(
    mode === 'edit' && habit ? habit.schedule : ALL_DAYS
  )
  const [isOptional, setIsOptional] = useState(
    mode === 'edit' && habit ? (habit.isOptional ?? false) : false
  )
  const [nameError, setNameError] = useState('')
  const [scheduleError, setScheduleError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const nameInputRef = useRef<HTMLInputElement>(null)

  // Auto-focus name input
  useEffect(() => {
    const id = setTimeout(() => nameInputRef.current?.focus(), 50)
    return () => clearTimeout(id)
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.isComposing) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const toggleDay = useCallback((day: DayAbbreviation) => {
    setSchedule((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }, [])

  const handleSave = useCallback(async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setNameError('Habit name is required')
      nameInputRef.current?.focus()
      return
    }
    if (schedule.length === 0) {
      setScheduleError('Please select at least one day')
      return
    }
    setNameError('')
    setScheduleError('')
    setSaving(true)
    try {
      await onSave(trimmed, schedule, isOptional)
      onClose()
    } finally {
      setSaving(false)
    }
  }, [name, schedule, isOptional, onSave, onClose])

  const handleDelete = async () => {
    if (!onDelete) return
    setDeleting(true)
    try {
      await onDelete()
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
      }}
    >
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          onClick={(e) => e.stopPropagation()}
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 12,
            border: '1px solid var(--border-subtle)',
            padding: 28,
            width: 440,
            maxWidth: '90vw',
            boxSizing: 'border-box',
          }}
        >
          {/* Title */}
          <h2
            style={{
              margin: 0,
              marginBottom: 20,
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {mode === 'add' ? 'Add Habit' : 'Edit Habit'}
          </h2>

          {/* Habit name input */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: 'block',
                marginBottom: 6,
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Habit Name
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (nameError) setNameError('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave()
              }}
              placeholder="e.g. Pray Fajr"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                backgroundColor: 'var(--bg-input)',
                border: `1px solid ${nameError ? '#f87171' : 'var(--border-subtle)'}`,
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 14,
                color: 'var(--text-primary)',
                outline: 'none',
                transition: 'border-color 150ms',
              }}
              onFocus={(e) => {
                if (!nameError)
                  e.currentTarget.style.borderColor = 'var(--border-strong)'
              }}
              onBlur={(e) => {
                if (!nameError)
                  e.currentTarget.style.borderColor = 'var(--border-subtle)'
              }}
            />
            {nameError && (
              <p
                style={{
                  margin: '6px 0 0',
                  fontSize: 12,
                  color: '#f87171',
                }}
              >
                {nameError}
              </p>
            )}
          </div>

          {/* Schedule pills */}
          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: 'block',
                marginBottom: 8,
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Schedule
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ALL_DAYS.map((day) => {
                const selected = schedule.includes(day)
                return (
                  <button
                    key={day}
                    onClick={() => {
                      toggleDay(day)
                      if (scheduleError) setScheduleError('')
                    }}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                      border: selected
                        ? '1px solid transparent'
                        : '1px solid var(--border-subtle)',
                      backgroundColor: selected ? 'var(--accent)' : 'var(--bg-surface-2)',
                      color: selected ? '#ffffff' : 'var(--text-secondary)',
                      transition: 'background-color 150ms, color 150ms, border-color 150ms',
                    }}
                  >
                    {DAY_LABELS[day]}
                  </button>
                )
              })}
            </div>
            {scheduleError && (
              <p
                style={{
                  margin: '6px 0 0',
                  fontSize: 12,
                  color: '#f87171',
                }}
              >
                {scheduleError}
              </p>
            )}
          </div>

          {/* Optional toggle */}
          <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>Optional</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                Won't count against Perfect Day if missed
              </div>
            </div>
            <div
              role="switch"
              aria-checked={isOptional}
              tabIndex={0}
              onClick={() => setIsOptional((v) => !v)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setIsOptional((v) => !v) }
              }}
              style={{
                width: 44, height: 24, borderRadius: 12, flexShrink: 0,
                backgroundColor: isOptional ? 'var(--accent)' : 'var(--bg-surface-2)',
                border: '1px solid var(--border-subtle)', cursor: 'pointer',
                transition: 'background-color 200ms', position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute', top: 3, left: isOptional ? 22 : 3,
                  width: 16, height: 16, borderRadius: '50%',
                  backgroundColor: 'white', transition: 'left 200ms',
                }}
              />
            </div>
          </div>

          {/* Delete section (edit mode only) */}
          {mode === 'edit' && onDelete && (
            <div
              style={{
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: 16,
                marginBottom: 20,
              }}
            >
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  aria-label="Delete habit"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'none',
                    border: 'none',
                    padding: '4px 0',
                    fontSize: 14,
                    color: '#EF4444',
                    cursor: 'pointer',
                    transition: 'opacity 150ms',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7' }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                >
                  <Trash2 size={14} />
                  Delete habit
                </button>
              ) : (
                <div>
                  <p
                    style={{
                      margin: '0 0 12px',
                      fontSize: 14,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Are you sure? This will remove the habit and all its history.
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 8,
                        border: 'none',
                        backgroundColor: '#ef4444',
                        color: '#ffffff',
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: deleting ? 'not-allowed' : 'pointer',
                        opacity: deleting ? 0.7 : 1,
                        transition: 'opacity 150ms',
                      }}
                    >
                      {deleting ? 'Deleting...' : 'Delete'}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 8,
                        border: '1px solid var(--border-subtle)',
                        backgroundColor: 'transparent',
                        color: 'var(--text-secondary)',
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'border-color 150ms, color 150ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-strong)'
                e.currentTarget.style.color = 'var(--text-primary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)'
                e.currentTarget.style.color = 'var(--text-secondary)'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                backgroundColor: 'var(--accent)',
                color: '#ffffff',
                fontSize: 14,
                fontWeight: 500,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
                transition: 'opacity 150ms',
              }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </motion.div>
    </div>
  )
}
