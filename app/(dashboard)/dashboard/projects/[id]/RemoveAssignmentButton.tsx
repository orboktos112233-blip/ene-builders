'use client'

import { useActionState } from 'react'
import { removeAssignmentAction, type AssignmentActionState } from '@/app/actions/assignments'
import { Button } from '@/components/ui/Button'

const initialState: AssignmentActionState = {}

interface RemoveAssignmentButtonProps {
  assignmentId: string
  projectId: string
}

export function RemoveAssignmentButton({ assignmentId, projectId }: RemoveAssignmentButtonProps) {
  const [, action, pending] = useActionState(removeAssignmentAction, initialState)

  return (
    <form action={action}>
      <input type="hidden" name="assignment_id" value={assignmentId} />
      <input type="hidden" name="project_id" value={projectId} />
      <Button type="submit" variant="ghost" size="sm" loading={pending} className="text-red-500 hover:text-red-700 hover:bg-red-50">
        Remove
      </Button>
    </form>
  )
}
