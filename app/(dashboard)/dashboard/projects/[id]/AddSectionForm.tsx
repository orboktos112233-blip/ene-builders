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
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        + Add Section
      </Button>
    )
  }

  return (
    <form
      action={async (fd) => {
        await action(fd)
        setOpen(false)
      }}
      className="flex items-end gap-3 p-4 bg-white border border-blue-200 rounded-xl"
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
