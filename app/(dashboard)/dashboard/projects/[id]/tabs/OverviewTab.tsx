import { ProjectDetailsCard } from '../ProjectDetailsCard'
import { ProjectLocationMap } from '../ProjectLocationMap'
import { ProjectMediaSection } from '@/components/media/ProjectMediaSection'
import { ProjectFilesSection } from '@/components/media/ProjectFilesSection'
import { DeleteProjectButton } from '../DeleteProjectButton'
import type { Project, MediaFile } from '@/types/database'

interface OverviewTabProps {
  project: Project
  canEdit: boolean
  canDelete: boolean
  mediaFiles: MediaFile[]
  projectFiles: MediaFile[]
  canUpload: boolean
  canDeleteMedia: boolean
}

export function OverviewTab({
  project,
  canEdit,
  canDelete,
  mediaFiles,
  projectFiles,
  canUpload,
  canDeleteMedia,
}: OverviewTabProps) {
  return (
    <div className="space-y-5">
      <ProjectDetailsCard project={project} canEdit={canEdit} />
      <ProjectLocationMap address={project.address} />
      <ProjectMediaSection
        projectId={project.id}
        files={mediaFiles}
        canUpload={canUpload}
        canDelete={canDeleteMedia}
      />
      <ProjectFilesSection
        projectId={project.id}
        files={projectFiles}
        canUpload={canUpload}
        canDelete={canDeleteMedia}
      />

      {/* Danger zone — admin only */}
      {canDelete && (
        <div className="bg-white border border-red-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-red-100 bg-red-50/40">
            <h3 className="text-sm font-semibold text-red-700">Danger Zone</h3>
            <p className="text-xs text-red-400 mt-0.5">Irreversible actions — proceed with caution</p>
          </div>
          <div className="px-6 py-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-800">Delete this project</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Permanently removes all data: sections, items, team, media, and files.
              </p>
            </div>
            <DeleteProjectButton projectId={project.id} projectName={project.name} />
          </div>
        </div>
      )}
    </div>
  )
}
