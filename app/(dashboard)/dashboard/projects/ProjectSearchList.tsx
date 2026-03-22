'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AvatarStack } from '@/components/ui/Avatar'
import { InlineStatusSelect } from '@/components/ui/InlineStatusSelect'
import { InlineStartDateEdit } from '@/components/ui/InlineStartDateEdit'
import { Button } from '@/components/ui/Button'
import { formatDate, formatCurrencyCompact } from '@/lib/utils'
import { canCreateProject } from '@/lib/auth/permissions'
import { PHASE_LABELS } from '@/types/database'
import type { Project, ProjectStatus, PhaseName, Role } from '@/types/database'
import { cn } from '@/lib/utils'

type TeamMember = { id: string; full_name: string; avatar_url: string | null }

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '',           label: 'All statuses' },
  { value: 'planning',   label: 'Planning'     },
  { value: 'in_progress',label: 'In Progress'  },
  { value: 'finishing',  label: 'Finishing'    },
  { value: 'inspection', label: 'Inspection'   },
  { value: 'completed',  label: 'Completed'    },
]

interface Props {
  projects: Project[]
  costByProject: Record<string, number>
  currentPhases: Record<string, { phase: PhaseName; status: string } | null>
  unreviewedByProject: Record<string, number>
  teamByProject: Record<string, TeamMember[]>
  profileRole: Role
  myAssignedProjectIds: string[]
}

export function ProjectSearchList({
  projects,
  costByProject,
  currentPhases,
  unreviewedByProject,
  teamByProject,
  profileRole,
  myAssignedProjectIds,
}: Props) {
  const [query,        setQuery]        = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const q = query.trim().toLowerCase()

  const filtered = projects.filter((p) => {
    const matchesSearch = !q ||
      p.name.toLowerCase().includes(q) ||
      (p.project_code ?? '').toLowerCase().includes(q) ||
      (p.address ?? '').toLowerCase().includes(q) ||
      (p.client_name ?? '').toLowerCase().includes(q)
    const matchesStatus = !statusFilter || p.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const hasFilters = !!q || !!statusFilter

  function canEditStatus(projectId: string): boolean {
    if (profileRole === 'admin') return true
    if (profileRole === 'project_manager') return myAssignedProjectIds.includes(projectId)
    return false
  }

  function clearAll() {
    setQuery('')
    setStatusFilter('')
  }

  return (
    <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">

      {/* ── Toolbar: search + filters ── */}
      <div className="px-4 py-3 border-b border-black/[0.05] bg-gray-50/60 flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects..."
            className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-black/[0.08] rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1C3FAA]/20 focus:border-[#1C3FAA] transition-all"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Clear search"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="py-2 pl-3 pr-7 text-sm bg-white border border-black/[0.08] rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1C3FAA]/20 focus:border-[#1C3FAA] transition-all appearance-none cursor-pointer"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='m19 9-7 7-7-7'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '14px' }}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Clear all filters */}
        {hasFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-semibold text-[#1C3FAA] hover:text-[#162F82] transition-colors px-2 py-1"
          >
            Clear filters
          </button>
        )}

        {/* Result count when filtering */}
        {hasFilters && (
          <span className="text-xs text-gray-400 ml-auto">
            {filtered.length} of {projects.length}
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-600">No projects found</p>
          <p className="text-xs text-gray-400 mt-1">
            {hasFilters ? 'Try adjusting your search or filters' : 'Create your first project to get started'}
          </p>
          {!hasFilters && canCreateProject(profileRole) && (
            <Link href="/dashboard/projects/new">
              <Button size="sm" className="mt-5">+ New Project</Button>
            </Link>
          )}
          {hasFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="mt-4 text-xs text-[#1C3FAA] hover:text-[#162F82] font-medium transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Column headers — desktop (9 cols: +Profit) */}
          <div className="hidden md:grid md:grid-cols-[1fr_90px_100px_90px_100px_100px_100px_140px_80px] items-center px-6 py-3 bg-gray-50/80 border-b border-black/[0.05]">
            {[
              { label: 'Project',   align: '' },
              { label: 'Start',     align: 'text-right' },
              { label: 'Est. End',  align: 'text-right' },
              { label: 'Budget',    align: 'text-right' },
              { label: 'Cost',      align: 'text-right' },
              { label: 'Profit',    align: 'text-right' },
              { label: 'Status',    align: 'text-center' },
              { label: 'Phase',     align: 'text-center' },
              { label: 'Team',      align: 'text-center' },
            ].map((h) => (
              <p key={h.label} className={cn('text-[10px] font-bold text-gray-400 uppercase tracking-[0.08em]', h.align)}>
                {h.label}
              </p>
            ))}
          </div>

          <div className="divide-y divide-black/[0.04]">
            {filtered.map((project) => {
              const cost       = costByProject[project.id] ?? null
              const team       = teamByProject[project.id] ?? []
              const phase      = currentPhases[project.id] ?? null
              const unreviewed = unreviewedByProject[project.id] ?? 0
              const editableStatus = canEditStatus(project.id)

              const profit =
                project.budget_total != null && cost != null
                  ? project.budget_total - cost
                  : null
              const profitPositive = profit != null && profit >= 0

              return (
                <Link
                  key={project.id}
                  href={`/dashboard/projects/${project.id}`}
                  className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_90px_100px_90px_100px_100px_100px_140px_80px] items-center px-5 md:px-6 py-5 hover:bg-[#FAFBFF] transition-colors duration-100 group"
                >
                  {/* Project name / meta */}
                  <div className="min-w-0 pr-4 md:pr-6">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono font-semibold text-gray-400 tracking-wider bg-gray-100 px-1.5 py-0.5 rounded">
                        {project.project_code}
                      </span>
                      {unreviewed > 0 && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-orange-600 bg-orange-50 border border-orange-200/80 rounded-full px-1.5 py-0.5 leading-none">
                          <span className="w-1 h-1 rounded-full bg-orange-400" />
                          {unreviewed} unreviewed
                        </span>
                      )}
                    </div>
                    <p className="text-[15px] font-semibold text-gray-900 group-hover:text-[#1C3FAA] transition-colors duration-100 truncate leading-snug">
                      {project.name}
                    </p>
                    {(project.address || project.client_name) && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {[project.address, project.client_name].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>

                  {/* Start date */}
                  <div className="hidden md:block">
                    <InlineStartDateEdit
                      projectId={project.id}
                      startDate={project.start_date}
                      canEdit={editableStatus}
                    />
                  </div>

                  {/* Est. end */}
                  <div className="hidden md:block text-right">
                    <p className="text-xs text-gray-500 font-medium tabular-nums">
                      {formatDate(project.estimated_end_date)}
                    </p>
                  </div>

                  {/* Budget */}
                  <div className="hidden md:block text-right">
                    <p className="text-sm font-bold text-gray-900 tabular-nums">
                      {project.budget_total != null
                        ? formatCurrencyCompact(project.budget_total)
                        : <span className="text-gray-300 font-normal">—</span>}
                    </p>
                  </div>

                  {/* Cost */}
                  <div className="hidden md:block text-right">
                    <p className="text-sm font-semibold text-gray-600 tabular-nums">
                      {cost != null
                        ? formatCurrencyCompact(cost)
                        : <span className="text-gray-300 font-normal">—</span>}
                    </p>
                  </div>

                  {/* Profit */}
                  <div className="hidden md:block text-right">
                    {profit != null ? (
                      <p className={cn(
                        'text-sm font-bold tabular-nums',
                        profitPositive ? 'text-emerald-600' : 'text-red-500'
                      )}>
                        {profitPositive ? '+' : ''}{formatCurrencyCompact(profit)}
                      </p>
                    ) : (
                      <span className="text-gray-300 text-sm font-normal">—</span>
                    )}
                  </div>

                  {/* Status */}
                  <div className="hidden md:flex md:justify-center">
                    <InlineStatusSelect
                      projectId={project.id}
                      status={project.status as ProjectStatus}
                      canEdit={editableStatus}
                    />
                  </div>

                  {/* Phase */}
                  <div className="hidden md:flex md:justify-center">
                    {phase ? (
                      <span className={
                        phase.status === 'in_progress'
                          ? 'text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-full'
                          : 'text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-full'
                      }>
                        {PHASE_LABELS[phase.phase]}
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-300">—</span>
                    )}
                  </div>

                  {/* Team */}
                  <div className="hidden md:flex md:justify-center">
                    {team.length > 0
                      ? <AvatarStack members={team} max={3} />
                      : <span className="text-gray-300 text-sm">—</span>}
                  </div>

                  {/* Mobile: right side */}
                  <div className="flex flex-col items-end gap-2 md:hidden">
                    <InlineStatusSelect
                      projectId={project.id}
                      status={project.status as ProjectStatus}
                      canEdit={editableStatus}
                    />
                    {profit != null && (
                      <span className={cn(
                        'text-xs font-bold tabular-nums',
                        profitPositive ? 'text-emerald-600' : 'text-red-500'
                      )}>
                        {profitPositive ? '+' : ''}{formatCurrencyCompact(profit)}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
