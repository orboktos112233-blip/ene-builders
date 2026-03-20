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
} from '@/lib/auth/permissions'
import { OverviewTab } from './tabs/OverviewTab'
import { SectionsTab } from './tabs/SectionsTab'
import { ImportHistoryTab } from './tabs/ImportHistoryTab'
import type {
  Project,
  Profile,
  ProjectAssignment,
  ProjectImportRun,
  SectionWithItems,
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
  ])

  const project = projectData as Project | null
  if (!project) notFound()

  const assignments = (assignmentsData ?? []) as (ProjectAssignment & { profiles: Profile })[]
  const allUsers = (allUsersData ?? []) as Profile[]
  const sections = (sectionsData ?? []) as SectionWithItems[]
  const importRun = importRunData as (ProjectImportRun & { profiles: Profile }) | null

  // Sort items within each section by display_order
  for (const section of sections) {
    section.project_items = section.project_items.sort(
      (a, b) => a.display_order - b.display_order
    )
  }

  const assignedUserIds = new Set(assignments.map((a) => a.user_id))
  const unassignedUsers = allUsers.filter((u) => !assignedUserIds.has(u.id))

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'sections', label: `Sections & Items${sections.length > 0 ? ` (${sections.length})` : ''}` },
    ...(canImportProjects(profile.role) ? [{ key: 'import-history', label: 'Import History' }] : []),
  ]

  return (
    <>
      <Topbar title={project.name} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">

          {/* Breadcrumb */}
          <nav className="text-xs text-gray-400 flex items-center gap-1.5">
            <Link href="/dashboard/projects" className="hover:text-gray-600">Projects</Link>
            <span>/</span>
            <span className="text-gray-600">{project.project_code}</span>
          </nav>

          {/* Tab bar */}
          <div className="flex border-b border-gray-200 gap-1">
            {tabs.map(({ key, label }) => (
              <Link
                key={key}
                href={`/dashboard/projects/${id}?tab=${key}`}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                  tab === key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
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
              assignments={assignments}
              unassignedUsers={unassignedUsers}
              canEdit={canEditProject(profile.role)}
              canManageTeam={canManageAssignments(profile.role)}
            />
          )}

          {tab === 'sections' && (
            <SectionsTab
              projectId={project.id}
              sections={sections}
              canManage={canManageSections(profile.role)}
              canEdit={canManageItems(profile.role)}
              canDelete={canDeleteItems(profile.role)}
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
