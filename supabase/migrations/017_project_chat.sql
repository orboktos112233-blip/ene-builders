-- ============================================================
-- ENE Builders – Project Chat (017)
-- ============================================================
-- Tables: project_chat_messages, project_chat_reads
-- Also adds 'project_chat' to the notification_type enum.
-- ============================================================


-- ── 1. Extend notification_type enum ──────────────────────────

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'project_chat';


-- ── 2. project_chat_messages ───────────────────────────────────

CREATE TABLE IF NOT EXISTS project_chat_messages (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sender_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body       text        NOT NULL CHECK (char_length(trim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_chat_messages_project_id_idx
  ON project_chat_messages(project_id, created_at);


-- ── 3. project_chat_reads (unread tracking) ────────────────────
-- One row per (project, user). Updated whenever the user opens the chat.

CREATE TABLE IF NOT EXISTS project_chat_reads (
  project_id   uuid        NOT NULL REFERENCES projects(id)  ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);


-- ── 4. RLS ────────────────────────────────────────────────────

ALTER TABLE project_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_chat_reads    ENABLE ROW LEVEL SECURITY;

-- project_chat_messages: admin can always read; assigned users can read their project's chat
DROP POLICY IF EXISTS "chat_messages: admin can read all" ON project_chat_messages;
CREATE POLICY "chat_messages: admin can read all"
  ON project_chat_messages FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "chat_messages: assigned users can read" ON project_chat_messages;
CREATE POLICY "chat_messages: assigned users can read"
  ON project_chat_messages FOR SELECT TO authenticated
  USING (is_assigned_to_project(project_id));

-- project_chat_messages: admin can send; assigned users can send (must be sender)
DROP POLICY IF EXISTS "chat_messages: admin can send" ON project_chat_messages;
CREATE POLICY "chat_messages: admin can send"
  ON project_chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'admin'
    AND sender_id = auth.uid()
  );

DROP POLICY IF EXISTS "chat_messages: assigned users can send" ON project_chat_messages;
CREATE POLICY "chat_messages: assigned users can send"
  ON project_chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND is_assigned_to_project(project_id)
  );

-- project_chat_reads: users manage their own read state
DROP POLICY IF EXISTS "chat_reads: users can read own" ON project_chat_reads;
CREATE POLICY "chat_reads: users can read own"
  ON project_chat_reads FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "chat_reads: users can upsert own" ON project_chat_reads;
CREATE POLICY "chat_reads: users can upsert own"
  ON project_chat_reads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "chat_reads: users can update own" ON project_chat_reads;
CREATE POLICY "chat_reads: users can update own"
  ON project_chat_reads FOR UPDATE TO authenticated
  USING   (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


NOTIFY pgrst, 'reload schema';
