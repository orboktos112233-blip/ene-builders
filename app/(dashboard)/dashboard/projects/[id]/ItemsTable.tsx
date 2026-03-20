'use client'

import { useState, useActionState } from 'react'
import { updateItemAction, deleteItemAction, type ItemActionState } from '@/app/actions/items'
import { ItemStatusBadge } from '@/components/ui/Badge'
import { NotesCell } from '@/components/ui/NotesCell'
import { Button } from '@/components/ui/Button'
import { formatCurrencyCompact } from '@/lib/utils'
import { getItemTotal } from '@/types/database'
import type { ProjectItem } from '@/types/database'

const initialState: ItemActionState = {}
const STATUS_SUGGESTIONS = ['Pending', 'In Progress', 'Completed', 'Cancelled']

function empty(v: string | null | undefined): boolean {
  return !v || v.trim() === ''
}

function display(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
}

// ── Single editable item row ──────────────────────────────────

function ItemRow({
  item,
  projectId,
  canEdit,
  canDelete,
}: {
  item: ProjectItem
  projectId: string
  canEdit: boolean
  canDelete: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [updateState, updateAction, updatePending] = useActionState(updateItemAction, initialState)
  const [deleteState, deleteAction, deletePending] = useActionState(deleteItemAction, initialState)

  const qtyDisplay = item.quantity != null
    ? `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`
    : '—'

  const rowTotal = getItemTotal(item)

  if (editing) {
    return (
      <tr className="bg-blue-50/30">
        <td className="px-3 py-2">
          <form
            id={`edit-${item.id}`}
            action={async (fd) => {
              await updateAction(fd)
              setEditing(false)
            }}
          >
            <input type="hidden" name="item_id" value={item.id} />
            <input type="hidden" name="project_id" value={projectId} />
          </form>
          <input
            form={`edit-${item.id}`}
            name="material"
            defaultValue={item.material ?? ''}
            placeholder="Material"
            className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </td>
        <td className="px-3 py-2">
          <div className="flex gap-1">
            <input
              form={`edit-${item.id}`}
              name="quantity"
              type="number"
              step="any"
              defaultValue={item.quantity ?? ''}
              placeholder="Qty"
              className="w-16 text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              form={`edit-${item.id}`}
              name="unit"
              defaultValue={item.unit ?? ''}
              placeholder="unit"
              className="w-14 text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </td>
        <td className="px-3 py-2">
          <input
            form={`edit-${item.id}`}
            name="unit_price"
            type="number"
            step="any"
            defaultValue={item.unit_price ?? ''}
            placeholder="0.00"
            className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </td>
        <td className="px-3 py-2">
          <input
            form={`edit-${item.id}`}
            name="total_price"
            type="number"
            step="any"
            defaultValue={item.total_price ?? ''}
            placeholder="auto"
            className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </td>
        <td className="px-3 py-2">
          <input
            form={`edit-${item.id}`}
            name="status"
            defaultValue={item.status ?? ''}
            placeholder="Status"
            list="status-suggestions-edit"
            className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <datalist id="status-suggestions-edit">
            {STATUS_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
          </datalist>
        </td>
        <td className="px-3 py-2">
          <input
            form={`edit-${item.id}`}
            name="notes"
            defaultValue={item.notes ?? ''}
            placeholder="Notes"
            className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </td>
        {/* hidden fields for non-displayed columns */}
        <input form={`edit-${item.id}`} type="hidden" name="category" value={item.category ?? ''} />
        <input form={`edit-${item.id}`} type="hidden" name="worker" value={item.worker ?? ''} />
        <input form={`edit-${item.id}`} type="hidden" name="vendor" value={item.vendor ?? ''} />
        <td className="px-3 py-2 whitespace-nowrap">
          {updateState.error && (
            <span className="text-xs text-red-600 block mb-1">{updateState.error}</span>
          )}
          <div className="flex gap-1">
            <Button
              form={`edit-${item.id}`}
              type="submit"
              size="sm"
              loading={updatePending}
              className="text-xs"
            >
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
              className="text-xs"
            >
              Cancel
            </Button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 group">
      <td className="px-3 py-2.5 text-xs text-gray-700">{display(item.material)}</td>
      <td className="px-3 py-2.5 text-xs text-gray-700 text-right whitespace-nowrap">{qtyDisplay}</td>
      <td className="px-3 py-2.5 text-xs text-gray-700 text-right whitespace-nowrap">
        {formatCurrencyCompact(item.unit_price)}
      </td>
      <td className="px-3 py-2.5 text-xs font-medium text-gray-900 text-right whitespace-nowrap">
        {formatCurrencyCompact(rowTotal)}
      </td>
      <td className="px-3 py-2.5 text-xs">
        <ItemStatusBadge status={item.status} />
      </td>
      <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[200px]">
        <NotesCell notes={item.notes} />
      </td>
      <td className="px-3 py-2.5 text-xs">
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {canEdit && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(true)}
              className="text-xs text-gray-400 hover:text-gray-700 h-6 px-2"
            >
              Edit
            </Button>
          )}
          {canDelete && (
            <form action={deleteAction}>
              <input type="hidden" name="item_id" value={item.id} />
              <input type="hidden" name="project_id" value={projectId} />
              {deleteState.error && (
                <span className="text-xs text-red-600">{deleteState.error}</span>
              )}
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                loading={deletePending}
                className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 h-6 px-2"
              >
                ×
              </Button>
            </form>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Items table ───────────────────────────────────────────────

interface ItemsTableProps {
  items: ProjectItem[]
  projectId: string
  canEdit: boolean
  canDelete: boolean
}

export function ItemsTable({ items, projectId, canEdit, canDelete }: ItemsTableProps) {
  if (items.length === 0) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-xs text-gray-400">No items yet.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100">
            {[
              { label: 'Material', align: 'left' },
              { label: 'Qty', align: 'right' },
              { label: 'Unit Price', align: 'right' },
              { label: 'Total', align: 'right' },
              { label: 'Status', align: 'left' },
              { label: 'Notes', align: 'left' },
              { label: '', align: 'left' },
            ].map((h) => (
              <th
                key={h.label}
                className={`px-3 py-2 text-xs font-medium text-gray-400 bg-white ${h.align === 'right' ? 'text-right' : 'text-left'}`}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              projectId={projectId}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
