'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/session'
import { sendDirectNotification } from '@/lib/notifications/send'

// ── Admin client helper ────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function adminClient(): Promise<any> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  const { createClient: create } = await import('@supabase/supabase-js')
  return create(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// ── Get or create a 1-to-1 conversation ──────────────────────────────
// If a conversation already exists between these two users, return it.
// Otherwise create a new one.

export async function getOrCreateConversationAction(
  otherUserId: string
): Promise<{ conversationId?: string; error?: string }> {
  const profile = await requireAuth()
  if (otherUserId === profile.id) return { error: 'Cannot message yourself.' }

  const admin = await adminClient()
  if (!admin) return { error: 'Server configuration error.' }

  // Find conversation IDs I'm part of
  const { data: mine } = await admin
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', profile.id)

  const myIds: string[] = (mine ?? []).map((r: { conversation_id: string }) => r.conversation_id)

  if (myIds.length > 0) {
    // Find conversation IDs the other user is part of, intersected with mine
    const { data: theirs } = await admin
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', otherUserId)
      .in('conversation_id', myIds)

    for (const row of theirs ?? []) {
      // Verify it's exactly a 1:1 (2 participants)
      const { count } = await admin
        .from('conversation_participants')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', row.conversation_id)
      if (count === 2) return { conversationId: row.conversation_id }
    }
  }

  // Create new conversation
  const { data: conv, error: convErr } = await admin
    .from('conversations')
    .insert({})
    .select('id')
    .single()

  if (convErr || !conv) return { error: 'Failed to create conversation.' }

  await admin.from('conversation_participants').insert([
    { conversation_id: conv.id, user_id: profile.id },
    { conversation_id: conv.id, user_id: otherUserId },
  ])

  revalidatePath('/dashboard/messages')
  return { conversationId: conv.id }
}

// ── Send a message (text + optional attachment) ───────────────────────

export async function sendMessageAction(
  conversationId: string,
  body: string,
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

  // Insert message (admin client bypasses RLS + body CHECK constraint)
  const { error } = await db
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id:       profile.id,
      body:            trimmed,
      attachment_path: attachment?.path ?? null,
      attachment_name: attachment?.name ?? null,
      attachment_type: attachment?.type ?? null,
      attachment_size: attachment?.size ?? null,
    })

  if (error) return { error: 'Failed to send message.' }

  // Mark sender as read immediately (admin client)
  await db
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', profile.id)

  // Notify other participants — use admin client to read participants list
  // (session client RLS might not return other users' rows in all cases)
  const adminDb = admin ?? supabase
  const { data: others } = await adminDb
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .neq('user_id', profile.id)

  for (const p of others ?? []) {
    await sendDirectNotification({
      recipientId: p.user_id as string,
      actorId:     profile.id,
      message:     `New message from ${profile.full_name}`,
    })
  }

  revalidatePath('/dashboard/messages')
  return {}
}

// ── Mark a conversation as read ───────────────────────────────────────

export async function markConversationReadAction(
  conversationId: string
): Promise<void> {
  const profile = await requireAuth()
  const admin = await adminClient()
  const supabase = await createClient()
  const db = admin ?? supabase

  await db
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', profile.id)

  revalidatePath('/dashboard/messages')
}
