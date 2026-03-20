import { Suspense } from 'react'
import { requireAuth } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/layout/Topbar'
import { StatusBadge } from '@/components/ui/Badge'
import { DashboardFilters } from './DashboardFilters'
import { formatDate, formatCurrency, formatCurrencyCompact } from '@/lib/utils'
import { getItemTotal } from '@/types/database'
import { cn } from '@/lib/utils'
import { canManageUsers } from '@/lib/auth/permissions'
import Link from 'next/link'
import type {
  Project, ProjectStatus, ProjectItem, Profile,
  ActivityLogWithProfile, PhaseName,
} from '@/types/database'
import { PHASE_LABELS } from '@/types/database'

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

  // ── Project filter (same as before) ──────────────────────────
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

  // ── Parallel data fetching ────────────────────────────────────
  const [
    { data: projectsData },
    { data: usersData },
  ] = await Promise.all([
    projectQuery,
    canManageUsers(profile.role)
      ? supabase.from('profiles').select('id, full_name').order('full_name')
      : Promise.resolve({ data: [] }),
  ])

  const allProjects = (projectsData as Project[] | null) ?? []
  const users = (usersData as Pick<Profile, 'id' | 'full_name'>[] | null) ?? []
  const projectIds = allProjects.map((p) => p.id)

  // ── Secondary data ────────────────────────────────────────────
  const [
    { data: itemsData },
    { data: phasesData },
    { data: activityData },
  ] = await Promise.all([
    projectIds.length > 0
      ? supabase
          .from('project_items')
          .select('project_id, total_price, quantity, unit_price')
          .in('project_id', projectIds)
      : Promise.resolve({ data: [] as Pick<ProjectItem, 'total_price' | 'quantity' | 'unit_price'>[] }),
    projectIds.length > 0
      ? supabase
          .from('construction_phases')
          .select('project_id, phase_name, status, start_date, end_date, updated_at')
          .in('project_id', projectIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from('activity_logs')
      .select('*, profiles(id, full_name, avatar_url), projects(id, project_code, name)')
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  const allItems = (itemsData as (Pick<ProjectItem, 'total_price' | 'quantity' | 'unit_price'> & { project_id: string })[] | null) ?? []
  const allPhases = (phasesData ?? []) as {
    project_id: string
    phase_name: PhaseName
    status: string
    start_date: string | null
    end_date: string | null
    updated_at: string
  }[]
  const recentActivity = (activityData ?? []) as ActivityLogWithProfile[]

  // ── KPI computations ──────────────────────────────────────────
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const activeProjects  = allProjects.filter((p) => p.status !== 'completed').length
  const completedCount  = allProjects.filter((p) => p.status === 'completed').length
  const inProgressCount = allProjects.filter((p) => p.status === 'in_progress').length
  const totalBudget     = allProjects.reduce((sum, p) => sum + (p.budget_total ?? 0), 0)

  const costByProject: Record<string, number> = {}
  for (const item of allItems) {
    const val = getItemTotal(item) ?? 0
    costByProject[item.project_id] = (costByProject[item.project_id] ?? 0) + val
  }

  const totalCost   = Object.values(costByProject).reduce((s, v) => s + v, 0)
  const totalProfit = totalBudget - totalCost

  const delayedProjects = allProjects.filter((p) => {
    if (p.status === 'completed') return false
    if (!p.estimated_end_date) return false
    return new Date(p.estimated_end_date) < today
  })

  const phasesInProgress = allPhases.filter((ph) => ph.status === 'in_progress').length

  const hasFinancials = totalBudget > 0 || totalCost > 0
  const hasFilters    = !!(from || to || status || user_id)

  // ── Budget overrun alerts ─────────────────────────────────────
  const overrunProjects = allProjects.filter((p) => {
    const cost = costByProject[p.id] ?? 0
    return p.budget_total != null && cost > p.budget_total
  })

  const hasAlerts = delayedProjects.length > 0 || overrunProjects.length > 0

  // ── Budget vs Cost chart data (top 8 by budget) ───────────────
  const chartProjects = [...allProjects]
    .filter((p) => p.budget_total != null)
    .sort((a, b) => (b.budget_total ?? 0) - (a.budget_total ?? 0))
    .slice(0, 8)

  const maxBudget = Math.max(...chartProjects.map((p) => p.budget_total ?? 0), 1)

  // ── Upcoming deadlines (next 60 days, not completed) ─────────
  const in60days = new Date(today)
  in60days.setDate(in60days.getDate() + 60)

  const upcoming = allProjects
    .filter((p) => {
      if (p.status === 'completed') return false
      if (!p.estimated_end_date) return false
      const d = new Date(p.estimated_end_date)
      return d >= today && d <= in60days
    })
    .sort((a, b) =>
      new Date(a.estimated_end_date!).getTime() - new Date(b.estimated_end_date!).getTime()
    )
    .slice(0, 6)

  const recentProjects = allProjects.slice(0, 6)

  return (
    <>
      <Topbar title="Dashboard" />
      <main className="flex-1 overflow-y-auto bg-[#F4F2EF] px-4 py-8 lg:px-10 lg:py-10">
        <div className="max-w-6xl mx-auto space-y-8">

          {/* ── Header ── */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Good {getGreeting()},{' '}
              <span className="text-violet-600">{profile.full_name.split(' ')[0]}</span>
            </h1>
            <p className="text-sm text-gray-400 mt-1">Here&apos;s what&apos;s happening across your projects.</p>
          </div>

          {/* ── Filters ── */}
          <Suspense fallback={null}>
            <DashboardFilters showUserFilter={canManageUsers(profile.role)} users={users} />
          </Suspense>
          {hasFilters && (
            <p className="text-xs text-violet-600 font-semibold -mt-4">Showing filtered results</p>
          )}

          {/* ── KPI cards (6) ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 lg:gap-4">
            <KpiCard
              label="Active Projects"
              value={activeProjects}
              icon={<IconActive />}
              color="violet"
            />
            <KpiCard
              label="Total Budget"
              value={formatCurrencyCompact(totalBudget)}
              icon={<IconBudget />}
            />
            <KpiCard
              label="Total Cost"
              value={formatCurrencyCompact(totalCost)}
              icon={<IconCost />}
              color="amber"
            />
            <KpiCard
              label="Net Profit"
              value={formatCurrencyCompact(totalProfit)}
              icon={<IconProfit />}
              color={totalProfit >= 0 ? 'emerald' : 'red'}
            />
            <KpiCard
              label="Delayed"
              value={delayedProjects.length}
              icon={<IconDelayed />}
              color={delayedProjects.length > 0 ? 'red' : undefined}
            />
            <KpiCard
              label="Phases Active"
              value={phasesInProgress}
              icon={<IconPhase />}
              color="sky"
            />
          </div>

          {/* ── Alerts ── */}
          {hasAlerts && (
            <div>
              <SectionLabel>Issues</SectionLabel>
              <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06)] divide-y divide-black/[0.04] overflow-hidden">
                {delayedProjects.map((p) => {
                  const daysLate = Math.floor(
                    (today.getTime() - new Date(p.estimated_end_date!).getTime()) / 86_400_000
                  )
                  return (
                    <Link
                      key={p.id}
                      href={`/dashboard/projects/${p.id}`}
                      className="flex items-center gap-3 px-5 py-3.5 hover:bg-red-50/40 transition-colors group"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-gray-900 group-hover:text-red-700 transition-colors truncate block">
                          {p.name}
                        </span>
                        <span className="text-xs text-red-500 font-medium">
                          {daysLate}d overdue · est. {formatDate(p.estimated_end_date)}
                        </span>
                      </div>
                      <StatusBadge status={p.status as ProjectStatus} />
                    </Link>
                  )
                })}
                {overrunProjects.map((p) => {
                  const cost   = costByProject[p.id] ?? 0
                  const over   = cost - (p.budget_total ?? 0)
                  return (
                    <Link
                      key={`over-${p.id}`}
                      href={`/dashboard/projects/${p.id}`}
                      className="flex items-center gap-3 px-5 py-3.5 hover:bg-orange-50/40 transition-colors group"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-gray-900 group-hover:text-orange-700 transition-colors truncate block">
                          {p.name}
                        </span>
                        <span className="text-xs text-orange-500 font-medium">
                          Budget overrun · {formatCurrencyCompact(over)} over
                        </span>
                      </div>
                      <span className="text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-1 rounded-lg shrink-0">
                        Over budget
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Two-column layout ── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 lg:gap-8 items-start">

            {/* ── Left: Budget vs Cost chart ── */}
            <div>
              {hasFinancials && chartProjects.length > 0 && (
                <div>
                  <SectionLabel>Budget vs Cost</SectionLabel>
                  <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
                    <div className="px-6 py-5 space-y-4">
                      {chartProjects.map((p) => {
                        const cost    = costByProject[p.id] ?? 0
                        const budget  = p.budget_total ?? 0
                        const ratio   = budget > 0 ? cost / budget : 0
                        const overrun = ratio > 1
                        const budgetPct = Math.min((budget / maxBudget) * 100, 100)
                        const costPct   = Math.min((cost / maxBudget) * 100, 100)

                        return (
                          <Link
                            key={p.id}
                            href={`/dashboard/projects/${p.id}`}
                            className="block group"
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[10px] font-mono text-gray-400 shrink-0">{p.project_code}</span>
                                <span className="text-sm font-semibold text-gray-800 group-hover:text-violet-700 transition-colors truncate">
                                  {p.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 shrink-0 ml-4 text-right">
                                <span className={cn('text-xs font-bold tabular-nums', overrun ? 'text-red-600' : 'text-gray-900')}>
                                  {formatCurrencyCompact(cost)}
                                  {' '}
                                  <span className="font-normal text-gray-400">/ {formatCurrencyCompact(budget)}</span>
                                </span>
                              </div>
                            </div>

                            {/* Bar track */}
                            <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                              {/* Budget bar (full width relative to max) */}
                              <div
                                className="absolute left-0 top-0 h-full bg-gray-200 rounded-full"
                                style={{ width: `${budgetPct}%` }}
                              />
                              {/* Cost bar */}
                              <div
                                className={cn(
                                  'absolute left-0 top-0 h-full rounded-full transition-all',
                                  overrun ? 'bg-red-500' : ratio > 0.8 ? 'bg-amber-400' : 'bg-violet-500'
                                )}
                                style={{ width: `${costPct}%` }}
                              />
                            </div>
                          </Link>
                        )
                      })}
                    </div>

                    {/* Legend */}
                    <div className="px-6 py-3 border-t border-black/[0.05] flex items-center gap-5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-1.5 rounded-full bg-violet-500 inline-block" />
                        <span className="text-[11px] text-gray-400 font-medium">Cost</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-1.5 rounded-full bg-gray-200 inline-block" />
                        <span className="text-[11px] text-gray-400 font-medium">Budget</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-1.5 rounded-full bg-red-500 inline-block" />
                        <span className="text-[11px] text-gray-400 font-medium">Over budget</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Recent projects ── */}
              <div className={hasFinancials && chartProjects.length > 0 ? 'mt-8' : ''}>
                <div className="flex items-center justify-between mb-3">
                  <SectionLabel className="mb-0">
                    {hasFilters ? `Projects (${allProjects.length})` : 'Recent Projects'}
                  </SectionLabel>
                  <Link
                    href="/dashboard/projects"
                    className="text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors"
                  >
                    View all →
                  </Link>
                </div>

                <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
                  {recentProjects.length === 0 ? (
                    <div className="py-16 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-gray-500">
                        {hasFilters ? 'No projects match.' : 'No projects yet.'}
                      </p>
                      {!hasFilters && (
                        <Link href="/dashboard/projects/new" className="mt-2 inline-block text-sm font-semibold text-violet-600 hover:text-violet-800">
                          Create your first project →
                        </Link>
                      )}
                    </div>
                  ) : (
                    <div className="divide-y divide-black/[0.04]">
                      {recentProjects.map((project) => {
                        const cost = costByProject[project.id]
                        const isDelayed =
                          project.status !== 'completed' &&
                          project.estimated_end_date != null &&
                          new Date(project.estimated_end_date) < today

                        return (
                          <Link
                            key={project.id}
                            href={`/dashboard/projects/${project.id}`}
                            className="flex items-center justify-between px-5 lg:px-6 py-4 hover:bg-violet-50/30 transition-colors duration-100 group"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-gray-900 group-hover:text-violet-700 transition-colors truncate">
                                  {project.name}
                                </p>
                                {isDelayed && (
                                  <span className="shrink-0 text-[9px] font-bold text-red-600 bg-red-50 border border-red-200/80 px-1.5 py-0.5 rounded-full leading-none">
                                    delayed
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-gray-400 mt-0.5 font-mono tracking-wide">{project.project_code}</p>
                            </div>
                            <div className="flex items-center gap-3 lg:gap-5 shrink-0 ml-4">
                              {cost != null && (
                                <div className="hidden sm:block text-right">
                                  <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Cost</p>
                                  <p className="text-xs font-bold text-gray-900 mt-0.5 tabular-nums">{formatCurrencyCompact(cost)}</p>
                                </div>
                              )}
                              {project.estimated_end_date && (
                                <div className="hidden md:block text-right">
                                  <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Est. end</p>
                                  <p className={cn('text-xs font-medium mt-0.5', isDelayed ? 'text-red-500 font-bold' : 'text-gray-600')}>
                                    {formatDate(project.estimated_end_date)}
                                  </p>
                                </div>
                              )}
                              <StatusBadge status={project.status as ProjectStatus} />
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Right column ── */}
            <div className="space-y-6">

              {/* Activity feed */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <SectionLabel className="mb-0">Recent Activity</SectionLabel>
                  <Link
                    href="/dashboard/activity"
                    className="text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors"
                  >
                    View all →
                  </Link>
                </div>

                <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
                  {recentActivity.length === 0 ? (
                    <div className="py-12 text-center">
                      <p className="text-sm text-gray-400">No recent activity</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-black/[0.04]">
                      {recentActivity.map((log) => {
                        const config = ACTIVITY_CONFIG[log.action] ?? ACTIVITY_CONFIG._default
                        return (
                          <div key={log.id} className="flex items-start gap-3 px-4 py-3.5">
                            <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-xs', config.bg)}>
                              {config.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-800 leading-snug">
                                <span className="font-semibold">{log.profiles?.full_name ?? 'System'}</span>
                                {' '}
                                <span className="text-gray-500">{log.description}</span>
                              </p>
                              {log.projects && (
                                <Link
                                  href={`/dashboard/projects/${log.projects.id}`}
                                  className="text-[11px] text-violet-600 hover:text-violet-800 font-medium mt-0.5 inline-block transition-colors"
                                >
                                  {log.projects.project_code}
                                </Link>
                              )}
                              <p className="text-[11px] text-gray-400 mt-0.5">{timeAgo(log.created_at)}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Upcoming deadlines */}
              {upcoming.length > 0 && (
                <div>
                  <SectionLabel>Upcoming Deadlines</SectionLabel>
                  <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
                    <div className="divide-y divide-black/[0.04]">
                      {upcoming.map((p) => {
                        const daysLeft = Math.ceil(
                          (new Date(p.estimated_end_date!).getTime() - today.getTime()) / 86_400_000
                        )
                        const urgent = daysLeft <= 7
                        return (
                          <Link
                            key={p.id}
                            href={`/dashboard/projects/${p.id}`}
                            className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50/60 transition-colors group"
                          >
                            <div className={cn(
                              'shrink-0 w-10 h-10 rounded-xl flex flex-col items-center justify-center',
                              urgent ? 'bg-red-50' : 'bg-violet-50'
                            )}>
                              <span className={cn('text-[10px] font-bold leading-none', urgent ? 'text-red-500' : 'text-violet-500')}>
                                {daysLeft}d
                              </span>
                              <span className={cn('text-[9px] mt-0.5 font-medium', urgent ? 'text-red-400' : 'text-violet-400')}>
                                left
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 group-hover:text-violet-700 transition-colors truncate">
                                {p.name}
                              </p>
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                Due {formatDate(p.estimated_end_date)}
                              </p>
                            </div>
                            <StatusBadge status={p.status as ProjectStatus} />
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Active phases */}
              {phasesInProgress > 0 && (
                <div>
                  <SectionLabel>Active Phases</SectionLabel>
                  <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
                    <div className="divide-y divide-black/[0.04]">
                      {allPhases
                        .filter((ph) => ph.status === 'in_progress')
                        .slice(0, 6)
                        .map((ph, i) => {
                          const project = allProjects.find((p) => p.id === ph.project_id)
                          if (!project) return null
                          return (
                            <Link
                              key={`${ph.project_id}-${ph.phase_name}-${i}`}
                              href={`/dashboard/projects/${project.id}`}
                              className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50/60 transition-colors group"
                            >
                              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 group-hover:text-violet-700 transition-colors truncate">
                                  {PHASE_LABELS[ph.phase_name]}
                                </p>
                                <p className="text-[11px] text-gray-400 mt-0.5 truncate">{project.name}</p>
                              </div>
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-1 rounded-full shrink-0">
                                In progress
                              </span>
                            </Link>
                          )
                        })}
                    </div>
                  </div>
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

function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)  return 'just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days  < 7)  return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('text-[10px] font-bold text-gray-400 uppercase tracking-[0.1em] mb-3', className)}>
      {children}
    </p>
  )
}

// ── Activity action config ──────────────────────────────────────

const ACTIVITY_CONFIG: Record<string, { bg: string; icon: string }> = {
  project_created:  { bg: 'bg-emerald-100 text-emerald-600', icon: '✦'  },
  project_updated:  { bg: 'bg-blue-100 text-blue-600',      icon: '✎'  },
  project_deleted:  { bg: 'bg-red-100 text-red-500',        icon: '✕'  },
  status_changed:   { bg: 'bg-amber-100 text-amber-600',    icon: '↻'  },
  phase_updated:    { bg: 'bg-violet-100 text-violet-600',  icon: '▸'  },
  media_uploaded:   { bg: 'bg-violet-100 text-violet-600',  icon: '⬆'  },
  media_deleted:    { bg: 'bg-rose-100 text-rose-500',      icon: '✕'  },
  photo_reviewed:   { bg: 'bg-teal-100 text-teal-600',      icon: '✓'  },
  item_added:       { bg: 'bg-emerald-100 text-emerald-600',icon: '+'  },
  member_added:     { bg: 'bg-cyan-100 text-cyan-600',      icon: '+'  },
  member_removed:   { bg: 'bg-orange-100 text-orange-500',  icon: '−'  },
  import_completed: { bg: 'bg-slate-100 text-slate-500',    icon: '↓'  },
  _default:         { bg: 'bg-gray-100 text-gray-500',      icon: '·'  },
}

// ── KPI card ───────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon,
  color,
}: {
  label: string
  value: number | string
  icon: React.ReactNode
  color?: 'violet' | 'amber' | 'emerald' | 'red' | 'sky'
}) {
  const iconBg =
    color === 'violet'  ? 'bg-violet-100 text-violet-600'   :
    color === 'amber'   ? 'bg-amber-100 text-amber-600'     :
    color === 'emerald' ? 'bg-emerald-100 text-emerald-600' :
    color === 'red'     ? 'bg-red-100 text-red-500'         :
    color === 'sky'     ? 'bg-sky-100 text-sky-600'         :
    'bg-gray-100 text-gray-500'

  const valueColor =
    color === 'violet'  ? 'text-violet-600'  :
    color === 'amber'   ? 'text-amber-600'   :
    color === 'emerald' ? 'text-emerald-600' :
    color === 'red'     ? 'text-red-500'     :
    color === 'sky'     ? 'text-sky-600'     :
    'text-gray-900'

  return (
    <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] px-4 py-5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-200">
      <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center mb-3', iconBg)}>
        {icon}
      </div>
      <p className={cn('text-2xl font-black tracking-tight tabular-nums leading-none', valueColor)}>
        {value}
      </p>
      <p className="text-[11px] font-medium text-gray-400 mt-1.5 leading-tight">{label}</p>
    </div>
  )
}

// ── Icons ──────────────────────────────────────────────────────

const IconActive = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
  </svg>
)

const IconBudget = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75" />
  </svg>
)

const IconCost = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
)

const IconProfit = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
  </svg>
)

const IconDelayed = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
)

const IconPhase = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
  </svg>
)
