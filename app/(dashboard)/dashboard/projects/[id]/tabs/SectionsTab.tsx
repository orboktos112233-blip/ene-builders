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

  return (
    <div className="space-y-5">

      {/* ── Financial summary ── */}
      {sections.length > 0 && hasPricing && (
        budget != null ? (
          // Full 3-card financial bar when budget is set
          <div className="grid grid-cols-3 gap-4">
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
          // Grand total hero banner when no budget
          <div className="relative overflow-hidden rounded-2xl bg-gray-900 px-8 py-7 text-white shadow-lg">
            <div className="absolute -right-6 -top-6 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
            <div className="absolute -right-2 bottom-0 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
            <div className="relative">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                Total Project Cost
              </p>
              <p className="text-5xl font-black tracking-tight tabular-nums mt-1">
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
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Sections',    value: sections.length },
            { label: 'Items',       value: totalItems },
            { label: 'In Progress', value: inProgress },
            { label: 'Completed',   value: completed },
          ].map((stat) => (
            <div key={stat.label} className="bg-white border border-gray-200 rounded-xl px-4 py-4 text-center shadow-sm">
              <p className="text-2xl font-black text-gray-900 tabular-nums">{stat.value}</p>
              <p className="text-xs text-gray-400 mt-1 font-medium">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Add section */}
      {canManage && (
        <AddSectionForm projectId={projectId} />
      )}

      {/* Empty state */}
      {sections.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl py-20 text-center shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
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
        <div className="space-y-4">
          {sections.map((section) => (
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
      'rounded-2xl px-6 py-5 shadow-sm border',
      isPositive ? 'bg-emerald-50 border-emerald-200' :
      isNegative ? 'bg-red-50 border-red-200' :
      'bg-white border-gray-200'
    )}>
      <p className={cn(
        'text-[11px] font-bold uppercase tracking-widest mb-2',
        isPositive ? 'text-emerald-600' :
        isNegative ? 'text-red-500' :
        'text-gray-400'
      )}>
        {label}
      </p>
      <p className={cn(
        'text-3xl font-black tabular-nums tracking-tight',
        isPositive ? 'text-emerald-700' :
        isNegative ? 'text-red-600' :
        valueClass ?? 'text-gray-900'
      )}>
        {formatCurrency(Math.abs(value))}
      </p>
      {sub && (
        <p className={cn(
          'text-xs mt-2',
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
