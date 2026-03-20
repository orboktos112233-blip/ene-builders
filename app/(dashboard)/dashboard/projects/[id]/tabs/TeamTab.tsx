import { RoleBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { AssignUserForm } from '../AssignUserForm'
import { RemoveAssignmentButton } from '../RemoveAssignmentButton'
import type { Profile, ProjectAssignment } from '@/types/database'

interface TeamTabProps {
  projectId: string
  assignments: (ProjectAssignment & { profiles: Profile })[]
  unassignedUsers: Profile[]
  canManageTeam: boolean
}

export function TeamTab({
  projectId,
  assignments,
  unassignedUsers,
  canManageTeam,
}: TeamTabProps) {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Team Members</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {assignments.length} member{assignments.length !== 1 ? 's' : ''} assigned to this project
            </p>
          </div>
        </div>

        {/* Add member */}
        {canManageTeam && (
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500 mb-2 font-medium">Add team member</p>
            <AssignUserForm projectId={projectId} users={unassignedUsers} />
          </div>
        )}

        {/* Member list */}
        {assignments.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-400">No team members assigned yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {assignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <Avatar name={a.profiles.full_name} avatarUrl={(a.profiles as any).avatar_url ?? null} size="sm" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{a.profiles.full_name}</p>
                    <p className="text-xs text-gray-400 capitalize mt-0.5">
                      {a.assignment_role.replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <RoleBadge role={a.profiles.role} />
                  {canManageTeam && (
                    <RemoveAssignmentButton assignmentId={a.id} projectId={projectId} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
