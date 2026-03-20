import { requireAuth } from '@/lib/auth/session'
import { Sidebar } from '@/components/layout/Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // This will redirect to /login if the session is missing.
  const profile = await requireAuth()

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar profile={profile} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
