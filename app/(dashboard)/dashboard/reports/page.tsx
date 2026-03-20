import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/layout/Topbar'
import { getItemTotal } from '@/types/database'
import { ReportsClient, type ReportRow } from './ReportsClient'
import type { Project, ProjectItem } from '@/types/database'

export const metadata = {
  title: 'Reports – ENE Builders',
}

export default async function ReportsPage() {
  await requireRole(['admin', 'office'])

  const supabase = await createClient()

  const [
    { data: projectsData },
    { data: itemsData },
    { data: sectionsData },
  ] = await Promise.all([
    supabase.from('projects').select('*').order('created_at', { ascending: false }),
    supabase.from('project_items').select('project_id, total_price, quantity, unit_price'),
    supabase.from('project_sections').select('id, project_id'),
  ])

  const projects = (projectsData as Project[] | null) ?? []

  // Cost per project
  const costByProject: Record<string, number> = {}
  for (const item of (itemsData ?? []) as (Pick<ProjectItem, 'total_price' | 'quantity' | 'unit_price'> & { project_id: string })[]) {
    const val = getItemTotal(item) ?? 0
    costByProject[item.project_id] = (costByProject[item.project_id] ?? 0) + val
  }

  // Section count per project
  const sectionsByProject: Record<string, number> = {}
  for (const s of (sectionsData ?? []) as { id: string; project_id: string }[]) {
    sectionsByProject[s.project_id] = (sectionsByProject[s.project_id] ?? 0) + 1
  }

  // Item count per project
  const itemsByProject: Record<string, number> = {}
  for (const item of (itemsData ?? []) as { project_id: string }[]) {
    itemsByProject[item.project_id] = (itemsByProject[item.project_id] ?? 0) + 1
  }

  const rows: ReportRow[] = projects.map((p) => ({
    id:                 p.id,
    project_code:       p.project_code,
    name:               p.name,
    status:             p.status,
    start_date:         p.start_date ?? null,
    estimated_end_date: p.estimated_end_date ?? null,
    budget_total:       p.budget_total ?? null,
    cost:               costByProject[p.id] ?? 0,
    client_name:        p.client_name ?? null,
    sections:           sectionsByProject[p.id] ?? 0,
    items:              itemsByProject[p.id] ?? 0,
  }))

  return (
    <>
      <Topbar title="Reports" />
      <main className="flex-1 overflow-y-auto bg-[#F4F2EF] px-4 py-8 lg:px-10 lg:py-10">
        <div className="max-w-6xl mx-auto space-y-8">

          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Reports</h1>
            <p className="text-sm text-gray-400 mt-1">
              Financial summary across all {projects.length} project{projects.length !== 1 ? 's' : ''}.
            </p>
          </div>

          <ReportsClient rows={rows} />

        </div>
      </main>
    </>
  )
}
