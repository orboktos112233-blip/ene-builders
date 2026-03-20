import { requireAuth } from '@/lib/auth/session'
import { Sidebar } from '@/components/layout/Sidebar'
import { SidebarProvider } from '@/components/layout/SidebarContext'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // This will redirect to /login if the session is missing.
  const profile = await requireAuth()

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-[#F4F2EF]">
        <Sidebar profile={profile} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {children}
        </div>
      </div>
    </SidebarProvider>
  )
}
