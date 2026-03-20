'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyCompact, formatDate } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/Badge'
import Link from 'next/link'
import type { ProjectStatus } from '@/types/database'

export interface ReportRow {
  id: string
  project_code: string
  name: string
  status: string
  start_date: string | null
  estimated_end_date: string | null
  budget_total: number | null
  cost: number
  client_name: string | null
  sections: number
  items: number
}

interface Props {
  rows: ReportRow[]
}

const STATUS_OPTIONS = [
  { value: '',            label: 'All statuses'  },
  { value: 'planning',    label: 'Planning'      },
  { value: 'in_progress', label: 'In Progress'   },
  { value: 'finishing',   label: 'Finishing'     },
  { value: 'inspection',  label: 'Inspection'    },
  { value: 'completed',   label: 'Completed'     },
]

export function ReportsClient({ rows }: Props) {
  const [statusFilter, setStatusFilter] = useState('')
  const [query,        setQuery]        = useState('')

  const q = query.trim().toLowerCase()
  const filtered = rows.filter((r) => {
    const matchesSearch = !q ||
      r.name.toLowerCase().includes(q) ||
      r.project_code.toLowerCase().includes(q) ||
      (r.client_name ?? '').toLowerCase().includes(q)
    const matchesStatus = !statusFilter || r.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Aggregate totals over filtered rows
  const totalBudget = filtered.reduce((s, r) => s + (r.budget_total ?? 0), 0)
  const totalCost   = filtered.reduce((s, r) => s + r.cost, 0)
  const totalProfit = totalBudget - totalCost

  function exportCSV() {
    const headers = ['Code','Project','Client','Status','Start','Est. End','Budget','Cost','Profit','Sections','Items']
    const csvRows = [
      headers.join(','),
      ...filtered.map((r) => {
        const profit = r.budget_total != null ? r.budget_total - r.cost : ''
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
          r.sections,
          r.items,
        ].join(',')
      }),
    ]
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `ene-builders-report-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">

      {/* ── Aggregate KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Projects',     value: filtered.length.toString(),         color: '' },
          { label: 'Total Budget', value: formatCurrencyCompact(totalBudget), color: '' },
          { label: 'Total Cost',   value: formatCurrencyCompact(totalCost),   color: 'text-amber-600' },
          {
            label: 'Net Profit',
            value: formatCurrencyCompact(totalProfit),
            color: totalProfit >= 0 ? 'text-emerald-600' : 'text-red-500',
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06)] px-5 py-5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.08em] mb-2">{stat.label}</p>
            <p className={cn('text-2xl font-black tracking-tight tabular-nums', stat.color || 'text-gray-900')}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
        <div className="px-4 py-3 border-b border-black/[0.05] bg-gray-50/60 flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects..."
              className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-black/[0.08] rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-2 pl-3 pr-7 text-sm bg-white border border-black/[0.08] rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all appearance-none cursor-pointer"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='m19 9-7 7-7-7'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '14px' }}
          >
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-gray-400">{filtered.length} projects</span>
            <button
              type="button"
              onClick={exportCSV}
              className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 border border-violet-200/80 px-3 py-1.5 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-800 bg-white hover:bg-gray-50 border border-black/[0.08] px-3 py-1.5 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
              </svg>
              Print
            </button>
          </div>
        </div>

        {/* ── Table ── */}
        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm font-semibold text-gray-500">No projects match</p>
            <button type="button" onClick={() => { setQuery(''); setStatusFilter('') }} className="mt-3 text-xs text-violet-600 hover:text-violet-800 font-semibold transition-colors">
              Clear filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-black/[0.05] bg-gray-50/50">
                  {[
                    { label: 'Project',   cls: 'text-left  pl-6'  },
                    { label: 'Client',    cls: 'text-left'        },
                    { label: 'Status',    cls: 'text-center'      },
                    { label: 'Start',     cls: 'text-right'       },
                    { label: 'Est. End',  cls: 'text-right'       },
                    { label: 'Budget',    cls: 'text-right'       },
                    { label: 'Cost',      cls: 'text-right'       },
                    { label: 'Profit',    cls: 'text-right pr-6'  },
                  ].map((h) => (
                    <th key={h.label} className={cn('py-3 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-[0.08em]', h.cls)}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {filtered.map((r) => {
                  const profit = r.budget_total != null ? r.budget_total - r.cost : null
                  const profitPos = profit != null && profit >= 0
                  return (
                    <tr key={r.id} className="hover:bg-violet-50/20 transition-colors group">
                      <td className="py-4 pl-6 pr-3">
                        <Link href={`/dashboard/projects/${r.id}`} className="group/link">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-mono font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                              {r.project_code}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-gray-900 group-hover/link:text-violet-700 transition-colors">
                            {r.name}
                          </p>
                        </Link>
                      </td>
                      <td className="py-4 px-3">
                        <span className="text-sm text-gray-500">{r.client_name ?? <span className="text-gray-300">—</span>}</span>
                      </td>
                      <td className="py-4 px-3 text-center">
                        <StatusBadge status={r.status as ProjectStatus} />
                      </td>
                      <td className="py-4 px-3 text-right">
                        <span className="text-xs text-gray-500 tabular-nums">{formatDate(r.start_date)}</span>
                      </td>
                      <td className="py-4 px-3 text-right">
                        <span className="text-xs text-gray-500 tabular-nums">{formatDate(r.estimated_end_date)}</span>
                      </td>
                      <td className="py-4 px-3 text-right">
                        <span className="text-sm font-bold text-gray-900 tabular-nums">
                          {r.budget_total != null ? formatCurrencyCompact(r.budget_total) : <span className="text-gray-300 font-normal">—</span>}
                        </span>
                      </td>
                      <td className="py-4 px-3 text-right">
                        <span className="text-sm font-semibold text-gray-600 tabular-nums">
                          {r.cost > 0 ? formatCurrencyCompact(r.cost) : <span className="text-gray-300 font-normal">—</span>}
                        </span>
                      </td>
                      <td className="py-4 pl-3 pr-6 text-right">
                        {profit != null ? (
                          <span className={cn('text-sm font-bold tabular-nums', profitPos ? 'text-emerald-600' : 'text-red-500')}>
                            {profitPos ? '+' : ''}{formatCurrencyCompact(profit)}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-sm font-normal">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {/* Totals footer */}
              <tfoot>
                <tr className="border-t border-black/[0.08] bg-gray-50/60">
                  <td colSpan={5} className="py-3.5 pl-6 text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Totals ({filtered.length} projects)
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <span className="text-sm font-black text-gray-900 tabular-nums">{formatCurrencyCompact(totalBudget)}</span>
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <span className="text-sm font-black text-amber-600 tabular-nums">{formatCurrencyCompact(totalCost)}</span>
                  </td>
                  <td className="py-3.5 pl-3 pr-6 text-right">
                    <span className={cn('text-sm font-black tabular-nums', totalProfit >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                      {totalProfit >= 0 ? '+' : ''}{formatCurrencyCompact(totalProfit)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
