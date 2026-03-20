'use client'

import { useState, useRef, useEffect } from 'react'
import { updateProjectStartDateAction } from '@/app/actions/projects'

function formatDateCompact(iso: string | null): string {
  if (!iso) return '—'
  // Parse as local date to avoid UTC-offset day shift
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

interface InlineStartDateEditProps {
  projectId: string
  startDate: string | null   // YYYY-MM-DD or null
  canEdit: boolean
}

export function InlineStartDateEdit({ projectId, startDate, canEdit }: InlineStartDateEditProps) {
  const [current, setCurrent] = useState<string | null>(startDate)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string>(startDate ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const savedRef = useRef(current)

  useEffect(() => { setCurrent(startDate); setDraft(startDate ?? ''); savedRef.current = startDate }, [startDate])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  async function save(value: string) {
    const next = value === '' ? null : value
    if (next === savedRef.current) { setEditing(false); return }

    setSaving(true)
    setEditing(false)
    setError(null)

    const result = await updateProjectStartDateAction({
      project_id: projectId,
      start_date: next,
    })

    setSaving(false)

    if (result.error) {
      setError(result.error)
      setTimeout(() => setError(null), 3000)
    } else {
      setCurrent(next)
      savedRef.current = next
    }
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    save(e.target.value)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') save(draft)
    if (e.key === 'Escape') { setEditing(false); setDraft(current ?? '') }
  }

  // Read-only view
  if (!canEdit) {
    return (
      <p className="text-xs text-gray-600 font-medium text-right">{formatDateCompact(current)}</p>
    )
  }

  if (saving) {
    return (
      <span className="text-xs text-gray-400 font-medium inline-flex items-center gap-1">
        <svg className="w-3 h-3 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Saving…
      </span>
    )
  }

  if (error) {
    return (
      <span className="text-[10px] text-red-500 font-semibold truncate max-w-[88px] block" title={error}>
        ✕ {error}
      </span>
    )
  }

  if (editing) {
    return (
      // Stop the surrounding Link from navigating while the input is open
      <span onClick={(e) => e.preventDefault()}>
        <input
          ref={inputRef}
          type="date"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="text-xs border border-violet-300 rounded-lg px-1.5 py-0.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 w-[120px] text-gray-700 shadow-sm"
        />
      </span>
    )
  }

  // Editable idle state
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); setEditing(true) }}
      className="group flex items-center gap-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 w-full justify-end"
      title="Click to edit start date"
    >
      <span className="text-xs text-gray-600 font-medium group-hover:text-violet-600 transition-colors">
        {formatDateCompact(current)}
      </span>
      <svg
        className="w-3 h-3 text-gray-300 group-hover:text-violet-400 transition-colors shrink-0"
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
