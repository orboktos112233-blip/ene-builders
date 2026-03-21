import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/layout/Topbar'
import { getItemTotal } from '@/types/database'
import { AnalyticsClient, type AnalyticsRow, type FilterOption } from './AnalyticsClient'
import type { Project, ProjectItem } from '@/types/database'
import { PHASE_ORDER } from '@/types/database'

export const metadata = {
  title: 'Analytics – ENE Builders',
}

export default async function AnalyticsPage() {
  await requireRole(['admin', 'office'])

  const supabase = await createClient()

  const [
    { data: projectsData },
    { data: itemsData },
    { data: assignmentsData },
    { data: profilesData },
    { data: phasesData },
  ] = await Promise.all([
    supabase.from('projects').select('*').order('created_at', { ascending: false }),
    supabase.from('project_items').select('project_id, total_price, quantity, unit_price'),
    supabase.from('project_assignments').select('project_id, user_id, assignment_role'),
    supabase.from('profiles').select('id, full_name, role').order('full_name'),
    supabase.from('construction_phases').select('project_id, phase_name, status').eq('status', 'in_progress'),
  ])

  const projects = (projectsData as Project[] | null) ?? []

  // ── Cost per project ───────────────────────────────────────────
  const costByProject: Record<string, number> = {}
  for (const item of (itemsData ?? []) as (Pick<ProjectItem, 'total_price' | 'quantity' | 'unit_price'> & { project_id: string })[]) {
    const val = getItemTotal(item) ?? 0
    costByProject[item.project_id] = (costByProject[item.project_id] ?? 0) + val
  }

  // ── PM / worker IDs per project ────────────────────────────────
  const pmsByProject:     Record<string, string[]> = {}
  const workersByProject: Record<string, string[]> = {}
  for (const a of (assignmentsData ?? []) as { project_id: string; user_id: string; assignment_role: string }[]) {
    if (a.assignment_role === 'project_manager') {
      if (!pmsByProject[a.project_id]) pmsByProject[a.project_id] = []
      pmsByProject[a.project_id].push(a.user_id)
    } else if (a.assignment_role === 'worker') {
      if (!workersByProject[a.project_id]) workersByProject[a.project_id] = []
      workersByProject[a.project_id].push(a.user_id)
    }
  }

  // ── Active phases per project ──────────────────────────────────
  const activePhasesByProject: Record<string, string[]> = {}
  for (const ph of (phasesData ?? []) as { project_id: string; phase_name: string }[]) {
    if (!activePhasesByProject[ph.project_id]) activePhasesByProject[ph.project_id] = []
    activePhasesByProject[ph.project_id].push(ph.phase_name)
  }

  // ── Build rows ─────────────────────────────────────────────────
  const rows: AnalyticsRow[] = projects.map((p) => ({
    id:                 p.id,
    project_code:       p.project_code,
    name:               p.name,
    status:             p.status,
    created_at:         p.created_at,
    start_date:         p.start_date ?? null,
    estimated_end_date: p.estimated_end_date ?? null,
    budget_total:       p.budget_total ?? null,
    cost:               costByProject[p.id] ?? 0,
    client_name:        p.client_name ?? null,
    pm_ids:             pmsByProject[p.id] ?? [],
    worker_ids:         workersByProject[p.id] ?? [],
    active_phases:      activePhasesByProject[p.id] ?? [],
  }))

  // ── Dropdown options ───────────────────────────────────────────
  const allProfiles = (profilesData ?? []) as { id: string; full_name: string; role: string }[]
  const pmOptions:     FilterOption[] = allProfiles.filter((u) => u.role === 'project_manager' || u.role === 'admin').map((u) => ({ id: u.id, full_name: u.full_name }))
  const workerOptions: FilterOption[] = allProfiles.filter((u) => u.role === 'worker').map((u) => ({ id: u.id, full_name: u.full_name }))
  const phaseOptions:  string[]       = PHASE_ORDER as unknown as string[]

  return (
    <>
      <Topbar title="Analytics" />
      <main className="flex-1 overflow-y-auto bg-[#F4F2EF] px-4 py-8 lg:px-10 lg:py-10 print:bg-white print:p-6">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* Header */}
          <div className="flex items-start justify-between print:hidden">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Analytics</h1>
              <p className="text-sm text-gray-400 mt-1">
                Visual business overview across {projects.length} project{projects.length !== 1 ? 's' : ''}.
              </p>
            </div>
          </div>

          <AnalyticsClient
            rows={rows}
            pmOptions={pmOptions}
            workerOptions={workerOptions}
            phaseOptions={phaseOptions}
          />

        </div>
      </main>
    </>
  )
}
