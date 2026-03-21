'use client'

import { useState, useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts'
import { cn } from '@/lib/utils'
import { formatCurrencyCompact } from '@/lib/utils'
import { PHASE_LABELS } from '@/types/database'

// ── Types ───────────────────────────────────────────────────────

export interface AnalyticsRow {
  id: string
  project_code: string
  name: string
  status: string
  created_at: string
  start_date: string | null
  estimated_end_date: string | null
  budget_total: number | null
  cost: number
  client_name: string | null
  pm_ids: string[]
  worker_ids: string[]
  active_phases: string[]
}

export interface FilterOption {
  id: string
  full_name: string
}

interface Props {
  rows: AnalyticsRow[]
  pmOptions: FilterOption[]
  workerOptions: FilterOption[]
  phaseOptions: string[]
}

// ── Constants ───────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: '',            label: 'All statuses'  },
  { value: 'planning',    label: 'Planning'      },
  { value: 'in_progress', label: 'In Progress'   },
  { value: 'finishing',   label: 'Finishing'     },
  { value: 'inspection',  label: 'Inspection'    },
  { value: 'completed',   label: 'Completed'     },
]

const STATUS_COLORS: Record<string, string> = {
  planning:    '#a78bfa',
  in_progress: '#f59e0b',
  finishing:   '#60a5fa',
  inspection:  '#34d399',
  completed:   '#6ee7b7',
}

const STATUS_LABELS: Record<string, string> = {
  planning:    'Planning',
  in_progress: 'In Progress',
  finishing:   'Finishing',
  inspection:  'Inspection',
  completed:   'Completed',
}

const SELECT_CLS = [
  'py-2 pl-3 pr-8 text-sm bg-white border border-black/[0.08] rounded-xl text-gray-700',
  'focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all',
  'appearance-none cursor-pointer',
].join(' ')

const SELECT_STYLE = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='m19 9-7 7-7-7'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat' as const,
  backgroundPosition: 'right 8px center',
  backgroundSize: '14px',
}

// ── Tooltip components ──────────────────────────────────────────

function CurrencyTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-black/[0.08] rounded-xl px-4 py-3 shadow-xl text-sm min-w-[160px]">
      <p className="font-semibold text-gray-700 mb-2 text-xs">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
            <span className="text-gray-500 text-xs">{p.name}</span>
          </div>
          <span className="font-bold text-gray-900 tabular-nums text-xs">{formatCurrencyCompact(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="bg-white border border-black/[0.08] rounded-xl px-3 py-2 shadow-xl text-sm">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.payload.fill }} />
        <span className="text-gray-700 font-semibold text-xs">{p.name}</span>
        <span className="font-bold text-gray-900 text-xs">{p.value} project{p.value !== 1 ? 's' : ''}</span>
      </div>
    </div>
  )
}

function CountTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null
  const v = payload[0].value
  return (
    <div className="bg-white border border-black/[0.08] rounded-xl px-3 py-2 shadow-xl text-sm">
      <p className="font-semibold text-gray-700 text-xs mb-1">{label}</p>
      <p className="text-gray-900 font-bold text-xs">{v} project{v !== 1 ? 's' : ''}</p>
    </div>
  )
}

// ── Chart section wrapper ───────────────────────────────────────

function ChartCard({ title, subtitle, children, className }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5', className)}>
      <p className="text-[13px] font-bold text-gray-800 leading-none">{title}</p>
      {subtitle && <p className="text-[11px] text-gray-400 mt-1">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  )
}

// ── KPI icon components ─────────────────────────────────────────

const icons = {
  projects: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
    </svg>
  ),
  active: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h2.25m0 0 2.25-4.5m-2.25 4.5 2.25 4.5m2.25-4.5h2.25m0 0 2.25-3m-2.25 3 2.25 3m2.25-3h3" />
    </svg>
  ),
  budget: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
    </svg>
  ),
  cost: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0c1.1.128 1.907 1.077 1.907 2.185Z" />
    </svg>
  ),
  profit: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
    </svg>
  ),
  delayed: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  ),
}

// ── Main component ──────────────────────────────────────────────

export function AnalyticsClient({ rows, pmOptions, workerOptions, phaseOptions }: Props) {
  const [query,        setQuery]        = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [fromDate,     setFromDate]     = useState('')
  const [toDate,       setToDate]       = useState('')
  const [pmFilter,     setPmFilter]     = useState('')
  const [workerFilter, setWorkerFilter] = useState('')
  const [phaseFilter,  setPhaseFilter]  = useState('')

  const hasFilters = !!(query || statusFilter || fromDate || toDate || pmFilter || workerFilter || phaseFilter)

  // ── Filtered rows ─────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (q &&
        !r.name.toLowerCase().includes(q) &&
        !r.project_code.toLowerCase().includes(q) &&
        !(r.client_name ?? '').toLowerCase().includes(q)) return false
      if (statusFilter && r.status !== statusFilter) return false
      const dateKey = (r.start_date ?? r.created_at).slice(0, 10)
      if (fromDate && dateKey < fromDate) return false
      if (toDate   && dateKey > toDate)   return false
      if (pmFilter     && !r.pm_ids.includes(pmFilter))         return false
      if (workerFilter && !r.worker_ids.includes(workerFilter)) return false
      if (phaseFilter  && !r.active_phases.includes(phaseFilter)) return false
      return true
    })
  }, [rows, query, statusFilter, fromDate, toDate, pmFilter, workerFilter, phaseFilter])

  // ── KPIs ──────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const totalBudget       = filtered.reduce((s, r) => s + (r.budget_total ?? 0), 0)
    const totalCost         = filtered.reduce((s, r) => s + r.cost, 0)
    const budgetedRows      = filtered.filter(r => r.budget_total != null)
    const totalProfit       = budgetedRows.reduce((s, r) => s + ((r.budget_total ?? 0) - r.cost), 0)
    const activeProjects    = filtered.filter(r => r.status === 'in_progress').length
    const delayedProjects   = filtered.filter(r =>
      r.estimated_end_date && r.status !== 'completed' && new Date(r.estimated_end_date) < today
    ).length
    return { totalBudget, totalCost, totalProfit, activeProjects, delayedProjects, budgetedCount: budgetedRows.length }
  }, [filtered])

  // ── Chart: Profit / Cost / Budget over time ───────────────────

  const profitOverTime = useMemo(() => {
    const byMonth: Record<string, { Budget: number; Cost: number; Profit: number }> = {}
    for (const r of filtered) {
      const m = (r.start_date ?? r.created_at).slice(0, 7)
      if (!byMonth[m]) byMonth[m] = { Budget: 0, Cost: 0, Profit: 0 }
      byMonth[m].Budget += r.budget_total ?? 0
      byMonth[m].Cost   += r.cost
      if (r.budget_total != null) byMonth[m].Profit += r.budget_total - r.cost
    }
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([m, d]) => ({
        month:  new Date(m + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        Budget: Math.round(d.Budget),
        Cost:   Math.round(d.Cost),
        Profit: Math.round(d.Profit),
      }))
  }, [filtered])

  // ── Chart: Status distribution ────────────────────────────────

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of filtered) counts[r.status] = (counts[r.status] ?? 0) + 1
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([status, value]) => ({
        name:  STATUS_LABELS[status] ?? status,
        value,
        fill:  STATUS_COLORS[status] ?? '#cbd5e1',
      }))
  }, [filtered])

  // ── Chart: Cost vs Budget (top 12 by budget) ──────────────────

  const costVsBudget = useMemo(() =>
    [...filtered]
      .filter(r => r.budget_total != null || r.cost > 0)
      .sort((a, b) => (b.budget_total ?? 0) - (a.budget_total ?? 0))
      .slice(0, 12)
      .map(r => ({
        name:      r.project_code || r.name.slice(0, 12),
        Budget:    r.budget_total ?? 0,
        Cost:      r.cost,
        overBudget: r.budget_total != null && r.cost > r.budget_total,
      }))
  , [filtered])

  // ── Chart: Phase distribution ─────────────────────────────────

  const phaseData = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of filtered)
      for (const ph of r.active_phases)
        counts[ph] = (counts[ph] ?? 0) + 1
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([ph, count]) => ({
        name:  PHASE_LABELS[ph as keyof typeof PHASE_LABELS] ?? ph,
        count,
      }))
  }, [filtered])

  // ── Chart: Cost by project (top 10) ───────────────────────────

  const costByProject = useMemo(() =>
    [...filtered]
      .filter(r => r.cost > 0)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10)
      .map(r => ({ name: r.project_code || r.name.slice(0, 12), cost: r.cost }))
  , [filtered])

  // ── Chart: Profit by project (top 10) ─────────────────────────

  const profitByProject = useMemo(() =>
    [...filtered]
      .filter(r => r.budget_total != null)
      .map(r => ({
        name:     r.project_code || r.name.slice(0, 12),
        profit:   (r.budget_total ?? 0) - r.cost,
        positive: (r.budget_total ?? 0) >= r.cost,
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10)
  , [filtered])

  // ── Insights ──────────────────────────────────────────────────

  const insights = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const withBudget  = filtered.filter(r => r.budget_total != null)
    const highProfit  = withBudget.length
      ? withBudget.reduce((best, r) => ((r.budget_total ?? 0) - r.cost > (best.budget_total ?? 0) - best.cost ? r : best))
      : null
    const highCost    = filtered.length ? [...filtered].sort((a, b) => b.cost - a.cost)[0] : null
    const overBudget  = withBudget.filter(r => r.cost > (r.budget_total ?? 0))
    const delayed     = filtered.filter(r =>
      r.estimated_end_date && r.status !== 'completed' && new Date(r.estimated_end_date) < today
    )
    return { highProfit, highCost, overBudget, delayed }
  }, [filtered])

  function clearAll() {
    setQuery(''); setStatusFilter(''); setFromDate(''); setToDate('')
    setPmFilter(''); setWorkerFilter(''); setPhaseFilter('')
  }

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-5 print:space-y-4">

      {/* ── Filter bar ── */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 print:hidden">
        <div className="flex flex-wrap gap-2 items-center">

          {/* Search */}
          <div className="relative min-w-[180px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search projects…"
              className="pl-9 pr-8 py-2 text-sm bg-white border border-black/[0.08] rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all w-full"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Status */}
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={SELECT_CLS} style={SELECT_STYLE}>
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {/* From date */}
          <input
            type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="py-2 px-3 text-sm bg-white border border-black/[0.08] rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all"
          />

          {/* To date */}
          <input
            type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="py-2 px-3 text-sm bg-white border border-black/[0.08] rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all"
          />

          {/* PM filter */}
          {pmOptions.length > 0 && (
            <select value={pmFilter} onChange={e => setPmFilter(e.target.value)} className={SELECT_CLS} style={SELECT_STYLE}>
              <option value="">All PMs</option>
              {pmOptions.map(o => <option key={o.id} value={o.id}>{o.full_name}</option>)}
            </select>
          )}

          {/* Worker filter */}
          {workerOptions.length > 0 && (
            <select value={workerFilter} onChange={e => setWorkerFilter(e.target.value)} className={SELECT_CLS} style={SELECT_STYLE}>
              <option value="">All workers</option>
              {workerOptions.map(o => <option key={o.id} value={o.id}>{o.full_name}</option>)}
            </select>
          )}

          {/* Phase filter */}
          {phaseOptions.length > 0 && (
            <select value={phaseFilter} onChange={e => setPhaseFilter(e.target.value)} className={SELECT_CLS} style={SELECT_STYLE}>
              <option value="">All phases</option>
              {phaseOptions.map(p => (
                <option key={p} value={p}>{PHASE_LABELS[p as keyof typeof PHASE_LABELS] ?? p}</option>
              ))}
            </select>
          )}

          {/* Right side: count + clear + print */}
          <div className="ml-auto flex items-center gap-3">
            {hasFilters && (
              <>
                <span className="text-xs text-gray-400 tabular-nums">{filtered.length} / {rows.length}</span>
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors"
                >
                  Clear
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 border border-black/[0.08] rounded-lg px-3 py-2 hover:border-black/[0.15] transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
              </svg>
              Print
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          {
            label: 'Total Projects',
            value: filtered.length.toString(),
            sub: `${rows.length} total`,
            iconEl: icons.projects,
            iconBg: 'bg-violet-100',
            iconColor: 'text-violet-600',
            valueColor: 'text-gray-900',
          },
          {
            label: 'Active',
            value: kpis.activeProjects.toString(),
            sub: 'in progress',
            iconEl: icons.active,
            iconBg: 'bg-amber-100',
            iconColor: 'text-amber-600',
            valueColor: 'text-gray-900',
          },
          {
            label: 'Total Budget',
            value: formatCurrencyCompact(kpis.totalBudget),
            sub: `${kpis.budgetedCount} projects`,
            iconEl: icons.budget,
            iconBg: 'bg-blue-100',
            iconColor: 'text-blue-600',
            valueColor: 'text-gray-900',
          },
          {
            label: 'Total Cost',
            value: formatCurrencyCompact(kpis.totalCost),
            sub: 'actual spend',
            iconEl: icons.cost,
            iconBg: 'bg-slate-100',
            iconColor: 'text-slate-600',
            valueColor: 'text-gray-900',
          },
          {
            label: 'Net Profit',
            value: (kpis.totalProfit >= 0 ? '+' : '') + formatCurrencyCompact(kpis.totalProfit),
            sub: kpis.totalProfit >= 0 ? 'on budget' : 'over budget',
            iconEl: icons.profit,
            iconBg: kpis.totalProfit >= 0 ? 'bg-emerald-100' : 'bg-red-100',
            iconColor: kpis.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-500',
            valueColor: kpis.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-500',
          },
          {
            label: 'Delayed',
            value: kpis.delayedProjects.toString(),
            sub: kpis.delayedProjects > 0 ? 'past due date' : 'all on track',
            iconEl: icons.delayed,
            iconBg: kpis.delayedProjects > 0 ? 'bg-red-100' : 'bg-gray-100',
            iconColor: kpis.delayedProjects > 0 ? 'text-red-500' : 'text-gray-400',
            valueColor: kpis.delayedProjects > 0 ? 'text-red-500' : 'text-gray-400',
          },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
            <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center mb-3', card.iconBg)}>
              <span className={card.iconColor}>{card.iconEl}</span>
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.08em] mb-1">{card.label}</p>
            <p className={cn('text-[22px] font-bold leading-none tabular-nums', card.valueColor)}>{card.value}</p>
            <p className="text-[11px] text-gray-400 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Hero chart: Profit / Cost / Budget Over Time ── */}
      {profitOverTime.length > 0 ? (
        <ChartCard
          title="Profit, Cost & Budget Over Time"
          subtitle="Grouped by project start date (or creation date if no start date set)"
        >
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={profitOverTime} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => formatCurrencyCompact(v)} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={68} />
              <Tooltip content={<CurrencyTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
              <Line type="monotone" dataKey="Budget" stroke="#a78bfa" strokeWidth={2}   dot={false} />
              <Line type="monotone" dataKey="Cost"   stroke="#f87171" strokeWidth={2}   dot={false} />
              <Line type="monotone" dataKey="Profit" stroke="#34d399" strokeWidth={2.5} dot={false} strokeDasharray="0" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : (
        <ChartCard title="Profit, Cost & Budget Over Time">
          <div className="h-[300px] flex items-center justify-center text-sm text-gray-300">No data to display</div>
        </ChartCard>
      )}

      {/* ── Row: Status Donut + Phase Distribution ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Status donut — narrower */}
        <ChartCard title="Projects by Status" className="lg:col-span-2">
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%" cy="50%"
                  innerRadius={60} outerRadius={88}
                  paddingAngle={3}
                >
                  {statusData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-sm text-gray-300">No data</div>
          )}
        </ChartCard>

        {/* Phase distribution — wider */}
        <ChartCard title="Active Phases Distribution" className="lg:col-span-3">
          {phaseData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={phaseData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={150} />
                <Tooltip content={<CountTooltip />} cursor={{ fill: '#f9fafb' }} />
                <Bar dataKey="count" name="Projects" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-sm text-gray-300">No active phases</div>
          )}
        </ChartCard>
      </div>

      {/* ── Cost vs Budget ── */}
      {costVsBudget.length > 0 && (
        <ChartCard
          title="Cost vs Budget by Project"
          subtitle="Top 12 by budget. Blue = within budget · Red = over budget"
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={costVsBudget} margin={{ top: 5, right: 20, left: 0, bottom: 50 }} barCategoryGap="28%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} angle={-35} textAnchor="end" interval={0} />
              <YAxis tickFormatter={v => formatCurrencyCompact(v)} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={68} />
              <Tooltip content={<CurrencyTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Budget" fill="#a78bfa" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Cost" radius={[4, 4, 0, 0]}>
                {costVsBudget.map((entry, i) => (
                  <Cell key={i} fill={entry.overBudget ? '#f87171' : '#60a5fa'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* ── Row: Cost by Project + Profit by Project ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Cost by project */}
        <ChartCard title="Cost by Project" subtitle="Top 10 by actual spend">
          {costByProject.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={costByProject} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                <XAxis type="number" tickFormatter={v => formatCurrencyCompact(v)} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={80} />
                <Tooltip formatter={v => formatCurrencyCompact(v as number)} cursor={{ fill: '#f9fafb' }} />
                <Bar dataKey="cost" name="Cost" fill="#60a5fa" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-sm text-gray-300">No cost data</div>
          )}
        </ChartCard>

        {/* Profit by project */}
        <ChartCard title="Profit by Project" subtitle="Top 10. Green = profitable · Red = loss">
          {profitByProject.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={profitByProject} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                <XAxis type="number" tickFormatter={v => formatCurrencyCompact(v)} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={80} />
                <Tooltip formatter={v => formatCurrencyCompact(v as number)} cursor={{ fill: '#f9fafb' }} />
                <Bar dataKey="profit" name="Profit" radius={[0, 4, 4, 0]}>
                  {profitByProject.map((entry, i) => (
                    <Cell key={i} fill={entry.positive ? '#34d399' : '#f87171'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-sm text-gray-300">No budget data</div>
          )}
        </ChartCard>
      </div>

      {/* ── Insights ── */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5">
        <p className="text-[13px] font-bold text-gray-800 mb-4">Insights</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

          {/* Highest profit */}
          <div className="rounded-xl bg-emerald-50 border border-emerald-100/80 p-4">
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide mb-2">Highest Profit</p>
            {insights.highProfit ? (
              <>
                <p className="text-sm font-bold text-gray-900 truncate leading-snug">{insights.highProfit.name}</p>
                <p className="text-[11px] text-emerald-600/70 mt-0.5 font-mono">{insights.highProfit.project_code}</p>
                <p className="text-lg font-bold text-emerald-600 mt-2 tabular-nums">
                  +{formatCurrencyCompact((insights.highProfit.budget_total ?? 0) - insights.highProfit.cost)}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-400">No budget data</p>
            )}
          </div>

          {/* Highest cost */}
          <div className="rounded-xl bg-blue-50 border border-blue-100/80 p-4">
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide mb-2">Highest Cost</p>
            {insights.highCost ? (
              <>
                <p className="text-sm font-bold text-gray-900 truncate leading-snug">{insights.highCost.name}</p>
                <p className="text-[11px] text-blue-600/70 mt-0.5 font-mono">{insights.highCost.project_code}</p>
                <p className="text-lg font-bold text-blue-600 mt-2 tabular-nums">
                  {formatCurrencyCompact(insights.highCost.cost)}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-400">No data</p>
            )}
          </div>

          {/* Over budget */}
          <div className={cn(
            'rounded-xl border p-4',
            insights.overBudget.length > 0 ? 'bg-red-50 border-red-100/80' : 'bg-gray-50 border-gray-100'
          )}>
            <p className={cn(
              'text-[10px] font-bold uppercase tracking-wide mb-2',
              insights.overBudget.length > 0 ? 'text-red-500' : 'text-gray-400'
            )}>Over Budget</p>
            <p className={cn(
              'text-2xl font-bold tabular-nums',
              insights.overBudget.length > 0 ? 'text-red-500' : 'text-gray-400'
            )}>{insights.overBudget.length}</p>
            <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
              {insights.overBudget.length > 0
                ? insights.overBudget.slice(0, 3).map(r => r.project_code || r.name.slice(0, 10)).join(', ')
                : 'All within budget'}
            </p>
          </div>

          {/* Delayed */}
          <div className={cn(
            'rounded-xl border p-4',
            insights.delayed.length > 0 ? 'bg-orange-50 border-orange-100/80' : 'bg-gray-50 border-gray-100'
          )}>
            <p className={cn(
              'text-[10px] font-bold uppercase tracking-wide mb-2',
              insights.delayed.length > 0 ? 'text-orange-600' : 'text-gray-400'
            )}>Delayed</p>
            <p className={cn(
              'text-2xl font-bold tabular-nums',
              insights.delayed.length > 0 ? 'text-orange-600' : 'text-gray-400'
            )}>{insights.delayed.length}</p>
            <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
              {insights.delayed.length > 0
                ? insights.delayed.slice(0, 3).map(r => r.project_code || r.name.slice(0, 10)).join(', ')
                : 'All on schedule'}
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}
