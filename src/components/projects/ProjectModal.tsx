'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import type { Project } from '@shared/types'

const PRESET_COLORS = [
  '#E879B9', // pink (accent)
  '#A78BFA', // lavender
  '#34D399', // mint
  '#60A5FA', // soft blue
  '#FBBF24', // gold
  '#F87171', // coral
  '#86EFAC', // sage
  '#818CF8', // periwinkle
] as const

const COLOR_NAMES: Record<string, string> = {
  '#E879B9': 'Pink',
  '#A78BFA': 'Lavender',
  '#34D399': 'Mint',
  '#60A5FA': 'Blue',
  '#FBBF24': 'Gold',
  '#F87171': 'Coral',
  '#86EFAC': 'Sage',
  '#818CF8': 'Periwinkle',
}

interface ProjectModalProps {
  mode: 'add' | 'edit'
  project?: Project
  onSave: (name: string, color: string) => Promise<void>
  onClose: () => void
}

export function ProjectModal({ mode, project, onSave, onClose }: ProjectModalProps) {
  const [name, setName] = useState(mode === 'edit' && project ? project.name : '')
  const [selectedColor, setSelectedColor] = useState<string>(() => {
    if (mode === 'edit' && project) {
      return project.color
    }
    return PRESET_COLORS[0]
  })
  const [nameError, setNameError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const nameInputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Auto-focus name input
  useEffect(() => {
    const id = setTimeout(() => nameInputRef.current?.focus(), 50)
    return () => clearTimeout(id)
  }, [])

  // Focus trap + Escape handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
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
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handleSave = useCallback(async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setNameError('Project name is required')
      nameInputRef.current?.focus()
      return
    }
    setNameError('')
    setSaving(true)
    setSaveError('')
    try {
      await onSave(trimmed, selectedColor)
      onClose()
    } catch {
      setSaveError('Failed to save project. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [name, selectedColor, onSave, onClose])

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
        aria-labelledby="project-modal-title"
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
          width: 400,
          maxWidth: '90vw',
          boxSizing: 'border-box',
        }}
      >
        {/* Title */}
        <h2
          id="project-modal-title"
          style={{
            margin: 0,
            marginBottom: 20,
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          {mode === 'add' ? 'Add Project' : 'Edit Project'}
        </h2>

        {/* Name field */}
        <div style={{ marginBottom: 20 }}>
          <label
            htmlFor="project-name-input"
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
            Project Name
          </label>
          <input
            id="project-name-input"
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
            placeholder="e.g. Torgy.ai"
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
              if (!nameError)
                e.currentTarget.style.borderColor = 'var(--border-strong)'
            }}
            onBlur={(e) => {
              if (!nameError)
                e.currentTarget.style.borderColor = 'var(--border-subtle)'
            }}
          />
          {nameError && (
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#f87171' }}>
              {nameError}
            </p>
          )}
        </div>

        {/* Color picker */}
        <div style={{ marginBottom: 24 }}>
          <label
            id="project-color-label"
            style={{
              display: 'block',
              marginBottom: 10,
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Color
          </label>
          <div
            role="group"
            aria-labelledby="project-color-label"
            style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}
          >
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                aria-label={COLOR_NAMES[color] ?? color}
                aria-pressed={selectedColor === color}
                onClick={() => setSelectedColor(color)}
                title={color}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  backgroundColor: color,
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  flexShrink: 0,
                  outline: selectedColor === color ? '3px solid white' : 'none',
                  outlineOffset: selectedColor === color ? 2 : 0,
                  transition: 'outline 100ms',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {selectedColor === color && (
                  <span style={{ color: 'rgba(0,0,0,0.6)', fontSize: 14, fontWeight: 700, lineHeight: 1 }}>
                    ✓
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Custom color picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <label
              htmlFor="custom-color-picker"
              style={{ fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}
            >
              Custom
            </label>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  backgroundColor: selectedColor,
                  border: !PRESET_COLORS.includes(selectedColor as typeof PRESET_COLORS[number])
                    ? '3px solid white'
                    : '1px solid var(--border-subtle)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                }}
              >
                <input
                  id="custom-color-picker"
                  type="color"
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  title="Pick a custom color"
                  style={{
                    opacity: 0,
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    cursor: 'pointer',
                    border: 'none',
                    padding: 0,
                  }}
                />
              </div>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
              {selectedColor}
            </span>
          </div>
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
