'use client'

import { useActionState } from 'react'
import { createProjectAction, type ProjectActionState } from '@/app/actions/projects'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { FormError } from '@/components/ui/FormError'

const initialState: ProjectActionState = {}

export function CreateProjectForm() {
  const [state, action, pending] = useActionState(createProjectAction, initialState)

  return (
    <form action={action} className="flex flex-col gap-5">
      <FormError message={state.error} />

      <h2 className="text-base font-semibold text-gray-800">Project Details</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          id="name"
          name="name"
          label="Project Name"
          placeholder="Al-Rashidi Residence Renovation"
          required
        />
        <Select id="status" name="status" label="Status" defaultValue="planning">
          <option value="planning">Planning</option>
          <option value="demolition">Demolition</option>
          <option value="framing">Framing</option>
          <option value="finishing">Finishing</option>
          <option value="completed">Completed</option>
        </Select>
      </div>

      <Input
        id="address"
        name="address"
        label="Address"
        placeholder="123 Main St, Dubai"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          id="start_date"
          name="start_date"
          type="date"
          label="Start Date"
        />
        <Input
          id="estimated_end_date"
          name="estimated_end_date"
          type="date"
          label="Estimated End Date"
        />
      </div>

      <Input
        id="budget_total"
        name="budget_total"
        type="number"
        min="0"
        step="0.01"
        label="Budget Total (AUD)"
        placeholder="50000"
      />

      <hr className="border-gray-100" />

      <h2 className="text-base font-semibold text-gray-800">Client Information</h2>
      <p className="text-xs text-gray-400 -mt-3">Optional. A dedicated client module will be added in a future phase.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Input
          id="client_name"
          name="client_name"
          label="Client Name"
          placeholder="Mohammed Al-Sayed"
        />
        <Input
          id="client_email"
          name="client_email"
          type="email"
          label="Client Email"
          placeholder="client@example.com"
        />
        <Input
          id="client_phone"
          name="client_phone"
          label="Client Phone"
          placeholder="+971 50 123 4567"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" size="md" onClick={() => history.back()}>
          Cancel
        </Button>
        <Button type="submit" loading={pending} size="md">
          Create Project
        </Button>
      </div>
    </form>
  )
}
