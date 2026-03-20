import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/layout/Topbar'
import { ActivityFeed } from './ActivityFeed'
import type { ActivityLogWithProfile } from '@/types/database'

export const metadata = {
  title: 'Activity – ENE Builders',
}

export default async function ActivityPage() {
  await requireRole(['admin', 'office'])

  const supabase = await createClient()

  const [{ data: logsData }, { data: usersData }, { data: projectsData }] = await Promise.all([
    supabase
      .from('activity_logs')
      .select('*, profiles(id, full_name, avatar_url), projects(id, project_code, name)')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase.from('profiles').select('id, full_name').order('full_name'),
    supabase.from('projects').select('id, project_code, name').order('project_code'),
  ])

  const logs = (logsData ?? []) as ActivityLogWithProfile[]
  const allUsers = (usersData ?? []) as { id: string; full_name: string }[]
  const allProjects = (projectsData ?? []) as { id: string; project_code: string; name: string }[]

  return (
    <>
      <Topbar title="Activity" />
      <main className="flex-1 overflow-y-auto bg-[#F4F2EF] px-4 py-8 lg:px-10 lg:py-10">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Activity Feed</h1>
            <p className="text-sm text-gray-400 mt-1">
              A real-time trail of all key actions across projects and users.
            </p>
          </div>

          <ActivityFeed logs={logs} allUsers={allUsers} allProjects={allProjects} />
        </div>
      </main>
    </>
  )
}
