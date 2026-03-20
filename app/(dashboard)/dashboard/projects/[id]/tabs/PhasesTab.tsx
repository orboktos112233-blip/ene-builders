'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { updatePhaseAction } from '@/app/actions/phases'
import { PHASE_ORDER, PHASE_LABELS } from '@/types/database'
import type { ConstructionPhase, PhaseName, PhaseStatus } from '@/types/database'

// ── Helpers ───────────────────────────────────────────────────

function buildRows(phases: ConstructionPhase[]) {
  const map = new Map(phases.map((p) => [p.phase, p]))
  return PHASE_ORDER.map((phase) => ({
    phase,
    status: (map.get(phase)?.status ?? 'not_started') as PhaseStatus,
    notes: map.get(phase)?.notes ?? null,
    updated_at: map.get(phase)?.updated_at ?? null,
  }))
}

const STATUS_CONFIG: Record<PhaseStatus, { label: string; color: string; dot: string }> = {
  not_started: { label: 'Not Started', color: 'text-gray-400',    dot: 'bg-gray-200 border-2 border-gray-300' },
  in_progress: { label: 'In Progress', color: 'text-amber-600',   dot: 'bg-amber-400 border-2 border-amber-500' },
  completed:   { label: 'Completed',   color: 'text-emerald-600', dot: 'bg-emerald-500 border-2 border-emerald-600' },
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
  isLast: boolean
  canEdit: boolean
  isPending: boolean
  onStatusChange: (phase: PhaseName, status: PhaseStatus) => void
  onSaveNotes: (phase: PhaseName, notes: string) => void
}

function PhaseRow({
  phase, status, notes, isLast, canEdit, isPending, onStatusChange, onSaveNotes,
}: PhaseRowProps) {
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState(notes ?? '')
  const isActive = status === 'in_progress'

  return (
    <div className="flex gap-4">
      {/* Left: circle + connector line */}
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
      <div className={cn(
        'flex-1 pb-6 min-w-0',
        isLast && 'pb-0'
      )}>
        {/* Phase card */}
        <div className={cn(
          'rounded-xl border px-4 py-3 transition-all duration-200',
          isActive
            ? 'border-amber-200 bg-amber-50/60 shadow-sm'
            : status === 'completed'
            ? 'border-emerald-100 bg-emerald-50/30'
            : 'border-gray-200 bg-white'
        )}>
          {/* Header row */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <h3 className={cn(
                'text-sm font-semibold',
                isActive ? 'text-amber-800' :
                status === 'completed' ? 'text-emerald-800' : 'text-gray-700'
              )}>
                {PHASE_LABELS[phase]}
              </h3>
              {isActive && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-700 uppercase tracking-wide">
                  Active
                </span>
              )}
            </div>

            {/* Status label (read mode) */}
            <span className={cn(
              'text-xs font-semibold shrink-0',
              STATUS_CONFIG[status].color
            )}>
              {STATUS_CONFIG[status].label}
            </span>
          </div>

          {/* Status buttons — authorized users only */}
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

              {/* Notes toggle */}
              <button
                type="button"
                onClick={() => {
                  setNotesDraft(notes ?? '')
                  setEditingNotes((v) => !v)
                }}
                className="ml-auto text-[11px] font-medium text-gray-400 hover:text-indigo-600 transition-colors"
              >
                {editingNotes ? 'Cancel' : notes ? 'Edit note' : '+ Add note'}
              </button>
            </div>
          )}

          {/* Notes — view or edit */}
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

// ── Tab ───────────────────────────────────────────────────────

interface PhasesTabProps {
  projectId: string
  initialPhases: ConstructionPhase[]
  canEdit: boolean
}

export function PhasesTab({ projectId, initialPhases, canEdit }: PhasesTabProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const rows = buildRows(initialPhases)
  const activePhase = rows.find((r) => r.status === 'in_progress')
  const completedCount = rows.filter((r) => r.status === 'completed').length

  function runUpdate(phase: PhaseName, status: PhaseStatus, notes?: string | null) {
    setError(null)
    startTransition(async () => {
      const row = rows.find((r) => r.phase === phase)
      const result = await updatePhaseAction({
        project_id: projectId,
        phase,
        status,
        notes: notes !== undefined ? notes : (row?.notes ?? null),
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
          {/* Progress bar */}
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
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-sm font-medium text-red-600">{error}</p>
        </div>
      )}

      {/* Stepper */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-5 py-6">
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
              isLast={i === rows.length - 1}
              canEdit={canEdit}
              isPending={isPending}
              onStatusChange={(phase, status) => runUpdate(phase, status)}
              onSaveNotes={(phase, notes) => runUpdate(phase, rows.find(r => r.phase === phase)!.status, notes)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
