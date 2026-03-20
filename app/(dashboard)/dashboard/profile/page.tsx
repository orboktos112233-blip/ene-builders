import { requireAuth } from '@/lib/auth/session'
import { Topbar } from '@/components/layout/Topbar'
import { AvatarUpload } from '@/components/media/AvatarUpload'
import { ROLE_LABELS } from '@/lib/auth/permissions'

export const metadata = {
  title: 'My Profile – ENE Builders',
}

export default async function ProfilePage() {
  const profile = await requireAuth()

  return (
    <>
      <Topbar title="My Profile" />
      <main className="flex-1 overflow-y-auto bg-slate-50 p-6 lg:p-8">
        <div className="max-w-lg mx-auto space-y-6">

          {/* Avatar card */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Profile Photo</h2>
              <p className="text-xs text-gray-400 mt-0.5">Visible across projects, teams, and reports</p>
            </div>
            <div className="px-6 py-8 flex flex-col items-center">
              <AvatarUpload
                userId={profile.id}
                name={profile.full_name}
                currentAvatarUrl={profile.avatar_url}
              />
            </div>
          </div>

          {/* Account info */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Account Info</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Full Name</p>
                <p className="text-sm font-medium text-gray-900">{profile.full_name}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Role</p>
                <p className="text-sm font-medium text-gray-900">{ROLE_LABELS[profile.role] ?? profile.role}</p>
              </div>
            </div>
          </div>

        </div>
      </main>
    </>
  )
}
