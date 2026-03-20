-- In-app notification system.
-- One row per recipient per event — simple fan-out model.

CREATE TYPE notification_type AS ENUM (
  'photo_uploaded',
  'status_changed',
  'phase_updated',
  'item_added',
  'budget_updated'
);

CREATE TABLE notifications (
  id          uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid             NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id  uuid             REFERENCES projects(id) ON DELETE CASCADE,
  type        notification_type NOT NULL,
  message     text             NOT NULL,
  is_read     boolean          NOT NULL DEFAULT false,
  created_at  timestamptz      NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_id_idx   ON notifications(user_id);
CREATE INDEX notifications_is_read_idx   ON notifications(user_id, is_read) WHERE NOT is_read;
CREATE INDEX notifications_created_at_idx ON notifications(created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only read their own notifications
CREATE POLICY "notifications_select" ON notifications
  FOR SELECT USING (user_id = auth.uid());

-- Any authenticated user can insert (server actions fan-out to recipients)
CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Users can only update (mark read) their own notifications
CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
