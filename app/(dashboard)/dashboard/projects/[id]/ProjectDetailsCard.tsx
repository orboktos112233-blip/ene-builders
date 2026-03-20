'use client'

import { useState, useEffect, useActionState } from 'react'
import { updateProjectDetailsAction, type ProjectActionState } from '@/app/actions/projects'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { FormError } from '@/components/ui/FormError'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { Project, ProjectStatus } from '@/types/database'

const initialState: ProjectActionState = {}

const STATUS_OPTIONS = [
  { value: 'planning',    label: 'Planning' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'finishing',   label: 'Finishing' },
  { value: 'inspection',  label: 'Inspection' },
  { value: 'completed',   label: 'Completed' },
]

interface ProjectDetailsCardProps {
  project: Project
  canEdit: boolean
}

export function ProjectDetailsCard({ project, canEdit }: ProjectDetailsCardProps) {
  const [editing, setEditing] = useState(false)
  const [state, action, pending] = useActionState(updateProjectDetailsAction, initialState)

  // Auto-close on success
  useEffect(() => {
    if (state.success) setEditing(false)
  }, [state.success])

  if (editing) {
    return (
      <div className="bg-white border border-indigo-200 rounded-2xl overflow-hidden shadow-sm">
        <form action={action}>
          <input type="hidden" name="project_id" value={project.id} />

          {/* Edit header */}
          <div className="px-7 pt-6 pb-5 border-b border-gray-100">
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-widest mb-4">
              Editing Project Details
            </p>
            <FormError message={state.error} />
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">
                  Project Name
                </label>
                <Input name="name" defaultValue={project.name} className="text-sm font-semibold" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">
                    Status
                  </label>
                  <Select name="status" defaultValue={project.status ?? 'planning'}>
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">
                    Address / Location
                  </label>
                  <Input name="address" defaultValue={project.address ?? ''} placeholder="e.g. 123 Main St" className="text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">
                    Start Date
                  </label>
                  <Input
                    name="start_date"
                    type="date"
                    defaultValue={project.start_date ?? ''}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">
                    Est. Completion
                  </label>
                  <Input
                    name="estimated_end_date"
                    type="date"
                    defaultValue={project.estimated_end_date ?? ''}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">
                    Budget (USD)
                  </label>
                  <Input
                    name="budget_total"
                    type="number"
                    step="any"
                    defaultValue={project.budget_total ?? ''}
                    placeholder="0.00"
                    className="text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Client section */}
          <div className="px-7 py-5 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Client</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">
                  Client Name
                </label>
                <Input name="client_name" defaultValue={project.client_name ?? ''} placeholder="Full name" className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">
                  Email
                </label>
                <Input name="client_email" type="email" defaultValue={project.client_email ?? ''} placeholder="email@example.com" className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">
                  Phone
                </label>
                <Input name="client_phone" defaultValue={project.client_phone ?? ''} placeholder="(555) 000-0000" className="text-sm" />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="px-7 py-4 flex justify-end gap-2.5">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={pending}>
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-7 pt-7 pb-6 border-b border-gray-100">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="text-xs font-mono font-semibold text-gray-400">{project.project_code}</span>
              <StatusBadge status={project.status as ProjectStatus} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight leading-tight">
              {project.name}
            </h2>
            {project.address && (
              <p className="text-sm text-gray-500 mt-2">{project.address}</p>
            )}
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="shrink-0 text-xs font-semibold text-gray-400 hover:text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors border border-gray-200 hover:border-indigo-200"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Key details grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100">
        <InfoCell label="Start Date" value={formatDate(project.start_date)} />
        <InfoCell label="Est. Completion" value={formatDate(project.estimated_end_date)} />
        <InfoCell label="Budget (USD)" value={formatCurrency(project.budget_total)} bold />
        <InfoCell label="Created" value={formatDate(project.created_at)} />
      </div>

      {/* Client */}
      {(project.client_name || project.client_email || project.client_phone) && (
        <div className="border-t border-gray-100">
          <div className="px-7 py-4 border-b border-gray-100 bg-gray-50/60">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Client</p>
          </div>
          <div className="px-7 py-5">
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {project.client_name && <ClientField label="Name" value={project.client_name} />}
              {project.client_email && (
                <div>
                  <dt className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Email</dt>
                  <dd className="text-sm text-gray-900">
                    <a href={`mailto:${project.client_email}`} className="text-indigo-600 hover:text-indigo-700 hover:underline transition-colors">
                      {project.client_email}
                    </a>
                  </dd>
                </div>
              )}
              {project.client_phone && <ClientField label="Phone" value={project.client_phone} />}
            </dl>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoCell({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="px-7 py-5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
      <p className={bold ? 'text-base font-black text-gray-900' : 'text-sm font-medium text-gray-800'}>
        {value}
      </p>
    </div>
  )
}

function ClientField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">{label}</dt>
      <dd className="text-sm font-medium text-gray-900">{value}</dd>
    </div>
  )
}
