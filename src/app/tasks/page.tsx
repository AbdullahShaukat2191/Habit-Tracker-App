'use client'
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { format, isYesterday } from 'date-fns'
import type { Quote, CreateTaskInput, Task } from '@shared/types'
import { useTaskStore } from '@/lib/store/taskStore'
import { useProjectStore } from '@/lib/store/projectStore'
import { listQuotes } from '@/lib/ipc'
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import TaskCard from '@/components/tasks/TaskCard'
import { AddTaskModal } from '@/components/tasks/AddTaskModal'
import { AllTasksDoneDialog } from '@/components/tasks/AllTasksDoneDialog'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { PageQuote } from '@/components/layout/PageQuote'

function buildGroupLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  if (isYesterday(date)) return 'Yesterday — ' + format(date, 'EEE MMM d')
  return format(date, 'EEE MMM d')
}

type DeletePending = { taskId: string; action: () => Promise<void> } | null

type SortOrder = 'asc' | 'desc' | 'projects'

export default function TasksPage() {
  const [activeTab, setActiveTab] = useState<'today' | 'optional' | 'completed'>('today')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [randomQuote, setRandomQuote] = useState<Quote | null>(null)
  const [showAllDoneDialog, setShowAllDoneDialog] = useState(false)
  const [deletePending, setDeletePending] = useState<DeletePending>(null)
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    try {
      const v = localStorage.getItem('tasks:sortOrder')
      return (v === 'asc' || v === 'desc' || v === 'projects') ? v : 'asc'
    } catch { return 'asc' }
  })
  const [groupByDate, setGroupByDate] = useState(() => {
    try { return localStorage.getItem('tasks:groupByDate') === '1' } catch { return false }
  })
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false)
  const sortDropdownRef = useRef<HTMLDivElement>(null)
  const hasShownDialogRef = useRef(false)
  const [manualOrder, setManualOrder] = useState<string[] | null>(null)
  const todayTasksRef = useRef<Task[]>([])

  const { tasks, loadTasks, createTask, updateTask, completeTask, uncompleteTask, deleteTask, hardDeleteTask } = useTaskStore()
  const { projects, loadProjects } = useProjectStore()

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [])
  const dateHeading = useMemo(() => `Current Tasks — ${format(new Date(), 'EEEE, MMMM d, yyyy')}`, [])

  useEffect(() => {
    loadTasks()
    loadProjects()
    listQuotes()
      .then((q) => {
        const visible = q.filter((x) => !x.hidden)
        setQuotes(visible)
        if (visible.length > 0) setRandomQuote(visible[Math.floor(Math.random() * visible.length)])
      })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])

  // Active task counts per project — split by optional vs non-optional (for sort + header display)
  const activeTasksByProject = useMemo(() => {
    const count = new Map<string | null, number>()
    tasks
      .filter((t) => t.completedAt === null && t.archivedAt === null)
      .forEach((t) => count.set(t.projectId, (count.get(t.projectId) ?? 0) + 1))
    return count
  }, [tasks])

  const activeNonOptionalByProject = useMemo(() => {
    const count = new Map<string | null, number>()
    tasks
      .filter((t) => t.completedAt === null && t.archivedAt === null && !t.isOptional)
      .forEach((t) => count.set(t.projectId, (count.get(t.projectId) ?? 0) + 1))
    return count
  }, [tasks])

  const activeOptionalByProject = useMemo(() => {
    const count = new Map<string | null, number>()
    tasks
      .filter((t) => t.completedAt === null && t.archivedAt === null && t.isOptional)
      .forEach((t) => count.set(t.projectId, (count.get(t.projectId) ?? 0) + 1))
    return count
  }, [tasks])

  const optionalTasks = useMemo(() => {
    const filtered = tasks.filter((t) => t.isOptional && t.completedAt === null && t.archivedAt === null)
    if (sortOrder === 'projects') {
      return [...filtered].sort((a, b) => {
        if (a.projectId === null && b.projectId !== null) return 1
        if (a.projectId !== null && b.projectId === null) return -1
        const ac = activeTasksByProject.get(a.projectId) ?? 0
        const bc = activeTasksByProject.get(b.projectId) ?? 0
        if (bc !== ac) return bc - ac
        if (a.projectId !== b.projectId) return (a.projectId ?? '').localeCompare(b.projectId ?? '')
        return a.createdAt - b.createdAt
      })
    }
    return filtered.sort((a, b) => sortOrder === 'asc' ? a.createdAt - b.createdAt : b.createdAt - a.createdAt)
  }, [tasks, sortOrder, activeTasksByProject])

  const todayTasks = useMemo(() => {
    const filtered = tasks.filter((t) => {
      if (t.archivedAt !== null) return false
      if (t.completedAt !== null) return format(new Date(t.completedAt), 'yyyy-MM-dd') === todayStr
      return !t.isOptional
    })
    if (sortOrder === 'projects') {
      // Project grouping is the primary key — so Group on/off shows identical task order, headers just appear/disappear
      return [...filtered].sort((a, b) => {
        if (a.projectId === null && b.projectId !== null) return 1
        if (a.projectId !== null && b.projectId === null) return -1
        const ac = activeTasksByProject.get(a.projectId) ?? 0
        const bc = activeTasksByProject.get(b.projectId) ?? 0
        if (bc !== ac) return bc - ac
        if (a.projectId !== b.projectId) return (a.projectId ?? '').localeCompare(b.projectId ?? '')
        // Within same project: incomplete before complete, then by creation date
        const aComp = a.completedAt !== null
        const bComp = b.completedAt !== null
        if (aComp !== bComp) return aComp ? 1 : -1
        return a.createdAt - b.createdAt
      })
    }
    return filtered.sort((a, b) => {
      const aComplete = a.completedAt !== null
      const bComplete = b.completedAt !== null
      if (aComplete !== bComplete) return aComplete ? 1 : -1
      const diff = a.createdAt - b.createdAt
      return sortOrder === 'asc' ? diff : -diff
    })
  }, [tasks, todayStr, sortOrder, activeTasksByProject])

  useEffect(() => { todayTasksRef.current = todayTasks }, [todayTasks])
  useEffect(() => {
    try { localStorage.setItem('tasks:groupByDate', groupByDate ? '1' : '0') } catch {}
  }, [groupByDate])
  useEffect(() => {
    try { localStorage.setItem('tasks:sortOrder', sortOrder) } catch {}
  }, [sortOrder])

  useEffect(() => {
    if (!sortDropdownOpen) return
    const handle = (e: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) {
        setSortDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [sortDropdownOpen])

  const orderedTodayTasks = useMemo(() => {
    if (manualOrder === null || groupByDate || sortOrder === 'projects') return todayTasks
    const incomplete = todayTasks.filter((t) => t.completedAt === null)
    const completed = todayTasks.filter((t) => t.completedAt !== null)
    const orderMap = new Map(manualOrder.map((id, i) => [id, i]))
    const sorted = [...incomplete].sort((a, b) => {
      const ai = orderMap.get(a.id) ?? 999999
      const bi = orderMap.get(b.id) ?? 999999
      return ai - bi
    })
    return [...sorted, ...completed]
  }, [todayTasks, manualOrder, groupByDate])

  useEffect(() => {
    if (todayTasks.length > 0 && todayTasks.every((t) => t.completedAt !== null) && !hasShownDialogRef.current) {
      hasShownDialogRef.current = true
      setShowAllDoneDialog(true)
    }
    if (todayTasks.some((t) => t.completedAt === null)) {
      hasShownDialogRef.current = false
    }
  }, [todayTasks])

  useEffect(() => {
    const handleOpenAdd = () => setShowAddModal(true)
    window.addEventListener('open-add-modal', handleOpenAdd)
    return () => window.removeEventListener('open-add-modal', handleOpenAdd)
  }, [])

  const completedGroups = useMemo(() => {
    const filtered = tasks.filter((t) => {
      if (t.completedAt === null) return false
      const completedDate = format(new Date(t.completedAt as number), 'yyyy-MM-dd')
      if (completedDate === todayStr && t.archivedAt === null) return false
      return true
    })
    const groups = new Map<string, Task[]>()
    for (const t of filtered) {
      const key = format(new Date(t.completedAt as number), 'yyyy-MM-dd')
      const existing = groups.get(key)
      if (existing) existing.push(t)
      else groups.set(key, [t])
    }
    for (const [, groupTasks] of groups) {
      groupTasks.sort((a, b) => (b.completedAt as number) - (a.completedAt as number))
    }
    const sortedKeys = Array.from(groups.keys()).sort((a, b) => b.localeCompare(a))
    return sortedKeys.map((key) => ({ key, label: buildGroupLabel(key), tasks: groups.get(key) as Task[] }))
  }, [tasks, todayStr])

  const handleSaveTask = useCallback(async (input: CreateTaskInput) => {
    if (editingTask) { await updateTask(editingTask.id, input); setEditingTask(null) }
    else await createTask(input)
  }, [createTask, updateTask, editingTask])

  const handleEditTask = useCallback((task: Task) => { setEditingTask(task); setShowAddModal(true) }, [])
  const handleCompleteTask = useCallback(async (id: string) => { await completeTask(id) }, [completeTask])
  const handleUncompleteTask = useCallback(async (id: string) => { await uncompleteTask(id) }, [uncompleteTask])
  const handleToggleOptional = useCallback(async (id: string) => {
    const task = tasks.find((t) => t.id === id)
    if (!task) return
    await updateTask(id, { isOptional: !task.isOptional })
  }, [tasks, updateTask])

  const handleDeleteFromToday = useCallback((id: string) => { setDeletePending({ taskId: id, action: () => deleteTask(id) }) }, [deleteTask])
  const handleDeleteFromCompleted = useCallback((id: string) => { setDeletePending({ taskId: id, action: () => hardDeleteTask(id) }) }, [hardDeleteTask])
  const handleConfirmDelete = useCallback(async () => { if (!deletePending) return; await deletePending.action(); setDeletePending(null) }, [deletePending])
  const handleCancelDelete = useCallback(() => setDeletePending(null), [])

  const handleDragEnd = useCallback((activeId: string, overId: string) => {
    setManualOrder((prev) => {
      const base = prev ?? todayTasksRef.current
        .filter((t) => t.completedAt === null)
        .map((t) => t.id)
      const oldIdx = base.indexOf(activeId)
      const newIdx = base.indexOf(overId)
      if (oldIdx === -1 || newIdx === -1) return prev
      return arrayMove(base, oldIdx, newIdx)
    })
  }, [])

  const isTodayEmpty = todayTasks.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-base)', maxWidth: 1100, width: '100%', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ padding: '20px 32px 0', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{dateHeading}</h2>
          <button
            onClick={() => setShowAddModal(true)}
            style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--accent)', backgroundColor: 'transparent', color: 'var(--accent)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'background-color 150ms' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-soft)' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            + Add Task
          </button>
        </div>

        <PageQuote pageId="tasks" tabId={activeTab} />

        {/* Tabs + sort/group controls */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['today', 'completed', 'optional'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '6px 16px',
                  borderRadius: '8px 8px 0 0',
                  border: 'none',
                  backgroundColor: activeTab === tab ? 'var(--bg-surface-2)' : 'transparent',
                  color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: activeTab === tab ? 500 : 400,
                  fontSize: 14,
                  cursor: 'pointer',
                  transition: 'background-color 150ms, color 150ms',
                }}
              >
                {tab === 'today' ? 'Today' : tab === 'completed' ? 'Completed' : 'Optional'}
              </button>
            ))}
          </div>

          {/* Sort + Group controls (Today and Optional tabs) */}
          {(activeTab === 'today' || activeTab === 'optional') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 6 }}>
              {/* Sort dropdown */}
              <div ref={sortDropdownRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setSortDropdownOpen((o) => !o)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)',
                    backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
                    transition: 'border-color 150ms, color 150ms',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                >
                  {sortOrder === 'asc' ? '↑ Oldest' : sortOrder === 'desc' ? '↓ Newest' : '◈ Projects'}
                  {sortDropdownOpen ? <ChevronUp size={11} strokeWidth={2} /> : <ChevronDown size={11} strokeWidth={2} />}
                </button>
                {sortDropdownOpen && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 50,
                    backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                    borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                    minWidth: 120, overflow: 'hidden',
                  }}>
                    {(['asc', 'desc', 'projects'] as SortOrder[]).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => { setSortOrder(opt); setManualOrder(null); setSortDropdownOpen(false) }}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '7px 12px', border: 'none', cursor: 'pointer',
                          fontSize: 12, backgroundColor: sortOrder === opt ? 'var(--bg-surface-2)' : 'transparent',
                          color: sortOrder === opt ? 'var(--accent)' : 'var(--text-secondary)',
                          fontWeight: sortOrder === opt ? 500 : 400,
                        }}
                        onMouseEnter={(e) => { if (sortOrder !== opt) e.currentTarget.style.backgroundColor = 'var(--bg-surface-2)' }}
                        onMouseLeave={(e) => { if (sortOrder !== opt) e.currentTarget.style.backgroundColor = 'transparent' }}
                      >
                        {opt === 'asc' ? '↑ Oldest' : opt === 'desc' ? '↓ Newest' : '◈ Projects'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setGroupByDate((g) => !g)}
                title={groupByDate ? 'Ungroup' : 'Group by date added'}
                style={{
                  padding: '4px 10px', borderRadius: 6,
                  border: `1px solid ${groupByDate ? 'var(--accent)' : 'var(--border-subtle)'}`,
                  backgroundColor: groupByDate ? 'var(--accent-soft)' : 'transparent',
                  color: groupByDate ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: 12, cursor: 'pointer', transition: 'all 150ms',
                }}
              >
                Group
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 32px' }}>
        {activeTab === 'today' ? (
          <TodayView
            tasks={orderedTodayTasks}
            isEmpty={isTodayEmpty}
            randomQuote={randomQuote}
            projectMap={projectMap}
            groupByDate={groupByDate}
            sortOrder={sortOrder}
            activeTasksByProject={activeTasksByProject}
            activeNonOptionalByProject={activeNonOptionalByProject}
            activeOptionalByProject={activeOptionalByProject}
            onComplete={handleCompleteTask}
            onUncomplete={handleUncompleteTask}
            onDelete={handleDeleteFromToday}
            onEdit={handleEditTask}
            onAddTask={() => setShowAddModal(true)}
            onDragEnd={handleDragEnd}
            onToggleOptional={handleToggleOptional}
          />
        ) : activeTab === 'optional' ? (
          <OptionalView
            tasks={optionalTasks}
            projectMap={projectMap}
            sortOrder={sortOrder}
            groupByDate={groupByDate}
            activeTasksByProject={activeTasksByProject}
            activeNonOptionalByProject={activeNonOptionalByProject}
            activeOptionalByProject={activeOptionalByProject}
            onComplete={handleCompleteTask}
            onUncomplete={handleUncompleteTask}
            onDelete={handleDeleteFromToday}
            onEdit={handleEditTask}
            onToggleOptional={handleToggleOptional}
          />
        ) : (
          <CompletedView
            groups={completedGroups}
            projectMap={projectMap}
            onComplete={handleCompleteTask}
            onDelete={handleDeleteFromCompleted}
          />
        )}
      </div>

      {showAddModal && (
        <AddTaskModal
          projects={projects}
          initialTask={editingTask ?? undefined}
          onSave={handleSaveTask}
          onClose={() => { setShowAddModal(false); setEditingTask(null) }}
        />
      )}

      <AnimatePresence>
        {showAllDoneDialog && (
          <AllTasksDoneDialog quote={randomQuote} onClose={() => setShowAllDoneDialog(false)} />
        )}
      </AnimatePresence>

      {deletePending && (
        <ConfirmDeleteModal
          title="Delete Task?"
          message="This action cannot be undone."
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SortableTaskItem({
  task,
  project,
  onComplete,
  onUncomplete,
  onDelete,
  onEdit,
  onToggleOptional,
}: {
  task: Task
  project?: import('@shared/types').Project
  onComplete: (id: string) => void
  onUncomplete?: (id: string) => void
  onDelete: (id: string) => void
  onEdit?: (task: Task) => void
  onToggleOptional?: (id: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })

  const dragArrows = !task.completedAt ? (
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
  ) : undefined

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
      <TaskCard
        task={task}
        project={project}
        onComplete={onComplete}
        onUncomplete={onUncomplete}
        onDelete={onDelete}
        onEdit={onEdit}
        onToggleOptional={onToggleOptional}
        dragIndicator={dragArrows}
      />
    </div>
  )
}

function SortableTaskList({
  tasks,
  projectMap,
  onComplete,
  onUncomplete,
  onDelete,
  onEdit,
  onDragEnd,
  onToggleOptional,
}: {
  tasks: Task[]
  projectMap: Map<string, import('@shared/types').Project>
  onComplete: (id: string) => void
  onUncomplete: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (task: Task) => void
  onDragEnd?: (activeId: string, overId: string) => void
  onToggleOptional?: (id: string) => void
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const incompleteIds = tasks.filter((t) => t.completedAt === null).map((t) => t.id)

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      onDragEnd?.(String(active.id), String(over.id))
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={incompleteIds} strategy={verticalListSortingStrategy}>
        <div>
          {tasks.map((task) =>
            !task.completedAt ? (
              <SortableTaskItem
                key={task.id}
                task={task}
                project={task.projectId ? projectMap.get(task.projectId) : undefined}
                onComplete={onComplete}
                onUncomplete={onUncomplete}
                onDelete={onDelete}
                onEdit={onEdit}
                onToggleOptional={onToggleOptional}
              />
            ) : (
              <TaskCard
                key={task.id}
                task={task}
                project={task.projectId ? projectMap.get(task.projectId) : undefined}
                onComplete={onComplete}
                onUncomplete={onUncomplete}
                onDelete={onDelete}
                onEdit={onEdit}
              />
            )
          )}
        </div>
      </SortableContext>
    </DndContext>
  )
}

interface TodayViewProps {
  tasks: Task[]
  isEmpty: boolean
  randomQuote: Quote | null
  projectMap: Map<string, import('@shared/types').Project>
  groupByDate: boolean
  sortOrder: SortOrder
  activeTasksByProject: Map<string | null, number>
  activeNonOptionalByProject: Map<string | null, number>
  activeOptionalByProject: Map<string | null, number>
  onComplete: (id: string) => void
  onUncomplete: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (task: Task) => void
  onAddTask: () => void
  onDragEnd?: (activeId: string, overId: string) => void
  onToggleOptional?: (id: string) => void
}

function TodayView({ tasks, isEmpty, randomQuote, projectMap, groupByDate, sortOrder, activeTasksByProject, activeNonOptionalByProject, activeOptionalByProject, onComplete, onUncomplete, onDelete, onEdit, onAddTask, onDragEnd, onToggleOptional }: TodayViewProps) {
  if (isEmpty) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 300 }}>
        <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 16, padding: 40, textAlign: 'center', maxWidth: 480, width: '100%' }}>
          <p style={{ margin: 0, marginBottom: randomQuote ? 8 : 32, fontSize: 18, color: 'var(--text-primary)', lineHeight: 1.5, fontStyle: randomQuote ? 'italic' : 'normal' }}>
            {randomQuote ? `"${randomQuote.text}"` : 'Get after it.'}
          </p>
          {randomQuote && <p style={{ margin: 0, marginBottom: 32, fontSize: 14, color: 'var(--text-tertiary)' }}>— {randomQuote.author}</p>}
          <button
            onClick={onAddTask}
            style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--accent)', backgroundColor: 'transparent', color: 'var(--accent)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'background-color 150ms' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-soft)' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            Add your first task →
          </button>
        </div>
      </div>
    )
  }

  if (!groupByDate) {
    return (
      <SortableTaskList
        tasks={tasks}
        projectMap={projectMap}
        onComplete={onComplete}
        onUncomplete={onUncomplete}
        onDelete={onDelete}
        onEdit={onEdit}
        onDragEnd={sortOrder === 'projects' ? undefined : onDragEnd}
        onToggleOptional={onToggleOptional}
      />
    )
  }

  // Group by project when sort=projects — insertion order matches flat sort so Group on/off is identical
  if (sortOrder === 'projects') {
    const projectGroups = new Map<string | null, Task[]>()
    for (const t of tasks) {
      const key = t.projectId
      if (!projectGroups.has(key)) projectGroups.set(key, [])
      projectGroups.get(key)!.push(t)
    }
    return (
      <div>
        {Array.from(projectGroups.entries()).map(([projectId, groupTasks]) => {
          const project = projectId ? projectMap.get(projectId) : undefined
          const label = project ? project.name : 'No Project'
          const nonOpt = activeNonOptionalByProject.get(projectId) ?? 0
          const opt = activeOptionalByProject.get(projectId) ?? 0
          const countLabel = opt > 0
            ? `${nonOpt + opt} (${nonOpt} active · ${opt} optional)`
            : String(nonOpt || groupTasks.length)
          return (
            <div key={projectId ?? 'no-project'} style={{ marginBottom: 20 }}>
              <h3 style={{ margin: 0, marginBottom: 8, fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {label} · {countLabel}
              </h3>
              {groupTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  project={project}
                  onComplete={onComplete}
                  onUncomplete={onUncomplete}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  onToggleOptional={onToggleOptional}
                />
              ))}
            </div>
          )
        })}
      </div>
    )
  }

  // Group by creation date
  const groups = new Map<string, Task[]>()
  for (const t of tasks) {
    const key = format(new Date(t.createdAt), 'yyyy-MM-dd')
    const existing = groups.get(key)
    if (existing) existing.push(t)
    else groups.set(key, [t])
  }
  const sortedKeys = Array.from(groups.keys()).sort((a, b) =>
    sortOrder === 'asc' ? a.localeCompare(b) : b.localeCompare(a)
  )

  return (
    <div>
      {sortedKeys.map((key) => {
        const groupTasks = (groups.get(key) as Task[]).slice().sort((a, b) =>
          sortOrder === 'asc' ? a.createdAt - b.createdAt : b.createdAt - a.createdAt
        )
        return (
          <div key={key} style={{ marginBottom: 20 }}>
            <h3 style={{ margin: 0, marginBottom: 8, fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {buildGroupLabel(key)}
            </h3>
            {groupTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                project={task.projectId ? projectMap.get(task.projectId) : undefined}
                onComplete={onComplete}
                onUncomplete={onUncomplete}
                onDelete={onDelete}
                onEdit={onEdit}
                onToggleOptional={onToggleOptional}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}

interface OptionalViewProps {
  tasks: Task[]
  projectMap: Map<string, import('@shared/types').Project>
  sortOrder: SortOrder
  groupByDate: boolean
  activeTasksByProject: Map<string | null, number>
  activeNonOptionalByProject: Map<string | null, number>
  activeOptionalByProject: Map<string | null, number>
  onComplete: (id: string) => void
  onUncomplete: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (task: Task) => void
  onToggleOptional: (id: string) => void
}

function OptionalView({ tasks, projectMap, sortOrder, groupByDate, activeTasksByProject, activeNonOptionalByProject, activeOptionalByProject, onComplete, onUncomplete, onDelete, onEdit, onToggleOptional }: OptionalViewProps) {
  if (tasks.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200, color: 'var(--text-tertiary)', fontSize: 14, textAlign: 'center' }}>
        No optional tasks. Hover a task in Today and click the + circle icon to move it here.
      </div>
    )
  }

  const renderCard = (task: Task) => (
    <TaskCard
      key={task.id}
      task={task}
      project={task.projectId ? projectMap.get(task.projectId) : undefined}
      onComplete={onComplete}
      onUncomplete={onUncomplete}
      onDelete={onDelete}
      onEdit={onEdit}
      onToggleOptional={onToggleOptional}
    />
  )

  if (!groupByDate) {
    return <div>{tasks.map(renderCard)}</div>
  }

  // Group by project when sort=projects — insertion order matches flat sort
  if (sortOrder === 'projects') {
    const projectGroups = new Map<string | null, Task[]>()
    for (const t of tasks) {
      const key = t.projectId
      if (!projectGroups.has(key)) projectGroups.set(key, [])
      projectGroups.get(key)!.push(t)
    }
    return (
      <div>
        {Array.from(projectGroups.entries()).map(([projectId, groupTasks]) => {
          const project = projectId ? projectMap.get(projectId) : undefined
          const label = project ? project.name : 'No Project'
          const nonOpt = activeNonOptionalByProject.get(projectId) ?? 0
          const opt = activeOptionalByProject.get(projectId) ?? 0
          const countLabel = opt > 0
            ? `${nonOpt + opt} (${nonOpt} active · ${opt} optional)`
            : String(opt || groupTasks.length)
          return (
            <div key={projectId ?? 'no-project'} style={{ marginBottom: 20 }}>
              <h3 style={{ margin: 0, marginBottom: 8, fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {label} · {countLabel}
              </h3>
              {groupTasks.map(renderCard)}
            </div>
          )
        })}
      </div>
    )
  }

  const groups = new Map<string, Task[]>()
  for (const t of tasks) {
    const key = format(new Date(t.createdAt), 'yyyy-MM-dd')
    const existing = groups.get(key)
    if (existing) existing.push(t)
    else groups.set(key, [t])
  }
  const sortedKeys = Array.from(groups.keys()).sort((a, b) =>
    sortOrder === 'asc' ? a.localeCompare(b) : b.localeCompare(a)
  )

  return (
    <div>
      {sortedKeys.map((key) => {
        const groupTasks = (groups.get(key) as Task[]).slice().sort((a, b) =>
          sortOrder === 'asc' ? a.createdAt - b.createdAt : b.createdAt - a.createdAt
        )
        return (
          <div key={key} style={{ marginBottom: 20 }}>
            <h3 style={{ margin: 0, marginBottom: 8, fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {buildGroupLabel(key)}
            </h3>
            {groupTasks.map(renderCard)}
          </div>
        )
      })}
    </div>
  )
}

interface CompletedGroup { key: string; label: string; tasks: Task[] }
interface CompletedViewProps {
  groups: CompletedGroup[]
  projectMap: Map<string, import('@shared/types').Project>
  onComplete: (id: string) => void
  onDelete: (id: string) => void
}

function CompletedView({ groups, projectMap, onComplete, onDelete }: CompletedViewProps) {
  if (groups.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200, color: 'var(--text-tertiary)', fontSize: 14 }}>
        No completed tasks yet.
      </div>
    )
  }
  return (
    <div>
      {groups.map((group) => (
        <div key={group.key} style={{ marginBottom: 24 }}>
          <h3 style={{ margin: 0, marginBottom: 10, fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            {group.label}
          </h3>
          {group.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              project={task.projectId ? projectMap.get(task.projectId) : undefined}
              onComplete={onComplete}
              onDelete={onDelete}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
