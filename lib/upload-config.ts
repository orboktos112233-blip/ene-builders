// ── Upload limits — keep in sync with migration 015_photo_live_complete.sql ──

export const UPLOAD_BUCKET    = 'project-media'
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024   // 200 MB
export const MAX_UPLOAD_MB    = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))
