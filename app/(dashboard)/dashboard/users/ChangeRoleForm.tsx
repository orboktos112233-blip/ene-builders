'use client'

import { useActionState } from 'react'
import { updateUserRoleAction, type UserActionState } from '@/app/actions/users'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import type { Role } from '@/types/database'

const initialState: UserActionState = {}

interface ChangeRoleFormProps {
  userId: string
  currentRole: Role
}

export function ChangeRoleForm({ userId, currentRole }: ChangeRoleFormProps) {
  const [, action, pending] = useActionState(updateUserRoleAction, initialState)

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="user_id" value={userId} />
      <Select name="role" defaultValue={currentRole} className="text-xs py-1 h-8">
        <option value="worker">Worker</option>
        <option value="project_manager">Project Manager</option>
        <option value="office">Office</option>
        <option value="client">Client</option>
        <option value="admin">Admin</option>
      </Select>
      <Button type="submit" variant="secondary" size="sm" loading={pending}>
        Save
      </Button>
    </form>
  )
}
