-- ============================================================
-- ENE Builders – Photo Live complete setup (015)
-- ============================================================
-- Idempotent: safe to run even if 006, 011, 012 were already
-- applied. Covers everything Photo Live needs:
--   1. project-media storage bucket (200 MB, correct MIME types)
--   2. live_photo category CHECK constraint
--   3. reviewed / reviewed_by / reviewed_at columns
--   4. Storage RLS policies
--   5. media_files RLS policies
-- ============================================================


-- ── 1. project-media bucket ───────────────────────────────────
-- Insert-or-update so existing buckets get the correct settings.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-media',
  'project-media',
  true,
  209715200,  -- 200 MB
  ARRAY[
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    'image/gif',  'image/heic', 'image/heif',
    'video/mp4',  'video/quicktime', 'video/webm',
    'video/mpeg', 'video/3gpp',      'video/x-msvideo'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public             = true,
  file_size_limit    = 209715200,
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    'image/gif',  'image/heic', 'image/heif',
    'video/mp4',  'video/quicktime', 'video/webm',
    'video/mpeg', 'video/3gpp',      'video/x-msvideo'
  ];


-- ── 2. live_photo category constraint ────────────────────────

ALTER TABLE media_files
  DROP CONSTRAINT IF EXISTS media_files_category_check;

ALTER TABLE media_files
  ADD CONSTRAINT media_files_category_check
  CHECK (category IN (
    'before', 'progress', 'after', 'final_result',
    'contract', 'invoice', 'budget', 'plan', 'other',
    'live_photo'
  ));


-- ── 3. Review tracking columns ────────────────────────────────

ALTER TABLE media_files
  ADD COLUMN IF NOT EXISTS reviewed    boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid        REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;


-- ── 4. Storage RLS – project-media ───────────────────────────

DROP POLICY IF EXISTS "project-media: authenticated can read"  ON storage.objects;
DROP POLICY IF EXISTS "project-media: authorized can upload"   ON storage.objects;
DROP POLICY IF EXISTS "project-media: authorized can delete"   ON storage.objects;

CREATE POLICY "project-media: authenticated can read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'project-media');

-- Uploads via signed URL bypass this policy, but keep it for
-- any direct uploads that may happen in the future.
CREATE POLICY "project-media: authorized can upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-media'
    AND get_my_role() IN ('admin', 'office', 'project_manager', 'worker')
  );

CREATE POLICY "project-media: authorized can delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'project-media'
    AND get_my_role() IN ('admin', 'office', 'project_manager')
  );


-- ── 5. media_files RLS – SELECT ─────────────────────────────
-- Admin and office see all files.
-- Project managers and workers only see files for projects they are
-- explicitly assigned to.
-- This policy is idempotent: DROP IF EXISTS before CREATE.

DROP POLICY IF EXISTS "media: read based on role" ON media_files;

CREATE POLICY "media: read based on role"
  ON media_files FOR SELECT
  TO authenticated
  USING (
    get_my_role() IN ('admin', 'office')
    OR is_assigned_to_project(project_id)
  );


-- ── 6. media_files RLS – INSERT ──────────────────────────────
-- Admin/office can always insert.
-- PM/worker need to be assigned to the project.
-- (Server actions use the service role key and bypass this entirely,
--  but keep the policy correct for direct DB access.)

DROP POLICY IF EXISTS "media: insert for assigned users" ON media_files;
DROP POLICY IF EXISTS "media: insert for admin and office" ON media_files;

CREATE POLICY "media: insert for assigned users"
  ON media_files FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() IN ('admin', 'office')
    OR (
      get_my_role() IN ('project_manager', 'worker')
      AND is_assigned_to_project(project_id)
    )
  );


-- ── 7. media_files RLS – DELETE ──────────────────────────────

DROP POLICY IF EXISTS "media: admin can delete"            ON media_files;
DROP POLICY IF EXISTS "media: delete by uploader or admin" ON media_files;

CREATE POLICY "media: delete by uploader or admin"
  ON media_files FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR get_my_role() IN ('admin', 'office')
  );


-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
