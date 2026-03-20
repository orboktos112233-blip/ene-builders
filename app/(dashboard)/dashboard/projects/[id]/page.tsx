import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireAuth } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/layout/Topbar'
import { cn } from '@/lib/utils'
import {
  canEditProject,
  canManageAssignments,
  canManageSections,
  canManageItems,
  canDeleteItems,
  canImportProjects,
  canUploadMedia,
  canDeleteMedia,
  canDeleteProject,
  canManagePhases,
} from '@/lib/auth/permissions'
import { OverviewTab } from './tabs/OverviewTab'
import { SectionsTab } from './tabs/SectionsTab'
import { PhasesTab } from './tabs/PhasesTab'
import { TeamTab } from './tabs/TeamTab'
import { ImportHistoryTab } from './tabs/ImportHistoryTab'
import type {
  Project,
  Profile,
  ProjectAssignment,
  ProjectImportRun,
  SectionWithItems,
  MediaFile,
  ConstructionPhase,
} from '@/types/database'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('projects').select('*').eq('id', id).single()
  const project = data as Project | null
  return {
    title: project ? `${project.project_code} – ${project.name}` : 'Project – ENE Builders',
  }
}

export default async function ProjectDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { tab = 'overview' } = await searchParams

  const profile = await requireAuth()
  const supabase = await createClient()

  const [
    { data: projectData },
    { data: assignmentsData },
    { data: allUsersData },
    { data: sectionsData },
    { data: importRunData },
    { data: mediaFilesData },
    { data: phasesData },
  ] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).single(),
    supabase.from('project_assignments').select('*, profiles(*)').eq('project_id', id),
    canManageAssignments(profile.role)
      ? supabase.from('profiles').select('*').order('full_name')
      : Promise.resolve({ data: [] }),
    supabase
      .from('project_sections')
      .select('*, project_items(*)')
      .eq('project_id', id)
      .order('display_order', { ascending: true }),
    canImportProjects(profile.role)
      ? supabase
          .from('project_import_runs')
          .select('*, profiles(*)')
          .eq('project_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
      : Promise.resolve({ data: null }),
    supabase
      .from('media_files')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('construction_phases')
      .select('*')
      .eq('project_id', id)
      .order('updated_at', { ascending: false }),
  ])

  const project = projectData as Project | null
  if (!project) notFound()

  const assignments = (assignmentsData ?? []) as (ProjectAssignment & { profiles: Profile })[]
  const allUsers = (allUsersData ?? []) as Profile[]
  const sections = (sectionsData ?? []) as SectionWithItems[]
  const importRun = importRunData as (ProjectImportRun & { profiles: Profile }) | null
  const allMediaFiles = (mediaFilesData ?? []) as MediaFile[]
  const phases = (phasesData ?? []) as ConstructionPhase[]

  const mediaFiles = allMediaFiles.filter((f) => f.file_type.startsWith('image/') || f.file_type.startsWith('video/'))
  const projectFiles = allMediaFiles.filter((f) => !f.file_type.startsWith('image/') && !f.file_type.startsWith('video/'))

  for (const section of sections) {
    section.project_items = section.project_items.sort(
      (a, b) => a.display_order - b.display_order
    )
  }

  const assignedUserIds = new Set(assignments.map((a) => a.user_id))
  const unassignedUsers = allUsers.filter((u) => !assignedUserIds.has(u.id))

  // PM can only edit phases if they are assigned to this project
  const isAssigned = assignments.some((a) => a.user_id === profile.id)
  const userCanEditPhases =
    profile.role === 'admin' ||
    (profile.role === 'project_manager' && isAssigned)

  const tabs = [
    { key: 'overview',  label: 'Overview' },
    { key: 'progress',  label: 'Progress' },
    { key: 'sections',  label: sections.length > 0 ? `Sections & Items (${sections.length})` : 'Sections & Items' },
    { key: 'team',      label: assignments.length > 0 ? `Team (${assignments.length})` : 'Team' },
    ...(canImportProjects(profile.role) ? [{ key: 'import-history', label: 'Import History' }] : []),
  ]

  return (
    <>
      <Topbar title={project.name} />
      <main className="flex-1 overflow-y-auto bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 lg:px-6 py-6 space-y-5">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs">
            <Link href="/dashboard/projects" className="text-gray-400 hover:text-gray-600 transition-colors font-medium">
              Projects
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-gray-600 font-semibold">{project.project_code}</span>
          </nav>

          {/* Tab bar — scrollable on mobile */}
          <div className="flex border-b border-gray-200 gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1">
            {tabs.map(({ key, label }) => (
              <Link
                key={key}
                href={`/dashboard/projects/${id}?tab=${key}`}
                className={cn(
                  'px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all duration-150 whitespace-nowrap',
                  tab === key
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-300'
                )}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Tab content */}
          {tab === 'overview' && (
            <OverviewTab
              project={project}
              canEdit={canEditProject(profile.role)}
              canDelete={canDeleteProject(profile.role)}
              mediaFiles={mediaFiles}
              projectFiles={projectFiles}
              canUpload={canUploadMedia(profile.role)}
              canDeleteMedia={canDeleteMedia(profile.role)}
            />
          )}

          {tab === 'progress' && (
            <PhasesTab
              projectId={project.id}
              initialPhases={phases}
              canEdit={userCanEditPhases}
            />
          )}

          {tab === 'sections' && (
            <SectionsTab
              projectId={project.id}
              sections={sections}
              budgetTotal={project.budget_total}
              canManage={canManageSections(profile.role)}
              canEdit={canManageItems(profile.role)}
              canDelete={canDeleteItems(profile.role)}
            />
          )}

          {tab === 'team' && (
            <TeamTab
              projectId={project.id}
              assignments={assignments}
              unassignedUsers={unassignedUsers}
              canManageTeam={canManageAssignments(profile.role)}
            />
          )}

          {tab === 'import-history' && canImportProjects(profile.role) && (
            <ImportHistoryTab importRun={importRun} />
          )}

        </div>
      </main>
    </>
  )
}
