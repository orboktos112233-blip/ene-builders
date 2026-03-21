-- ============================================================
-- ENE Builders – Internal Messaging System (016)
-- ============================================================
-- Tables: conversations, conversation_participants, messages
-- Also adds 'new_message' to the notification_type enum.
-- ============================================================


-- ── 1. Extend notification_type enum ─────────────────────────

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_message';


-- ── 2. conversations ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversations (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Keep updated_at current whenever a message is added.
CREATE OR REPLACE FUNCTION conversations_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_bump_conversation ON messages;


-- ── 3. conversation_participants ──────────────────────────────

CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id uuid        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES profiles(id)      ON DELETE CASCADE,
  last_read_at    timestamptz,
  PRIMARY KEY (conversation_id, user_id)
);


-- ── 4. messages ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       uuid        NOT NULL REFERENCES profiles(id),
  body            text        NOT NULL CHECK (char_length(trim(body)) > 0),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Update conversation.updated_at whenever a message is inserted.
CREATE TRIGGER messages_bump_conversation
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION conversations_set_updated_at();

-- Performance indexes
CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS conversation_participants_user_id_idx ON conversation_participants(user_id);


-- ── 5. RLS ───────────────────────────────────────────────────

ALTER TABLE conversations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages                  ENABLE ROW LEVEL SECURITY;

-- Conversations: readable by participants
DROP POLICY IF EXISTS "conversations: participants can read" ON conversations;
CREATE POLICY "conversations: participants can read"
  ON conversations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = id AND cp.user_id = auth.uid()
    )
  );

-- Conversations: any authenticated user can create (admin client does it in practice)
DROP POLICY IF EXISTS "conversations: authenticated can create" ON conversations;
CREATE POLICY "conversations: authenticated can create"
  ON conversations FOR INSERT TO authenticated
  WITH CHECK (true);

-- Participants: readable if you are in the conversation
DROP POLICY IF EXISTS "conversation_participants: participants can read" ON conversation_participants;
CREATE POLICY "conversation_participants: participants can read"
  ON conversation_participants FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid()
    )
  );

-- Participants: users can update their own last_read_at
DROP POLICY IF EXISTS "conversation_participants: users can update own" ON conversation_participants;
CREATE POLICY "conversation_participants: users can update own"
  ON conversation_participants FOR UPDATE TO authenticated
  USING   (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Messages: readable by participants
DROP POLICY IF EXISTS "messages: participants can read" ON messages;
CREATE POLICY "messages: participants can read"
  ON messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()
    )
  );

-- Messages: participants can send (sender must be current user)
DROP POLICY IF EXISTS "messages: participants can send" ON messages;
CREATE POLICY "messages: participants can send"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()
    )
  );


NOTIFY pgrst, 'reload schema';
