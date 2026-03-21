-- ============================================================
-- ENE Builders – Fixes (018)
-- ============================================================
-- 1. Add UPDATE policy to media_files so review action works
-- 2. Add attachment columns to project_chat_messages
-- ============================================================


-- ── 1. media_files UPDATE policy ──────────────────────────────
-- Allows admin and PM (assigned to project) to mark photos reviewed.

DROP POLICY IF EXISTS "media: admin and pm can update" ON media_files;

CREATE POLICY "media: admin and pm can update"
  ON media_files FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'admin'
    OR (
      get_my_role() = 'project_manager'
      AND is_assigned_to_project(project_id)
    )
  )
  WITH CHECK (
    get_my_role() = 'admin'
    OR (
      get_my_role() = 'project_manager'
      AND is_assigned_to_project(project_id)
    )
  );


-- ── 2. Chat attachment columns ─────────────────────────────────
-- Nullable — only present when a message includes a file.

ALTER TABLE project_chat_messages
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_type text,
  ADD COLUMN IF NOT EXISTS attachment_size bigint;


NOTIFY pgrst, 'reload schema';
