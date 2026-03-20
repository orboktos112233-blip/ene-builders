'use client'

import { useState, useRef, useEffect } from 'react'
import { StatusBadge } from './Badge'
import { updateProjectStatusInlineAction } from '@/app/actions/projects'
import type { ProjectStatus } from '@/types/database'

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'planning',    label: 'Planning' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'finishing',   label: 'Finishing' },
  { value: 'inspection',  label: 'Inspection' },
  { value: 'completed',   label: 'Completed' },
]

interface InlineStatusSelectProps {
  projectId: string
  status: ProjectStatus
  canEdit: boolean
}

export function InlineStatusSelect({ projectId, status, canEdit }: InlineStatusSelectProps) {
  const [current, setCurrent] = useState<ProjectStatus>(status)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectRef = useRef<HTMLSelectElement>(null)

  // Sync if parent re-renders with updated status (after router.refresh)
  useEffect(() => { setCurrent(status) }, [status])

  // Auto-focus the select when it opens
  useEffect(() => {
    if (editing) selectRef.current?.focus()
  }, [editing])

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as ProjectStatus
    setEditing(false)
    if (next === current) return

    setSaving(true)
    setError(null)

    const result = await updateProjectStatusInlineAction({
      project_id: projectId,
      status: next,
    })

    setSaving(false)

    if (result.error) {
      setError(result.error)
      // Clear error after 3 s
      setTimeout(() => setError(null), 3000)
    } else {
      setCurrent(next)
    }
  }

  function handleBlur() {
    setEditing(false)
  }

  if (!canEdit) {
    return <StatusBadge status={current} />
  }

  if (saving) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-400">
        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Saving…
      </span>
    )
  }

  if (error) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5 max-w-[130px] truncate" title={error}>
        ✕ {error}
      </span>
    )
  }

  if (editing) {
    return (
      // Stop the Link row click from firing while the select is open
      <span onClick={(e) => e.preventDefault()} className="inline-block">
        <select
          ref={selectRef}
          defaultValue={current}
          onChange={handleChange}
          onBlur={handleBlur}
          className="text-xs font-semibold border border-violet-300 rounded-full px-2.5 py-0.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 cursor-pointer text-gray-700 shadow-sm"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </span>
    )
  }

  // Default: show badge with an edit affordance on hover
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); setEditing(true) }}
      className="group inline-flex items-center gap-1 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
      title="Click to change status"
    >
      <StatusBadge status={current} />
      <svg
        className="w-3 h-3 text-gray-300 group-hover:text-gray-500 transition-colors shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
      </svg>
    </button>
  )
}
