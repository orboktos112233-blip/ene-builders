-- Activity logs: a lightweight audit trail for key user actions.
-- Each action is appended; rows are never updated or hard-deleted.

CREATE TYPE activity_action AS ENUM (
  'project_created',
  'project_updated',
  'project_deleted',
  'status_changed',
  'phase_updated',
  'media_uploaded',
  'media_deleted',
  'photo_reviewed',
  'member_added',
  'member_removed',
  'import_completed'
);

CREATE TABLE activity_logs (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid         REFERENCES projects(id) ON DELETE SET NULL,
  user_id     uuid         REFERENCES profiles(id) ON DELETE SET NULL,
  action      activity_action NOT NULL,
  entity_type text,
  entity_id   text,
  description text         NOT NULL,
  metadata    jsonb,
  created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX activity_logs_project_idx    ON activity_logs(project_id);
CREATE INDEX activity_logs_user_idx       ON activity_logs(user_id);
CREATE INDEX activity_logs_created_at_idx ON activity_logs(created_at DESC);

-- Row-level security
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Admins and office see everything; others see only their own entries
CREATE POLICY "activity_logs_select" ON activity_logs
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'office')
    OR user_id = auth.uid()
  );

-- Any authenticated user may append (server actions write logs)
CREATE POLICY "activity_logs_insert" ON activity_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

NOTIFY pgrst, 'reload schema';
