import { requireAuth } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/layout/Topbar'
import { StatusBadge } from '@/components/ui/Badge'
import { AvatarStack } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { formatDate, formatCurrency, formatCurrencyCompact } from '@/lib/utils'
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

  // Material cost per project: sum total_price (falling back to qty * unit_price)
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

  // Current phase per project:
  //   1. Latest in_progress phase (highest index in PHASE_ORDER)
  //   2. Else: latest completed phase
  //   3. Else: null → "Not started"
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

  // Team members per project
  const { data: assignmentsData } = await supabase
    .from('project_assignments')
    .select('project_id, profiles(id, full_name, avatar_url)')

  type TeamMember = { id: string; full_name: string; avatar_url: string | null }
  const teamByProject: Record<string, TeamMember[]> = {}
  for (const row of (assignmentsData ?? [])) {
    const pid = (row as any).project_id as string
    const p = (row as any).profiles as TeamMember | null
    if (p) {
      if (!teamByProject[pid]) teamByProject[pid] = []
      teamByProject[pid].push(p)
    }
  }

  return (
    <>
      <Topbar title="Projects" />
      <main className="flex-1 overflow-y-auto bg-slate-50 p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* Header */}
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Projects</h1>
              <p className="text-sm text-gray-500 mt-1">
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
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            {projects.length === 0 ? (
              <div className="text-center py-24">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-500">No projects yet</p>
                <p className="text-xs text-gray-400 mt-1">Create your first project to get started</p>
                {canCreateProject(profile.role) && (
                  <Link href="/dashboard/projects/new">
                    <Button size="sm" className="mt-5">+ New Project</Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {/* Table header */}
                <div className="hidden md:grid md:grid-cols-[1fr_110px_120px_130px_140px] items-center px-6 py-2.5 bg-gray-50/80 border-b border-gray-100">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Project</p>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest text-right">Completion</p>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest text-right">Budget</p>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest text-right">Material Cost</p>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest text-right">Status / Team</p>
                </div>

                {projects.map((project) => {
                  const cost = costByProject[project.id]
                  const team = teamByProject[project.id] ?? []
                  const phase = currentPhase(project.id)
                  return (
                    <Link
                      key={project.id}
                      href={`/dashboard/projects/${project.id}`}
                      className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_110px_120px_130px_140px] items-center px-6 py-4 hover:bg-slate-50 transition-colors duration-100 group"
                    >
                      {/* Name / meta */}
                      <div className="min-w-0 pr-4">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-mono text-gray-400">{project.project_code}</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors truncate">
                          {project.name}
                        </p>
                        {(project.address || project.client_name) && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">
                            {[project.address, project.client_name].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>

                      {/* Est. completion */}
                      <div className="hidden md:block text-right">
                        <p className="text-xs text-gray-600 font-medium">
                          {formatDate(project.estimated_end_date)}
                        </p>
                      </div>

                      {/* Budget */}
                      <div className="hidden md:block text-right">
                        <p className="text-sm font-bold text-gray-900">
                          {project.budget_total != null ? formatCurrencyCompact(project.budget_total) : '—'}
                        </p>
                      </div>

                      {/* Material Cost */}
                      <div className="hidden md:block text-right">
                        <p className="text-sm font-semibold text-gray-700">
                          {cost != null ? formatCurrencyCompact(cost) : '—'}
                        </p>
                      </div>

                      {/* Status + Phase + Team */}
                      <div className="flex flex-col items-end gap-1.5">
                        <StatusBadge status={project.status as ProjectStatus} />
                        {phase ? (
                          <span className={
                            phase.status === 'in_progress'
                              ? 'text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md'
                              : 'text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md'
                          }>
                            {PHASE_LABELS[phase.phase]}
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-gray-400">
                            Not started
                          </span>
                        )}
                        {team.length > 0 && (
                          <AvatarStack members={team} max={3} />
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </main>
    </>
  )
}
