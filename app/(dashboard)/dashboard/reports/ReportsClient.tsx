'use client'

import { useState, useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyCompact, formatDate } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/Badge'
import Link from 'next/link'
import type { ProjectStatus, PhaseName } from '@/types/database'
import { PHASE_LABELS } from '@/types/database'

// ── Types ──────────────────────────────────────────────────────

export interface ReportRow {
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
  sections: number
  items: number
  pm_ids: string[]
  worker_ids: string[]
  active_phases: string[]
}

export interface FilterOption {
  id: string
  full_name: string
}

interface Props {
  rows: ReportRow[]
  pmOptions: FilterOption[]
  workerOptions: FilterOption[]
  phaseOptions: string[]
}

// ── Constants ──────────────────────────────────────────────────

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

// ── Custom tooltip helpers ─────────────────────────────────────

function CurrencyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-black/[0.08] rounded-xl px-4 py-3 shadow-lg text-sm">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="tabular-nums font-medium">
          {p.name}: {formatCurrencyCompact(p.value)}
        </p>
      ))}
    </div>
  )
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="bg-white border border-black/[0.08] rounded-xl px-4 py-3 shadow-lg text-sm">
      <p className="font-semibold text-gray-700">{item.name}</p>
      <p className="text-gray-500 mt-0.5">{item.value} project{item.value !== 1 ? 's' : ''}</p>
    </div>
  )
}

// ── Select helper ──────────────────────────────────────────────

function FilterSelect({
  value, onChange, children, className,
}: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'py-2 pl-3 pr-7 text-sm bg-white border border-black/[0.08] rounded-lg text-gray-700',
        'focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all',
        'appearance-none cursor-pointer',
        className
      )}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='m19 9-7 7-7-7'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 8px center',
        backgroundSize: '14px',
      }}
    >
      {children}
    </select>
  )
}

// ── Section label ──────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.1em] mb-3">{children}</p>
  )
}

// ── Main component ─────────────────────────────────────────────

export function ReportsClient({ rows, pmOptions, workerOptions, phaseOptions }: Props) {
  const [query,         setQuery]         = useState('')
  const [statusFilter,  setStatusFilter]  = useState('')
  const [fromDate,      setFromDate]      = useState('')
  const [toDate,        setToDate]        = useState('')
  const [pmFilter,      setPmFilter]      = useState('')
  const [workerFilter,  setWorkerFilter]  = useState('')
  const [phaseFilter,   setPhaseFilter]   = useState('')

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])

  // ── Filter logic (applied once, drives everything) ──────────
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q) && !r.project_code.toLowerCase().includes(q) && !(r.client_name ?? '').toLowerCase().includes(q)) return false
      if (statusFilter && r.status !== statusFilter) return false
      if (fromDate) {
        const date = r.start_date ?? r.created_at
        if (date < fromDate) return false
      }
      if (toDate) {
        const date = r.start_date ?? r.created_at
        if (date > toDate + 'T23:59:59') return false
      }
      if (pmFilter && !r.pm_ids.includes(pmFilter)) return false
      if (workerFilter && !r.worker_ids.includes(workerFilter)) return false
      if (phaseFilter && !r.active_phases.includes(phaseFilter)) return false
      return true
    })
  }, [rows, query, statusFilter, fromDate, toDate, pmFilter, workerFilter, phaseFilter])

  const hasFilters = !!(query || statusFilter || fromDate || toDate || pmFilter || workerFilter || phaseFilter)

  function clearAll() {
    setQuery(''); setStatusFilter(''); setFromDate(''); setToDate('')
    setPmFilter(''); setWorkerFilter(''); setPhaseFilter('')
  }

  // ── Aggregate KPIs ─────────────────────────────────────────
  const totalBudget = useMemo(() => filtered.reduce((s, r) => s + (r.budget_total ?? 0), 0), [filtered])
  const totalCost   = useMemo(() => filtered.reduce((s, r) => s + r.cost, 0), [filtered])
  const totalProfit = totalBudget - totalCost
  const profitMargin = totalBudget > 0 ? (totalProfit / totalBudget) * 100 : 0

  // ── Chart data ──────────────────────────────────────────────

  // A) Profit over time — group by month of start_date or created_at
  const profitOverTime = useMemo(() => {
    const map: Record<string, { month: string; budget: number; cost: number; profit: number }> = {}
    for (const r of filtered) {
      const raw  = r.start_date ?? r.created_at
      const month = raw.slice(0, 7) // "2024-03"
      if (!map[month]) map[month] = { month, budget: 0, cost: 0, profit: 0 }
      map[month].budget += r.budget_total ?? 0
      map[month].cost   += r.cost
      map[month].profit += (r.budget_total ?? 0) - r.cost
    }
    return Object.values(map)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((d) => ({
        ...d,
        label: new Date(d.month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      }))
  }, [filtered])

  // B) Cost vs Budget — top 10 by budget
  const costVsBudget = useMemo(() => {
    return [...filtered]
      .filter((r) => r.budget_total != null)
      .sort((a, b) => (b.budget_total ?? 0) - (a.budget_total ?? 0))
      .slice(0, 10)
      .map((r) => ({
        name:   r.project_code,
        label:  r.name,
        budget: r.budget_total ?? 0,
        cost:   r.cost,
      }))
  }, [filtered])

  // C) Status distribution
  const statusDist = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of filtered) counts[r.status] = (counts[r.status] ?? 0) + 1
    return Object.entries(counts)
      .map(([status, value]) => ({ name: STATUS_LABELS[status] ?? status, status, value }))
      .sort((a, b) => b.value - a.value)
  }, [filtered])

  // D) Phase distribution (active in-progress phases)
  const phaseDist = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of filtered) {
      for (const phase of r.active_phases) {
        counts[phase] = (counts[phase] ?? 0) + 1
      }
    }
    return Object.entries(counts)
      .map(([phase, count]) => ({ name: PHASE_LABELS[phase as PhaseName] ?? phase, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [filtered])

  // ── Insights ───────────────────────────────────────────────
  const insights = useMemo(() => {
    const list: { type: 'warning' | 'danger' | 'success' | 'info'; title: string; detail: string; id: string; link: string }[] = []
    for (const r of filtered) {
      // Over budget
      if (r.budget_total != null && r.cost > r.budget_total && r.cost > 0) {
        const over = r.cost - r.budget_total
        list.push({ type: 'danger', title: r.name, detail: `Over budget by ${formatCurrencyCompact(over)}`, id: `over-${r.id}`, link: `/dashboard/projects/${r.id}` })
      }
      // Delayed
      if (r.status !== 'completed' && r.estimated_end_date) {
        const end = new Date(r.estimated_end_date)
        if (end < today) {
          const days = Math.floor((today.getTime() - end.getTime()) / 86_400_000)
          list.push({ type: 'warning', title: r.name, detail: `Overdue by ${days} day${days !== 1 ? 's' : ''}`, id: `delayed-${r.id}`, link: `/dashboard/projects/${r.id}` })
        }
      }
      // High profit
      if (r.budget_total != null && r.budget_total > 0) {
        const margin = ((r.budget_total - r.cost) / r.budget_total) * 100
        if (margin >= 30 && r.cost > 0) {
          list.push({ type: 'success', title: r.name, detail: `${margin.toFixed(0)}% profit margin`, id: `profit-${r.id}`, link: `/dashboard/projects/${r.id}` })
        }
      }
      // No cost tracked
      if (r.budget_total != null && r.budget_total > 0 && r.cost === 0) {
        list.push({ type: 'info', title: r.name, detail: 'Budget set but no costs tracked yet', id: `notrack-${r.id}`, link: `/dashboard/projects/${r.id}` })
      }
    }
    return list.slice(0, 12)
  }, [filtered, today])

  // ── CSV export ─────────────────────────────────────────────
  function exportCSV() {
    const headers = ['Code', 'Project', 'Client', 'Status', 'Start', 'Est. End', 'Budget', 'Cost', 'Profit', 'Margin %', 'Sections', 'Items']
    const csvRows = [
      headers.join(','),
      ...filtered.map((r) => {
        const profit = r.budget_total != null ? r.budget_total - r.cost : ''
        const margin = r.budget_total && r.budget_total > 0 ? (((r.budget_total - r.cost) / r.budget_total) * 100).toFixed(1) : ''
        return [
          r.project_code,
          `"${r.name.replace(/"/g, '""')}"`,
          `"${(r.client_name ?? '').replace(/"/g, '""')}"`,
          r.status,
          r.start_date ?? '',
          r.estimated_end_date ?? '',
          r.budget_total ?? '',
          r.cost,
          profit,
          margin,
          r.sections,
          r.items,
        ].join(',')
      }),
    ]
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `ene-report-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-8">

      {/* ── Filter bar ── */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06)] px-5 py-4 print:hidden">
        <div className="flex flex-wrap gap-3 items-end">

          {/* Search */}
          <div className="flex-1 min-w-[180px] max-w-xs">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.08em] mb-1.5">Search</p>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Project, client..."
                className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-black/[0.08] rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
          </div>

          {/* Status */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.08em] mb-1.5">Status</p>
            <FilterSelect value={statusFilter} onChange={setStatusFilter}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </FilterSelect>
          </div>

          {/* From date */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.08em] mb-1.5">From date</p>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="py-2 px-3 text-sm bg-white border border-black/[0.08] rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all"
            />
          </div>

          {/* To date */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.08em] mb-1.5">To date</p>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="py-2 px-3 text-sm bg-white border border-black/[0.08] rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all"
            />
          </div>

          {/* Project Manager */}
          {pmOptions.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.08em] mb-1.5">Project Manager</p>
              <FilterSelect value={pmFilter} onChange={setPmFilter} className="max-w-[160px]">
                <option value="">All PMs</option>
                {pmOptions.map((o) => <option key={o.id} value={o.id}>{o.full_name}</option>)}
              </FilterSelect>
            </div>
          )}

          {/* Worker */}
          {workerOptions.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.08em] mb-1.5">Worker</p>
              <FilterSelect value={workerFilter} onChange={setWorkerFilter} className="max-w-[160px]">
                <option value="">All workers</option>
                {workerOptions.map((o) => <option key={o.id} value={o.id}>{o.full_name}</option>)}
              </FilterSelect>
            </div>
          )}

          {/* Phase */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.08em] mb-1.5">Active Phase</p>
            <FilterSelect value={phaseFilter} onChange={setPhaseFilter} className="max-w-[160px]">
              <option value="">All phases</option>
              {phaseOptions.map((p) => (
                <option key={p} value={p}>{PHASE_LABELS[p as PhaseName] ?? p}</option>
              ))}
            </FilterSelect>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 ml-auto self-end">
            {hasFilters && (
              <button type="button" onClick={clearAll} className="text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors px-2 py-2">
                Clear all
              </button>
            )}
            <span className="text-xs text-gray-400 py-2">{filtered.length} project{filtered.length !== 1 ? 's' : ''}</span>
            <button type="button" onClick={exportCSV} className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 border border-violet-200/80 px-3 py-2 rounded-lg transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
              CSV
            </button>
            <button type="button" onClick={() => window.print()} className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-800 bg-white hover:bg-gray-50 border border-black/[0.08] px-3 py-2 rounded-lg transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" /></svg>
              Print
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Projects',    value: filtered.length,                       formatted: filtered.length.toString(),            color: 'text-gray-900',    bg: 'bg-gray-100',    icon: '🏗' },
          { label: 'Total Budget',value: totalBudget,                           formatted: formatCurrencyCompact(totalBudget),    color: 'text-gray-900',    bg: 'bg-violet-100',  icon: '💰' },
          { label: 'Total Cost',  value: totalCost,                             formatted: formatCurrencyCompact(totalCost),      color: 'text-amber-600',   bg: 'bg-amber-100',   icon: '📊' },
          {
            label: totalProfit >= 0 ? 'Net Profit' : 'Net Loss',
            value: totalProfit,
            formatted: (totalProfit >= 0 ? '+' : '') + formatCurrencyCompact(totalProfit),
            color: totalProfit >= 0 ? 'text-emerald-600' : 'text-red-500',
            bg:    totalProfit >= 0 ? 'bg-emerald-100'   : 'bg-red-100',
            icon:  totalProfit >= 0 ? '📈' : '📉',
          },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06)] px-5 py-5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-200">
            <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center mb-4 text-base', card.bg)}>
              {card.icon}
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.08em] mb-1">{card.label}</p>
            <p className={cn('text-2xl font-black tracking-tight tabular-nums leading-none', card.color)}>
              {card.formatted}
            </p>
            {card.label.includes('Profit') || card.label.includes('Loss') ? (
              <p className="text-[11px] text-gray-400 mt-1.5">
                {totalBudget > 0 ? `${profitMargin.toFixed(1)}% margin` : 'No budget set'}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {/* ── Charts ── */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06)] py-20 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-500">No data matches your filters</p>
          <button type="button" onClick={clearAll} className="mt-3 text-xs text-violet-600 hover:text-violet-800 font-semibold transition-colors">
            Clear filters
          </button>
        </div>
      ) : (
        <>
          {/* Row 1: Profit over time + Status donut */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">

            {/* A) Profit over time */}
            <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06)] px-6 py-5">
              <SectionLabel>Profit / Cost over time</SectionLabel>
              {profitOverTime.length < 2 ? (
                <div className="flex items-center justify-center h-[240px] text-sm text-gray-400">
                  Not enough data points — add start dates to projects
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={profitOverTime} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => formatCurrencyCompact(v)} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={72} />
                    <Tooltip content={<CurrencyTooltip />} />
                    <Line type="monotone" dataKey="budget" name="Budget" stroke="#e5e7eb" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="cost"   name="Cost"   stroke="#f59e0b" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="profit" name="Profit" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 3, fill: '#7c3aed' }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
              <div className="flex items-center gap-5 mt-3">
                {[
                  { color: '#e5e7eb', label: 'Budget'     },
                  { color: '#f59e0b', label: 'Cost'       },
                  { color: '#7c3aed', label: 'Profit'     },
                ].map((l) => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <span className="w-3 h-1.5 rounded-full inline-block" style={{ background: l.color }} />
                    <span className="text-[11px] text-gray-400 font-medium">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* C) Status distribution donut */}
            <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06)] px-6 py-5">
              <SectionLabel>Status distribution</SectionLabel>
              {statusDist.length === 0 ? (
                <div className="flex items-center justify-center h-[240px] text-sm text-gray-400">No data</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={statusDist}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {statusDist.map((entry) => (
                          <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#d1d5db'} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2">
                    {statusDist.map((d) => (
                      <div key={d.status} className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: STATUS_COLORS[d.status] ?? '#d1d5db' }} />
                        <span className="text-[11px] text-gray-500 font-medium">{d.name} <span className="text-gray-400">({d.value})</span></span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* B) Cost vs Budget per project */}
          {costVsBudget.length > 0 && (
            <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06)] px-6 py-5">
              <SectionLabel>Cost vs Budget — top {costVsBudget.length} projects</SectionLabel>
              <ResponsiveContainer width="100%" height={Math.max(200, costVsBudget.length * 44)}>
                <BarChart
                  data={costVsBudget}
                  layout="vertical"
                  margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
                  barCategoryGap="30%"
                  barGap={4}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                  <XAxis type="number" tickFormatter={(v) => formatCurrencyCompact(v)} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280', fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={56} />
                  <Tooltip content={<CurrencyTooltip />} cursor={{ fill: '#f9fafb' }} />
                  <Bar dataKey="budget" name="Budget" fill="#e5e7eb" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="cost"   name="Cost"   fill="#7c3aed" radius={[0, 4, 4, 0]}>
                    {costVsBudget.map((entry) => (
                      <Cell key={entry.name} fill={entry.cost > entry.budget ? '#ef4444' : '#7c3aed'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-5 mt-3">
                {[
                  { color: '#e5e7eb', label: 'Budget'                },
                  { color: '#7c3aed', label: 'Cost'                  },
                  { color: '#ef4444', label: 'Cost (over budget)'    },
                ].map((l) => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <span className="w-3 h-1.5 rounded-full inline-block" style={{ background: l.color }} />
                    <span className="text-[11px] text-gray-400 font-medium">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* D) Phase distribution */}
          {phaseDist.length > 0 && (
            <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06)] px-6 py-5">
              <SectionLabel>Active phases across projects</SectionLabel>
              <ResponsiveContainer width="100%" height={Math.max(160, phaseDist.length * 40)}>
                <BarChart
                  data={phaseDist}
                  layout="vertical"
                  margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
                  barCategoryGap="35%"
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={130} />
                  <Tooltip formatter={(v) => [`${v} project${v !== 1 ? 's' : ''}`, 'Active']} cursor={{ fill: '#f9fafb' }} />
                  <Bar dataKey="count" name="Projects" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Insights ── */}
          {insights.length > 0 && (
            <div>
              <SectionLabel>Insights & Alerts</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {insights.map((ins) => (
                  <Link key={ins.id} href={ins.link} className="group">
                    <div className={cn(
                      'bg-white rounded-2xl border px-4 py-4 hover:shadow-md transition-all duration-150',
                      ins.type === 'danger'  ? 'border-red-200/80 hover:border-red-300'        :
                      ins.type === 'warning' ? 'border-amber-200/80 hover:border-amber-300'    :
                      ins.type === 'success' ? 'border-emerald-200/80 hover:border-emerald-300':
                      'border-black/[0.06]'
                    )}>
                      <div className="flex items-start gap-3">
                        <span className={cn(
                          'w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-xs mt-0.5',
                          ins.type === 'danger'  ? 'bg-red-100 text-red-600'        :
                          ins.type === 'warning' ? 'bg-amber-100 text-amber-600'   :
                          ins.type === 'success' ? 'bg-emerald-100 text-emerald-600':
                          'bg-gray-100 text-gray-500'
                        )}>
                          {ins.type === 'danger' ? '!' : ins.type === 'warning' ? '⚠' : ins.type === 'success' ? '✓' : 'i'}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 group-hover:text-violet-700 transition-colors truncate">
                            {ins.title}
                          </p>
                          <p className={cn(
                            'text-xs mt-0.5',
                            ins.type === 'danger'  ? 'text-red-500'         :
                            ins.type === 'warning' ? 'text-amber-600'      :
                            ins.type === 'success' ? 'text-emerald-600'    :
                            'text-gray-400'
                          )}>
                            {ins.detail}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ── Table ── */}
          <div>
            <SectionLabel>Project breakdown</SectionLabel>
            <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead>
                    <tr className="border-b border-black/[0.05] bg-gray-50/60">
                      {[
                        { label: 'Project',  cls: 'text-left pl-6' },
                        { label: 'Client',   cls: 'text-left'      },
                        { label: 'Status',   cls: 'text-center'    },
                        { label: 'Start',    cls: 'text-right'     },
                        { label: 'Est. End', cls: 'text-right'     },
                        { label: 'Budget',   cls: 'text-right'     },
                        { label: 'Cost',     cls: 'text-right'     },
                        { label: 'Profit',   cls: 'text-right'     },
                        { label: 'Margin',   cls: 'text-right pr-6'},
                      ].map((h) => (
                        <th key={h.label} className={cn('py-3 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-[0.08em]', h.cls)}>
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04]">
                    {filtered.map((r) => {
                      const profit    = r.budget_total != null ? r.budget_total - r.cost : null
                      const margin    = r.budget_total && r.budget_total > 0 && r.cost >= 0 ? ((r.budget_total - r.cost) / r.budget_total) * 100 : null
                      const profitPos = profit != null && profit >= 0
                      const isDelayed = r.status !== 'completed' && r.estimated_end_date && new Date(r.estimated_end_date) < today
                      return (
                        <tr key={r.id} className="hover:bg-violet-50/20 transition-colors group">
                          <td className="py-4 pl-6 pr-3">
                            <Link href={`/dashboard/projects/${r.id}`} className="group/link">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[10px] font-mono font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{r.project_code}</span>
                                {isDelayed && <span className="text-[9px] font-bold text-red-500 bg-red-50 border border-red-200/80 px-1.5 py-0.5 rounded-full">delayed</span>}
                              </div>
                              <p className="text-sm font-semibold text-gray-900 group-hover/link:text-violet-700 transition-colors">{r.name}</p>
                            </Link>
                          </td>
                          <td className="py-4 px-3"><span className="text-sm text-gray-500">{r.client_name ?? <span className="text-gray-300">—</span>}</span></td>
                          <td className="py-4 px-3 text-center"><StatusBadge status={r.status as ProjectStatus} /></td>
                          <td className="py-4 px-3 text-right"><span className="text-xs text-gray-500 tabular-nums">{formatDate(r.start_date)}</span></td>
                          <td className="py-4 px-3 text-right"><span className={cn('text-xs tabular-nums font-medium', isDelayed ? 'text-red-500 font-bold' : 'text-gray-500')}>{formatDate(r.estimated_end_date)}</span></td>
                          <td className="py-4 px-3 text-right"><span className="text-sm font-bold text-gray-900 tabular-nums">{r.budget_total != null ? formatCurrencyCompact(r.budget_total) : <span className="text-gray-300 font-normal">—</span>}</span></td>
                          <td className="py-4 px-3 text-right"><span className="text-sm font-semibold text-gray-600 tabular-nums">{r.cost > 0 ? formatCurrencyCompact(r.cost) : <span className="text-gray-300 font-normal">—</span>}</span></td>
                          <td className="py-4 px-3 text-right">
                            {profit != null ? (
                              <span className={cn('text-sm font-bold tabular-nums', profitPos ? 'text-emerald-600' : 'text-red-500')}>
                                {profitPos ? '+' : ''}{formatCurrencyCompact(profit)}
                              </span>
                            ) : <span className="text-gray-300 text-sm font-normal">—</span>}
                          </td>
                          <td className="py-4 pl-3 pr-6 text-right">
                            {margin != null ? (
                              <span className={cn('text-sm font-bold tabular-nums', margin >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                                {margin.toFixed(1)}%
                              </span>
                            ) : <span className="text-gray-300 text-sm font-normal">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-black/[0.08] bg-gray-50/60">
                      <td colSpan={5} className="py-4 pl-6 text-xs font-bold text-gray-500 uppercase tracking-wide">
                        Totals · {filtered.length} projects
                      </td>
                      <td className="py-4 px-3 text-right"><span className="text-sm font-black text-gray-900 tabular-nums">{formatCurrencyCompact(totalBudget)}</span></td>
                      <td className="py-4 px-3 text-right"><span className="text-sm font-black text-amber-600 tabular-nums">{formatCurrencyCompact(totalCost)}</span></td>
                      <td className="py-4 px-3 text-right"><span className={cn('text-sm font-black tabular-nums', totalProfit >= 0 ? 'text-emerald-600' : 'text-red-500')}>{totalProfit >= 0 ? '+' : ''}{formatCurrencyCompact(totalProfit)}</span></td>
                      <td className="py-4 pl-3 pr-6 text-right"><span className={cn('text-sm font-black tabular-nums', profitMargin >= 0 ? 'text-emerald-600' : 'text-red-500')}>{profitMargin.toFixed(1)}%</span></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
