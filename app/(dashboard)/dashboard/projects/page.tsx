import { requireAuth } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/layout/Topbar'
import { Button } from '@/components/ui/Button'
import { canCreateProject } from '@/lib/auth/permissions'
import { ProjectSearchList } from './ProjectSearchList'
import Link from 'next/link'
import type { Project, PhaseName } from '@/types/database'
import { PHASE_ORDER } from '@/types/database'

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

  // Compute current phase per project (serialisable — passed to client component)
  const currentPhases: Record<string, { phase: PhaseName; status: string } | null> = {}
  for (const project of projects) {
    const rows = phasesByProject[project.id] ?? []
    const inProgress = rows
      .filter((r) => r.status === 'in_progress')
      .sort((a, b) => PHASE_ORDER.indexOf(b.phase_name) - PHASE_ORDER.indexOf(a.phase_name))
    if (inProgress.length > 0) {
      currentPhases[project.id] = { phase: inProgress[0].phase_name, status: inProgress[0].status }
      continue
    }
    const completed = rows
      .filter((r) => r.status === 'completed')
      .sort((a, b) => PHASE_ORDER.indexOf(b.phase_name) - PHASE_ORDER.indexOf(a.phase_name))
    currentPhases[project.id] = completed.length > 0
      ? { phase: completed[0].phase_name, status: completed[0].status }
      : null
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
  const myAssignedProjectIds: string[] = []

  for (const row of (assignmentsData ?? [])) {
    const pid = (row as any).project_id as string
    const uid = (row as any).user_id as string
    const p = (row as any).profiles as TeamMember | null
    if (p) {
      if (!teamByProject[pid]) teamByProject[pid] = []
      teamByProject[pid].push(p)
    }
    if (uid === profile.id) myAssignedProjectIds.push(pid)
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

          {/* Project list with search */}
          {projects.length === 0 ? (
            <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] text-center py-28">
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
            <ProjectSearchList
              projects={projects}
              costByProject={costByProject}
              currentPhases={currentPhases}
              unreviewedByProject={unreviewedByProject}
              teamByProject={teamByProject}
              profileRole={profile.role}
              myAssignedProjectIds={myAssignedProjectIds}
            />
          )}

        </div>
      </main>
    </>
  )
}
