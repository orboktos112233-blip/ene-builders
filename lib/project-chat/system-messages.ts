/**
 * Utility for posting system messages into a project's chat thread.
 *
 * System messages appear automatically when important project events happen:
 * status changes, phase updates, team member additions, file uploads, etc.
 *
 * They are inserted with sender_id = NULL and message_type = 'system',
 * using the service-role admin client to bypass RLS.
 *
 * All errors are swallowed — system messages must never block the
 * calling action from completing successfully.
 */

export async function postSystemMessage(
  projectId:   string,
  body:        string,
  systemEvent?: string,
): Promise<void> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return

    const { createClient } = await import('@supabase/supabase-js')
    const admin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    await admin.from('project_chat_messages').insert({
      project_id:   projectId,
      sender_id:    null,
      body,
      message_type: 'system',
      system_event: systemEvent ?? null,
    })
  } catch {
    // Non-fatal — never block the caller
  }
}
