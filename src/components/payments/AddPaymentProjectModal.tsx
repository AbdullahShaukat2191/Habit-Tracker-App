'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import type { Project, CreatePaymentProjectInput } from '@shared/types'

const PRESET_COLORS = [
  '#E879B9', '#A78BFA', '#34D399', '#60A5FA',
  '#FBBF24', '#F87171', '#86EFAC', '#818CF8',
] as const

interface AddPaymentProjectModalProps {
  importableProjects: Project[]
  onCreate: (input: CreatePaymentProjectInput) => Promise<void>
  onImport: (projectIds: string[]) => Promise<void>
  onClose: () => void
}

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

export function AddPaymentProjectModal({ importableProjects, onCreate, onImport, onClose }: AddPaymentProjectModalProps) {
  const [mode, setMode] = useState<'create' | 'import'>('create')
  const [name, setName] = useState('')
  const [selectedColor, setSelectedColor] = useState<string>(PRESET_COLORS[0])
  const [totalAmount, setTotalAmount] = useState('')
  const [developer, setDeveloper] = useState('')
  const [nameError, setNameError] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const nameInputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (mode !== 'create') return
    const id = setTimeout(() => nameInputRef.current?.focus(), 50)
    return () => clearTimeout(id)
  }, [mode])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.isComposing) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose]
  )

  const handleCreate = useCallback(async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setNameError('Project name is required')
      nameInputRef.current?.focus()
      return
    }
    setNameError('')
    setSaving(true)
    try {
      const input: CreatePaymentProjectInput = { name: trimmed, color: selectedColor }
      const parsedTotal = parseFloat(totalAmount)
      if (!isNaN(parsedTotal)) input.totalAmount = parsedTotal
      if (developer.trim()) input.developer = developer.trim()
      await onCreate(input)
      onClose()
    } finally {
      setSaving(false)
    }
  }, [name, selectedColor, totalAmount, developer, onCreate, onClose])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleImportClick = useCallback(async () => {
    if (selectedIds.size === 0) return
    setSaving(true)
    try {
      await onImport(Array.from(selectedIds))
      onClose()
    } finally {
      setSaving(false)
    }
  }, [selectedIds, onImport, onClose])

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
        aria-labelledby="add-payment-project-title"
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
          <h2 id="add-payment-project-title" style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
            {mode === 'create' ? 'Add Payment Project' : 'Import from Projects'}
          </h2>
          {mode === 'create' ? (
            <button
              onClick={() => setMode('import')}
              style={{
                padding: '7px 16px',
                borderRadius: 8,
                border: '1px solid var(--accent)',
                backgroundColor: 'transparent',
                color: 'var(--accent)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'background-color 150ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-soft)' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              Import from Projects
            </button>
          ) : (
            <button
              onClick={() => setMode('create')}
              style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
            >
              &larr; Back
            </button>
          )}
        </div>

        {mode === 'create' ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="pp-name-input" style={labelStyle}>Project Name</label>
              <input
                id="pp-name-input"
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); if (nameError) setNameError('') }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
                placeholder="e.g. Client Website Redesign"
                style={{ ...inputStyle, border: `1px solid ${nameError ? '#f87171' : 'var(--border-subtle)'}` }}
              />
              {nameError && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#f87171' }}>{nameError}</p>}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Color</label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    aria-label={color}
                    aria-pressed={selectedColor === color}
                    onClick={() => setSelectedColor(color)}
                    title={color}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      backgroundColor: color,
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      flexShrink: 0,
                      outline: selectedColor === color ? '3px solid white' : 'none',
                      outlineOffset: selectedColor === color ? 2 : 0,
                      transition: 'outline 100ms',
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label htmlFor="pp-total-input" style={labelStyle}>Total Amount</label>
                <input
                  id="pp-total-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="0.00"
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor="pp-dev-input" style={labelStyle}>
                  Developer <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--text-tertiary)' }}>(optional)</span>
                </label>
                <input
                  id="pp-dev-input"
                  type="text"
                  value={developer}
                  onChange={(e) => setDeveloper(e.target.value)}
                  placeholder="Assigned to..."
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button
                onClick={onClose}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)',
                  backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: 14,
                  fontWeight: 500, cursor: 'pointer', transition: 'border-color 150ms, color 150ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none', backgroundColor: 'var(--accent)',
                  color: '#ffffff', fontSize: 14, fontWeight: 500,
                  cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, transition: 'opacity 150ms',
                }}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </>
        ) : (
          <>
            {importableProjects.length === 0 ? (
              <p style={{ color: 'var(--text-tertiary)', fontSize: 14, margin: '0 0 20px' }}>
                All your projects are already imported.
              </p>
            ) : (
              <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
                {importableProjects.map((p) => (
                  <label
                    key={p.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8,
                      cursor: 'pointer', backgroundColor: selectedIds.has(p.id) ? 'var(--bg-surface-2)' : 'transparent',
                    }}
                  >
                    <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} />
                    <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: p.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{p.name}</span>
                  </label>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={onClose}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)',
                  backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: 14,
                  fontWeight: 500, cursor: 'pointer', transition: 'border-color 150ms, color 150ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleImportClick}
                disabled={saving || selectedIds.size === 0}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none', backgroundColor: 'var(--accent)',
                  color: '#ffffff', fontSize: 14, fontWeight: 500,
                  cursor: (saving || selectedIds.size === 0) ? 'not-allowed' : 'pointer',
                  opacity: (saving || selectedIds.size === 0) ? 0.6 : 1, transition: 'opacity 150ms',
                }}
              >
                {saving ? 'Importing...' : `Import Selected (${selectedIds.size})`}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}
