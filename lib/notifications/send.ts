import { createClient } from '@/lib/supabase/server'
import type { NotificationType } from '@/types/database'

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
 *   • All users assigned to the project (PM + workers)
 *   • Actor is excluded (you don't notify yourself)
 *
 * Non-fatal — a failure here must never break the calling action.
 */
export async function sendNotification(input: SendNotificationInput): Promise<void> {
  try {
    const supabase = await createClient()

    // 1. All admin user IDs
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')

    // 2. All assigned user IDs for this project
    const { data: assignments } = await supabase
      .from('project_assignments')
      .select('user_id')
      .eq('project_id', input.projectId)

    // 3. Union, excluding the actor
    const recipientIds = new Set<string>()
    for (const a of (admins ?? [])) recipientIds.add(a.id)
    for (const a of (assignments ?? [])) recipientIds.add(a.user_id)
    recipientIds.delete(input.actor.id)

    if (recipientIds.size === 0) return

    // 4. Bulk-insert one row per recipient
    const rows = [...recipientIds].map((userId) => ({
      user_id:    userId,
      project_id: input.projectId,
      type:       input.type,
      message:    input.message,
    }))

    await supabase.from('notifications').insert(rows)
  } catch {
    // Intentionally swallowed — notifications must never break the caller
  }
}
