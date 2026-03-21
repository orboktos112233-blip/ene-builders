'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/session'
import { sendNotification } from '@/lib/notifications/send'

// ── Admin client helper ────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function adminClient(): Promise<any> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  const { createClient: create } = await import('@supabase/supabase-js')
  return create(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// ── Send a project chat message ────────────────────────────────

export async function sendProjectChatMessageAction(
  projectId:   string,
  body:        string,
  projectCode: string,
  projectName: string,
  attachment?: {
    path: string
    name: string
    type: string
    size: number
  },
): Promise<{ error?: string }> {
  const profile = await requireAuth()
  const trimmed = body.trim()
  if (!trimmed && !attachment) return { error: 'Message cannot be empty.' }

  const admin = await adminClient()
  const supabase = await createClient()
  const db = admin ?? supabase

  // ── Attempt 1: full insert with all extended columns ──────────
  // These columns exist after migrations 018 / 019 / 020 are applied.
  // If any column is missing (migrations not yet run) PostgREST returns
  // a 400 "column X does not exist" error — we catch it and fall back.
  const { error: fullError } = await db
    .from('project_chat_messages')
    .insert({
      project_id:      projectId,
      sender_id:       profile.id,
      body:            trimmed,
      message_type:    'user',
      attachment_path: attachment?.path ?? null,
      attachment_name: attachment?.name ?? null,
      attachment_type: attachment?.type ?? null,
      attachment_size: attachment?.size ?? null,
    })

  if (!fullError) {
    // Success — proceed to post-insert work below
    await afterInsert(db, projectId, projectCode, projectName, profile)
    revalidatePath(`/dashboard/projects/${projectId}`)
    revalidatePath('/dashboard/messages')
    return {}
  }

  // Log the real error so it appears in server logs / Vercel Functions logs
  console.error('[project-chat] full insert failed:', fullError.code, fullError.message)

  // ── Attempt 2: minimal insert (migration 017 columns only) ────
  // Falls back gracefully if migrations 018-020 have not been applied.
  // Attachment metadata is silently omitted — the message text still sends.
  const isColumnError = fullError.message?.includes('column') ||
    fullError.code === '42703' // undefined_column
  const isCheckError  = fullError.message?.includes('check') ||
    fullError.code === '23514' // check_violation (empty body with attachment)

  if (isColumnError || isCheckError) {
    // For attachment-only messages with no text, use a placeholder body
    // so the old CHECK (char_length(trim(body)) > 0) constraint passes.
    const fallbackBody = trimmed || (attachment ? `[attachment: ${attachment.name}]` : '')

    const { error: minError } = await db
      .from('project_chat_messages')
      .insert({
        project_id: projectId,
        sender_id:  profile.id,
        body:       fallbackBody,
      })

    if (minError) {
      console.error('[project-chat] fallback insert also failed:', minError.code, minError.message)
      return {
        error: `Failed to send message: ${minError.message} (code: ${minError.code}). ` +
               `Please apply all pending Supabase migrations (017-020) and try again.`,
      }
    }

    // Minimal insert succeeded
    await afterInsert(db, projectId, projectCode, projectName, profile)
    revalidatePath(`/dashboard/projects/${projectId}`)
    revalidatePath('/dashboard/messages')
    return {}
  }

  // Unknown error — return the real message
  return {
    error: `Failed to send message: ${fullError.message} (code: ${fullError.code})`,
  }
}

// ── Post-insert work (shared between full and fallback paths) ──

async function afterInsert(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db:          any,
  projectId:   string,
  projectCode: string,
  projectName: string,
  profile:     { id: string; full_name: string },
) {
  // Mark sender as read immediately
  await db
    .from('project_chat_reads')
    .upsert(
      { project_id: projectId, user_id: profile.id, last_read_at: new Date().toISOString() },
      { onConflict: 'project_id,user_id' }
    )

  // Notify all assigned project members + admins.
  // sendNotification uses admin client internally and is non-fatal.
  await sendNotification({
    actor:       { id: profile.id, full_name: profile.full_name },
    projectId,
    projectCode,
    type:        'project_chat',
    message:     `${profile.full_name} sent a message in ${projectCode} · ${projectName}`,
  })
}

// ── Mark project chat as read ──────────────────────────────────

export async function markProjectChatReadAction(projectId: string): Promise<void> {
  const profile = await requireAuth()
  const admin = await adminClient()
  const supabase = await createClient()
  const db = admin ?? supabase

  await db
    .from('project_chat_reads')
    .upsert(
      { project_id: projectId, user_id: profile.id, last_read_at: new Date().toISOString() },
      { onConflict: 'project_id,user_id' }
    )
}
