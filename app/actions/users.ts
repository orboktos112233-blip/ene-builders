'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/session'
import type { Role } from '@/types/database'

export interface UserActionState {
  error?: string
  success?: string
}

const inviteSchema = z.object({
  email:     z.string().email('Invalid email address'),
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  role:      z.enum(['admin', 'office', 'project_manager', 'worker', 'client']),
})

export async function inviteUserAction(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  await requireRole(['admin'])

  const parsed = inviteSchema.safeParse({
    email:     formData.get('email'),
    full_name: formData.get('full_name'),
    role:      formData.get('role'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  // ── Guard: env vars ────────────────────────────────────────────
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error(
      '[inviteUser] Missing env vars:',
      { NEXT_PUBLIC_SUPABASE_URL: !!supabaseUrl, SUPABASE_SERVICE_ROLE_KEY: !!serviceKey }
    )
    return {
      error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is not set. Add it to your Vercel environment variables.',
    }
  }

  // ── Admin client (service role, no session) ────────────────────
  const { createClient: createServiceClient } = await import('@supabase/supabase-js')
  const adminClient = createServiceClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log('[inviteUser] Sending invite to:', parsed.data.email, '| role:', parsed.data.role)

  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo: 'https://ene-builders-system.vercel.app/auth/callback',
    data: {
      full_name: parsed.data.full_name,
      role:      parsed.data.role,
    },
  })

  if (error) {
    // Always log the real error server-side
    console.error(
      '[inviteUser] Supabase error — message:', error.message,
      '| status:', (error as any).status,
      '| name:', error.name,
    )

    const msg = error.message.toLowerCase()

    if (msg.includes('already been invited') || msg.includes('already registered') || msg.includes('already exists')) {
      return { error: 'A user with this email has already been invited or registered.' }
    }
    if (msg.includes('rate limit') || msg.includes('too many') || msg.includes('once every')) {
      return { error: 'Rate limit reached. Supabase allows a limited number of emails per hour on the free tier. Wait a few minutes and try again.' }
    }
    if (msg.includes('smtp') || msg.includes('send') && msg.includes('email')) {
      return { error: 'Email sending failed. If you are on Supabase free tier, SMTP may not be configured. Go to Supabase Dashboard → Authentication → SMTP Settings.' }
    }
    if (msg.includes('not authorized') || msg.includes('unauthorized') || (error as any).status === 403) {
      return { error: 'Auth error: the service role key is invalid or does not have admin privileges.' }
    }
    if (msg.includes('invalid') && msg.includes('email')) {
      return { error: 'Invalid email address.' }
    }

    // Return the real Supabase message when we don't have a specific handler
    return { error: `Invitation failed: ${error.message}` }
  }

  console.log('[inviteUser] Success — user id:', data.user?.id, '| email:', data.user?.email)

  revalidatePath('/dashboard/users')
  return { success: `Invitation sent to ${parsed.data.email}` }
}

// ── Change role ────────────────────────────────────────────────

const updateRoleSchema = z.object({
  user_id: z.string().uuid(),
  role:    z.enum(['admin', 'office', 'project_manager', 'worker', 'client']),
})

export async function updateUserRoleAction(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  const me = await requireRole(['admin'])

  const parsed = updateRoleSchema.safeParse({
    user_id: formData.get('user_id'),
    role:    formData.get('role'),
  })
  if (!parsed.success) return { error: 'Invalid request.' }

  if (parsed.data.user_id === me.id && parsed.data.role !== 'admin') {
    return { error: 'You cannot change your own role.' }
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ role: parsed.data.role as Role })
    .eq('id', parsed.data.user_id)

  if (error) return { error: 'Failed to update role.' }

  revalidatePath('/dashboard/users')
  return { success: 'Role updated.' }
}
