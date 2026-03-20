import { ProjectDetailsCard } from '../ProjectDetailsCard'
import { ProjectMediaSection } from '@/components/media/ProjectMediaSection'
import { ProjectFilesSection } from '@/components/media/ProjectFilesSection'
import type { Project, MediaFile } from '@/types/database'

interface OverviewTabProps {
  project: Project
  canEdit: boolean
  mediaFiles: MediaFile[]
  projectFiles: MediaFile[]
  canUpload: boolean
  canDelete: boolean
}

export function OverviewTab({
  project,
  canEdit,
  mediaFiles,
  projectFiles,
  canUpload,
  canDelete,
}: OverviewTabProps) {
  return (
    <div className="space-y-5">
      <ProjectDetailsCard project={project} canEdit={canEdit} />
      <ProjectMediaSection
        projectId={project.id}
        files={mediaFiles}
        canUpload={canUpload}
        canDelete={canDelete}
      />
      <ProjectFilesSection
        projectId={project.id}
        files={projectFiles}
        canUpload={canUpload}
        canDelete={canDelete}
      />
    </div>
  )
}
