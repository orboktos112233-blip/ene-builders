'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/session'
import type { Notification } from '@/types/database'

/** Returns the 25 most recent notifications for the current user. */
export async function getNotificationsAction(): Promise<Notification[]> {
  const profile = await requireAuth()
  const supabase = await createClient()

  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(25)

  return (data ?? []) as Notification[]
}

/** Returns the unread notification count for the current user. */
export async function getUnreadCountAction(): Promise<number> {
  const profile = await requireAuth()
  const supabase = await createClient()

  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .eq('is_read', false)

  return count ?? 0
}

/** Marks all of the current user's notifications as read. */
export async function markAllReadAction(): Promise<void> {
  const profile = await requireAuth()
  const supabase = await createClient()

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', profile.id)
    .eq('is_read', false)
}

/** Marks a single notification as read. */
export async function markOneReadAction(notificationId: string): Promise<void> {
  const profile = await requireAuth()
  const supabase = await createClient()

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', profile.id) // safety: only own rows
}
