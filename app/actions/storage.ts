'use server'

import { requireAuth } from '@/lib/auth/session'
import { UPLOAD_BUCKET } from '@/lib/upload-config'

// ── Shared: get admin storage client ──────────────────────────
async function getAdminStorage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return null

  const { createClient } = await import('@supabase/supabase-js')
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return { admin, supabaseUrl, serviceKey }
}

type SignedUrlResult = { path?: string; token?: string; error?: string }

async function createSignedUpload(folderPath: string): Promise<SignedUrlResult> {
  const ctx = await getAdminStorage()
  if (!ctx) return { error: 'Storage is not configured. Please contact support.' }

  const { data, error } = await ctx.admin.storage
    .from(UPLOAD_BUCKET)
    .createSignedUploadUrl(folderPath)

  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('not found') || msg.includes('does not exist')) {
      return { error: 'Storage bucket not found. Please ensure the project-media bucket exists.' }
    }
    return { error: 'Failed to prepare upload. Please try again.' }
  }

  return { path: data.path, token: data.token }
}

// ── Signed upload URL for live photos ─────────────────────────
// Path: {projectId}/live/{timestamp}_{random}.{ext}

export async function getSignedUploadUrlAction(params: {
  projectId: string
  ext:       string
  mimeType:  string
}): Promise<SignedUrlResult> {
  await requireAuth()
  const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2)}`
  const path       = `${params.projectId}/live/${uniqueName}.${params.ext}`
  return createSignedUpload(path)
}

// ── Signed upload URL for project chat attachments ─────────────
// Path: {projectId}/chat/{timestamp}_{random}.{ext}

export async function getChatUploadUrlAction(params: {
  projectId: string
  ext:       string
  mimeType:  string
}): Promise<SignedUrlResult> {
  await requireAuth()
  const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2)}`
  const path       = `${params.projectId}/chat/${uniqueName}.${params.ext}`
  return createSignedUpload(path)
}

// ── Signed upload URL for direct message attachments ──────────
// Path: dm/{conversationId}/{timestamp}_{random}.{ext}

export async function getDmUploadUrlAction(params: {
  conversationId: string
  ext:            string
  mimeType:       string
}): Promise<SignedUrlResult> {
  await requireAuth()
  const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2)}`
  const path       = `dm/${params.conversationId}/${uniqueName}.${params.ext}`
  return createSignedUpload(path)
}
