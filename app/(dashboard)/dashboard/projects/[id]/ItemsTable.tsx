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
  'placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1C3FAA]/20 ' +
  'focus:border-[#1C3FAA] transition-colors'
const iClsR = iCls + ' text-right tabular-nums'

function display(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
}

// ── Column definitions ────────────────────────────────────────
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

// ── Mobile item card (shown on screens < md) ──────────────────

function MobileItemCard({
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
  const [editing, setEditing]   = useState(false)
  const [saved,   setSaved]     = useState(false)
  const [updateState, updateAction, updatePending] = useActionState(updateItemAction, initialState)
  const [, deleteAction, deletePending]            = useActionState(deleteItemAction, initialState)
  const prevPending = useRef(false)

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

  const rowTotal   = getItemTotal(item)
  const qtyDisplay = item.quantity != null
    ? `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`
    : null

  // ── Edit mode ─────────────────────────────────────────
  if (editing) {
    const formId = `m-edit-${item.id}`
    return (
      <div className={cn(
        'px-4 py-4 border-b border-gray-100 last:border-0 transition-colors',
        saved ? 'bg-emerald-50' : 'bg-[#F5F8FF]'
      )}>
        <form id={formId} action={updateAction} className="space-y-2">
          <input type="hidden" name="item_id"    value={item.id} />
          <input type="hidden" name="project_id" value={projectId} />

          {/* Material — primary field */}
          <input
            name="material"
            defaultValue={item.material ?? ''}
            placeholder="Material / Description"
            autoFocus
            className={iCls + ' font-medium'}
          />

          {/* Category + Worker */}
          <div className="grid grid-cols-2 gap-2">
            <input name="category" defaultValue={item.category ?? ''} placeholder="Category" className={iCls} />
            <input name="worker"   defaultValue={item.worker   ?? ''} placeholder="Worker"   className={iCls} />
          </div>

          {/* Vendor + Status */}
          <div className="grid grid-cols-2 gap-2">
            <input name="vendor" defaultValue={item.vendor ?? ''} placeholder="Vendor" className={iCls} />
            <div>
              <input
                name="status"
                defaultValue={item.status ?? ''}
                placeholder="Status"
                list={`m-status-opts-${item.id}`}
                className={iCls}
              />
              <datalist id={`m-status-opts-${item.id}`}>
                {STATUS_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
              </datalist>
            </div>
          </div>

          {/* Qty + Unit + Unit Price */}
          <div className="grid grid-cols-3 gap-2">
            <input name="quantity"   type="number" step="any" defaultValue={item.quantity   ?? ''} placeholder="Qty"    className={iClsR} />
            <input name="unit"                                defaultValue={item.unit        ?? ''} placeholder="unit"   className={iCls}  />
            <input name="unit_price" type="number" step="any" defaultValue={item.unit_price ?? ''} placeholder="Unit $" className={iClsR} />
          </div>

          {/* Total + Notes */}
          <div className="grid grid-cols-2 gap-2">
            <input name="total_price" type="number" step="any" defaultValue={item.total_price ?? ''} placeholder="Total $" className={iClsR} />
            <input name="notes"                                defaultValue={item.notes        ?? ''} placeholder="Notes"   className={iCls}  />
          </div>
        </form>

        {updateState.error && (
          <p className="text-xs text-red-500 mt-2">{updateState.error}</p>
        )}

        <div className="flex gap-2 mt-3">
          <Button form={formId} type="submit" size="sm" loading={updatePending || saved}>
            {saved ? '✓ Saved' : 'Save'}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  // ── Read mode ─────────────────────────────────────────
  return (
    <div className="px-4 py-3.5 border-b border-gray-100 last:border-0">
      {/* Material + total */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-sm font-semibold text-gray-900 leading-tight flex-1 min-w-0">
          {display(item.material)}
        </p>
        {rowTotal != null && (
          <span className="text-sm font-black text-gray-900 tabular-nums shrink-0">
            {formatCurrencyCompact(rowTotal)}
          </span>
        )}
      </div>

      {/* Status + category */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <ItemStatusBadge status={item.status} />
        {item.category && (
          <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {item.category}
          </span>
        )}
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
        {item.worker  && <span>Worker: <span className="font-medium text-gray-700">{item.worker}</span></span>}
        {item.vendor  && <span>Vendor: <span className="font-medium text-gray-700">{item.vendor}</span></span>}
        {qtyDisplay   && <span>Qty: <span className="font-medium text-gray-700">{qtyDisplay}</span></span>}
      </div>

      {/* Notes */}
      {item.notes && (
        <p className="text-[11px] text-gray-400 italic mt-1 leading-relaxed">{item.notes}</p>
      )}

      {/* Actions */}
      {(canEdit || canDelete) && (
        <div className="flex gap-1.5 mt-3">
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs font-semibold text-[#1C3FAA] px-3 py-1.5 rounded-lg bg-[#EEF2FF] border border-[#DBEAFE] hover:bg-[#EEF2FF] transition-colors"
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
                className="text-xs font-semibold text-red-500 px-3 py-1.5 rounded-lg bg-red-50 border border-red-100 hover:bg-red-100 transition-colors disabled:opacity-40"
              >
                {deletePending ? '…' : 'Delete'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

// ── Desktop table row (shown on screens >= md) ────────────────

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
  const [saved,   setSaved]   = useState(false)
  const [updateState, updateAction, updatePending] = useActionState(updateItemAction, initialState)
  const [, deleteAction, deletePending]            = useActionState(deleteItemAction, initialState)
  const prevPending = useRef(false)

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
            : 'bg-[#FAFBFF] border-[#C7D2FE]/60'
        )}
        onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false) }}
      >
        <td className="px-2 py-2">
          <form id={formId} action={updateAction}>
            <input type="hidden" name="item_id"    value={item.id} />
            <input type="hidden" name="project_id" value={projectId} />
          </form>
          <input form={formId} name="category" defaultValue={item.category ?? ''} placeholder="Category" className={iCls} />
        </td>
        <td className="px-2 py-2">
          <input form={formId} name="worker" defaultValue={item.worker ?? ''} placeholder="Worker" className={iCls} />
        </td>
        <td className="px-2 py-2">
          <input form={formId} name="material" defaultValue={item.material ?? ''} placeholder="Material / Description" className={iCls + ' font-medium'} autoFocus />
        </td>
        <td className="px-2 py-2">
          <input form={formId} name="quantity" type="number" step="any" defaultValue={item.quantity ?? ''} placeholder="0" className={iClsR} />
          <input form={formId} name="unit"     defaultValue={item.unit ?? ''}      placeholder="unit"    className={iCls + ' mt-1'} />
        </td>
        <td className="px-2 py-2">
          <input form={formId} name="vendor" defaultValue={item.vendor ?? ''} placeholder="Vendor" className={iCls} />
        </td>
        <td className="px-2 py-2">
          <input form={formId} name="status" defaultValue={item.status ?? ''} placeholder="Status" list={`status-opts-${item.id}`} className={iCls} />
          <datalist id={`status-opts-${item.id}`}>
            {STATUS_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
          </datalist>
        </td>
        <td className="px-2 py-2">
          <input form={formId} name="notes" defaultValue={item.notes ?? ''} placeholder="Notes" className={iCls} />
        </td>
        <td className="px-2 py-2">
          <input form={formId} name="unit_price"  type="number" step="any" defaultValue={item.unit_price  ?? ''} placeholder="Unit $" className={iClsR} />
          <input form={formId} name="total_price" type="number" step="any" defaultValue={item.total_price ?? ''} placeholder="Total"   className={iClsR + ' mt-1'} />
        </td>
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
      <td className="px-3 py-2.5">
        <span className="text-xs text-gray-500">{display(item.category)}</span>
      </td>
      <td className="px-3 py-2.5">
        <span className="text-xs text-gray-500">{display(item.worker)}</span>
      </td>
      <td className="px-3 py-2.5">
        <span className="text-sm font-semibold text-gray-800">{display(item.material)}</span>
      </td>
      <td className="px-3 py-2.5 text-xs text-gray-600 text-right whitespace-nowrap tabular-nums">
        {qtyDisplay}
      </td>
      <td className="px-3 py-2.5">
        <span className="text-xs text-gray-500">{display(item.vendor)}</span>
      </td>
      <td className="px-3 py-2.5">
        <ItemStatusBadge status={item.status} />
      </td>
      <td className="px-3 py-2.5 max-w-[160px]">
        <NotesCell notes={item.notes} />
      </td>
      <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">
        <span className="text-sm font-bold text-gray-900">{formatCurrencyCompact(rowTotal)}</span>
      </td>
      <td className="px-3 py-2.5 text-right">
        <div className="flex gap-0.5 justify-end opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-150">
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-[11px] font-semibold text-gray-400 hover:text-[#1C3FAA] px-2 py-1 rounded-md hover:bg-[#F0F4FF] transition-colors"
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
    <>
      {/* Mobile: card list (hidden md+) */}
      <div className="block md:hidden divide-y divide-gray-50">
        {items.map((item) => (
          <MobileItemCard
            key={item.id}
            item={item}
            projectId={projectId}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        ))}
      </div>

      {/* Desktop: scrollable table (hidden on mobile) */}
      <div className="hidden md:block overflow-x-auto">
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
    </>
  )
}
