'use client'
import React, { useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { GripVertical } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Project } from '@shared/types'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'

interface ProjectCardProps {
  project: Project
  activeTasks: number
  completedTasks: number
  onEdit: (project: Project) => void
  onDelete: (id: string) => void
}

const ProjectCard = React.memo(function ProjectCard({
  project,
  activeTasks,
  completedTasks,
  onEdit,
  onDelete,
}: ProjectCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: project.id })

  const sortableStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : undefined,
    position: 'relative',
  }

  const handleEdit = useCallback(() => onEdit(project), [onEdit, project])
  const handleDeleteClick = useCallback(() => setShowConfirmModal(true), [])
  const handleDeleteConfirm = useCallback(async () => {
    setShowConfirmModal(false)
    await onDelete(project.id)
  }, [onDelete, project.id])

  return (
    <div
      ref={setNodeRef}
      style={sortableStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: `1px solid ${isHovered ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
          borderRadius: 10,
          padding: '14px 16px',
          marginBottom: 10,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          transition: 'border-color 150ms',
        }}
      >
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          style={{
            cursor: 'grab',
            color: 'var(--text-tertiary)',
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 150ms',
            flexShrink: 0,
            paddingTop: 2,
          }}
          aria-label="Drag to reorder"
        >
          <GripVertical size={16} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Top row: color dot + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: project.color,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
              {project.name}
            </span>
          </div>

          {/* Stats line */}
          <p style={{ margin: '0 0 10px', fontSize: 14, color: 'var(--text-secondary)', paddingLeft: 22 }}>
            {activeTasks} active task{activeTasks !== 1 ? 's' : ''} · {completedTasks} completed
          </p>

          {/* Action row */}
          <div style={{ display: 'flex', gap: 8, paddingLeft: 22 }}>
            <button
              aria-label={`Edit ${project.name}`}
              onClick={handleEdit}
              style={{
                background: 'none',
                border: 'none',
                padding: '2px 6px',
                fontSize: 14,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'color 150ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
            >
              Edit
            </button>
            <button
              aria-label={`Delete ${project.name}`}
              onClick={handleDeleteClick}
              style={{
                background: 'none',
                border: 'none',
                padding: '2px 6px',
                fontSize: 14,
                color: '#F87171',
                cursor: 'pointer',
                transition: 'color 150ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#F87171' }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {showConfirmModal && (
        <ConfirmDeleteModal
          title="Delete Project?"
          message="Tasks will become unassigned. This cannot be undone."
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowConfirmModal(false)}
        />
      )}
    </div>
  )
})

export default ProjectCard
