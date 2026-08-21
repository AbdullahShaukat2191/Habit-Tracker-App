'use client'
import { useState, useEffect, useCallback } from 'react'
import { Pencil } from 'lucide-react'
import type { Quote } from '@shared/types'
import { listQuotes, getAllQuoteAssignments, setQuoteAssignment } from '@/lib/ipc'
import { QuotesViewerModal } from '@/components/settings/QuotesViewerModal'

interface PageQuoteProps {
  pageId: string
  // Omit for pages with one page-wide quote; pass the active tab for pages
  // where each tab has its own assigned quote (e.g. Tasks).
  tabId?: string
}

// Shared quote block used above the tab row on every page that shows one
// (Wishlist, Long-Term Goals, Current Tasks, Finance, Projects) — one
// implementation so placement/styling/behavior can't drift between pages.
// Self-contained: given a page (+ optional tab) id, it resolves and displays
// the assigned quote, and owns the hover-to-edit picker for changing it.
export function PageQuote({ pageId, tabId = '' }: PageQuoteProps) {
  const [quote, setQuote] = useState<Quote | null>(null)
  const [allQuotes, setAllQuotes] = useState<Quote[]>([])
  const [hovered, setHovered] = useState(false)
  const [showPicker, setShowPicker] = useState(false)

  const load = useCallback(async () => {
    const [quotesList, assignments] = await Promise.all([listQuotes(), getAllQuoteAssignments()])
    setAllQuotes(quotesList)
    const assignedId = assignments[`${pageId}:${tabId}`]
    setQuote(quotesList.find((q) => q.id === assignedId && !q.hidden) ?? null)
  }, [pageId, tabId])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI) return
    load()
  }, [load])

  const handleSelect = useCallback(
    async (selected: Quote) => {
      await setQuoteAssignment(pageId, tabId, selected.id).catch(() => {})
      setQuote(selected)
      setShowPicker(false)
    },
    [pageId, tabId]
  )

  if (!quote) return null

  return (
    <div style={{ marginBottom: 10 }}>
      {/* inline-flex hugs exactly the text content's box (plus a small padded
          buffer), instead of a block/flex row spanning the full line — so
          hover and the pointer cursor only activate over the quote itself. */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          flexWrap: 'wrap',
          gap: 6,
          padding: '3px 4px',
          margin: '-3px -4px',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
          &ldquo;{quote.text}&rdquo; — {quote.author}
        </span>
        <button
          onClick={() => setShowPicker(true)}
          aria-label="Change quote"
          title="Change quote"
          style={{
            opacity: hovered ? 1 : 0,
            pointerEvents: hovered ? 'auto' : 'none',
            transition: 'opacity 120ms',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            color: 'var(--text-tertiary)',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          <Pencil size={11} />
        </button>
      </div>

      {showPicker && (
        <QuotesViewerModal
          quotes={allQuotes}
          onClose={() => setShowPicker(false)}
          onQuotesChanged={setAllQuotes}
          onSelect={handleSelect}
        />
      )}
    </div>
  )
}
