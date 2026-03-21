import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/session'
import { MessagesClient } from './MessagesClient'
import type {
  ConversationSummary,
  MessageWithSender,
  Profile,
  ProjectConversation,
  ProjectChatMessageWithSender,
} from '@/types/database'

interface PageProps {
  searchParams: Promise<{ c?: string; pid?: string }>
}

export default async function MessagesPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const selectedConvId    = sp.c   ?? null
  const selectedProjectId = sp.pid ?? null

  const profile  = await requireAuth()
  const supabase = await createClient()
  const isAdmin  = profile.role === 'admin'

  // ── 1. My DM participations ───────────────────────────────────
  const { data: myParticipations } = await supabase
    .from('conversation_participants')
    .select('conversation_id, last_read_at')
    .eq('user_id', profile.id)

  const myConvIds = (myParticipations ?? []).map((p) => p.conversation_id as string)
  const lastReadMap = new Map(
    (myParticipations ?? []).map((p) => [p.conversation_id as string, p.last_read_at as string | null])
  )

  let conversations: ConversationSummary[] = []

  if (myConvIds.length > 0) {
    // ── 2. Other participants ──────────────────────────────────
    const { data: allParticipants } = await supabase
      .from('conversation_participants')
      .select('conversation_id, user_id')
      .in('conversation_id', myConvIds)
      .neq('user_id', profile.id)

    const otherUserIds = [...new Set((allParticipants ?? []).map((p) => p.user_id as string))]

    // ── 3. Profiles of other users ─────────────────────────────
    const { data: otherProfiles } = otherUserIds.length > 0
      ? await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, role')
          .in('id', otherUserIds)
      : { data: [] }

    const profilesById    = new Map((otherProfiles ?? []).map((p) => [p.id as string, p]))
    const otherUserByConv = new Map(
      (allParticipants ?? []).map((p) => [p.conversation_id as string, p.user_id as string])
    )

    // ── 4. Last message per conversation ───────────────────────
    const { data: allMsgs } = await supabase
      .from('messages')
      .select('conversation_id, body, created_at, sender_id')
      .in('conversation_id', myConvIds)
      .order('created_at', { ascending: false })

    const lastMsgByConv = new Map<string, { body: string; created_at: string; sender_id: string }>()
    for (const msg of allMsgs ?? []) {
      const cid = msg.conversation_id as string
      if (!lastMsgByConv.has(cid)) {
        lastMsgByConv.set(cid, {
          body:       msg.body as string,
          created_at: msg.created_at as string,
          sender_id:  msg.sender_id as string,
        })
      }
    }

    // ── 5. Unread counts ───────────────────────────────────────
    const unreadByConv = new Map<string, number>()
    for (const msg of allMsgs ?? []) {
      const cid = msg.conversation_id as string
      if ((msg.sender_id as string) === profile.id) continue
      const lastRead = lastReadMap.get(cid)
      if (!lastRead || (msg.created_at as string) > lastRead) {
        unreadByConv.set(cid, (unreadByConv.get(cid) ?? 0) + 1)
      }
    }

    // ── 6. Conversation rows (sorted by activity) ──────────────
    const { data: convRows } = await supabase
      .from('conversations')
      .select('id, updated_at')
      .in('id', myConvIds)
      .order('updated_at', { ascending: false })

    conversations = (convRows ?? []).map((conv) => {
      const cid       = conv.id as string
      const otherUserId = otherUserByConv.get(cid)
      return {
        id:          cid,
        updatedAt:   conv.updated_at as string,
        otherUser:   otherUserId ? (profilesById.get(otherUserId) ?? null) : null,
        lastMessage: lastMsgByConv.get(cid) ?? null,
        unreadCount: unreadByConv.get(cid) ?? 0,
      }
    })
  }

  // ── 7. Thread messages (if DM conversation selected) ──────────
  let threadMessages: MessageWithSender[] = []

  if (selectedConvId && myConvIds.includes(selectedConvId)) {
    const { data: msgRows } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', selectedConvId)
      .order('created_at', { ascending: true })

    const senderIds = [...new Set((msgRows ?? []).map((m) => m.sender_id as string))]
    const { data: senderProfiles } = senderIds.length > 0
      ? await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', senderIds)
      : { data: [] }

    const sendersById = new Map((senderProfiles ?? []).map((p) => [p.id as string, p]))
    threadMessages = (msgRows ?? []).map((msg) => ({
      ...msg,
      attachment_path: (msg.attachment_path as string | null) ?? null,
      attachment_name: (msg.attachment_name as string | null) ?? null,
      attachment_type: (msg.attachment_type as string | null) ?? null,
      attachment_size: (msg.attachment_size as number | null) ?? null,
      sender: sendersById.get(msg.sender_id as string) ?? null,
    })) as MessageWithSender[]
  }

  // ── 8. All users for "New conversation" ───────────────────────
  const { data: allUsers } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, role')
    .neq('id', profile.id)
    .order('full_name')

  // ── 9. Project conversations (admin only) ─────────────────────
  let projectConversations: ProjectConversation[] = []
  let projectChatMessages:  ProjectChatMessageWithSender[] = []
  let selectedProjectCode = ''
  let selectedProjectName = ''

  if (isAdmin) {
    // Fetch all projects
    const { data: projects } = await supabase
      .from('projects')
      .select('id, project_code, name')
      .order('name')

    if ((projects ?? []).length > 0) {
      const projectIds = (projects ?? []).map((p) => p.id as string)

      // Latest message per project (one query, sorted desc, take first per project)
      const { data: recentMsgs } = await supabase
        .from('project_chat_messages')
        .select('project_id, body, created_at, sender_id')
        .in('project_id', projectIds)
        .order('created_at', { ascending: false })
        .limit(1000)

      const latestByProject = new Map<string, { body: string; created_at: string; sender_id: string | null }>()
      for (const msg of recentMsgs ?? []) {
        const pid = msg.project_id as string
        if (!latestByProject.has(pid)) {
          latestByProject.set(pid, {
            body:       msg.body as string,
            created_at: msg.created_at as string,
            sender_id:  msg.sender_id as string | null,
          })
        }
      }

      // Current user's last read per project
      const { data: reads } = await supabase
        .from('project_chat_reads')
        .select('project_id, last_read_at')
        .eq('user_id', profile.id)
        .in('project_id', projectIds)

      const lastReadByProject = new Map(
        (reads ?? []).map((r) => [r.project_id as string, r.last_read_at as string])
      )

      // Unread count: count messages newer than last_read_at per project
      const unreadByProject = new Map<string, number>()
      for (const msg of recentMsgs ?? []) {
        const pid = msg.project_id as string
        if ((msg.sender_id as string) === profile.id) continue
        const lastRead = lastReadByProject.get(pid)
        if (!lastRead || (msg.created_at as string) > lastRead) {
          unreadByProject.set(pid, (unreadByProject.get(pid) ?? 0) + 1)
        }
      }

      // Build project conversation list — only projects with messages, sorted by latest
      projectConversations = (projects ?? [])
        .map((p) => ({
          projectId:   p.id as string,
          projectCode: p.project_code as string,
          projectName: p.name as string,
          lastMessage: latestByProject.get(p.id as string) ?? null,
          unreadCount: unreadByProject.get(p.id as string) ?? 0,
        }))
        .filter((p) => p.lastMessage !== null)
        .sort((a, b) => {
          const aTime = a.lastMessage?.created_at ?? ''
          const bTime = b.lastMessage?.created_at ?? ''
          return bTime.localeCompare(aTime)
        })
    }

    // Selected project's chat messages
    if (selectedProjectId) {
      const { data: projRow } = await supabase
        .from('projects')
        .select('project_code, name')
        .eq('id', selectedProjectId)
        .single()

      selectedProjectCode = (projRow as { project_code: string; name: string } | null)?.project_code ?? ''
      selectedProjectName = (projRow as { project_code: string; name: string } | null)?.name ?? ''

      const { data: rawMsgs } = await supabase
        .from('project_chat_messages')
        .select('*')
        .eq('project_id', selectedProjectId)
        .order('created_at', { ascending: true })

      const rawList = (rawMsgs ?? []) as Record<string, unknown>[]
      const senderIds = [...new Set(
        rawList
          .map((m) => m.sender_id as string | null)
          .filter((id): id is string => id !== null)
      )]

      const { data: senderProfs } = senderIds.length > 0
        ? await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('id', senderIds)
        : { data: [] }

      const sendersById = new Map((senderProfs ?? []).map((p) => [p.id as string, p]))
      projectChatMessages = rawList.map((msg) => ({
        ...msg,
        message_type:    (msg.message_type as string) ?? 'user',
        sender: msg.sender_id
          ? (sendersById.get(msg.sender_id as string) ?? null)
          : null,
      })) as ProjectChatMessageWithSender[]
    }
  }

  return (
    <MessagesClient
      profile={profile}
      conversations={conversations}
      threadMessages={threadMessages}
      selectedConvId={selectedConvId}
      allUsers={(allUsers ?? []) as Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'role'>[]}
      isAdmin={isAdmin}
      projectConversations={projectConversations}
      projectChatMessages={projectChatMessages}
      selectedProjectId={selectedProjectId}
      selectedProjectCode={selectedProjectCode}
      selectedProjectName={selectedProjectName}
    />
  )
}
