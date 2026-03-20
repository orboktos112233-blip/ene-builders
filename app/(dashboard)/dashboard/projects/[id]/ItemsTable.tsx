'use client'

import { useState, useRef, useEffect, useActionState } from 'react'
import { updateItemAction, deleteItemAction, type ItemActionState } from '@/app/actions/items'
import { ItemStatusBadge } from '@/components/ui/Badge'
import { NotesCell } from '@/components/ui/NotesCell'
import { Button } from '@/components/ui/Button'
import { formatCurrencyCompact } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { getItemTotal } from '@/types/database'
import type { ProjectItem } from '@/types/database'

const initialState: ItemActionState = {}
const STATUS_SUGGESTIONS = ['Pending', 'In Progress', 'Completed', 'Cancelled']

// Input styles — consistent across all edit cells
const iCls =
  'w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white ' +
  'placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ' +
  'focus:border-indigo-400 transition-colors'
const iClsR = iCls + ' text-right tabular-nums'

function display(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
}

// ── Column definitions ────────────────────────────────────────
// Used to keep header and rows in lockstep.

const COLUMNS = [
  { label: 'Category',    align: 'left',  width: 'w-[110px]' },
  { label: 'Worker',      align: 'left',  width: 'w-[110px]' },
  { label: 'Material',    align: 'left',  width: ''           }, // flex grow
  { label: 'Qty',         align: 'right', width: 'w-[80px]'  },
  { label: 'Vendor',      align: 'left',  width: 'w-[110px]' },
  { label: 'Status',      align: 'left',  width: 'w-[110px]' },
  { label: 'Notes',       align: 'left',  width: 'w-[160px]' },
  { label: 'Total',       align: 'right', width: 'w-[100px]' },
  { label: '',            align: 'right', width: 'w-[70px]'  },
] as const

// ── Single row ────────────────────────────────────────────────

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
  const [saved, setSaved] = useState(false)
  const [updateState, updateAction, updatePending] = useActionState(updateItemAction, initialState)
  const [, deleteAction, deletePending] = useActionState(deleteItemAction, initialState)
  const prevPending = useRef(false)

  // Detect successful save → brief green flash → close
  useEffect(() => {
    if (prevPending.current && !updatePending) {
      if (!updateState.error) {
        setSaved(true)
        const t = setTimeout(() => { setSaved(false); setEditing(false) }, 500)
        return () => clearTimeout(t)
      }
    }
    prevPending.current = updatePending
  }, [updatePending, updateState.error])

  const qtyDisplay =
    item.quantity != null
      ? `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`
      : '—'
  const rowTotal = getItemTotal(item)

  // ── Edit mode ─────────────────────────────────────────
  if (editing) {
    const formId = `edit-${item.id}`
    return (
      <tr
        className={cn(
          'border-b transition-colors duration-300',
          saved
            ? 'bg-emerald-50 border-emerald-100'
            : 'bg-indigo-50/20 border-indigo-100/60'
        )}
        onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false) }}
      >
        {/* Hidden form that all inputs submit to */}
        <td className="px-2 py-2">
          <form id={formId} action={updateAction}>
            <input type="hidden" name="item_id"    value={item.id} />
            <input type="hidden" name="project_id" value={projectId} />
          </form>
          <input
            form={formId}
            name="category"
            defaultValue={item.category ?? ''}
            placeholder="Category"
            className={iCls}
          />
        </td>

        <td className="px-2 py-2">
          <input
            form={formId}
            name="worker"
            defaultValue={item.worker ?? ''}
            placeholder="Worker"
            className={iCls}
          />
        </td>

        <td className="px-2 py-2">
          <input
            form={formId}
            name="material"
            defaultValue={item.material ?? ''}
            placeholder="Material / Description"
            className={iCls + ' font-medium'}
            autoFocus
          />
        </td>

        {/* Qty + Unit stacked in one cell */}
        <td className="px-2 py-2">
          <input
            form={formId}
            name="quantity"
            type="number"
            step="any"
            defaultValue={item.quantity ?? ''}
            placeholder="0"
            className={iClsR}
          />
          <input
            form={formId}
            name="unit"
            defaultValue={item.unit ?? ''}
            placeholder="unit"
            className={iCls + ' mt-1'}
          />
        </td>

        <td className="px-2 py-2">
          <input
            form={formId}
            name="vendor"
            defaultValue={item.vendor ?? ''}
            placeholder="Vendor"
            className={iCls}
          />
        </td>

        <td className="px-2 py-2">
          <input
            form={formId}
            name="status"
            defaultValue={item.status ?? ''}
            placeholder="Status"
            list={`status-opts-${item.id}`}
            className={iCls}
          />
          <datalist id={`status-opts-${item.id}`}>
            {STATUS_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
          </datalist>
        </td>

        <td className="px-2 py-2">
          <input
            form={formId}
            name="notes"
            defaultValue={item.notes ?? ''}
            placeholder="Notes"
            className={iCls}
          />
        </td>

        {/* Unit price + Total stacked — unit_price feeds auto-calc */}
        <td className="px-2 py-2">
          <input
            form={formId}
            name="unit_price"
            type="number"
            step="any"
            defaultValue={item.unit_price ?? ''}
            placeholder="Unit $"
            className={iClsR}
          />
          <input
            form={formId}
            name="total_price"
            type="number"
            step="any"
            defaultValue={item.total_price ?? ''}
            placeholder="Total"
            className={iClsR + ' mt-1'}
          />
        </td>

        {/* Save / Cancel */}
        <td className="px-2 py-2 whitespace-nowrap align-top">
          {updateState.error && (
            <p className="text-[11px] text-red-500 mb-1">{updateState.error}</p>
          )}
          <div className="flex flex-col gap-1">
            <Button form={formId} type="submit" size="sm" loading={updatePending || saved}>
              {saved ? '✓' : 'Save'}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Esc
            </Button>
          </div>
        </td>
      </tr>
    )
  }

  // ── Read mode ─────────────────────────────────────────
  return (
    <tr className="border-b border-gray-50 last:border-0 hover:bg-slate-50/60 group transition-colors duration-100">
      {/* Category */}
      <td className="px-3 py-2.5">
        <span className="text-xs text-gray-500">{display(item.category)}</span>
      </td>

      {/* Worker */}
      <td className="px-3 py-2.5">
        <span className="text-xs text-gray-500">{display(item.worker)}</span>
      </td>

      {/* Material — primary, bold */}
      <td className="px-3 py-2.5">
        <span className="text-sm font-semibold text-gray-800">{display(item.material)}</span>
      </td>

      {/* Quantity */}
      <td className="px-3 py-2.5 text-xs text-gray-600 text-right whitespace-nowrap tabular-nums">
        {qtyDisplay}
      </td>

      {/* Vendor */}
      <td className="px-3 py-2.5">
        <span className="text-xs text-gray-500">{display(item.vendor)}</span>
      </td>

      {/* Status */}
      <td className="px-3 py-2.5">
        <ItemStatusBadge status={item.status} />
      </td>

      {/* Notes */}
      <td className="px-3 py-2.5 max-w-[160px]">
        <NotesCell notes={item.notes} />
      </td>

      {/* Total Price */}
      <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">
        <span className="text-sm font-bold text-gray-900">{formatCurrencyCompact(rowTotal)}</span>
      </td>

      {/* Row actions — visible on hover */}
      <td className="px-3 py-2.5 text-right">
        <div className="flex gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-[11px] font-semibold text-gray-400 hover:text-indigo-600 px-2 py-1 rounded-md hover:bg-indigo-50 transition-colors"
            >
              Edit
            </button>
          )}
          {canDelete && (
            <form action={deleteAction}>
              <input type="hidden" name="item_id"    value={item.id} />
              <input type="hidden" name="project_id" value={projectId} />
              <button
                type="submit"
                disabled={deletePending}
                className="text-[11px] font-semibold text-gray-400 hover:text-red-500 px-2 py-1 rounded-md hover:bg-red-50 transition-colors disabled:opacity-40"
              >
                ×
              </button>
            </form>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Table ─────────────────────────────────────────────────────

interface ItemsTableProps {
  items: ProjectItem[]
  projectId: string
  canEdit: boolean
  canDelete: boolean
}

export function ItemsTable({ items, projectId, canEdit, canDelete }: ItemsTableProps) {
  if (items.length === 0) return null  // empty state handled by SectionCard

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px]">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/70">
            {COLUMNS.map((col, i) => (
              <th
                key={i}
                className={cn(
                  'px-3 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest',
                  col.width,
                  col.align === 'right' ? 'text-right' : 'text-left'
                )}
              >
                {col.label}
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
