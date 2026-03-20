-- ============================================================
-- ENE Builders – Storage Buckets, Storage RLS, Media RLS fixes
-- ============================================================
-- Run this in the Supabase SQL editor.
-- ============================================================


-- ── 1. Create storage buckets ────────────────────────────────

-- Avatars: public bucket, images only, 2 MB max
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 'avatars', true, 2097152,
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Project media: public bucket for photos/videos, 50 MB max
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-media', 'project-media', true, 52428800,
  ARRAY['image/jpeg','image/png','image/webp','image/gif',
        'video/mp4','video/quicktime','video/webm','video/mpeg']
)
ON CONFLICT (id) DO NOTHING;

-- Project files: public bucket for documents, 50 MB max
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'project-files', 'project-files', true, 52428800
)
ON CONFLICT (id) DO NOTHING;


-- ── 2. Storage policies: avatars ─────────────────────────────

DROP POLICY IF EXISTS "avatars: authenticated can read"    ON storage.objects;
DROP POLICY IF EXISTS "avatars: users can upload own"      ON storage.objects;
DROP POLICY IF EXISTS "avatars: users can update own"      ON storage.objects;
DROP POLICY IF EXISTS "avatars: users can delete own"      ON storage.objects;

-- Anyone authenticated can view avatars (shown throughout the app)
CREATE POLICY "avatars: authenticated can read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

-- Users upload/replace their own avatar only (path = {user_id}/...)
CREATE POLICY "avatars: users can upload own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars: users can update own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars: users can delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ── 3. Storage policies: project-media ───────────────────────

DROP POLICY IF EXISTS "project-media: authenticated can read"   ON storage.objects;
DROP POLICY IF EXISTS "project-media: authorized can upload"    ON storage.objects;
DROP POLICY IF EXISTS "project-media: authorized can delete"    ON storage.objects;

CREATE POLICY "project-media: authenticated can read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'project-media');

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


-- ── 4. Storage policies: project-files ───────────────────────

DROP POLICY IF EXISTS "project-files: authenticated can read"   ON storage.objects;
DROP POLICY IF EXISTS "project-files: authorized can upload"    ON storage.objects;
DROP POLICY IF EXISTS "project-files: authorized can delete"    ON storage.objects;

CREATE POLICY "project-files: authenticated can read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'project-files');

CREATE POLICY "project-files: authorized can upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-files'
    AND get_my_role() IN ('admin', 'office', 'project_manager', 'worker')
  );

CREATE POLICY "project-files: authorized can delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'project-files'
    AND get_my_role() IN ('admin', 'office', 'project_manager')
  );


-- ── 5. Fix media_files INSERT policy ─────────────────────────
-- Admin and office can always insert; PM/worker need assignment.

DROP POLICY IF EXISTS "media: insert for assigned users" ON media_files;

CREATE POLICY "media: insert for assigned users"
  ON media_files FOR INSERT
  TO authenticated
  WITH CHECK (
    get_my_role() IN ('admin', 'office')
    OR (
      get_my_role() IN ('project_manager', 'worker')
      AND is_assigned_to_project(project_id)
    )
  );


-- ── 6. Fix media_files DELETE policy ─────────────────────────
-- Uploader can delete their own file; admin/office can delete any.

DROP POLICY IF EXISTS "media: admin can delete" ON media_files;

CREATE POLICY "media: delete by uploader or admin"
  ON media_files FOR DELETE
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR get_my_role() IN ('admin', 'office')
  );
