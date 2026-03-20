'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import type { Role } from '@/types/database'

export interface UserActionState {
  error?: string
  success?: string
}

const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['admin', 'office', 'project_manager', 'worker', 'client']),
})

// Invite a new user by email. Admin only.
// Supabase sends an invitation email. The profile row is created via the
// handle_new_user trigger with the role embedded in raw_user_meta_data.
export async function inviteUserAction(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  await requireRole(['admin'])

  const raw = {
    email: formData.get('email'),
    full_name: formData.get('full_name'),
    role: formData.get('role'),
  }

  const parsed = inviteSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()

  // Use the Supabase Admin API (service role needed for inviteUserByEmail).
  // We call it via a server action which runs server-side only.
  const { createClient: createServiceClient } = await import('@supabase/supabase-js')
  const adminClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await adminClient.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: {
      full_name: parsed.data.full_name,
      role: parsed.data.role,
    },
  })

  if (error) {
    if (error.message.includes('already been registered')) {
      return { error: 'A user with this email already exists.' }
    }
    return { error: 'Failed to send invitation. Please try again.' }
  }

  revalidatePath('/dashboard/users')
  return { success: `Invitation sent to ${parsed.data.email}` }
}

const updateRoleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(['admin', 'office', 'project_manager', 'worker', 'client']),
})

// Change a user's role. Admin only.
export async function updateUserRoleAction(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  const me = await requireRole(['admin'])

  const parsed = updateRoleSchema.safeParse({
    user_id: formData.get('user_id'),
    role: formData.get('role'),
  })

  if (!parsed.success) {
    return { error: 'Invalid request.' }
  }

  // Prevent admin from removing their own admin role.
  if (parsed.data.user_id === me.id && parsed.data.role !== 'admin') {
    return { error: 'You cannot change your own role.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ role: parsed.data.role as Role })
    .eq('id', parsed.data.user_id)

  if (error) {
    return { error: 'Failed to update role.' }
  }

  revalidatePath('/dashboard/users')
  return { success: 'Role updated.' }
}
