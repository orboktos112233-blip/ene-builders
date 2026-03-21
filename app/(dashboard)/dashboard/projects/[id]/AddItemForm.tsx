'use client'

import { useState, useRef, useEffect, useActionState } from 'react'
import { addItemAction, type ItemActionState } from '@/app/actions/items'
import { Button } from '@/components/ui/Button'
import { FormError } from '@/components/ui/FormError'

const initialState: ItemActionState = {}
const STATUS_SUGGESTIONS = ['Pending', 'In Progress', 'Completed', 'Cancelled']

const iCls =
  'w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 bg-white placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-colors'
const iClsR = iCls + ' text-right tabular-nums'

// Session-level memory — survives form unmount/remount within same page session
const lastUsed = { category: '', vendor: '', worker: '' }

interface AddItemFormProps {
  projectId: string
  sectionId: string
  onClose: () => void
}

export function AddItemForm({ projectId, sectionId, onClose }: AddItemFormProps) {
  const [state, action, pending] = useActionState(addItemAction, initialState)
  const [formKey, setFormKey]     = useState(0)
  const [savedCount, setSavedCount] = useState(0)
  const formRef    = useRef<HTMLFormElement>(null)
  const prevPending = useRef(false)

  useEffect(() => {
    if (prevPending.current && !pending) {
      if (!state.error) {
        if (formRef.current) {
          const fd  = new FormData(formRef.current)
          const cat = fd.get('category') as string
          const ven = fd.get('vendor')   as string
          const wrk = fd.get('worker')   as string
          if (cat) lastUsed.category = cat
          if (ven) lastUsed.vendor   = ven
          if (wrk) lastUsed.worker   = wrk
        }
        setSavedCount((n) => n + 1)
        setFormKey((k) => k + 1)
      }
    }
    prevPending.current = pending
  }, [pending, state.error])

  return (
    <form
      ref={formRef}
      action={action}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      className="px-4 py-4 bg-violet-50/30 border-b border-violet-100"
    >
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="section_id" value={sectionId} />

      {/* Status bar */}
      {state.error
        ? <FormError message={state.error} />
        : savedCount > 0 && (
          <p className="text-[11px] font-semibold text-emerald-600 mb-2">
            ✓ Item saved — enter another or press Escape to close
          </p>
        )
      }

      {/* ── Mobile: stacked 2-col grid (hidden md+) ───────────────── */}
      <div key={formKey} className="block md:hidden space-y-2 mb-3">
        <input
          name="material"
          placeholder="Material / Description"
          className={iCls + ' font-medium'}
          autoFocus
        />
        <div className="grid grid-cols-2 gap-2">
          <input name="category" placeholder="Category" defaultValue={lastUsed.category} className={iCls} />
          <input name="worker"   placeholder="Worker"   defaultValue={lastUsed.worker}   className={iCls} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input name="vendor"  placeholder="Vendor"  defaultValue={lastUsed.vendor} className={iCls} />
          <div>
            <input name="status" placeholder="Status" className={iCls} list="add-item-status-opts-m" defaultValue="In Progress" />
            <datalist id="add-item-status-opts-m">
              {STATUS_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <input name="quantity"   type="number" step="any" placeholder="Qty"    className={iClsR} />
          <input name="unit"                               placeholder="unit"   className={iCls}  />
          <input name="unit_price" type="number" step="any" placeholder="Unit $" className={iClsR} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input name="total_price" type="number" step="any" placeholder="Total (auto)" className={iClsR} />
          <input name="notes"                               placeholder="Notes"         className={iCls}  />
        </div>
      </div>

      {/* ── Desktop: single-row grid (hidden on mobile) ──────────── */}
      <div className="hidden md:block overflow-x-auto mb-3">
        <div key={formKey + 1000} className="grid grid-cols-[110px_110px_1fr_90px_110px_120px_160px_120px] gap-2 min-w-[860px]">
          <input name="category"  placeholder="Category"              defaultValue={lastUsed.category} className={iCls} />
          <input name="worker"    placeholder="Worker"                defaultValue={lastUsed.worker}   className={iCls} />
          <input name="material"  placeholder="Material / Description"                                 className={iCls + ' font-medium'} autoFocus />
          <div className="flex flex-col gap-1">
            <input name="quantity" type="number" step="any" placeholder="Qty"  className={iClsR} />
            <input name="unit"                              placeholder="unit" className={iCls}  />
          </div>
          <input name="vendor" placeholder="Vendor" defaultValue={lastUsed.vendor} className={iCls} />
          <div>
            <input name="status" placeholder="Status" className={iCls} list="add-item-status-opts" defaultValue="In Progress" />
            <datalist id="add-item-status-opts">
              {STATUS_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
          <input name="notes" placeholder="Notes" className={iCls} />
          <div className="flex flex-col gap-1">
            <input name="unit_price"  type="number" step="any" placeholder="Unit $"      className={iClsR} />
            <input name="total_price" type="number" step="any" placeholder="Total (auto)" className={iClsR} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-gray-400 hidden sm:block">
          <kbd className="font-mono bg-gray-100 px-1 py-0.5 rounded text-gray-500">Enter</kbd> saves ·{' '}
          <kbd className="font-mono bg-gray-100 px-1 py-0.5 rounded text-gray-500">Esc</kbd> closes
        </p>
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Close
          </button>
          <Button type="submit" size="sm" loading={pending}>
            Save Item
          </Button>
        </div>
      </div>
    </form>
  )
}
