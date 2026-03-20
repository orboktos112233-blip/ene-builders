'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/session'
import type { MediaCategory } from '@/types/database'

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

  const { error } = await supabase.from('media_files').insert({
    ...data,
    uploaded_by: profile.id,
  })

  if (error) {
    return { error: `Failed to save file: ${error.message}` }
  }

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
  await requireAuth()
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
