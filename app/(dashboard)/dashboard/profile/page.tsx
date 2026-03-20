import { requireAuth } from '@/lib/auth/session'
import { Topbar } from '@/components/layout/Topbar'
import { AvatarUpload } from '@/components/media/AvatarUpload'
import { ROLE_LABELS } from '@/lib/auth/permissions'
import { UpdateNameForm } from './UpdateNameForm'
import { ChangePasswordForm } from './ChangePasswordForm'

export const metadata = {
  title: 'My Profile – ENE Builders',
}

export default async function ProfilePage() {
  const profile = await requireAuth()

  return (
    <>
      <Topbar title="My Profile" />
      <main className="flex-1 overflow-y-auto bg-[#F4F2EF] px-4 py-8 lg:px-10 lg:py-10">
        <div className="max-w-lg mx-auto space-y-6">

          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">My Profile</h1>
            <p className="text-sm text-gray-400 mt-1">Manage your account information and security.</p>
          </div>

          {/* ── Avatar card ── */}
          <div className="bg-white border border-black/[0.06] rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
            <div className="px-6 py-5 border-b border-black/[0.05]">
              <h2 className="text-sm font-semibold text-gray-900">Profile Photo</h2>
              <p className="text-xs text-gray-400 mt-0.5">Visible across projects, teams, and reports</p>
            </div>
            <div className="px-6 py-10 flex flex-col items-center">
              <AvatarUpload
                userId={profile.id}
                name={profile.full_name}
                currentAvatarUrl={profile.avatar_url}
              />
            </div>
          </div>

          {/* ── Edit name card ── */}
          <div className="bg-white border border-black/[0.06] rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
            <div className="px-6 py-5 border-b border-black/[0.05]">
              <h2 className="text-sm font-semibold text-gray-900">Profile Information</h2>
              <p className="text-xs text-gray-400 mt-0.5">Update your display name</p>
            </div>
            <div className="px-6 py-6 space-y-5">
              <UpdateNameForm currentName={profile.full_name} />

              {/* Role — read-only */}
              <div className="pt-4 border-t border-black/[0.05]">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-[0.08em] mb-1.5">Role</p>
                <p className="text-sm font-semibold text-gray-700">{ROLE_LABELS[profile.role] ?? profile.role}</p>
                <p className="text-xs text-gray-400 mt-0.5">Roles are assigned by an administrator.</p>
              </div>
            </div>
          </div>

          {/* ── Change password card ── */}
          <div className="bg-white border border-black/[0.06] rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
            <div className="px-6 py-5 border-b border-black/[0.05]">
              <h2 className="text-sm font-semibold text-gray-900">Change Password</h2>
              <p className="text-xs text-gray-400 mt-0.5">You must enter your current password to set a new one</p>
            </div>
            <div className="px-6 py-6">
              <ChangePasswordForm />
            </div>
          </div>

        </div>
      </main>
    </>
  )
}
