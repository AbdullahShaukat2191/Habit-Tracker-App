'use client'
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { motion } from 'framer-motion'
import { Trash2, Pencil } from 'lucide-react'
import type { WishlistItem, CreateWishlistInput } from '@shared/types'
import { useWishlistStore } from '@/lib/store/wishlistStore'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { goalConfetti } from '@/lib/confetti'

// ─── Add/Edit Modal ───────────────────────────────────────────────────────────

interface WishlistModalProps {
  initialItem?: WishlistItem
  onSave: (input: CreateWishlistInput) => Promise<void>
  onClose: () => void
}

function WishlistModal({ initialItem, onSave, onClose }: WishlistModalProps) {
  const [title, setTitle] = useState(initialItem?.title ?? '')
  const [description, setDescription] = useState(initialItem?.description ?? '')
  const [titleError, setTitleError] = useState('')
  const [saving, setSaving] = useState(false)
  const titleRef = React.useRef<HTMLInputElement>(null)

  useEffect(() => { const t = setTimeout(() => titleRef.current?.focus(), 50); return () => clearTimeout(t) }, [])
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const handleSave = useCallback(async () => {
    const trimmed = title.trim()
    if (!trimmed) { setTitleError('Title is required'); titleRef.current?.focus(); return }
    setSaving(true)
    try {
      await onSave({ title: trimmed, description: description.trim() || undefined })
      onClose()
    } finally { setSaving(false) }
  }, [title, description, onSave, onClose])

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', backgroundColor: 'var(--bg-input)',
    border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '10px 14px',
    fontSize: 14, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 500,
    color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em',
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border-subtle)', padding: 28, width: 480, maxWidth: '90vw', boxSizing: 'border-box' }}
      >
        <h2 style={{ margin: 0, marginBottom: 20, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
          {initialItem ? 'Edit Wish' : 'Add to Wish List'}
        </h2>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>What do you want?</label>
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); if (titleError) setTitleError('') }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
            placeholder="e.g. Tokyo Ghoul Vol 6 & 7"
            style={{ ...inputStyle, border: `1px solid ${titleError ? '#F87171' : 'var(--border-subtle)'}` }}
          />
          {titleError && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#f87171' }}>{titleError}</p>}
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Note <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--text-tertiary)' }}>(optional)</span></label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Where to get it, why you want it..."
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', backgroundColor: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Saving...' : initialItem ? 'Save' : 'Add'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Wish Card ────────────────────────────────────────────────────────────────

interface WishCardProps {
  item: WishlistItem
  onComplete: (id: string) => void
  onUncomplete: (id: string) => void
  onEdit: (item: WishlistItem) => void
  onDelete: (id: string) => void
  dragIndicator?: React.ReactNode
}

function WishCard({ item, onComplete, onUncomplete, onEdit, onDelete, dragIndicator }: WishCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const wasCompletedOnMount = React.useRef(item.completedAt !== null)
  const isCompleted = item.completedAt !== null
  const shouldAnimate = isCompleted && !wasCompletedOnMount.current
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const completedToday = isCompleted && format(new Date(item.completedAt as number), 'yyyy-MM-dd') === todayStr

  const handleCheck = useCallback(() => {
    if (!isCompleted) { goalConfetti(); onComplete(item.id) }
    else if (completedToday) { onUncomplete(item.id) }
  }, [isCompleted, completedToday, onComplete, onUncomplete, item.id])

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: `1px solid ${isHovered ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
        borderRadius: 10, padding: '12px 16px', marginBottom: 8,
        display: 'flex', gap: 12, alignItems: 'flex-start', transition: 'border-color 150ms',
      }}
    >
      <div
        role="checkbox"
        aria-checked={isCompleted}
        tabIndex={0}
        onClick={handleCheck}
        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleCheck() } }}
        style={{
          width: 24, height: 24, borderRadius: '50%', flexShrink: 0, marginTop: 1,
          border: isCompleted ? 'none' : '1px solid var(--border-strong)',
          backgroundColor: isCompleted ? 'var(--accent)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: !isCompleted || completedToday ? 'pointer' : 'default',
          opacity: isCompleted && !completedToday ? 0.6 : 1,
          transition: 'background-color 150ms',
        }}
        title={completedToday ? 'Click to undo' : undefined}
      >
        {isCompleted && <span style={{ color: '#fff', fontSize: 14, fontWeight: 700, lineHeight: 1 }}>✓</span>}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <span style={{ color: isCompleted ? 'var(--text-tertiary)' : 'var(--text-primary)', fontSize: 14, fontWeight: 500 }}>
            {item.title}
          </span>
          {isCompleted && (
            <motion.div
              initial={shouldAnimate ? { scaleX: 0 } : { scaleX: 1 }}
              animate={{ scaleX: 1 }}
              transition={shouldAnimate ? { duration: 0.35, ease: 'linear' } : { duration: 0 }}
              style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1.5, backgroundColor: 'var(--text-secondary)', transformOrigin: 'left center', transform: 'translateY(-50%)' }}
            />
          )}
        </div>
        {item.description && (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.4 }}>
            {item.description}
          </p>
        )}
      </div>

      {!isCompleted && (
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(item) }}
          title="Edit" style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--text-tertiary)', opacity: isHovered ? 1 : 0, transition: 'opacity 150ms, color 150ms', display: 'flex', alignItems: 'center', alignSelf: 'center', flexShrink: 0 }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
        >
          <Pencil size={14} />
        </button>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(item.id) }}
        title="Delete" style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--text-tertiary)', opacity: isHovered ? 1 : 0, transition: 'opacity 150ms, color 150ms', display: 'flex', alignItems: 'center', alignSelf: 'center', flexShrink: 0 }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
      >
        <Trash2 size={14} />
      </button>

      {dragIndicator}
    </div>
  )
}

// ─── Sortable Wish Item ───────────────────────────────────────────────────────

function SortableWishItem({ item, onComplete, onUncomplete, onEdit, onDelete }: WishCardProps) {
  const [hovered, setHovered] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

  const dragArrows = (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: 4,
        alignSelf: 'center', pointerEvents: 'none', flexShrink: 0,
        opacity: hovered && !isDragging ? 0.5 : 0,
        transition: 'opacity 150ms',
      }}
    >
      <span style={{ fontSize: 9, color: 'var(--text-tertiary)', lineHeight: 1, display: 'block' }}>▲</span>
      <span style={{ fontSize: 9, color: 'var(--text-tertiary)', lineHeight: 1, display: 'block' }}>▼</span>
    </div>
  )

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
        opacity: isDragging ? 0.5 : 1,
        touchAction: 'none',
      }}
    >
      <WishCard
        item={item}
        onComplete={onComplete}
        onUncomplete={onUncomplete}
        onEdit={onEdit}
        onDelete={onDelete}
        dragIndicator={dragArrows}
      />
    </div>
  )
}

// ─── Wish Sortable List ───────────────────────────────────────────────────────

function WishSortableList({
  items,
  onComplete,
  onUncomplete,
  onEdit,
  onDelete,
  onDragEnd,
}: {
  items: WishlistItem[]
  onComplete: (id: string) => void
  onUncomplete: (id: string) => void
  onEdit: (item: WishlistItem) => void
  onDelete: (id: string) => void
  onDragEnd: (activeId: string, overId: string) => void
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const ids = items.map((i) => i.id)

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      onDragEnd(String(active.id), String(over.id))
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div>
          {items.map((item) => (
            <SortableWishItem
              key={item.id}
              item={item}
              onComplete={onComplete}
              onUncomplete={onUncomplete}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type DeletePending = { id: string; action: () => Promise<void> } | null

export default function WishlistPage() {
  const { items, loadItems, createItem, updateItem, completeItem, uncompleteItem, deleteItem, hardDeleteItem } = useWishlistStore()
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null)
  const [activeTab, setActiveTab] = useState<'active' | 'got'>('active')
  const [deletePending, setDeletePending] = useState<DeletePending>(null)
  const [wishOrder, setWishOrder] = useState<string[] | null>(null)
  const activeItemsRef = useRef<WishlistItem[]>([])

  useEffect(() => { loadItems() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const h = () => setShowModal(true)
    window.addEventListener('open-add-modal', h)
    return () => window.removeEventListener('open-add-modal', h)
  }, [])

  const activeItems = useMemo(() => items.filter((i) => i.completedAt === null && i.archivedAt === null), [items])
  const gotItems = useMemo(() => items.filter((i) => i.completedAt !== null), [items])

  useEffect(() => { activeItemsRef.current = activeItems }, [activeItems])

  const orderedActiveItems = useMemo(() => {
    if (wishOrder === null) return activeItems
    const orderMap = new Map(wishOrder.map((id, i) => [id, i]))
    return [...activeItems].sort((a, b) => (orderMap.get(a.id) ?? 999999) - (orderMap.get(b.id) ?? 999999))
  }, [activeItems, wishOrder])

  const handleSave = useCallback(async (input: CreateWishlistInput) => {
    if (editingItem) { await updateItem(editingItem.id, input); setEditingItem(null) }
    else await createItem(input)
  }, [createItem, updateItem, editingItem])

  const handleEdit = useCallback((item: WishlistItem) => { setEditingItem(item); setShowModal(true) }, [])

  const handleDelete = useCallback((id: string) => {
    const item = items.find((i) => i.id === id)!
    if (item.completedAt !== null) {
      setDeletePending({ id, action: () => hardDeleteItem(id) })
    } else {
      setDeletePending({ id, action: () => deleteItem(id) })
    }
  }, [items, deleteItem, hardDeleteItem])

  const handleWishDragEnd = useCallback((activeId: string, overId: string) => {
    setWishOrder((prev) => {
      const base = prev ?? activeItemsRef.current.map((i) => i.id)
      const oldIdx = base.indexOf(activeId)
      const newIdx = base.indexOf(overId)
      if (oldIdx === -1 || newIdx === -1) return prev
      return arrayMove(base, oldIdx, newIdx)
    })
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-base)', maxWidth: 1100, width: '100%', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ padding: '20px 32px 0', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Wish List</h2>
          <button
            onClick={() => setShowModal(true)}
            style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--accent)', backgroundColor: 'transparent', color: 'var(--accent)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'background-color 150ms' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-soft)' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            + Add Wish
          </button>
        </div>
        <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
          &ldquo;The goal isn&rsquo;t to be rich. The goal is to be free.&rdquo; — Alex Hormozi
        </p>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['active', 'got'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '6px 16px', borderRadius: '8px 8px 0 0', border: 'none',
                backgroundColor: activeTab === tab ? 'var(--bg-surface-2)' : 'transparent',
                color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === tab ? 500 : 400, fontSize: 14, cursor: 'pointer',
              }}
            >
              {tab === 'active' ? 'Want' : 'Got It ✓'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 32px' }}>
        {activeTab === 'active' ? (
          activeItems.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200, color: 'var(--text-tertiary)', fontSize: 14 }}>
              Nothing on your list yet — add something that'll make you smile.
            </div>
          ) : (
            <WishSortableList
              items={orderedActiveItems}
              onComplete={completeItem}
              onUncomplete={uncompleteItem}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onDragEnd={handleWishDragEnd}
            />
          )
        ) : (
          gotItems.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200, color: 'var(--text-tertiary)', fontSize: 14 }}>
              Nothing checked off yet.
            </div>
          ) : (
            <div>
              {gotItems.map((item) => (
                <WishCard
                  key={item.id}
                  item={item}
                  onComplete={completeItem}
                  onUncomplete={uncompleteItem}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )
        )}
      </div>

      {showModal && (
        <WishlistModal
          initialItem={editingItem ?? undefined}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingItem(null) }}
        />
      )}

      {deletePending && (
        <ConfirmDeleteModal
          title="Remove wish?"
          message="This cannot be undone."
          onConfirm={async () => { await deletePending.action(); setDeletePending(null) }}
          onCancel={() => setDeletePending(null)}
        />
      )}
    </div>
  )
}
