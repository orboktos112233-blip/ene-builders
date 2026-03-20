import { requireAuth } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/layout/Topbar'
import { StatusBadge } from '@/components/ui/Badge'
import { formatDate, formatCurrency } from '@/lib/utils'
import { getItemTotal } from '@/types/database'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import type { Project, ProjectStatus, ProjectItem } from '@/types/database'

export const metadata = {
  title: 'Dashboard – ENE Builders',
}

export default async function DashboardPage() {
  const profile = await requireAuth()
  const supabase = await createClient()

  const [{ data: projectsData }, { data: itemsData }] = await Promise.all([
    supabase.from('projects').select('*').order('created_at', { ascending: false }),
    supabase.from('project_items').select('total_price, quantity, unit_price'),
  ])

  const allProjects = (projectsData as Project[] | null) ?? []
  const allItems = (itemsData as Pick<ProjectItem, 'total_price' | 'quantity' | 'unit_price'>[] | null) ?? []

  const totalProjects = allProjects.length
  const inProgress = allProjects.filter((p) => p.status === 'in_progress').length
  const inspection = allProjects.filter((p) => p.status === 'inspection').length
  const completed = allProjects.filter((p) => p.status === 'completed').length

  const totalRevenue = allProjects.reduce((sum, p) => sum + (p.budget_total ?? 0), 0)
  const totalCost = allItems.reduce((sum, i) => sum + (getItemTotal(i) ?? 0), 0)
  const totalProfit = totalRevenue - totalCost
  const hasFinancials = totalRevenue > 0 || totalCost > 0

  const recentProjects = allProjects.slice(0, 6)

  return (
    <>
      <Topbar title="Dashboard" />
      <main className="flex-1 overflow-y-auto bg-slate-50 p-6 lg:p-8">
        <div className="max-w-5xl mx-auto space-y-8">

          {/* Page header */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Overview of your business</p>
          </div>

          {/* Project stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total Projects" value={totalProjects} />
            <StatCard label="In Progress" value={inProgress} variant="indigo" />
            <StatCard label="Inspection" value={inspection} variant="purple" />
            <StatCard label="Completed" value={completed} variant="green" />
          </div>

          {/* Financial row */}
          {hasFinancials && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Financials</p>
              <div className="grid grid-cols-3 gap-4">
                <FinancialCard label="Total Revenue" value={totalRevenue} />
                <FinancialCard label="Total Cost" value={totalCost} />
                <FinancialCard
                  label="Total Profit"
                  value={totalProfit}
                  highlight={totalProfit >= 0 ? 'positive' : 'negative'}
                />
              </div>
            </div>
          )}

          {/* Recent projects */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                Recent Projects
              </p>
              <Link
                href="/dashboard/projects"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                View all →
              </Link>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              {recentProjects.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-sm text-gray-400">No projects yet.</p>
                  <Link
                    href="/dashboard/projects/new"
                    className="mt-3 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    Create your first project →
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {recentProjects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/dashboard/projects/${project.id}`}
                      className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors duration-100 group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors truncate">
                          {project.name}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 font-mono">{project.project_code}</p>
                      </div>
                      <div className="flex items-center gap-5 shrink-0 ml-4">
                        <div className="hidden sm:block text-right">
                          <p className="text-[11px] text-gray-400">Est. completion</p>
                          <p className="text-xs text-gray-700 font-medium mt-0.5">
                            {formatDate(project.estimated_end_date)}
                          </p>
                        </div>
                        {project.budget_total != null && (
                          <div className="hidden md:block text-right">
                            <p className="text-[11px] text-gray-400">Budget</p>
                            <p className="text-xs font-bold text-gray-900 mt-0.5">
                              {formatCurrency(project.budget_total)}
                            </p>
                          </div>
                        )}
                        <StatusBadge status={project.status as ProjectStatus} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────

function StatCard({
  label,
  value,
  variant,
}: {
  label: string
  value: number
  variant?: 'indigo' | 'purple' | 'green'
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl px-6 py-6 shadow-sm hover:shadow-md transition-shadow duration-200">
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
      <p className={cn(
        'text-5xl font-black mt-3 tracking-tight tabular-nums',
        variant === 'indigo' ? 'text-indigo-600' :
        variant === 'purple' ? 'text-purple-600' :
        variant === 'green' ? 'text-emerald-600' :
        'text-gray-900'
      )}>
        {value}
      </p>
    </div>
  )
}

function FinancialCard({
  label,
  value,
  highlight,
}: {
  label: string
  value: number
  highlight?: 'positive' | 'negative'
}) {
  return (
    <div className={cn(
      'border rounded-2xl px-6 py-6 shadow-sm hover:shadow-md transition-shadow duration-200',
      highlight === 'positive' ? 'bg-emerald-50 border-emerald-200' :
      highlight === 'negative' ? 'bg-red-50 border-red-200' :
      'bg-white border-gray-200'
    )}>
      <p className={cn(
        'text-xs font-semibold uppercase tracking-widest',
        highlight === 'positive' ? 'text-emerald-600' :
        highlight === 'negative' ? 'text-red-500' :
        'text-gray-400'
      )}>
        {label}
      </p>
      <p className={cn(
        'text-2xl font-black mt-2 tracking-tight',
        highlight === 'positive' ? 'text-emerald-700' :
        highlight === 'negative' ? 'text-red-600' :
        'text-gray-900'
      )}>
        {formatCurrency(value)}
      </p>
    </div>
  )
}
