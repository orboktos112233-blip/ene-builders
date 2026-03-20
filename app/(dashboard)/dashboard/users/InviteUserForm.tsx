'use client'

import { useActionState } from 'react'
import { inviteUserAction, type UserActionState } from '@/app/actions/users'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { FormError } from '@/components/ui/FormError'

const initialState: UserActionState = {}

export function InviteUserForm() {
  const [state, action, pending] = useActionState(inviteUserAction, initialState)

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && <FormError message={state.error} />}
      {state.success && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3">
          <p className="text-sm text-green-700">{state.success}</p>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Input
          id="full_name"
          name="full_name"
          label="Full Name"
          placeholder="Ahmad Al-Rashidi"
          required
        />
        <Input
          id="email"
          name="email"
          type="email"
          label="Email"
          placeholder="ahmad@example.com"
          required
        />
        <Select id="role" name="role" label="Role">
          <option value="worker">Worker</option>
          <option value="project_manager">Project Manager</option>
          <option value="office">Office</option>
          <option value="client">Client</option>
          <option value="admin">Admin</option>
        </Select>
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={pending} size="sm">
          Send Invitation
        </Button>
      </div>
    </form>
  )
}
