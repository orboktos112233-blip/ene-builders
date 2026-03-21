-- ============================================================
-- ENE Builders – Messaging System Fixes (020)
-- ============================================================
-- Comprehensive, idempotent fix for all messaging issues.
-- Safe to run even if migrations 017-019 were already applied.
-- ============================================================


-- ── 1. Ensure project_chat_messages has all needed columns ─────

-- Attachment columns (from migration 018)
ALTER TABLE project_chat_messages
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_type text,
  ADD COLUMN IF NOT EXISTS attachment_size bigint;

-- Make sender_id nullable for system messages (from migration 019)
ALTER TABLE project_chat_messages
  ALTER COLUMN sender_id DROP NOT NULL;

-- message_type and system_event (from migration 019)
ALTER TABLE project_chat_messages
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS system_event text;

-- Add CHECK constraint for message_type if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_chat_messages_message_type_check'
      AND conrelid = 'project_chat_messages'::regclass
  ) THEN
    ALTER TABLE project_chat_messages
      ADD CONSTRAINT project_chat_messages_message_type_check
      CHECK (message_type IN ('user', 'system'));
  END IF;
END $$;


-- ── 2. Fix body CHECK constraint ───────────────────────────────
-- Original constraint forbids empty body, but attachment-only
-- messages send body=''. New constraint allows empty body when
-- attachment_path is present.

ALTER TABLE project_chat_messages
  DROP CONSTRAINT IF EXISTS project_chat_messages_body_check;

ALTER TABLE project_chat_messages
  ADD CONSTRAINT project_chat_messages_body_check
  CHECK (char_length(trim(body)) > 0 OR attachment_path IS NOT NULL);


-- ── 3. Fix messages body constraint (DM attachments) ───────────

ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_body_check;

-- Add attachment columns to direct messages
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_type text,
  ADD COLUMN IF NOT EXISTS attachment_size bigint;

-- Allow empty body when attachment is present
ALTER TABLE messages
  ADD CONSTRAINT messages_body_check
  CHECK (char_length(trim(body)) > 0 OR attachment_path IS NOT NULL);


-- ── 4. conversation_participants INSERT policy ─────────────────
-- Migration 016 was missing this policy. Admin client bypasses RLS
-- in practice, but add it for completeness and future safety.

DROP POLICY IF EXISTS "conversation_participants: authenticated can insert"
  ON conversation_participants;

CREATE POLICY "conversation_participants: authenticated can insert"
  ON conversation_participants FOR INSERT TO authenticated
  WITH CHECK (true);


-- ── 5. Fix notifications INSERT RLS ───────────────────────────
-- Server-side code (send.ts) inserts notifications on behalf of
-- recipients. The session client needs INSERT permission.
-- We handle security in code (admin client + explicit recipient list).

DROP POLICY IF EXISTS "notifications: authenticated can insert" ON notifications;
CREATE POLICY "notifications: authenticated can insert"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (true);


-- ── 6. Extend project-media bucket MIME types ─────────────────
-- Idempotent version of migration 019's bucket update.
-- Also adds application/octet-stream as fallback.

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
  'text/plain', 'text/csv',
  -- Fallback for unknown MIME types
  'application/octet-stream'
]
WHERE id = 'project-media';


NOTIFY pgrst, 'reload schema';
