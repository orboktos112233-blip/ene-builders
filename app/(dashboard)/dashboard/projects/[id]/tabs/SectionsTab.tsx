'use client'

import { useState } from 'react'
import type { SectionWithItems } from '@/types/database'
import { getItemTotal } from '@/types/database'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { SectionCard } from '../SectionCard'
import { AddSectionForm } from '../AddSectionForm'

interface SectionsTabProps {
  projectId: string
  sections: SectionWithItems[]
  budgetTotal?: number | null
  canManage: boolean
  canEdit: boolean
  canDelete: boolean
}

export function SectionsTab({
  projectId,
  sections,
  budgetTotal,
  canManage,
  canEdit,
  canDelete,
}: SectionsTabProps) {
  const [query, setQuery] = useState('')

  // ── Financial summary — always over full data ──────────────
  const allItems = sections.flatMap((s) => s.project_items)
  const totalItems = allItems.length
  const inProgress = allItems.filter((i) => i.status?.toLowerCase().includes('progress')).length
  const completed = allItems.filter(
    (i) => ['done', 'complete', 'completed', 'finished'].includes(i.status?.toLowerCase() ?? '')
  ).length
  const grandTotal = allItems.reduce((sum, i) => sum + (getItemTotal(i) ?? 0), 0)
  const hasPricing = allItems.some((i) => getItemTotal(i) != null)

  const budget = budgetTotal ?? null
  const profit = budget != null ? budget - grandTotal : null

  // ── Search filtering ───────────────────────────────────────
  const q = query.trim().toLowerCase()

  const displaySections: SectionWithItems[] = q
    ? sections
        .map((section) => ({
          ...section,
          project_items: section.project_items.filter((item) =>
            (item.category ?? '').toLowerCase().includes(q) ||
            (item.worker   ?? '').toLowerCase().includes(q) ||
            (item.material ?? '').toLowerCase().includes(q) ||
            (item.vendor   ?? '').toLowerCase().includes(q) ||
            (item.status   ?? '').toLowerCase().includes(q) ||
            (item.notes    ?? '').toLowerCase().includes(q)
          ),
        }))
        .filter((section) => section.project_items.length > 0)
    : sections

  return (
    <div className="space-y-5">

      {/* ── Financial summary ── */}
      {sections.length > 0 && hasPricing && (
        budget != null ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FinancialCard
              label="Budget / Revenue"
              value={budget}
              sub={`${sections.length} section${sections.length !== 1 ? 's' : ''} · ${totalItems} items`}
            />
            <FinancialCard
              label="Total Cost"
              value={grandTotal}
              sub={`${totalItems} item${totalItems !== 1 ? 's' : ''} tracked`}
              valueClass="text-gray-900"
            />
            <FinancialCard
              label={profit != null && profit < 0 ? 'Over Budget' : 'Profit / Margin'}
              value={profit ?? 0}
              sub={profit != null && profit >= 0 ? 'Surplus' : 'Over budget'}
              variant={profit != null && profit >= 0 ? 'positive' : 'negative'}
            />
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-2xl bg-gray-900 px-5 py-5 sm:px-8 sm:py-7 text-white shadow-lg">
            <div className="absolute -right-6 -top-6 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
            <div className="absolute -right-2 bottom-0 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
            <div className="relative">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                Total Project Cost
              </p>
              <p className="text-3xl sm:text-5xl font-black tracking-tight tabular-nums mt-1">
                {formatCurrency(grandTotal)}
              </p>
              <p className="flex items-center gap-3 mt-4 text-gray-400 text-xs font-medium">
                <span>{sections.length} section{sections.length !== 1 ? 's' : ''}</span>
                <span className="text-gray-700">·</span>
                <span>{totalItems} item{totalItems !== 1 ? 's' : ''}</span>
                {completed > 0 && (
                  <>
                    <span className="text-gray-700">·</span>
                    <span className="text-emerald-400">{completed} completed</span>
                  </>
                )}
              </p>
            </div>
          </div>
        )
      )}

      {/* Item count stats (no pricing yet) */}
      {sections.length > 0 && !hasPricing && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Sections',    value: sections.length },
            { label: 'Items',       value: totalItems },
            { label: 'In Progress', value: inProgress },
            { label: 'Completed',   value: completed },
          ].map((stat) => (
            <div key={stat.label} className="bg-white border border-gray-200 rounded-xl px-3 py-3.5 text-center shadow-sm">
              <p className="text-xl sm:text-2xl font-black text-gray-900 tabular-nums">{stat.value}</p>
              <p className="text-[11px] sm:text-xs text-gray-400 mt-1 font-medium">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Add section */}
      {canManage && (
        <AddSectionForm projectId={projectId} />
      )}

      {/* Empty state — no sections at all */}
      {sections.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl py-20 text-center shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-700">No sections yet</p>
          <p className="text-xs text-gray-400 mt-1.5">
            {canManage
              ? 'Start by adding your first section above.'
              : 'No sections have been added to this project.'}
          </p>
        </div>
      ) : (
        <>
          {/* ── Search bar ── */}
          <div className="relative max-w-sm">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
              fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search items..."
              className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-black/[0.08] rounded-xl text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Clear search"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* ── No search results ── */}
          {q && displaySections.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl py-16 text-center shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-600">No items found</p>
              <p className="text-xs text-gray-400 mt-1">No results for &ldquo;{query}&rdquo;</p>
              <button
                type="button"
                onClick={() => setQuery('')}
                className="mt-4 text-xs text-violet-600 hover:text-violet-800 font-semibold transition-colors"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {displaySections.map((section) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  canManage={canManage}
                  canEdit={canEdit}
                  canDelete={canDelete}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Financial summary card ────────────────────────────────────

function FinancialCard({
  label,
  value,
  sub,
  variant,
  valueClass,
}: {
  label: string
  value: number
  sub?: string
  variant?: 'positive' | 'negative'
  valueClass?: string
}) {
  const isPositive = variant === 'positive'
  const isNegative = variant === 'negative'

  return (
    <div className={cn(
      'rounded-2xl px-4 sm:px-6 py-4 sm:py-5 shadow-sm border',
      isPositive ? 'bg-emerald-50 border-emerald-200' :
      isNegative ? 'bg-red-50 border-red-200' :
      'bg-white border-gray-200'
    )}>
      <p className={cn(
        'text-[10px] font-bold uppercase tracking-widest mb-1.5',
        isPositive ? 'text-emerald-600' :
        isNegative ? 'text-red-500' :
        'text-gray-400'
      )}>
        {label}
      </p>
      <p className={cn(
        'text-xl sm:text-2xl font-black tabular-nums tracking-tight break-all',
        isPositive ? 'text-emerald-700' :
        isNegative ? 'text-red-600' :
        valueClass ?? 'text-gray-900'
      )}>
        {formatCurrency(Math.abs(value))}
      </p>
      {sub && (
        <p className={cn(
          'text-xs mt-1.5',
          isPositive ? 'text-emerald-600' :
          isNegative ? 'text-red-400' :
          'text-gray-400'
        )}>
          {sub}
        </p>
      )}
    </div>
  )
}
