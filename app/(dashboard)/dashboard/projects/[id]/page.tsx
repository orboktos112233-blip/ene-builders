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
  canUploadPhotoLive,
  canDeleteAnyLivePhoto,
  canReviewLivePhoto,
} from '@/lib/auth/permissions'
import { OverviewTab } from './tabs/OverviewTab'
import { SectionsTab } from './tabs/SectionsTab'
import { PhasesTab } from './tabs/PhasesTab'
import { TeamTab } from './tabs/TeamTab'
import { ImportHistoryTab } from './tabs/ImportHistoryTab'
import { PhotoLiveTab } from './tabs/PhotoLiveTab'
import { ProjectChatTab } from './tabs/ProjectChatTab'
import type {
  Project,
  Profile,
  ProjectAssignment,
  ProjectImportRun,
  SectionWithItems,
  MediaFile,
  ConstructionPhase,
  LivePhotoWithUploader,
  ProjectChatMessageWithSender,
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
    // Live photos: plain select — no embedded profile joins.
    // PostgREST can fail to resolve FK hints when two columns on the same table
    // both reference profiles (uploaded_by + reviewed_by). We resolve profiles
    // in a separate query below, which is always reliable.
    { data: rawLivePhotosData, error: livePhotosError },
    { data: rawChatMessages },
    { data: chatReadRow },
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
      .neq('category', 'live_photo')
      .order('created_at', { ascending: false }),
    supabase
      .from('construction_phases')
      .select('id, project_id, phase_name, status, notes, start_date, end_date, updated_by, updated_at')
      .eq('project_id', id)
      .order('updated_at', { ascending: false }),
    supabase
      .from('media_files')
      .select('*')
      .eq('project_id', id)
      .eq('category', 'live_photo')
      .order('created_at', { ascending: false }),
    // Project chat: plain select, profiles resolved below
    supabase
      .from('project_chat_messages')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: true }),
    // Current user's last read timestamp for this chat
    supabase
      .from('project_chat_reads')
      .select('last_read_at')
      .eq('project_id', id)
      .eq('user_id', profile.id)
      .maybeSingle(),
  ])

  if (livePhotosError) {
    console.error('[Photo Live] feed query failed:', livePhotosError.message)
  }

  const project = projectData as Project | null
  if (!project) notFound()

  const assignments = (assignmentsData ?? []) as (ProjectAssignment & { profiles: Profile })[]
  const allUsers = (allUsersData ?? []) as Profile[]
  const sections = (sectionsData ?? []) as SectionWithItems[]
  const importRun = importRunData as (ProjectImportRun & { profiles: Profile }) | null
  const allMediaFiles = (mediaFilesData ?? []) as MediaFile[]
  const phases = (phasesData ?? []) as ConstructionPhase[]

  // Resolve uploader and reviewer profiles with a single follow-up query.
  // This avoids the PostgREST schema-cache issue with multiple FKs to profiles.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawLivePhotos: any[] = rawLivePhotosData ?? []

  const livePhotos: LivePhotoWithUploader[] = await (async () => {
    if (rawLivePhotos.length === 0) return []

    const profileIds = [...new Set([
      ...rawLivePhotos.map((p) => p.uploaded_by as string),
      ...rawLivePhotos.map((p) => p.reviewed_by as string | null).filter(Boolean),
    ])]

    const profilesById = new Map<string, Pick<Profile, 'id' | 'full_name' | 'avatar_url'>>()
    if (profileIds.length > 0) {
      const { data: profData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', profileIds)
      for (const p of profData ?? []) {
        profilesById.set(p.id, p as Pick<Profile, 'id' | 'full_name' | 'avatar_url'>)
      }
    }

    return rawLivePhotos.map((photo) => ({
      ...photo,
      profiles:         profilesById.get(photo.uploaded_by as string) ?? null,
      reviewer_profile: photo.reviewed_by
        ? (profilesById.get(photo.reviewed_by as string) ?? null)
        : null,
    })) as LivePhotoWithUploader[]
  })()

  // Resolve chat message sender profiles
  // sender_id is NULL for system messages — filter those out before the profile lookup.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawChat: any[] = rawChatMessages ?? []
  const chatMessages: ProjectChatMessageWithSender[] = await (async () => {
    if (rawChat.length === 0) return []
    const senderIds = [...new Set(
      rawChat
        .map((m) => m.sender_id as string | null)
        .filter((id): id is string => id !== null)
    )]
    const sendersById = new Map<string, { id: string; full_name: string; avatar_url: string | null }>()
    if (senderIds.length > 0) {
      const { data: senderProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', senderIds)
      for (const p of senderProfiles ?? []) {
        sendersById.set(p.id as string, p as { id: string; full_name: string; avatar_url: string | null })
      }
    }
    return rawChat.map((msg) => ({
      ...msg,
      message_type: (msg.message_type as string) ?? 'user',
      sender: msg.sender_id ? (sendersById.get(msg.sender_id as string) ?? null) : null,
    })) as ProjectChatMessageWithSender[]
  })()

  // Unread chat count: messages after last_read_at, not sent by current user
  const lastReadAt = (chatReadRow as { last_read_at: string } | null)?.last_read_at ?? null
  const chatUnreadCount = chatMessages.filter(
    (m) => m.sender_id !== profile.id && (!lastReadAt || m.created_at > lastReadAt)
  ).length

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

  const showPhotoLive = canUploadPhotoLive(profile.role) || profile.role === 'admin'
  // Chat is visible to admin (always) and users assigned to this project
  const showChat = profile.role === 'admin' || isAssigned

  const tabs = [
    { key: 'overview',   label: 'Overview' },
    { key: 'progress',   label: 'Progress' },
    { key: 'sections',   label: sections.length > 0 ? `Sections & Items (${sections.length})` : 'Sections & Items' },
    { key: 'team',       label: assignments.length > 0 ? `Team (${assignments.length})` : 'Team' },
    ...(showPhotoLive
      ? [{ key: 'photo-live', label: livePhotos.length > 0 ? `Photo Live (${livePhotos.length})` : 'Photo Live' }]
      : []),
    ...(showChat
      ? [{ key: 'chat', label: chatUnreadCount > 0 ? `Chat (${chatUnreadCount} new)` : 'Chat' }]
      : []),
    ...(canImportProjects(profile.role) ? [{ key: 'import-history', label: 'Import History' }] : []),
  ]

  return (
    <>
      <Topbar title={project.name} />
      <main className="flex-1 overflow-y-auto bg-[#F4F2EF]">
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
                    ? 'border-violet-600 text-violet-600'
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
              projectName={project.name}
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

          {tab === 'photo-live' && showPhotoLive && (
            <PhotoLiveTab
              projectId={project.id}
              photos={livePhotos}
              canUpload={canUploadPhotoLive(profile.role)}
              canDeleteAny={canDeleteAnyLivePhoto(profile.role)}
              canReview={canReviewLivePhoto(profile.role) && (profile.role === 'admin' || isAssigned)}
              currentUserId={profile.id}
              currentUserProfile={{
                id:         profile.id,
                full_name:  profile.full_name,
                avatar_url: profile.avatar_url,
              }}
            />
          )}

          {tab === 'chat' && showChat && (
            <ProjectChatTab
              projectId={project.id}
              projectCode={project.project_code}
              projectName={project.name}
              initialMessages={chatMessages}
              currentUser={{
                id:         profile.id,
                full_name:  profile.full_name,
                avatar_url: profile.avatar_url,
              }}
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
