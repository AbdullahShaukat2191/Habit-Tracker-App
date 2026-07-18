'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import type { Goal } from '@shared/types'

interface GoalModalProps {
  mode: 'add' | 'edit'
  goal?: Goal
  onSave: (title: string, description: string) => Promise<void>
  onClose: () => void
}

export function GoalModal({ mode, goal, onSave, onClose }: GoalModalProps) {
  const [name, setName] = useState(mode === 'edit' && goal ? goal.title : '')
  const [description, setDescription] = useState(
    mode === 'edit' && goal && goal.description ? goal.description : ''
  )
  const [nameError, setNameError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const titleInputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Auto-focus title input
  useEffect(() => {
    const id = setTimeout(() => titleInputRef.current?.focus(), 50)
    return () => clearTimeout(id)
  }, [])

  // Focus trap + Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.isComposing) {
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      if (!modalRef.current) return
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      const elements = Array.from(focusable)
      if (elements.length === 0) return
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    },
    [onClose]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handleSave = useCallback(async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setNameError('Goal title is required')
      return
    }
    setSaving(true)
    setSaveError('')
    let succeeded = false
    try {
      await onSave(trimmed, description.trim())
      succeeded = true
    } catch {
      setSaveError('Failed to save. Please try again.')
      setSaving(false)
    }
    if (succeeded) {
      onClose()  // unmounts the component — don't touch state after this
    }
  }, [name, description, onSave, onClose])

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleSave()
    },
    [handleSave]
  )

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose]
  )

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
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="goal-modal-title"
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
          width: 480,
          maxWidth: '90vw',
          boxSizing: 'border-box',
        }}
      >
        <h2
          id="goal-modal-title"
          style={{
            margin: 0,
            marginBottom: 20,
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          {mode === 'add' ? 'Add Goal' : 'Edit Goal'}
        </h2>

        {/* Title field */}
        <div style={{ marginBottom: 16 }}>
          <label
            htmlFor="goal-title-input"
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
            Goal Title
          </label>
          <input
            id="goal-title-input"
            ref={titleInputRef}
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (nameError) setNameError('')
            }}
            onKeyDown={handleTitleKeyDown}
            placeholder="e.g. Finish my Computer Science degree"
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
              fontFamily: 'inherit',
            }}
            onFocus={(e) => {
              if (!nameError) e.currentTarget.style.borderColor = 'var(--border-strong)'
            }}
            onBlur={(e) => {
              if (!nameError) e.currentTarget.style.borderColor = 'var(--border-subtle)'
            }}
          />
          {nameError && (
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#f87171' }}>{nameError}</p>
          )}
        </div>

        {/* Description field */}
        <div style={{ marginBottom: 24 }}>
          <label
            htmlFor="goal-description-input"
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
            Description / Vision{' '}
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
              (optional)
            </span>
          </label>
          <textarea
            id="goal-description-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What does achieving this goal mean to you?"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 14,
              color: 'var(--text-primary)',
              outline: 'none',
              resize: 'vertical',
              transition: 'border-color 150ms',
              fontFamily: 'inherit',
              lineHeight: 1.5,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-strong)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-subtle)'
            }}
          />
        </div>

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
        {saveError && (
          <p style={{ color: '#F87171', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
            {saveError}
          </p>
        )}
      </motion.div>
    </div>
  )
}
