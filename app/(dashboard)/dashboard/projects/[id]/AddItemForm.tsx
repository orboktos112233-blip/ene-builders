'use client'

import { useActionState } from 'react'
import { addItemAction, type ItemActionState } from '@/app/actions/items'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormError } from '@/components/ui/FormError'

const initialState: ItemActionState = {}

const STATUS_SUGGESTIONS = ['Pending', 'In Progress', 'Completed', 'Cancelled']

interface AddItemFormProps {
  projectId: string
  sectionId: string
  onClose: () => void
}

export function AddItemForm({ projectId, sectionId, onClose }: AddItemFormProps) {
  const [state, action, pending] = useActionState(addItemAction, initialState)

  return (
    <form
      action={async (fd) => {
        await action(fd)
        onClose()
      }}
      className="p-4 bg-blue-50/40 space-y-3"
    >
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="section_id" value={sectionId} />

      <FormError message={state.error} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Input name="material" placeholder="Material / Description" className="text-sm" />
        <div className="flex gap-2">
          <Input name="quantity" type="number" step="any" placeholder="Qty" className="text-sm" />
          <Input name="unit" placeholder="Unit" className="text-sm w-20" />
        </div>
        <Input name="unit_price" type="number" step="any" placeholder="Unit Price ($)" className="text-sm" />
        <Input name="total_price" type="number" step="any" placeholder="Total ($) — optional" className="text-sm" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Input name="category" placeholder="Category" className="text-sm" />
        <Input name="worker" placeholder="Worker" className="text-sm" />
        <Input name="vendor" placeholder="Vendor/Supplier" className="text-sm" />
        <div>
          <Input
            name="status"
            placeholder="Status"
            className="text-sm"
            list="status-suggestions"
            defaultValue="Pending"
          />
          <datalist id="status-suggestions">
            {STATUS_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
          </datalist>
        </div>
      </div>

      <Input name="notes" placeholder="Notes" className="text-sm" />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" size="sm" loading={pending}>Save Item</Button>
      </div>
    </form>
  )
}
