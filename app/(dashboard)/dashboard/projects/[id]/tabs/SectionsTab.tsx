import type { SectionWithItems } from '@/types/database'
import { getItemTotal } from '@/types/database'
import { formatCurrency } from '@/lib/utils'
import { SectionCard } from '../SectionCard'
import { AddSectionForm } from '../AddSectionForm'

interface SectionsTabProps {
  projectId: string
  sections: SectionWithItems[]
  canManage: boolean     // admin or PM
  canEdit: boolean       // admin, PM, office
  canDelete: boolean     // admin only
}

export function SectionsTab({
  projectId,
  sections,
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

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      {sections.length > 0 && (
        <div className="space-y-3">
          {/* Grand total banner */}
          {hasPricing && (
            <div className="bg-gray-900 text-white rounded-xl px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Total All Expenses</p>
                <p className="text-2xl font-bold mt-0.5">{formatCurrency(grandTotal)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">{sections.length} section{sections.length !== 1 ? 's' : ''}</p>
                <p className="text-xs text-gray-400">{totalItems} item{totalItems !== 1 ? 's' : ''}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Sections', value: sections.length },
              { label: 'Items', value: totalItems },
              { label: 'In Progress', value: inProgress },
              { label: 'Completed', value: completed },
            ].map((stat) => (
              <div key={stat.label} className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-center">
                <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add section form */}
      {canManage && (
        <AddSectionForm projectId={projectId} />
      )}

      {/* Section cards */}
      {sections.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl py-16 text-center">
          <p className="text-sm text-gray-400">No sections yet.</p>
          {canManage && (
            <p className="text-xs text-gray-300 mt-1">Add a section above to get started.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
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
