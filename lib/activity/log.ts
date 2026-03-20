import { createClient } from '@/lib/supabase/server'

export type ActivityAction =
  | 'project_created'
  | 'project_updated'
  | 'project_deleted'
  | 'status_changed'
  | 'phase_updated'
  | 'media_uploaded'
  | 'media_deleted'
  | 'photo_reviewed'
  | 'item_added'
  | 'member_added'
  | 'member_removed'
  | 'import_completed'

interface LogActivityInput {
  user_id: string
  action: ActivityAction
  description: string
  project_id?: string | null
  entity_type?: string | null
  entity_id?: string | null
  metadata?: Record<string, unknown> | null
}

/**
 * Append a row to activity_logs.  Non-fatal — a logging failure must never
 * break the calling action.  Call this *after* the primary write succeeds.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase.from('activity_logs').insert({
      user_id:     input.user_id,
      action:      input.action,
      description: input.description,
      project_id:  input.project_id  ?? null,
      entity_type: input.entity_type ?? null,
      entity_id:   input.entity_id   ?? null,
      metadata:    input.metadata    ?? null,
    })
  } catch {
    // Intentionally swallowed — logging must never break the caller
  }
}
