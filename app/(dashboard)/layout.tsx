import { requireAuth } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { SidebarProvider } from '@/components/layout/SidebarContext'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // This will redirect to /login if the session is missing.
  const profile = await requireAuth()
  const supabase = await createClient()

  // ── Unread message count ────────────────────────────────────
  // Count messages sent by others that are newer than last_read_at
  let unreadMessages = 0
  try {
    const { data: participations } = await supabase
      .from('conversation_participants')
      .select('conversation_id, last_read_at')
      .eq('user_id', profile.id)

    const convIds = (participations ?? []).map((p) => p.conversation_id as string)

    if (convIds.length > 0) {
      const lastReadMap = new Map(
        (participations ?? []).map((p) => [p.conversation_id as string, p.last_read_at as string | null])
      )

      const { data: msgs } = await supabase
        .from('messages')
        .select('conversation_id, created_at')
        .in('conversation_id', convIds)
        .neq('sender_id', profile.id)

      for (const msg of msgs ?? []) {
        const lastRead = lastReadMap.get(msg.conversation_id as string)
        if (!lastRead || (msg.created_at as string) > lastRead) {
          unreadMessages++
        }
      }
    }
  } catch {
    // Non-fatal — sidebar badge is optional
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-[#F4F2EF]">
        <Sidebar profile={profile} unreadMessages={unreadMessages} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {children}
        </div>
      </div>
    </SidebarProvider>
  )
}
