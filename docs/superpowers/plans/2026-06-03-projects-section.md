# Projects Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full Projects section UI — a page listing project cards with inline stats, an add/edit modal with a color picker, and animated inline delete confirmation.

**Architecture:** Three files: `ProjectCard.tsx` (memoized card with stats + inline delete confirm), `ProjectModal.tsx` (shared add/edit modal with preset color picker), and `projects/page.tsx` (page shell connecting stores, managing modal state, orchestrating `AnimatePresence`). The page owns all modal and delete state; cards and modal are pure presentational with callback props.

**Tech Stack:** Next.js 14 App Router, TypeScript (strict), Zustand 5, framer-motion 12, lucide-react 0.468, React 18 (useCallback, useMemo, memo)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/projects/ProjectCard.tsx` | Create | Renders one project card, task stat counts, hover border, inline delete confirm, animate-out on delete |
| `src/components/projects/ProjectModal.tsx` | Create | Add/Edit modal with name input + 8-color preset picker, framer-motion fade-in |
| `src/app/projects/page.tsx` | Replace | Page shell: header, card list, empty state, modal state, AnimatePresence |

---

## Task 1: ProjectCard component

**Files:**
- Create: `src/components/projects/ProjectCard.tsx`

- [ ] **Step 1: Create the file with full implementation**

```typescript
'use client'
import React, { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Project, Task } from '@shared/types'

interface ProjectCardProps {
  project: Project
  tasks: Task[]
  onEdit: (project: Project) => void
  onDelete: (id: string) => void
}

const ProjectCard = React.memo(function ProjectCard({
  project,
  tasks,
  onEdit,
  onDelete,
}: ProjectCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const activeCount = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.projectId === project.id &&
          t.completedAt === null &&
          t.archivedAt === null
      ).length,
    [tasks, project.id]
  )

  const completedCount = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.projectId === project.id &&
          t.completedAt !== null &&
          t.archivedAt === null
      ).length,
    [tasks, project.id]
  )

  const handleEdit = useCallback(() => {
    onEdit(project)
  }, [onEdit, project])

  const handleDeleteConfirm = useCallback(async () => {
    setDeleting(true)
    try {
      await onDelete(project.id)
    } finally {
      setDeleting(false)
    }
  }, [onDelete, project.id])

  const handleCancelDelete = useCallback(() => {
    setShowDeleteConfirm(false)
  }, [])

  return (
    <motion.div
      layout
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.2 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: `1px solid ${isHovered ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
        borderRadius: 10,
        padding: '16px 20px',
        marginBottom: 10,
        transition: 'border-color 150ms',
        overflow: 'hidden',
      }}
    >
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
        <span
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          {project.name}
        </span>
      </div>

      {/* Stats line */}
      <p
        style={{
          margin: '0 0 12px',
          fontSize: 13,
          color: 'var(--text-secondary)',
          paddingLeft: 22, // align with name (dot 12 + gap 10)
        }}
      >
        {activeCount} active task{activeCount !== 1 ? 's' : ''} · {completedCount} completed
      </p>

      {/* Action row */}
      <AnimatePresence mode="wait">
        {showDeleteConfirm ? (
          <motion.div
            key="confirm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              paddingLeft: 22,
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Delete project? Tasks will become unassigned.
            </span>
            <button
              onClick={handleCancelDelete}
              style={{
                background: 'none',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                padding: '3px 10px',
                fontSize: 13,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'border-color 150ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-strong)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteConfirm}
              disabled={deleting}
              style={{
                background: '#ef4444',
                border: 'none',
                borderRadius: 6,
                padding: '3px 10px',
                fontSize: 13,
                fontWeight: 500,
                color: '#ffffff',
                cursor: deleting ? 'not-allowed' : 'pointer',
                opacity: deleting ? 0.7 : 1,
                transition: 'opacity 150ms',
              }}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="actions"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            style={{ display: 'flex', gap: 8, paddingLeft: 22 }}
          >
            <button
              onClick={handleEdit}
              style={{
                background: 'none',
                border: 'none',
                padding: '2px 6px',
                fontSize: 13,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'color 150ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text-primary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-secondary)'
              }}
            >
              Edit
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{
                background: 'none',
                border: 'none',
                padding: '2px 6px',
                fontSize: 13,
                color: '#F87171',
                cursor: 'pointer',
                transition: 'color 150ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ef4444'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#F87171'
              }}
            >
              Delete
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
})

export default ProjectCard
```

- [ ] **Step 2: Verify the file was written correctly**

Check it exists:
```
ls src/components/projects/ProjectCard.tsx
```

---

## Task 2: ProjectModal component

**Files:**
- Create: `src/components/projects/ProjectModal.tsx`

- [ ] **Step 1: Create the file with full implementation**

```typescript
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
      return PRESET_COLORS.includes(project.color as typeof PRESET_COLORS[number])
        ? project.color
        : PRESET_COLORS[0]
    }
    return PRESET_COLORS[0]
  })
  const [nameError, setNameError] = useState('')
  const [saving, setSaving] = useState(false)

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

  const handleSave = useCallback(async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setNameError('Project name is required')
      nameInputRef.current?.focus()
      return
    }
    setNameError('')
    setSaving(true)
    try {
      await onSave(trimmed, selectedColor)
      onClose()
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
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
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
                  <span
                    style={{
                      color: 'rgba(0,0,0,0.6)',
                      fontSize: 14,
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                  >
                    ✓
                  </span>
                )}
              </button>
            ))}
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
              fontSize: 13,
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
              backgroundColor: 'var(--accent-pink)',
              color: '#ffffff',
              fontSize: 13,
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
```

- [ ] **Step 2: Verify the file was written correctly**

```
ls src/components/projects/ProjectModal.tsx
```

---

## Task 3: Projects page (full replacement)

**Files:**
- Modify: `src/app/projects/page.tsx`

- [ ] **Step 1: Replace the entire file**

```typescript
'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import type { Project } from '@shared/types'
import { useProjectStore } from '@/lib/store/projectStore'
import { useTaskStore } from '@/lib/store/taskStore'
import ProjectCard from '@/components/projects/ProjectCard'
import { ProjectModal } from '@/components/projects/ProjectModal'

type ModalState =
  | { type: 'add' }
  | { type: 'edit'; project: Project }
  | null

export default function ProjectsPage() {
  const [modalState, setModalState] = useState<ModalState>(null)

  const { projects, loadProjects, createProject, updateProject, deleteProject } =
    useProjectStore()
  const { tasks, loadTasks } = useTaskStore()

  useEffect(() => {
    loadProjects()
    loadTasks()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenAdd = useCallback(() => {
    setModalState({ type: 'add' })
  }, [])

  const handleOpenEdit = useCallback((project: Project) => {
    setModalState({ type: 'edit', project })
  }, [])

  const handleCloseModal = useCallback(() => {
    setModalState(null)
  }, [])

  const handleSave = useCallback(
    async (name: string, color: string) => {
      if (modalState?.type === 'add') {
        await createProject({ name, color })
      } else if (modalState?.type === 'edit') {
        await updateProject(modalState.project.id, { name, color })
      }
    },
    [modalState, createProject, updateProject]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteProject(id)
    },
    [deleteProject]
  )

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-base)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 32px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        <h2
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          Projects
        </h2>
        <button
          onClick={handleOpenAdd}
          style={{
            padding: '7px 16px',
            borderRadius: 8,
            border: '1px solid var(--accent-pink)',
            backgroundColor: 'transparent',
            color: 'var(--accent-pink)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background-color 150ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--accent-pink-soft)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          + Add Project
        </button>
      </div>

      {/* Card list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 32px',
        }}
      >
        {projects.length === 0 ? (
          <EmptyState onAdd={handleOpenAdd} />
        ) : (
          <AnimatePresence>
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                tasks={tasks}
                onEdit={handleOpenEdit}
                onDelete={handleDelete}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modalState && (
          <ProjectModal
            key={modalState.type === 'edit' ? modalState.project.id : 'add'}
            mode={modalState.type}
            project={modalState.type === 'edit' ? modalState.project : undefined}
            onSave={handleSave}
            onClose={handleCloseModal}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────

interface EmptyStateProps {
  onAdd: () => void
}

function EmptyState({ onAdd }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: 300,
        gap: 12,
        color: 'var(--text-tertiary)',
        fontSize: 14,
      }}
    >
      <span>No projects yet.</span>
      <button
        onClick={onAdd}
        style={{
          padding: '7px 16px',
          borderRadius: 8,
          border: '1px solid var(--accent-pink)',
          backgroundColor: 'transparent',
          color: 'var(--accent-pink)',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'background-color 150ms',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--accent-pink-soft)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent'
        }}
      >
        + Add Project
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Verify the page was written correctly**

```
ls src/app/projects/page.tsx
```

---

## Task 4: TypeScript verification

**Files:** All three files created above.

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected output: no errors (exit 0). If there are errors, fix them inline before proceeding.

Common issues to watch for:
- Missing `motion.div` exit prop — the `ProjectCard` `motion.div` must have `exit={{ opacity: 0, height: 0, marginBottom: 0 }}`
- The `PRESET_COLORS` array element access `PRESET_COLORS[0]` — TypeScript may infer `string | undefined`; use a non-null assertion or fallback: `PRESET_COLORS[0] ?? '#E879B9'`
- `onDelete` in `ProjectCard` must be typed as `(id: string) => void` not `Promise<void>` since the async work is internal to the card

Fix for `PRESET_COLORS[0]` if TypeScript complains:
```typescript
const [selectedColor, setSelectedColor] = useState<string>(() => {
  if (mode === 'edit' && project) {
    const found = PRESET_COLORS.find((c) => c === project.color)
    return found ?? PRESET_COLORS[0]
  }
  return PRESET_COLORS[0]
})
```

Fix for `onDelete` typing — in `ProjectCard` the prop type must be `(id: string) => void` because the card itself handles async internally. The page's `handleDelete` is `async (id: string) => Promise<void>` which is assignable to `(id: string) => void`.

- [ ] **Step 2: Confirm zero errors**

If `npx tsc --noEmit` exits with no output, it passed. Any red text is an error to fix.

---

## Task 5: Run existing tests

**Files:** No changes needed.

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: 14 tests pass, 0 fail. The existing tests only cover `habitLogic` (pure functions in `shared/`), so no new tests are needed. The tests should be unaffected by the UI changes.

- [ ] **Step 2: Confirm all pass**

Expected output (all green):
```
Test Suites: 1 passed, 1 total
Tests:       14 passed, 14 total
```

---

## Self-Review Checklist

These are requirements the plan must fully address — verified here before handoff:

- [x] **`npx tsc --noEmit` zero errors** — Task 4 runs this and fixes any errors
- [x] **`npm test` 14/14 pass** — Task 5 runs and expects 14/14
- [x] **ProjectCard shows correct active/completed task counts** — `useMemo` on `tasks` array in Task 1: active = `completedAt === null && archivedAt === null`, completed = `completedAt !== null && archivedAt === null`
- [x] **Delete confirmation is inline in the card** — `showDeleteConfirm` state in ProjectCard, `AnimatePresence mode="wait"` swaps the buttons row in place
- [x] **Delete animates the card out** — `motion.div` in ProjectCard with `exit={{ opacity: 0, height: 0, marginBottom: 0 }}`; wrapped in `AnimatePresence` in page.tsx
- [x] **Color picker shows 8 preset colors, selection visually clear** — Task 2: `PRESET_COLORS` array of 8, selected circle gets `outline: '3px solid white', outlineOffset: 2` plus a checkmark
- [x] **Edit modal pre-fills name + selected color** — `useState` initializer uses `project.name` and finds color in `PRESET_COLORS` (falls back to first if not found)
- [x] **AnimatePresence is in page.tsx (not inside modal component)** — Task 3: `AnimatePresence` wraps `{modalState && <ProjectModal ... />}` in page.tsx; `ProjectModal` itself only contains a bare `motion.div` with `initial/animate/exit`
- [x] **No `any` types** — All interfaces fully typed; `PRESET_COLORS` uses `as const`; no `any` appears anywhere
- [x] **`useCallback` wraps all handlers passed to child components** — `handleOpenEdit`, `handleDelete`, `handleSave`, `handleCloseModal` all wrapped in `useCallback` in page.tsx; `handleEdit`, `handleDeleteConfirm`, `handleCancelDelete` in ProjectCard also wrapped
