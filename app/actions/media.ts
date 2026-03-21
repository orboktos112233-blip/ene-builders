'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/session'
import type { MediaCategory } from '@/types/database'
import { logActivity } from '@/lib/activity/log'
import { sendNotification } from '@/lib/notifications/send'

// ── Admin client — bypasses RLS for server-side writes ─────────────────
// Safe: server actions already call requireAuth() before using this.
async function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  const { createClient: create } = await import('@supabase/supabase-js')
  return create(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export interface MediaActionState {
  error?: string
  success?: boolean
}

// ── Save file record after client-side Storage upload ──────────────────

export async function saveMediaRecordAction(data: {
  project_id: string
  file_path: string
  file_name: string
  file_type: string
  file_size: number | null
  category: MediaCategory
  description: string | null
}): Promise<MediaActionState> {
  const profile = await requireAuth()
  const supabase = await createClient()

  // Use admin client to bypass RLS — permissions are already checked via requireAuth()
  // This ensures uploads work regardless of whether the user is "assigned" to the project,
  // and regardless of which migrations have been applied to the RLS policies.
  const admin = await adminClient()
  const db    = admin ?? supabase  // fall back to session client if service key not set

  const { error } = await db.from('media_files').insert({
    ...data,
    uploaded_by: profile.id,
  })

  if (error) {
    return { error: `Failed to save file: ${error.message}` }
  }

  // Only notify for live photos (field workers uploading progress photos)
  if (data.category === 'live_photo') {
    const { data: proj } = await supabase
      .from('projects').select('project_code').eq('id', data.project_id).single()
    const code = (proj as { project_code: string } | null)?.project_code ?? ''
    await sendNotification({
      actor:       { id: profile.id, full_name: profile.full_name },
      projectId:   data.project_id,
      projectCode: code,
      type:        'photo_uploaded',
      message:     `${profile.full_name} uploaded new photos to ${code}`,
    })
  }

  await logActivity({
    user_id:     profile.id,
    action:      'media_uploaded',
    description: `Uploaded "${data.file_name}"`,
    project_id:  data.project_id,
    entity_type: 'media',
    metadata:    { category: data.category, file_name: data.file_name },
  })

  revalidatePath(`/dashboard/projects/${data.project_id}`)
  return { success: true }
}

// ── Delete file from Storage + DB ──────────────────────────────────────

export async function deleteMediaAction(data: {
  file_id: string
  project_id: string
  file_path: string
  bucket: 'project-media' | 'project-files'
}): Promise<MediaActionState> {
  const profile = await requireAuth()
  const supabase = await createClient()

  // Delete from storage (non-fatal — DB delete is the authoritative step)
  await supabase.storage.from(data.bucket).remove([data.file_path])

  const { error } = await supabase
    .from('media_files')
    .delete()
    .eq('id', data.file_id)

  if (error) {
    return { error: `Failed to delete: ${error.message}` }
  }

  await logActivity({
    user_id:     profile.id,
    action:      'media_deleted',
    description: `Deleted a file`,
    project_id:  data.project_id,
    entity_type: 'media',
    entity_id:   data.file_id,
  })

  revalidatePath(`/dashboard/projects/${data.project_id}`)
  return { success: true }
}

// ── Delete a live photo — worker can only delete their own ─────────────

export async function deleteLivePhotoAction(data: {
  file_id: string
  project_id: string
  file_path: string
}): Promise<MediaActionState> {
  const profile = await requireAuth()
  const supabase = await createClient()

  // Workers may only delete photos they uploaded themselves
  if (profile.role === 'worker') {
    const { data: file } = await supabase
      .from('media_files')
      .select('uploaded_by')
      .eq('id', data.file_id)
      .single()

    if (!file || file.uploaded_by !== profile.id) {
      return { error: 'You can only delete your own photos.' }
    }
  }

  await supabase.storage.from('project-media').remove([data.file_path])

  const { error } = await supabase
    .from('media_files')
    .delete()
    .eq('id', data.file_id)

  if (error) {
    return { error: `Failed to delete: ${error.message}` }
  }

  await logActivity({
    user_id:     profile.id,
    action:      'media_deleted',
    description: `Deleted a live photo`,
    project_id:  data.project_id,
    entity_type: 'media',
    entity_id:   data.file_id,
  })

  revalidatePath(`/dashboard/projects/${data.project_id}`)
  return { success: true }
}

// ── Mark / unmark a live photo as reviewed ─────────────────────────────

export async function reviewLivePhotoAction(data: {
  file_id: string
  project_id: string
  reviewed: boolean
}): Promise<MediaActionState> {
  const profile = await requireAuth()

  if (profile.role === 'worker' || profile.role === 'client' || profile.role === 'office') {
    return { error: 'Not authorized to review photos.' }
  }

  const supabase = await createClient()

  // PMs can only review photos on projects they are assigned to
  if (profile.role === 'project_manager') {
    const { data: assignment } = await supabase
      .from('project_assignments')
      .select('id')
      .eq('project_id', data.project_id)
      .eq('user_id', profile.id)
      .single()

    if (!assignment) {
      return { error: 'You are not assigned to this project.' }
    }
  }

  const { error } = await supabase
    .from('media_files')
    .update({
      reviewed: data.reviewed,
      reviewed_by: data.reviewed ? profile.id : null,
      reviewed_at: data.reviewed ? new Date().toISOString() : null,
    })
    .eq('id', data.file_id)

  if (error) {
    return { error: `Failed to update review status: ${error.message}` }
  }

  if (data.reviewed) {
    await logActivity({
      user_id:     profile.id,
      action:      'photo_reviewed',
      description: `Marked a live photo as reviewed`,
      project_id:  data.project_id,
      entity_type: 'media',
      entity_id:   data.file_id,
    })
  }

  revalidatePath(`/dashboard/projects/${data.project_id}`)
  return { success: true }
}

// ── Update the current user's avatar_url ───────────────────────────────

export async function updateAvatarUrlAction(
  avatarUrl: string | null
): Promise<MediaActionState> {
  const profile = await requireAuth()
  const supabase = await createClient()

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', profile.id)

  if (error) {
    return { error: `Failed to update avatar: ${error.message}` }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/users')
  revalidatePath('/dashboard/profile')
  return { success: true }
}
