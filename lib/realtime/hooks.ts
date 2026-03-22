'use client'

import { useEffect, useRef, useCallback } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { ProjectChatMessageWithSender, MessageWithSender, Notification } from '@/types/database'

/**
 * Subscribe to project chat messages in real-time.
 * Calls onNewMessage when a new message is inserted.
 * Automatically cleans up subscription on unmount.
 *
 * @param projectId - Project ID to subscribe to
 * @param onNewMessage - Callback when new message arrives (receives raw message, you must resolve profiles)
 */
export function useProjectChatRealtime(
  projectId: string,
  onNewMessage: (msg: any) => void,
  enabled: boolean = true
) {
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!enabled || !projectId) return

    const supabase = createClient()
    const channelName = `project-chat:${projectId}`

    // Subscribe to INSERT events on project_chat_messages for this project
    const channel = supabase
      .channel(channelName, {
        config: { broadcast: { self: true } },
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'project_chat_messages',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          // payload.new contains the newly inserted row
          onNewMessage(payload.new)
        }
      )
      .subscribe((status) => {
        console.log(`[ProjectChat Realtime] ${channelName} status:`, status)
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [projectId, onNewMessage, enabled])
}

/**
 * Subscribe to direct messages in real-time.
 * Calls onNewMessage when a new message is inserted.
 *
 * @param conversationId - Conversation ID to subscribe to
 * @param onNewMessage - Callback when new message arrives
 */
export function useDirectMessagesRealtime(
  conversationId: string | null,
  onNewMessage: (msg: any) => void,
  enabled: boolean = true
) {
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!enabled || !conversationId) return

    const supabase = createClient()
    const channelName = `direct-msg:${conversationId}`

    const channel = supabase
      .channel(channelName, {
        config: { broadcast: { self: true } },
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          onNewMessage(payload.new)
        }
      )
      .subscribe((status) => {
        console.log(`[DirectMsg Realtime] ${channelName} status:`, status)
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [conversationId, onNewMessage, enabled])
}

/**
 * Subscribe to notifications in real-time for the current user.
 * Calls onNewNotification when a new notification is inserted.
 * Also updates unread count immediately.
 *
 * @param userId - Current user's ID
 * @param onNewNotification - Callback when new notification arrives
 * @param onUnreadCountChange - Callback when unread count changes (pass number or state setter)
 */
export function useNotificationsRealtime(
  userId: string,
  onNewNotification: (notif: Notification) => void,
  onUnreadCountChange: (count: number | ((prev: number) => number)) => void,
  enabled: boolean = true
) {
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!enabled || !userId) return

    const supabase = createClient()
    const channelName = `notifications:${userId}`

    const channel = supabase
      .channel(channelName, {
        config: { broadcast: { self: true } },
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification
          onNewNotification(newNotif)
          // Increment unread by 1 if this notification is not read
          if (!newNotif.is_read) {
            // Call with a function to work with both number and state setter
            const updater = (prev: number) => (prev || 0) + 1
            onUnreadCountChange(updater as any)
          }
        }
      )
      .subscribe((status) => {
        console.log(`[Notifications Realtime] ${channelName} status:`, status)
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [userId, onNewNotification, onUnreadCountChange, enabled])
}

/**
 * Subscribe to project chat reads (mark-as-read updates).
 * Useful for tracking when other users mark the chat as read.
 *
 * @param projectId - Project ID
 * @param onReadUpdate - Callback when read state changes
 */
export function useProjectChatReadsRealtime(
  projectId: string,
  onReadUpdate: (data: any) => void,
  enabled: boolean = true
) {
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!enabled || !projectId) return

    const supabase = createClient()
    const channelName = `project-chat-reads:${projectId}`

    const channel = supabase
      .channel(channelName, {
        config: { broadcast: { self: true } },
      })
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'project_chat_reads',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          onReadUpdate(payload.new)
        }
      )
      .subscribe((status) => {
        console.log(`[ProjectChatReads Realtime] ${channelName} status:`, status)
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [projectId, onReadUpdate, enabled])
}
