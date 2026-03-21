-- ============================================================
-- ENE Builders – Project Chat Pro (019)
-- ============================================================
-- 1. Make sender_id nullable (system messages have no sender)
-- 2. Add message_type and system_event columns
-- 3. Extend project-media bucket to accept document MIME types
-- ============================================================


-- ── 1. Make sender_id nullable for system messages ─────────────

ALTER TABLE project_chat_messages
  ALTER COLUMN sender_id DROP NOT NULL;


-- ── 2. New columns ─────────────────────────────────────────────

ALTER TABLE project_chat_messages
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'user'
    CHECK (message_type IN ('user', 'system')),
  ADD COLUMN IF NOT EXISTS system_event text;


-- ── 3. Extend bucket to accept document MIME types ─────────────
-- Add PDF, Word, and Excel MIME types so chat file uploads work.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  -- Images
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'image/gif',  'image/heic', 'image/heif',
  -- Videos
  'video/mp4',  'video/quicktime', 'video/webm',
  'video/mpeg', 'video/3gpp',      'video/x-msvideo',
  -- Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv'
]
WHERE id = 'project-media';


NOTIFY pgrst, 'reload schema';
