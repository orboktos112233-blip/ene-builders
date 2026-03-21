'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { logActivity } from '@/lib/activity/log'
import { postSystemMessage } from '@/lib/project-chat/system-messages'

export interface AssignmentActionState {
  error?: string
}

const assignSchema = z.object({
  project_id: z.string().uuid(),
  user_id: z.string().uuid(),
  assignment_role: z.enum(['project_manager', 'worker', 'client', 'office_viewer']),
})

export async function assignUserAction(
  _prev: AssignmentActionState,
  formData: FormData
): Promise<AssignmentActionState> {
  const profile = await requireRole(['admin'])

  const parsed = assignSchema.safeParse({
    project_id: formData.get('project_id'),
    user_id: formData.get('user_id'),
    assignment_role: formData.get('assignment_role'),
  })

  if (!parsed.success) {
    return { error: 'Invalid request.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('project_assignments').insert(parsed.data)

  if (error) {
    if (error.code === '23505') {
      return { error: 'This user is already assigned to the project.' }
    }
    return { error: 'Failed to assign user.' }
  }

  await logActivity({
    user_id:     profile.id,
    action:      'member_added',
    description: `Added a team member`,
    project_id:  parsed.data.project_id,
    entity_type: 'assignment',
    metadata:    { user_id: parsed.data.user_id, assignment_role: parsed.data.assignment_role },
  })

  // Fetch added user's name for system message
  const { data: addedUser } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', parsed.data.user_id)
    .single()
  const addedName = (addedUser as { full_name: string } | null)?.full_name ?? 'A team member'
  await postSystemMessage(
    parsed.data.project_id,
    `${addedName} was added to the project`,
    'member_added',
  )

  revalidatePath(`/dashboard/projects/${parsed.data.project_id}`)
  return {}
}

const removeSchema = z.object({
  assignment_id: z.string().uuid(),
  project_id: z.string().uuid(),
})

export async function removeAssignmentAction(
  _prev: AssignmentActionState,
  formData: FormData
): Promise<AssignmentActionState> {
  const profile = await requireRole(['admin'])

  const parsed = removeSchema.safeParse({
    assignment_id: formData.get('assignment_id'),
    project_id: formData.get('project_id'),
  })

  if (!parsed.success) {
    return { error: 'Invalid request.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('project_assignments')
    .delete()
    .eq('id', parsed.data.assignment_id)

  if (error) {
    return { error: 'Failed to remove assignment.' }
  }

  await logActivity({
    user_id:     profile.id,
    action:      'member_removed',
    description: `Removed a team member`,
    project_id:  parsed.data.project_id,
    entity_type: 'assignment',
  })

  await postSystemMessage(
    parsed.data.project_id,
    `A team member was removed from the project`,
    'member_removed',
  )

  revalidatePath(`/dashboard/projects/${parsed.data.project_id}`)
  return {}
}
