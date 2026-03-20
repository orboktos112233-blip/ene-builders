import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { StatusBadge, RoleBadge } from '@/components/ui/Badge'
import { formatDate, formatCurrency } from '@/lib/utils'
import { canEditProject, canManageAssignments } from '@/lib/auth/permissions'
import { UpdateStatusForm } from '../UpdateStatusForm'
import { AssignUserForm } from '../AssignUserForm'
import { RemoveAssignmentButton } from '../RemoveAssignmentButton'
import type { Project, Profile, ProjectAssignment, ProjectStatus } from '@/types/database'

interface OverviewTabProps {
  project: Project
  assignments: (ProjectAssignment & { profiles: Profile })[]
  unassignedUsers: Profile[]
  canEdit: boolean
  canManageTeam: boolean
}

export function OverviewTab({
  project,
  assignments,
  unassignedUsers,
  canEdit,
  canManageTeam,
}: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Project header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-gray-400">{project.project_code}</span>
                <StatusBadge status={project.status as ProjectStatus} />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">{project.name}</h2>
              {project.address && (
                <p className="text-sm text-gray-500 mt-0.5">{project.address}</p>
              )}
            </div>
            {canEdit && (
              <UpdateStatusForm projectId={project.id} currentStatus={project.status as ProjectStatus} />
            )}
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <dt className="text-xs text-gray-400">Start Date</dt>
              <dd className="text-sm text-gray-800 mt-0.5">{formatDate(project.start_date)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Est. Completion</dt>
              <dd className="text-sm text-gray-800 mt-0.5">{formatDate(project.estimated_end_date)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Budget</dt>
              <dd className="text-sm text-gray-800 mt-0.5">{formatCurrency(project.budget_total)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Created</dt>
              <dd className="text-sm text-gray-800 mt-0.5">{formatDate(project.created_at)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Client info */}
      {(project.client_name || project.client_email || project.client_phone) && (
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-gray-700">Client</h3>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {project.client_name && (
                <div>
                  <dt className="text-xs text-gray-400">Name</dt>
                  <dd className="text-sm text-gray-800 mt-0.5">{project.client_name}</dd>
                </div>
              )}
              {project.client_email && (
                <div>
                  <dt className="text-xs text-gray-400">Email</dt>
                  <dd className="text-sm text-gray-800 mt-0.5">
                    <a href={`mailto:${project.client_email}`} className="text-blue-600 hover:underline">
                      {project.client_email}
                    </a>
                  </dd>
                </div>
              )}
              {project.client_phone && (
                <div>
                  <dt className="text-xs text-gray-400">Phone</dt>
                  <dd className="text-sm text-gray-800 mt-0.5">{project.client_phone}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Team */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-gray-700">
            Team <span className="text-gray-400 font-normal">({assignments.length})</span>
          </h3>
        </CardHeader>

        {canManageTeam && (
          <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
            <AssignUserForm projectId={project.id} users={unassignedUsers} />
          </div>
        )}

        <div className="divide-y divide-gray-100">
          {assignments.map((a) => (
            <div key={a.id} className="flex items-center justify-between px-6 py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                  {a.profiles.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{a.profiles.full_name}</p>
                  <p className="text-xs text-gray-400 capitalize">{a.assignment_role.replace('_', ' ')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <RoleBadge role={a.profiles.role} />
                {canManageTeam && (
                  <RemoveAssignmentButton assignmentId={a.id} projectId={project.id} />
                )}
              </div>
            </div>
          ))}
          {assignments.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No team members assigned.</p>
          )}
        </div>
      </Card>
    </div>
  )
}
