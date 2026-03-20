import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/layout/Topbar'
import { Card } from '@/components/ui/Card'
import { RoleBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { formatDate } from '@/lib/utils'
import { InviteUserForm } from './InviteUserForm'
import { ChangeRoleForm } from './ChangeRoleForm'
import type { Profile } from '@/types/database'

export const metadata = {
  title: 'Users – ENE Builders',
}

export default async function UsersPage() {
  // Hard gate: only admins can access this page.
  await requireRole(['admin'])

  const supabase = await createClient()
  const { data: usersData } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  const users = usersData as Profile[] | null

  return (
    <>
      <Topbar title="Users" />
      <main className="flex-1 overflow-y-auto bg-[#F4F2EF] px-4 py-8 lg:px-10 lg:py-10">
        <div className="max-w-4xl mx-auto space-y-8">

          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Users</h1>
            <p className="text-sm text-gray-400 mt-1">Manage team members and their access roles.</p>
          </div>

          {/* Invite form */}
          <Card>
            <div className="px-6 py-5 border-b border-black/[0.05]">
              <h2 className="text-sm font-semibold text-gray-800">Invite New User</h2>
            </div>
            <div className="px-6 py-5">
              <InviteUserForm />
            </div>
          </Card>

          {/* Users table */}
          <Card>
            <div className="px-6 py-5 border-b border-black/[0.05]">
              <h2 className="text-sm font-semibold text-gray-800">
                All Users <span className="text-gray-400 font-normal ml-1">({users?.length ?? 0})</span>
              </h2>
            </div>
            <div className="divide-y divide-black/[0.04]">
              {users?.map((user) => (
                <div key={user.id} className="flex items-center justify-between px-6 py-4 gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={user.full_name} avatarUrl={user.avatar_url} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{user.full_name}</p>
                      <p className="text-xs text-gray-400">Joined {formatDate(user.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <RoleBadge role={user.role} />
                    <ChangeRoleForm userId={user.id} currentRole={user.role} />
                  </div>
                </div>
              ))}
              {(!users || users.length === 0) && (
                <p className="text-sm text-gray-400 text-center py-10">No users found.</p>
              )}
            </div>
          </Card>

        </div>
      </main>
    </>
  )
}
