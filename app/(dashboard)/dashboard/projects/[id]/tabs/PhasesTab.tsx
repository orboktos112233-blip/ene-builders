'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { updatePhaseAction } from '@/app/actions/phases'
import { PHASE_ORDER, PHASE_LABELS } from '@/types/database'
import type { ConstructionPhase, PhaseName, PhaseStatus } from '@/types/database'

// ── Helpers ───────────────────────────────────────────────────

function buildRows(phases: ConstructionPhase[]) {
  const map = new Map(phases.map((p) => [p.phase_name, p]))
  return PHASE_ORDER.map((phase) => ({
    phase,
    status: (map.get(phase)?.status ?? 'not_started') as PhaseStatus,
    notes: map.get(phase)?.notes ?? null,
    startDate: map.get(phase)?.start_date ?? null,
    endDate: map.get(phase)?.end_date ?? null,
    updated_at: map.get(phase)?.updated_at ?? null,
  }))
}

function formatDateLabel(d: string | null): string {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function calcDuration(start: string | null, end: string | null): string | null {
  if (!start || !end) return null
  const ms = new Date(end + 'T00:00:00').getTime() - new Date(start + 'T00:00:00').getTime()
  const days = Math.round(ms / 86400000)
  if (days < 0) return null
  return `${days} day${days !== 1 ? 's' : ''}`
}

function buildGoogleCalendarUrl(
  phaseName: string, projectName: string,
  start: string | null, end: string | null, notes: string | null,
): string {
  const text = encodeURIComponent(`${phaseName} – ${projectName}`)
  const details = encodeURIComponent(notes ?? '')
  const startStr = (start ?? '').replace(/-/g, '')
  let endStr = ''
  if (end) {
    const d = new Date(end + 'T00:00:00')
    d.setDate(d.getDate() + 1)
    endStr = d.toISOString().slice(0, 10).replace(/-/g, '')
  }
  const dates = startStr && endStr ? `${startStr}/${endStr}` : startStr ? `${startStr}/${startStr}` : ''
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}`
}

function triggerICSDownload(
  phaseName: string, projectName: string,
  start: string | null, end: string | null, notes: string | null,
) {
  const startStr = (start ?? '').replace(/-/g, '')
  let endStr = ''
  if (end) {
    const d = new Date(end + 'T00:00:00')
    d.setDate(d.getDate() + 1)
    endStr = d.toISOString().slice(0, 10).replace(/-/g, '')
  }
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ENE Builders//Construction Progress//EN',
    'BEGIN:VEVENT',
    `DTSTART;VALUE=DATE:${startStr || endStr}`,
    `DTEND;VALUE=DATE:${endStr || startStr}`,
    `SUMMARY:${phaseName} \u2013 ${projectName}`,
    notes ? `DESCRIPTION:${notes.replace(/\n/g, '\\n')}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')
  const blob = new Blob([lines], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${phaseName.replace(/\s+/g, '-')}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

const STATUS_CONFIG: Record<PhaseStatus, { label: string; color: string }> = {
  not_started: { label: 'Not Started', color: 'text-gray-400' },
  in_progress: { label: 'In Progress', color: 'text-amber-600' },
  completed:   { label: 'Completed',   color: 'text-emerald-600' },
}

// ── Phase circle indicator ────────────────────────────────────

function PhaseCircle({ status }: { status: PhaseStatus }) {
  if (status === 'completed') {
    return (
      <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 z-10">
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>
    )
  }
  if (status === 'in_progress') {
    return (
      <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center shrink-0 z-10 ring-4 ring-amber-100">
        <div className="w-3 h-3 rounded-full bg-white" />
      </div>
    )
  }
  return (
    <div className="w-8 h-8 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center shrink-0 z-10">
      <div className="w-2 h-2 rounded-full bg-gray-300" />
    </div>
  )
}

// ── Individual phase row ──────────────────────────────────────

interface PhaseRowProps {
  phase: PhaseName
  status: PhaseStatus
  notes: string | null
  startDate: string | null
  endDate: string | null
  projectName: string
  isLast: boolean
  canEdit: boolean
  isPending: boolean
  onStatusChange: (phase: PhaseName, status: PhaseStatus) => void
  onSaveNotes: (phase: PhaseName, notes: string) => void
  onSaveDates: (phase: PhaseName, startDate: string | null, endDate: string | null) => void
}

function PhaseRow({
  phase, status, notes, startDate, endDate, projectName,
  isLast, canEdit, isPending, onStatusChange, onSaveNotes, onSaveDates,
}: PhaseRowProps) {
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState(notes ?? '')
  const [startDraft, setStartDraft] = useState(startDate ?? '')
  const [endDraft, setEndDraft] = useState(endDate ?? '')
  const isActive = status === 'in_progress'

  // Sync drafts with server-confirmed values after router.refresh().
  // Only runs when the props actually change (shallow equality), so
  // in-progress typing is never interrupted.
  useEffect(() => { setStartDraft(startDate ?? '') }, [startDate])
  useEffect(() => { setEndDraft(endDate ?? '') }, [endDate])
  const label = PHASE_LABELS[phase]

  const datesChanged = startDraft !== (startDate ?? '') || endDraft !== (endDate ?? '')
  const draftDuration = calcDuration(startDraft || null, endDraft || null)
  const savedDuration = calcDuration(startDate, endDate)
  const hasCalendarDates = !!(startDate || endDate)

  return (
    <div className="flex gap-4">
      {/* Left: circle + connector */}
      <div className="flex flex-col items-center">
        <PhaseCircle status={status} />
        {!isLast && (
          <div className={cn(
            'w-0.5 flex-1 mt-1 mb-0 min-h-[24px]',
            status === 'completed' ? 'bg-emerald-200' : 'bg-gray-200'
          )} />
        )}
      </div>

      {/* Right: content */}
      <div className={cn('flex-1 pb-6 min-w-0', isLast && 'pb-0')}>
        <div className={cn(
          'rounded-xl border px-4 py-3 transition-all duration-200',
          isActive
            ? 'border-amber-200 bg-amber-50/60 shadow-sm'
            : status === 'completed'
            ? 'border-emerald-100 bg-emerald-50/30'
            : 'border-gray-200 bg-white'
        )}>
          {/* Header */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <h3 className={cn(
                'text-sm font-semibold',
                isActive ? 'text-amber-800' :
                status === 'completed' ? 'text-emerald-800' : 'text-gray-700'
              )}>
                {label}
              </h3>
              {isActive && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-700 uppercase tracking-wide">
                  Active
                </span>
              )}
            </div>
            <span className={cn('text-xs font-semibold shrink-0', STATUS_CONFIG[status].color)}>
              {STATUS_CONFIG[status].label}
            </span>
          </div>

          {/* Status buttons */}
          {canEdit && (
            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
              {(['not_started', 'in_progress', 'completed'] as PhaseStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={isPending}
                  onClick={() => status !== s && onStatusChange(phase, s)}
                  className={cn(
                    'text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-all duration-150 active:scale-[0.97] disabled:opacity-50',
                    status === s
                      ? s === 'completed'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : s === 'in_progress'
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-gray-200 text-gray-700 border-gray-300'
                      : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                  )}
                >
                  {STATUS_CONFIG[s].label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => { setNotesDraft(notes ?? ''); setEditingNotes((v) => !v) }}
                className="ml-auto text-[11px] font-medium text-gray-400 hover:text-indigo-600 transition-colors"
              >
                {editingNotes ? 'Cancel' : notes ? 'Edit note' : '+ Add note'}
              </button>
            </div>
          )}

          {/* Date inputs (editable) */}
          {canEdit && (
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-gray-400 shrink-0">Start</span>
                <input
                  type="date"
                  value={startDraft}
                  onChange={(e) => setStartDraft(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-colors"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-gray-400 shrink-0">End</span>
                <input
                  type="date"
                  value={endDraft}
                  onChange={(e) => setEndDraft(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-colors"
                />
              </div>
              {draftDuration && (
                <span className="text-[11px] text-gray-400">{draftDuration}</span>
              )}
              {datesChanged && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => onSaveDates(phase, startDraft || null, endDraft || null)}
                  className="text-xs font-semibold px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  Save dates
                </button>
              )}
            </div>
          )}

          {/* Date display (read-only) */}
          {!canEdit && (startDate || endDate) && (
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {startDate && (
                <span className="text-xs text-gray-500">
                  Start: <span className="font-medium text-gray-700">{formatDateLabel(startDate)}</span>
                </span>
              )}
              {endDate && (
                <span className="text-xs text-gray-500">
                  End: <span className="font-medium text-gray-700">{formatDateLabel(endDate)}</span>
                </span>
              )}
              {savedDuration && (
                <span className="text-[11px] text-gray-400">{savedDuration}</span>
              )}
            </div>
          )}

          {/* Calendar links — shown when at least one date is saved */}
          {hasCalendarDates && (
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <a
                href={buildGoogleCalendarUrl(label, projectName, startDate, endDate, notes)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] font-medium text-indigo-500 hover:text-indigo-700 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                </svg>
                Google Calendar
              </a>
              <button
                type="button"
                onClick={() => triggerICSDownload(label, projectName, startDate, endDate, notes)}
                className="flex items-center gap-1 text-[11px] font-medium text-indigo-500 hover:text-indigo-700 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Add to Calendar (.ics)
              </button>
            </div>
          )}

          {/* Notes — edit or display */}
          {editingNotes && canEdit ? (
            <div className="mt-3 space-y-2">
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                rows={2}
                placeholder="Add a note about this phase…"
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-colors resize-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingNotes(false)}
                  className="text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => { onSaveNotes(phase, notesDraft); setEditingNotes(false) }}
                  className="text-xs font-semibold px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  Save note
                </button>
              </div>
            </div>
          ) : notes && !editingNotes ? (
            <p className="mt-2 text-xs text-gray-500 italic">{notes}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ── Progress Report table ─────────────────────────────────────

type Row = ReturnType<typeof buildRows>[number]

function ReportTable({ rows, projectName }: { rows: Row[]; projectName: string }) {
  function handleExportCSV() {
    const headers = ['Phase', 'Status', 'Start Date', 'End Date', 'Duration', 'Notes']
    const body = rows.map((r) => [
      PHASE_LABELS[r.phase],
      STATUS_CONFIG[r.status].label,
      r.startDate ?? '',
      r.endDate ?? '',
      calcDuration(r.startDate, r.endDate) ?? '',
      r.notes ?? '',
    ])
    const csv = [headers, ...body]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectName.replace(/\s+/g, '-')}-progress.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const completedCount = rows.filter((r) => r.status === 'completed').length
  const activeRow = rows.find((r) => r.status === 'in_progress')

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap border-b border-gray-100">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Progress Report</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {completedCount} of {PHASE_ORDER.length} phases complete
            {activeRow ? ` · Active: ${PHASE_LABELS[activeRow.phase]}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 15.75v3.375c0 .621.504 1.125 1.125 1.125h8.25c.621 0 1.125-.504 1.125-1.125V15.75m.375-12H6.375c-.621 0-1.125.504-1.125 1.125v5.25c0 .621.504 1.125 1.125 1.125h11.25c.621 0 1.125-.504 1.125-1.125V4.875c0-.621-.504-1.125-1.125-1.125ZM4.5 9.75h15" />
            </svg>
            Print / PDF
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-100">
              <th className="text-left px-5 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-widest w-[180px]">Phase</th>
              <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-widest w-[110px]">Status</th>
              <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-widest w-[110px]">Start</th>
              <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-widest w-[110px]">End</th>
              <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-widest w-[90px]">Duration</th>
              <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((row) => {
              const isActive = row.status === 'in_progress'
              const isComplete = row.status === 'completed'
              const missingDates = (row.status === 'in_progress' || row.status === 'completed') && (!row.startDate || !row.endDate)
              return (
                <tr
                  key={row.phase}
                  className={cn(
                    'transition-colors',
                    isActive ? 'bg-amber-50/60' : isComplete ? 'bg-emerald-50/30' : 'bg-white'
                  )}
                >
                  <td className="px-5 py-3">
                    <span className={cn(
                      'font-semibold',
                      isActive ? 'text-amber-800' : isComplete ? 'text-emerald-800' : 'text-gray-500'
                    )}>
                      {PHASE_LABELS[row.phase]}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn('font-semibold', STATUS_CONFIG[row.status].color)}>
                      {STATUS_CONFIG[row.status].label}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-gray-600">{formatDateLabel(row.startDate)}</td>
                  <td className="px-3 py-3 text-gray-600">{formatDateLabel(row.endDate)}</td>
                  <td className="px-3 py-3 text-gray-500">{calcDuration(row.startDate, row.endDate) ?? '—'}</td>
                  <td className="px-3 py-3">
                    {missingDates && (
                      <span className="text-[10px] font-semibold text-orange-500 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded mr-2">
                        Missing dates
                      </span>
                    )}
                    <span className="text-gray-500 italic">{row.notes ?? ''}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Tab ───────────────────────────────────────────────────────

interface PhasesTabProps {
  projectId: string
  projectName: string
  initialPhases: ConstructionPhase[]
  canEdit: boolean
}

export function PhasesTab({ projectId, projectName, initialPhases, canEdit }: PhasesTabProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const rows = buildRows(initialPhases)
  const activePhase = rows.find((r) => r.status === 'in_progress')
  const completedCount = rows.filter((r) => r.status === 'completed').length

  function runUpdate(
    phase: PhaseName,
    status: PhaseStatus,
    notes?: string | null,
    startDate?: string | null,
    endDate?: string | null,
  ) {
    setError(null)
    startTransition(async () => {
      const row = rows.find((r) => r.phase === phase)
      const result = await updatePhaseAction({
        project_id: projectId,
        phase,
        status,
        notes:       notes      !== undefined ? notes      : (row?.notes      ?? null),
        start_date:  startDate  !== undefined ? startDate  : (row?.startDate  ?? null),
        end_date:    endDate    !== undefined ? endDate    : (row?.endDate    ?? null),
      })
      if (result.error) {
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-5">
      {/* Summary card */}
      <div className="bg-white border border-gray-200 rounded-2xl px-6 py-5 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Construction Progress</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {completedCount} of {PHASE_ORDER.length} phases completed
            </p>
          </div>
          <div className="flex items-center gap-3 min-w-[200px] flex-1 max-w-xs">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${(completedCount / PHASE_ORDER.length) * 100}%` }}
              />
            </div>
            <span className="text-xs font-bold text-gray-600 tabular-nums shrink-0">
              {Math.round((completedCount / PHASE_ORDER.length) * 100)}%
            </span>
          </div>
          {activePhase && (
            <div className="text-right">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Current Phase</p>
              <p className="text-sm font-bold text-amber-700 mt-0.5">{PHASE_LABELS[activePhase.phase]}</p>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 print:hidden">
          <p className="text-sm font-medium text-red-600">{error}</p>
        </div>
      )}

      {/* Stepper */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-5 py-6 print:hidden">
        {!canEdit && (
          <p className="text-xs text-gray-400 mb-5 pb-4 border-b border-gray-100">
            View only — only the assigned Project Manager or Admin can update phases.
          </p>
        )}
        <div className="space-y-0">
          {rows.map((row, i) => (
            <PhaseRow
              key={row.phase}
              phase={row.phase}
              status={row.status}
              notes={row.notes}
              startDate={row.startDate}
              endDate={row.endDate}
              projectName={projectName}
              isLast={i === rows.length - 1}
              canEdit={canEdit}
              isPending={isPending}
              onStatusChange={(phase, status) => runUpdate(phase, status)}
              onSaveNotes={(phase, notes) => runUpdate(phase, rows.find(r => r.phase === phase)!.status, notes)}
              onSaveDates={(phase, start, end) => runUpdate(phase, rows.find(r => r.phase === phase)!.status, undefined, start, end)}
            />
          ))}
        </div>
      </div>

      {/* Report */}
      <ReportTable rows={rows} projectName={projectName} />
    </div>
  )
}
