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

  let allowedProjectIds: string[] | null = null
  if (user_id) {
    const { data: assignments } = await supabase
      .from('project_assignments')
      .select('project_id')
      .eq('user_id', user_id)
    allowedProjectIds = ((assignments ?? []) as { project_id: string }[]).map((a) => a.project_id)
  }

  let projectQuery = supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  if (from)   projectQuery = projectQuery.gte('created_at', `${from}T00:00:00`)
  if (to)     projectQuery = projectQuery.lte('created_at', `${to}T23:59:59`)
  if (status) projectQuery = projectQuery.eq('status', status)
  if (allowedProjectIds !== null) {
    projectQuery = allowedProjectIds.length > 0
      ? projectQuery.in('id', allowedProjectIds)
      : projectQuery.in('id', ['00000000-0000-0000-0000-000000000000'])
  }

  const [{ data: projectsData }, { data: usersData }] = await Promise.all([
    projectQuery,
    canManageUsers(profile.role)
      ? supabase.from('profiles').select('id, full_name').order('full_name')
      : Promise.resolve({ data: [] }),
  ])

  const allProjects = (projectsData as Project[] | null) ?? []
  const users = (usersData as Pick<Profile, 'id' | 'full_name'>[] | null) ?? []

  const projectIds = allProjects.map((p) => p.id)
  const { data: itemsData } = projectIds.length > 0
    ? await supabase
        .from('project_items')
        .select('total_price, quantity, unit_price')
        .in('project_id', projectIds)
    : { data: [] as Pick<ProjectItem, 'total_price' | 'quantity' | 'unit_price'>[] }

  const allItems = (itemsData as Pick<ProjectItem, 'total_price' | 'quantity' | 'unit_price'>[] | null) ?? []

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
      <main className="flex-1 overflow-y-auto bg-[#F4F2EF] px-4 py-8 lg:px-10 lg:py-10">
        <div className="max-w-5xl mx-auto space-y-8">

          {/* Page header */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Good {getGreeting()},{' '}
              <span className="text-violet-600">{profile.full_name.split(' ')[0]}</span>
            </h1>
            <p className="text-sm text-gray-400 mt-1">Here's what's happening across your projects.</p>
          </div>

          {/* Filters */}
          <Suspense fallback={null}>
            <DashboardFilters showUserFilter={canManageUsers(profile.role)} users={users} />
          </Suspense>

          {hasFilters && (
            <p className="text-xs text-violet-600 font-semibold -mt-4">Showing filtered results</p>
          )}

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Projects"
              value={totalProjects}
              icon={<ProjectsIcon />}
            />
            <StatCard
              label="In Progress"
              value={inProgress}
              color="violet"
              icon={<InProgressIcon />}
            />
            <StatCard
              label="Inspection"
              value={inspection}
              color="amber"
              icon={<InspectionIcon />}
            />
            <StatCard
              label="Completed"
              value={completed}
              color="emerald"
              icon={<CompletedIcon />}
            />
          </div>

          {/* Financial summary */}
          {hasFinancials && (
            <div>
              <SectionLabel>{hasFilters ? 'Filtered Financials' : 'Financials'}</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FinancialCard label="Total Budget" value={totalRevenue} />
                <FinancialCard label="Total Cost" value={totalCost} />
                <FinancialCard
                  label="Net Profit"
                  value={totalProfit}
                  highlight={totalProfit >= 0 ? 'positive' : 'negative'}
                />
              </div>
            </div>
          )}

          {/* Recent projects */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel className="mb-0">
                {hasFilters ? `Projects (${totalProjects})` : 'Recent Projects'}
              </SectionLabel>
              <Link
                href="/dashboard/projects"
                className="text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors"
              >
                View all →
              </Link>
            </div>

            <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
              {recentProjects.length === 0 ? (
                <div className="py-20 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-gray-500">
                    {hasFilters ? 'No projects match these filters.' : 'No projects yet.'}
                  </p>
                  {!hasFilters && (
                    <Link href="/dashboard/projects/new" className="mt-2 inline-block text-sm font-semibold text-violet-600 hover:text-violet-800">
                      Create your first project →
                    </Link>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-black/[0.04]">
                  {recentProjects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/dashboard/projects/${project.id}`}
                      className="flex items-center justify-between px-5 lg:px-6 py-4 hover:bg-violet-50/30 transition-colors duration-100 group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 group-hover:text-violet-700 transition-colors truncate">
                          {project.name}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5 font-mono tracking-wide">{project.project_code}</p>
                      </div>
                      <div className="flex items-center gap-4 lg:gap-6 shrink-0 ml-4">
                        <div className="hidden sm:block text-right">
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Est. end</p>
                          <p className="text-xs text-gray-600 font-medium mt-0.5">{formatDate(project.estimated_end_date)}</p>
                        </div>
                        {project.budget_total != null && (
                          <div className="hidden md:block text-right">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Budget</p>
                            <p className="text-xs font-bold text-gray-900 mt-0.5 tabular-nums">{formatCurrency(project.budget_total)}</p>
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

// ── Helpers ────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('text-[10px] font-bold text-gray-400 uppercase tracking-[0.1em] mb-3', className)}>
      {children}
    </p>
  )
}

// ── Icons ──────────────────────────────────────────────────────

const ProjectsIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
  </svg>
)

const InProgressIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
  </svg>
)

const InspectionIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
  </svg>
)

const CompletedIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
)

// ── Sub-components ─────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string
  value: number
  color?: 'violet' | 'amber' | 'emerald'
  icon: React.ReactNode
}) {
  const iconBg =
    color === 'violet'  ? 'bg-violet-100 text-violet-600' :
    color === 'amber'   ? 'bg-amber-100 text-amber-600' :
    color === 'emerald' ? 'bg-emerald-100 text-emerald-600' :
    'bg-gray-100 text-gray-500'

  const valueColor =
    color === 'violet'  ? 'text-violet-600' :
    color === 'amber'   ? 'text-amber-600' :
    color === 'emerald' ? 'text-emerald-600' :
    'text-gray-900'

  return (
    <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] px-5 py-5 lg:py-6 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-200">
      <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center mb-4', iconBg)}>
        {icon}
      </div>
      <p className={cn('text-3xl lg:text-4xl font-black tracking-tight tabular-nums', valueColor)}>
        {value}
      </p>
      <p className="text-xs font-medium text-gray-400 mt-1.5">{label}</p>
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
      'rounded-2xl border px-5 py-5 lg:px-6 lg:py-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-200',
      highlight === 'positive' ? 'bg-emerald-50 border-emerald-200/70' :
      highlight === 'negative' ? 'bg-red-50 border-red-200/70' :
      'bg-white border-black/[0.06]'
    )}>
      <p className={cn(
        'text-[10px] font-bold uppercase tracking-[0.1em]',
        highlight === 'positive' ? 'text-emerald-600' :
        highlight === 'negative' ? 'text-red-500' :
        'text-gray-400'
      )}>
        {label}
      </p>
      <p className={cn(
        'text-xl lg:text-2xl font-black mt-2.5 tracking-tight tabular-nums',
        highlight === 'positive' ? 'text-emerald-700' :
        highlight === 'negative' ? 'text-red-600' :
        'text-gray-900'
      )}>
        {formatCurrency(value)}
      </p>
    </div>
  )
}
