'use client'

import { useActionState } from 'react'
import { updateProjectStatusAction, type ProjectActionState } from '@/app/actions/projects'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import type { ProjectStatus } from '@/types/database'

const initialState: ProjectActionState = {}

interface UpdateStatusFormProps {
  projectId: string
  currentStatus: ProjectStatus
}

export function UpdateStatusForm({ projectId, currentStatus }: UpdateStatusFormProps) {
  const [state, action, pending] = useActionState(updateProjectStatusAction, initialState)

  return (
    <form action={action} className="flex items-center gap-2 shrink-0">
      <input type="hidden" name="project_id" value={projectId} />
      <Select name="status" defaultValue={currentStatus} className="text-xs h-8 py-1">
        <option value="planning">Planning</option>
        <option value="in_progress">In Progress</option>
        <option value="finishing">Finishing</option>
        <option value="inspection">Inspection</option>
        <option value="completed">Completed</option>
      </Select>
      <Button type="submit" variant="secondary" size="sm" loading={pending}>
        Update
      </Button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  )
}
