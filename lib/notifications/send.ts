import type { NotificationType } from '@/types/database'

// ── Admin client helper ───────────────────────────────────────────────
// All notification inserts use admin client so the session user's RLS
// doesn't block writing notification rows for other users.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function adminClient(): Promise<any> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// ── Direct (non-project) notification ────────────────────────────────
// Used for DMs: sends to a single specific user.
export async function sendDirectNotification(input: {
  recipientId: string
  actorId:     string
  message:     string
}): Promise<void> {
  try {
    const admin = await adminClient()
    if (!admin) return
    await admin.from('notifications').insert({
      user_id:    input.recipientId,
      project_id: null,
      type:       'new_message' as NotificationType,
      message:    input.message,
    })
  } catch {
    // Non-fatal
  }
}

interface SendNotificationInput {
  /** The user who triggered the action */
  actor: { id: string; full_name: string }
  projectId: string
  projectCode: string
  type: NotificationType
  message: string
}

/**
 * Resolves all recipients for a project notification and inserts rows.
 *
 * Recipients:
 *   • All admins (platform-wide visibility)
 *   • All users assigned to the project (PM + workers + clients)
 *   • Actor is excluded (you don't notify yourself)
 *
 * Uses admin client throughout so that:
 *   1. We can always read the full list of admins and assignments
 *      regardless of the session user's role.
 *   2. We can insert notification rows for other users without
 *      being blocked by RLS.
 *
 * Non-fatal — a failure here must never break the calling action.
 */
export async function sendNotification(input: SendNotificationInput): Promise<void> {
  try {
    const admin = await adminClient()
    if (!admin) return

    // 1. All admin user IDs
    const { data: admins } = await admin
      .from('profiles')
      .select('id')
      .eq('role', 'admin')

    // 2. All assigned user IDs for this project
    const { data: assignments } = await admin
      .from('project_assignments')
      .select('user_id')
      .eq('project_id', input.projectId)

    // 3. Union, excluding the actor
    const recipientIds = new Set<string>()
    for (const a of (admins ?? [])) recipientIds.add(a.id as string)
    for (const a of (assignments ?? [])) recipientIds.add(a.user_id as string)
    recipientIds.delete(input.actor.id)

    if (recipientIds.size === 0) return

    // 4. Bulk-insert one row per recipient
    const rows = [...recipientIds].map((userId) => ({
      user_id:    userId,
      project_id: input.projectId,
      type:       input.type,
      message:    input.message,
    }))

    await admin.from('notifications').insert(rows)
  } catch {
    // Intentionally swallowed — notifications must never break the caller
  }
}
