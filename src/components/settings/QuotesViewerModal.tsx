'use client'
import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { X, Eye, EyeOff, Pencil, Trash2 } from 'lucide-react'
import type { Quote } from '@shared/types'
import { updateQuote, deleteQuote, toggleQuoteHidden, listQuotes } from '@/lib/ipc'

interface QuotesViewerModalProps {
  quotes: Quote[]
  onClose: () => void
  onQuotesChanged: (quotes: Quote[]) => void
  // When provided, the modal doubles as a picker: clicking a row selects that
  // quote instead of just browsing/managing the list.
  onSelect?: (quote: Quote) => void
}

export function QuotesViewerModal({ quotes, onClose, onQuotesChanged, onSelect }: QuotesViewerModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editAuthor, setEditAuthor] = useState('')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const sorted = useMemo(
    () => [...quotes].sort((a, b) => a.author.localeCompare(b.author) || a.text.localeCompare(b.text)),
    [quotes]
  )

  const refresh = useCallback(async () => {
    const updated = await listQuotes()
    onQuotesChanged(updated)
  }, [onQuotesChanged])

  const startEdit = useCallback((q: Quote) => {
    setEditingId(q.id)
    setEditText(q.text)
    setEditAuthor(q.author)
  }, [])

  const saveEdit = useCallback(
    async (id: string) => {
      await updateQuote(id, { text: editText.trim(), author: editAuthor.trim() }).catch(() => {})
      setEditingId(null)
      await refresh()
    },
    [editText, editAuthor, refresh]
  )

  const handleToggleHidden = useCallback(
    async (id: string) => {
      await toggleQuoteHidden(id).catch(() => {})
      await refresh()
    },
    [refresh]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteQuote(id).catch(() => {})
      await refresh()
    },
    [refresh]
  )

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 24,
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15 }}
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          width: '100%',
          maxWidth: 860,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 22px',
            borderBottom: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
              {onSelect ? 'Choose a Quote' : 'All Saved Quotes'}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
              {onSelect
                ? 'Click a row to display it here instead.'
                : `${sorted.length} quote${sorted.length !== 1 ? 's' : ''} — every quote used across habits, tasks, goals, and notifications`}
            </p>
          </div>
          <button
            onClick={onClose}
            title="Close"
            style={{
              padding: 6,
              borderRadius: 8,
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr
                style={{
                  position: 'sticky',
                  top: 0,
                  backgroundColor: 'var(--bg-surface)',
                  zIndex: 1,
                }}
              >
                <th style={headerCellStyle}>Quote</th>
                <th style={{ ...headerCellStyle, width: 160 }}>Author</th>
                <th style={{ ...headerCellStyle, width: 90 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((q) => {
                const isEditing = editingId === q.id && !q.bundled
                const selectable = Boolean(onSelect) && !isEditing
                return (
                  <tr
                    key={q.id}
                    onClick={() => { if (selectable) onSelect!(q) }}
                    style={{
                      opacity: q.hidden ? 0.5 : 1,
                      cursor: selectable ? 'pointer' : 'default',
                      transition: 'background-color 100ms',
                    }}
                    onMouseEnter={(e) => { if (selectable) e.currentTarget.style.backgroundColor = 'var(--bg-surface-2)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                  >
                    <td style={{ ...cellStyle, lineHeight: 1.5 }}>
                      {isEditing ? (
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          style={{ ...editInputStyle, minHeight: 56, resize: 'vertical' }}
                        />
                      ) : (
                        <span style={{ fontStyle: 'italic' }}>
                          "{q.text}"
                          {q.hidden && (
                            <span style={{ marginLeft: 8, fontSize: 10, fontStyle: 'normal', color: 'var(--text-tertiary)' }}>
                              (hidden)
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td style={cellStyle}>
                      {isEditing ? (
                        <input
                          value={editAuthor}
                          onChange={(e) => setEditAuthor(e.target.value)}
                          style={editInputStyle}
                        />
                      ) : (
                        q.author
                      )}
                    </td>
                    <td style={cellStyle} onClick={(e) => e.stopPropagation()}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => saveEdit(q.id)} title="Save" style={actionButtonStyle}>
                            Save
                          </button>
                          <button onClick={() => setEditingId(null)} title="Cancel" style={actionButtonStyle}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 6 }}>
                          {q.bundled ? (
                            <button
                              onClick={() => handleToggleHidden(q.id)}
                              title={q.hidden ? 'Show quote' : 'Hide quote'}
                              style={{ ...actionButtonStyle, padding: '4px 6px' }}
                            >
                              {q.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(q)}
                                title="Edit quote"
                                style={{ ...actionButtonStyle, padding: '4px 6px' }}
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(q.id)}
                                title="Delete quote"
                                style={{ ...actionButtonStyle, padding: '4px 6px', color: '#F87171', borderColor: '#7F1D1D' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ ...cellStyle, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    No quotes saved yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  )
}

const headerCellStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 22px',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  color: 'var(--text-tertiary)',
  borderBottom: '1px solid var(--border-subtle)',
}

const cellStyle: React.CSSProperties = {
  padding: '12px 22px',
  fontSize: 13,
  color: 'var(--text-primary)',
  borderBottom: '1px solid var(--border-subtle)',
  verticalAlign: 'top',
}

const editInputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  backgroundColor: 'var(--bg-input)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 6,
  padding: '6px 8px',
  color: 'var(--text-primary)',
  fontSize: 13,
  outline: 'none',
}

const actionButtonStyle: React.CSSProperties = {
  padding: '4px 8px',
  borderRadius: 6,
  border: '1px solid var(--border-subtle)',
  backgroundColor: 'transparent',
  color: 'var(--text-secondary)',
  fontSize: 12,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
}
