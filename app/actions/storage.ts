'use server'

import { requireAuth } from '@/lib/auth/session'
import { UPLOAD_BUCKET } from '@/lib/upload-config'

// ── Get a pre-signed upload URL ────────────────────────────────────────
// Uses the service role so it works for all authenticated users regardless
// of their project assignment. The bucket is NOT created here — it must
// exist via migration 015_photo_live_complete.sql.
//
export async function getSignedUploadUrlAction(params: {
  projectId: string
  ext:       string
  mimeType:  string
}): Promise<{ path?: string; token?: string; error?: string }> {
  await requireAuth()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return { error: 'Storage is not configured. Please contact support.' }
  }

  const { createClient } = await import('@supabase/supabase-js')
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Clean file path: {projectId}/live/{timestamp}_{random}.{ext}
  const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2)}`
  const path       = `${params.projectId}/live/${uniqueName}.${params.ext}`

  const { data, error } = await admin.storage
    .from(UPLOAD_BUCKET)
    .createSignedUploadUrl(path)

  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('not found') || msg.includes('does not exist')) {
      return { error: 'Storage bucket not found. Please run migration 015 in Supabase and try again.' }
    }
    return { error: 'Failed to prepare upload. Please try again.' }
  }

  return { path: data.path, token: data.token }
}
