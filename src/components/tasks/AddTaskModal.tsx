'use client'
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import type { Project, Task, CreateTaskInput } from '@shared/types'

interface AddTaskModalProps {
  projects: Project[]
  initialTask?: Task
  onSave: (input: CreateTaskInput) => Promise<void>
  onClose: () => void
}

export function AddTaskModal({ projects, initialTask, onSave, onClose }: AddTaskModalProps) {
  const [title, setTitle] = useState(initialTask?.title ?? '')
  const [description, setDescription] = useState(initialTask?.description ?? '')
  const [projectId, setProjectId] = useState(initialTask?.projectId ?? '')
  const [titleError, setTitleError] = useState('')
  const [saving, setSaving] = useState(false)
  const [titleFocused, setTitleFocused] = useState(false)
  const [descriptionFocused, setDescriptionFocused] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [projectLastUsed, setProjectLastUsed] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem('tasks:projectLastUsed')
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  })

  const titleInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = setTimeout(() => titleInputRef.current?.focus(), 50)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.isComposing) {
        if (dropdownOpen) { setDropdownOpen(false); return }
        onClose()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, dropdownOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!dropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownOpen])

  const handleSave = useCallback(async () => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setTitleError('Task title is required')
      titleInputRef.current?.focus()
      return
    }
    setTitleError('')
    setSaving(true)
    try {
      const input: CreateTaskInput = { title: trimmedTitle }
      if (description.trim()) input.description = description.trim()
      if (projectId) input.projectId = projectId
      await onSave(input)
      onClose()
    } finally {
      setSaving(false)
    }
  }, [title, description, projectId, onSave, onClose])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose]
  )

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => (projectLastUsed[b.id] ?? 0) - (projectLastUsed[a.id] ?? 0)),
    [projects, projectLastUsed]
  )

  const selectedProject = projects.find((p) => p.id === projectId) ?? null

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: 'var(--bg-input)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 14,
    color: 'var(--text-primary)',
    outline: 'none',
    transition: 'border-color 150ms',
    fontFamily: 'inherit',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: 6,
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
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
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-task-modal-title"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
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
          id="add-task-modal-title"
          style={{ margin: 0, marginBottom: 20, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}
        >
          {initialTask ? 'Edit Task' : 'Add Task'}
        </h2>

        {/* Title */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Title</label>
          <input
            ref={titleInputRef}
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); if (titleError) setTitleError('') }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
            placeholder="What needs to be done?"
            style={{ ...inputStyle, border: `1px solid ${titleError ? '#F87171' : titleFocused ? 'var(--border-strong)' : 'var(--border-subtle)'}` }}
            onFocus={() => setTitleFocused(true)}
            onBlur={() => setTitleFocused(false)}
          />
          {titleError && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#f87171' }}>{titleError}</p>}
        </div>

        {/* Description */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>
            Description{' '}
            <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--text-tertiary)' }}>(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add details..."
            rows={3}
            style={{
              ...inputStyle,
              resize: 'vertical',
              minHeight: 80,
              border: `1px solid ${descriptionFocused ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
            }}
            onFocus={() => setDescriptionFocused(true)}
            onBlur={() => setDescriptionFocused(false)}
          />
        </div>

        {/* Project — custom dropdown with colored dots */}
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>
            Project{' '}
            <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--text-tertiary)' }}>(optional)</span>
          </label>
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            {/* Trigger */}
            <button
              type="button"
              onClick={() => setDropdownOpen((o) => !o)}
              style={{
                ...inputStyle,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                border: `1px solid ${dropdownOpen ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
                textAlign: 'left',
              }}
            >
              {selectedProject ? (
                <>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: selectedProject.color,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1 }}>{selectedProject.name}</span>
                </>
              ) : (
                <span style={{ flex: 1, color: 'var(--text-tertiary)' }}>None</span>
              )}
              <ChevronDown size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            </button>

            {/* Dropdown list */}
            {dropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  right: 0,
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 8,
                  zIndex: 10,
                  maxHeight: 220,
                  overflowY: 'auto',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}
              >
                {/* None option */}
                <button
                  type="button"
                  onClick={() => { setProjectId(''); setDropdownOpen(false) }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 14px',
                    background: projectId === '' ? 'var(--bg-surface-2)' : 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    fontSize: 14,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-surface-2)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = projectId === '' ? 'var(--bg-surface-2)' : 'transparent' }}
                >
                  None
                </button>
                {sortedProjects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setProjectId(p.id)
                      setDropdownOpen(false)
                      const now = Date.now()
                      const updated = { ...projectLastUsed, [p.id]: now }
                      setProjectLastUsed(updated)
                      try { localStorage.setItem('tasks:projectLastUsed', JSON.stringify(updated)) } catch {}
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 14px',
                      background: projectId === p.id ? 'var(--bg-surface-2)' : 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontSize: 14,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-surface-2)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = projectId === p.id ? 'var(--bg-surface-2)' : 'transparent' }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor: p.color,
                        flexShrink: 0,
                      }}
                    />
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
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
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
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
            {saving ? 'Saving...' : initialTask ? 'Save Changes' : 'Save'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
