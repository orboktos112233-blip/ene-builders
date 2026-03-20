import { Suspense } from 'react'
import { requireAuth } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/layout/Topbar'
import { StatusBadge } from '@/components/ui/Badge'
import { DashboardFilters } from './DashboardFilters'
import { formatDate, formatCurrency } from '@/lib/utils'
import { getItemTotal } from '@/types/database'
import { cn } from '@/lib/utils'
import { canManageUsers } from '@/lib/auth/permissions'
import Link from 'next/link'
import type { Project, ProjectStatus, ProjectItem, Profile } from '@/types/database'

export const metadata = {
  title: 'Dashboard – ENE Builders',
}

interface PageProps {
  searchParams: Promise<{
    from?: string
    to?: string
    status?: string
    user_id?: string
  }>
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const { from, to, status, user_id } = await searchParams
  const profile = await requireAuth()
  const supabase = await createClient()

  // ── Resolve user_id filter: find project IDs assigned to that user ──────────
  let allowedProjectIds: string[] | null = null
  if (user_id) {
    const { data: assignments } = await supabase
      .from('project_assignments')
      .select('project_id')
      .eq('user_id', user_id)
    allowedProjectIds = ((assignments ?? []) as { project_id: string }[]).map((a) => a.project_id)
  }

  // ── Build and execute project query with filters ─────────────────────────────
  let projectQuery = supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  if (from)   projectQuery = projectQuery.gte('created_at', `${from}T00:00:00`)
  if (to)     projectQuery = projectQuery.lte('created_at', `${to}T23:59:59`)
  if (status) projectQuery = projectQuery.eq('status', status)
  if (allowedProjectIds !== null) {
    // If user has no assignments, force empty result
    projectQuery = allowedProjectIds.length > 0
      ? projectQuery.in('id', allowedProjectIds)
      : projectQuery.in('id', ['00000000-0000-0000-0000-000000000000']) // impossible UUID
  }

  // ── Fetch users for filter dropdown (admin/office only) ──────────────────────
  const [{ data: projectsData }, { data: usersData }] = await Promise.all([
    projectQuery,
    canManageUsers(profile.role)
      ? supabase.from('profiles').select('id, full_name').order('full_name')
      : Promise.resolve({ data: [] }),
  ])

  const allProjects = (projectsData as Project[] | null) ?? []
  const users = (usersData as Pick<Profile, 'id' | 'full_name'>[] | null) ?? []

  // ── Fetch items only for the filtered project set ────────────────────────────
  const projectIds = allProjects.map((p) => p.id)

  const { data: itemsData } = projectIds.length > 0
    ? await supabase
        .from('project_items')
        .select('total_price, quantity, unit_price')
        .in('project_id', projectIds)
    : { data: [] as Pick<ProjectItem, 'total_price' | 'quantity' | 'unit_price'>[] }

  const allItems = (itemsData as Pick<ProjectItem, 'total_price' | 'quantity' | 'unit_price'>[] | null) ?? []

  // ── Stats ────────────────────────────────────────────────────────────────────
  const totalProjects = allProjects.length
  const inProgress   = allProjects.filter((p) => p.status === 'in_progress').length
  const inspection   = allProjects.filter((p) => p.status === 'inspection').length
  const completed    = allProjects.filter((p) => p.status === 'completed').length

  const totalRevenue = allProjects.reduce((sum, p) => sum + (p.budget_total ?? 0), 0)
  const totalCost    = allItems.reduce((sum, i) => sum + (getItemTotal(i) ?? 0), 0)
  const totalProfit  = totalRevenue - totalCost
  const hasFinancials = totalRevenue > 0 || totalCost > 0

  const recentProjects = allProjects.slice(0, 8)
  const hasFilters = !!(from || to || status || user_id)

  return (
    <>
      <Topbar title="Dashboard" />
      <main className="flex-1 overflow-y-auto bg-slate-50 p-4 lg:p-8">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* Page header */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Overview of your business</p>
          </div>

          {/* Filters */}
          <Suspense fallback={null}>
            <DashboardFilters
              showUserFilter={canManageUsers(profile.role)}
              users={users}
            />
          </Suspense>

          {/* Filter active label */}
          {hasFilters && (
            <p className="text-xs text-indigo-600 font-semibold -mt-2">
              Showing filtered results
            </p>
          )}

          {/* Project stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
            <StatCard label="Total Projects" value={totalProjects} />
            <StatCard label="In Progress"    value={inProgress}   variant="indigo" />
            <StatCard label="Inspection"     value={inspection}   variant="purple" />
            <StatCard label="Completed"      value={completed}    variant="green" />
          </div>

          {/* Financial summary */}
          {hasFinancials && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                {hasFilters ? 'Filtered Financials' : 'Financials'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
                <FinancialCard label="Total Budget"   value={totalRevenue} />
                <FinancialCard label="Total Cost"     value={totalCost} />
                <FinancialCard
                  label="Net Profit"
                  value={totalProfit}
                  highlight={totalProfit >= 0 ? 'positive' : 'negative'}
                />
              </div>
            </div>
          )}

          {/* Recent / filtered projects */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                {hasFilters ? `Projects (${totalProjects})` : 'Recent Projects'}
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
                  <p className="text-sm text-gray-400">
                    {hasFilters ? 'No projects match these filters.' : 'No projects yet.'}
                  </p>
                  {!hasFilters && (
                    <Link
                      href="/dashboard/projects/new"
                      className="mt-3 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      Create your first project →
                    </Link>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {recentProjects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/dashboard/projects/${project.id}`}
                      className="flex items-center justify-between px-4 lg:px-6 py-4 hover:bg-slate-50 transition-colors duration-100 group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors truncate">
                          {project.name}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 font-mono">{project.project_code}</p>
                      </div>
                      <div className="flex items-center gap-3 lg:gap-5 shrink-0 ml-4">
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
    <div className="bg-white border border-gray-200 rounded-2xl px-5 py-5 lg:px-6 lg:py-6 shadow-sm hover:shadow-md transition-shadow duration-200">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-snug">{label}</p>
      <p className={cn(
        'text-4xl lg:text-5xl font-black mt-3 tracking-tight tabular-nums',
        variant === 'indigo' ? 'text-indigo-600' :
        variant === 'purple' ? 'text-purple-600' :
        variant === 'green'  ? 'text-emerald-600' :
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
      'border rounded-2xl px-5 py-5 lg:px-6 lg:py-6 shadow-sm hover:shadow-md transition-shadow duration-200',
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
        'text-xl lg:text-2xl font-black mt-2 tracking-tight',
        highlight === 'positive' ? 'text-emerald-700' :
        highlight === 'negative' ? 'text-red-600' :
        'text-gray-900'
      )}>
        {formatCurrency(value)}
      </p>
    </div>
  )
}
