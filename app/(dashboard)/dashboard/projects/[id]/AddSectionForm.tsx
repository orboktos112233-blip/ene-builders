'use client'

import { useActionState, useState } from 'react'
import { addSectionAction, type SectionActionState } from '@/app/actions/sections'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormError } from '@/components/ui/FormError'

const initialState: SectionActionState = {}

export function AddSectionForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(addSectionAction, initialState)
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm font-semibold text-gray-400 hover:border-[#1C3FAA]/30 hover:text-[#1C3FAA] hover:bg-[#F0F4FF]/40 transition-all duration-150"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add Section
      </button>
    )
  }

  return (
    <form
      action={async (fd) => {
        await action(fd)
        setOpen(false)
      }}
      className="flex items-end gap-3 p-4 bg-white border border-[#C7D2FE] rounded-xl shadow-sm"
    >
      <input type="hidden" name="project_id" value={projectId} />
      <div className="flex-1">
        <FormError message={state.error} />
        <Input
          id="section_name"
          name="name"
          label="Section Name"
          placeholder="e.g. Kitchen, Landscaping, Master Bedroom"
          autoFocus
          required
        />
      </div>
      <div className="flex gap-2 mb-0.5">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" size="sm" loading={pending}>
          Add
        </Button>
      </div>
    </form>
  )
}
