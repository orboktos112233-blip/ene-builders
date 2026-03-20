import { requireAuth } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/layout/Topbar'
import { AvatarStack } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { InlineStatusSelect } from '@/components/ui/InlineStatusSelect'
import { InlineStartDateEdit } from '@/components/ui/InlineStartDateEdit'
import { formatDate, formatCurrencyCompact } from '@/lib/utils'
import { canCreateProject } from '@/lib/auth/permissions'
import Link from 'next/link'
import type { Project, ProjectStatus, PhaseName } from '@/types/database'
import { PHASE_LABELS, PHASE_ORDER } from '@/types/database'

export const metadata = {
  title: 'Projects – ENE Builders',
}

export default async function ProjectsPage() {
  const profile = await requireAuth()
  const supabase = await createClient()

  const { data: projectsData } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  const projects = (projectsData as Project[] | null) ?? []

  const { data: itemsData } = await supabase
    .from('project_items')
    .select('project_id, total_price, quantity, unit_price')

  const costByProject: Record<string, number> = {}
  for (const item of (itemsData ?? [])) {
    const val =
      (item as { total_price: number | null; quantity: number | null; unit_price: number | null })
        .total_price ??
      ((item as any).quantity != null && (item as any).unit_price != null
        ? (item as any).quantity * (item as any).unit_price
        : null)
    if (val != null) {
      costByProject[(item as any).project_id] = (costByProject[(item as any).project_id] ?? 0) + val
    }
  }

  const { data: phasesData } = await supabase
    .from('construction_phases')
    .select('project_id, phase_name, status')
    .in('status', ['in_progress', 'completed'])

  type PhaseRow = { project_id: string; phase_name: PhaseName; status: string }
  const phasesByProject: Record<string, PhaseRow[]> = {}
  for (const row of (phasesData ?? [])) {
    const r = row as PhaseRow
    if (!phasesByProject[r.project_id]) phasesByProject[r.project_id] = []
    phasesByProject[r.project_id].push(r)
  }

  function currentPhase(projectId: string): { phase: PhaseName; status: string } | null {
    const rows = phasesByProject[projectId] ?? []
    const inProgress = rows
      .filter((r) => r.status === 'in_progress')
      .sort((a, b) => PHASE_ORDER.indexOf(b.phase_name) - PHASE_ORDER.indexOf(a.phase_name))
    if (inProgress.length > 0) return { phase: inProgress[0].phase_name, status: inProgress[0].status }
    const completed = rows
      .filter((r) => r.status === 'completed')
      .sort((a, b) => PHASE_ORDER.indexOf(b.phase_name) - PHASE_ORDER.indexOf(a.phase_name))
    if (completed.length > 0) return { phase: completed[0].phase_name, status: completed[0].status }
    return null
  }

  const { data: unreviewedData } = await supabase
    .from('media_files')
    .select('project_id')
    .eq('category', 'live_photo')
    .eq('reviewed', false)

  const unreviewedByProject: Record<string, number> = {}
  for (const row of (unreviewedData ?? [])) {
    const pid = (row as any).project_id as string
    unreviewedByProject[pid] = (unreviewedByProject[pid] ?? 0) + 1
  }

  const { data: assignmentsData } = await supabase
    .from('project_assignments')
    .select('project_id, user_id, profiles(id, full_name, avatar_url)')

  type TeamMember = { id: string; full_name: string; avatar_url: string | null }
  const teamByProject: Record<string, TeamMember[]> = {}
  const myAssignedProjectIds = new Set<string>()

  for (const row of (assignmentsData ?? [])) {
    const pid = (row as any).project_id as string
    const uid = (row as any).user_id as string
    const p = (row as any).profiles as TeamMember | null
    if (p) {
      if (!teamByProject[pid]) teamByProject[pid] = []
      teamByProject[pid].push(p)
    }
    if (uid === profile.id) myAssignedProjectIds.add(pid)
  }

  function canEditStatus(projectId: string): boolean {
    if (profile.role === 'admin') return true
    if (profile.role === 'project_manager') return myAssignedProjectIds.has(projectId)
    return false
  }

  return (
    <>
      <Topbar title="Projects" />
      <main className="flex-1 overflow-y-auto bg-[#F4F2EF] px-4 py-8 lg:px-10 lg:py-10">
        <div className="max-w-6xl mx-auto space-y-8">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Projects</h1>
              <p className="text-sm text-gray-400 mt-1">
                {projects.length} project{projects.length !== 1 ? 's' : ''}
              </p>
            </div>
            {canCreateProject(profile.role) && (
              <Link href="/dashboard/projects/new">
                <Button size="md">+ New Project</Button>
              </Link>
            )}
          </div>

          {/* Project list */}
          <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
            {projects.length === 0 ? (
              <div className="text-center py-28">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-5">
                  <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                  </svg>
                </div>
                <p className="text-base font-semibold text-gray-600">No projects yet</p>
                <p className="text-sm text-gray-400 mt-1">Create your first project to get started</p>
                {canCreateProject(profile.role) && (
                  <Link href="/dashboard/projects/new">
                    <Button size="sm" className="mt-6">+ New Project</Button>
                  </Link>
                )}
              </div>
            ) : (
              <>
                {/* Column headers — desktop */}
                <div className="hidden md:grid md:grid-cols-[1fr_90px_100px_100px_110px_100px_140px_80px] items-center px-6 py-3 bg-gray-50/80 border-b border-black/[0.05]">
                  {['Project', 'Start', 'Est. End', 'Budget', 'Materials', 'Status', 'Phase', 'Team'].map((h, i) => (
                    <p key={h} className={`text-[10px] font-bold text-gray-400 uppercase tracking-[0.08em] ${i > 0 ? (i <= 4 ? 'text-right' : 'text-center') : ''}`}>
                      {h}
                    </p>
                  ))}
                </div>

                <div className="divide-y divide-black/[0.04]">
                  {projects.map((project) => {
                    const cost = costByProject[project.id]
                    const team = teamByProject[project.id] ?? []
                    const phase = currentPhase(project.id)
                    const unreviewed = unreviewedByProject[project.id] ?? 0
                    const editableStatus = canEditStatus(project.id)

                    return (
                      <Link
                        key={project.id}
                        href={`/dashboard/projects/${project.id}`}
                        className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_90px_100px_100px_110px_100px_140px_80px] items-center px-5 md:px-6 py-5 hover:bg-violet-50/20 transition-colors duration-100 group"
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
                          <p className="text-[15px] font-semibold text-gray-900 group-hover:text-violet-700 transition-colors duration-100 truncate leading-snug">
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

                        {/* Material cost */}
                        <div className="hidden md:block text-right">
                          <p className="text-sm font-semibold text-gray-600 tabular-nums">
                            {cost != null
                              ? formatCurrencyCompact(cost)
                              : <span className="text-gray-300 font-normal">—</span>}
                          </p>
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
                          {phase ? (
                            <span className={
                              phase.status === 'in_progress'
                                ? 'text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-full'
                                : 'text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-full'
                            }>
                              {PHASE_LABELS[phase.phase]}
                            </span>
                          ) : null}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </>
            )}
          </div>

        </div>
      </main>
    </>
  )
}
