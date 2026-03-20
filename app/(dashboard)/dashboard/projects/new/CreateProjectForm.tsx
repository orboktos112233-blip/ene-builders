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
    <form action={action} className="space-y-10">
      <FormError message={state.error} />

      {/* ── Project Details ─────────────────────────────────── */}
      <section className="space-y-5">
        <div className="border-l-4 border-gray-900 pl-4">
          <h2 className="text-base font-semibold text-gray-900 leading-tight">Project Details</h2>
          <p className="text-xs text-gray-400 mt-0.5">Core information about this project</p>
        </div>

        <div className="space-y-4">
          <Input
            id="name"
            name="name"
            label="Project Name"
            placeholder="e.g. Tarzana Residence Renovation"
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select id="status" name="status" label="Status" defaultValue="planning">
              <option value="planning">Planning</option>
              <option value="in_progress">In Progress</option>
              <option value="finishing">Finishing</option>
              <option value="inspection">Inspection</option>
              <option value="completed">Completed</option>
            </Select>
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
              label="Estimated Completion"
            />
          </div>

          <Input
            id="address"
            name="address"
            label="Project Address"
            placeholder="e.g. 5717 Topeka Dr, Tarzana, CA 91356"
          />

          <div className="sm:max-w-xs">
            <Input
              id="budget_total"
              name="budget_total"
              type="number"
              min="0"
              step="0.01"
              label="Budget Total (USD)"
              placeholder="e.g. 50000"
            />
            <p className="text-xs text-gray-400 mt-1">Enter the total project budget in US dollars.</p>
          </div>
        </div>
      </section>

      <div className="border-t border-gray-100" />

      {/* ── Client Information ───────────────────────────────── */}
      <section className="space-y-5">
        <div className="border-l-4 border-gray-300 pl-4">
          <h2 className="text-base font-semibold text-gray-900 leading-tight">Client Information</h2>
          <p className="text-xs text-gray-400 mt-0.5">Optional — all fields below can be filled in later</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            id="client_name"
            name="client_name"
            label="Client Name"
            placeholder="e.g. Michael Carter"
          />
          <Input
            id="client_email"
            name="client_email"
            type="email"
            label="Client Email"
            placeholder="e.g. michael.carter@example.com"
          />
          <Input
            id="client_phone"
            name="client_phone"
            label="Client Phone"
            placeholder="e.g. (818) 555-0147"
          />
        </div>
      </section>

      {/* ── Actions ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={() => history.back()}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Cancel
        </button>
        <Button type="submit" loading={pending} size="md" className="min-w-[140px]">
          Create Project
        </Button>
      </div>
    </form>
  )
}
