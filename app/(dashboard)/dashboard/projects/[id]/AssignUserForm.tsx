'use client'

import { useActionState } from 'react'
import { assignUserAction, type AssignmentActionState } from '@/app/actions/assignments'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { FormError } from '@/components/ui/FormError'

const initialState: AssignmentActionState = {}

interface User {
  id: string
  full_name: string
  role: string
}

interface AssignUserFormProps {
  projectId: string
  users: User[]
}

export function AssignUserForm({ projectId, users }: AssignUserFormProps) {
  const [state, action, pending] = useActionState(assignUserAction, initialState)

  if (users.length === 0) {
    return <p className="text-xs text-gray-400 py-1">All users are already assigned to this project.</p>
  }

  return (
    <form action={action} className="flex flex-col gap-2">
      <FormError message={state.error} />
      <input type="hidden" name="project_id" value={projectId} />
      <div className="flex items-end gap-3">
        <Select name="user_id" label="Add Team Member" className="text-xs">
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name} ({u.role.replace('_', ' ')})
            </option>
          ))}
        </Select>
        <Select name="assignment_role" label="Role on Project" className="text-xs">
          <option value="project_manager">Project Manager</option>
          <option value="worker">Worker</option>
          <option value="office_viewer">Office Viewer</option>
          <option value="client">Client</option>
        </Select>
        <Button type="submit" size="sm" loading={pending} className="shrink-0 mb-0.5">
          Assign
        </Button>
      </div>
    </form>
  )
}
