'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

export interface ProfileActionState {
  error?: string
  success?: boolean
}

// ── Update full name ───────────────────────────────────────────

const updateNameSchema = z.object({
  full_name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name is too long')
    .regex(/\S/, 'Name cannot be blank'),
})

export async function updateNameAction(
  _prev: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const profile = await requireAuth()

  const parsed = updateNameSchema.safeParse({
    full_name: formData.get('full_name'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: parsed.data.full_name.trim() })
    .eq('id', profile.id)

  if (error) {
    return { error: 'Failed to update name. Please try again.' }
  }

  revalidatePath('/dashboard/profile')
  revalidatePath('/dashboard')
  return { success: true }
}

// ── Change password ────────────────────────────────────────────

const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Current password is required'),
    new_password: z
      .string()
      .min(8, 'New password must be at least 8 characters'),
    confirm_password: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

export async function changePasswordAction(
  _prev: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  await requireAuth()

  const parsed = changePasswordSchema.safeParse({
    current_password: formData.get('current_password'),
    new_password:     formData.get('new_password'),
    confirm_password: formData.get('confirm_password'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()

  // Get the current user's email to re-authenticate
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    return { error: 'Could not verify your identity. Please sign in again.' }
  }

  // Verify current password by attempting sign-in
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email:    user.email,
    password: parsed.data.current_password,
  })

  if (verifyError) {
    return { error: 'Current password is incorrect.' }
  }

  // Update the password
  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.new_password,
  })

  if (updateError) {
    return { error: 'Failed to update password. Please try again.' }
  }

  return { success: true }
}
