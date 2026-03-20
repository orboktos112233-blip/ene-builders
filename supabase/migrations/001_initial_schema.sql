-- ============================================================
-- ENE Builders – Phase 1 Initial Schema
-- ============================================================
-- Run this migration in the Supabase SQL editor.
-- Tables: profiles, projects, project_assignments, media_files, import_logs
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- PROFILES
-- Extends auth.users with role and display info.
-- Created automatically via trigger on user creation.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text        NOT NULL,
  role        text        NOT NULL DEFAULT 'worker'
                          CHECK (role IN ('admin','office','project_manager','worker','client')),
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Auto-create a profile row when a new auth user is created.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'worker')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ─────────────────────────────────────────────────────────────
-- PROJECTS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS projects (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code        text        NOT NULL UNIQUE,
  name                text        NOT NULL,
  address             text,
  status              text        NOT NULL DEFAULT 'planning'
                                  CHECK (status IN ('planning','demolition','framing','finishing','completed')),
  start_date          date,
  estimated_end_date  date,
  actual_end_date     date,
  budget_total        numeric(12,2),
  -- Minimal client info (dedicated clients table comes in a later phase)
  client_name         text,
  client_email        text,
  client_phone        text,
  created_by          uuid        NOT NULL REFERENCES profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Keep updated_at current on every row update.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_set_updated_at ON projects;
CREATE TRIGGER projects_set_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Sequence for generating project_code: ENE-{YEAR}-{NNN}
-- Used by the application layer (see lib/projects/code.ts).
CREATE SEQUENCE IF NOT EXISTS project_code_seq;


-- ─────────────────────────────────────────────────────────────
-- PROJECT ASSIGNMENTS
-- Controls per-project visibility for workers and clients.
-- Admins and office staff bypass this via RLS.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_assignments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assignment_role text        NOT NULL
                              CHECK (assignment_role IN ('project_manager','worker','client','office_viewer')),
  assigned_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);


-- ─────────────────────────────────────────────────────────────
-- MEDIA FILES
-- Schema foundation only. Upload UI comes in a later phase.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS media_files (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  uploaded_by  uuid        NOT NULL REFERENCES profiles(id),
  file_path    text        NOT NULL,  -- Supabase Storage key: {project_code}/{category}/{uuid}.ext
  file_name    text        NOT NULL,  -- Original filename for display
  file_type    text        NOT NULL,  -- MIME type: image/jpeg, application/pdf, etc.
  file_size    bigint,                -- Bytes; useful for storage auditing
  category     text        NOT NULL
               CHECK (category IN (
                 'before','progress','after','final_result',
                 'contract','invoice','budget','plan','other'
               )),
  description  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);


-- ─────────────────────────────────────────────────────────────
-- IMPORT LOGS
-- Schema foundation only. Import UI comes in a later phase.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS import_logs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by       uuid        NOT NULL REFERENCES profiles(id),
  source_file_name  text        NOT NULL,
  source_file_path  text,        -- Supabase Storage path if file is retained
  import_type       text        NOT NULL
                                CHECK (import_type IN ('projects','budgets','financials','clients')),
  total_rows        integer     NOT NULL DEFAULT 0,
  successful_rows   integer     NOT NULL DEFAULT 0,
  failed_rows       integer     NOT NULL DEFAULT 0,
  status            text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','processing','completed','failed')),
  errors_json       jsonb,      -- Array of {row, field, message} for failed rows
  created_at        timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- Default deny on all tables. Every access must match a policy.
-- ============================================================

ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects           ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_files        ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_logs        ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────
-- HELPER FUNCTION
-- Reused by all table policies that gate access per project.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_assigned_to_project(p_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_assignments
    WHERE project_id = p_id
      AND user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;


-- ─────────────────────────────────────────────────────────────
-- PROFILES POLICIES
-- ─────────────────────────────────────────────────────────────

-- Any authenticated user can read profiles (needed for display names throughout the app).
CREATE POLICY "profiles: authenticated users can read"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- Users can update their own profile (name, avatar).
CREATE POLICY "profiles: user can update own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admin can update any profile (role changes).
CREATE POLICY "profiles: admin can update any"
  ON profiles FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'admin');

-- Admin can delete profiles.
CREATE POLICY "profiles: admin can delete"
  ON profiles FOR DELETE
  TO authenticated
  USING (get_my_role() = 'admin');


-- ─────────────────────────────────────────────────────────────
-- PROJECTS POLICIES
-- ─────────────────────────────────────────────────────────────

-- Admin and office see all projects.
-- PM, worker, client see only projects they are assigned to.
CREATE POLICY "projects: read based on role"
  ON projects FOR SELECT
  TO authenticated
  USING (
    get_my_role() IN ('admin', 'office')
    OR is_assigned_to_project(id)
  );

-- Admin and PM can create projects.
CREATE POLICY "projects: admin and pm can insert"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'project_manager'));

-- Admin can update any project.
-- PM can only update projects they are assigned to.
CREATE POLICY "projects: update based on role"
  ON projects FOR UPDATE
  TO authenticated
  USING (
    get_my_role() = 'admin'
    OR (get_my_role() = 'project_manager' AND is_assigned_to_project(id))
  );

-- Admin only for delete.
CREATE POLICY "projects: admin can delete"
  ON projects FOR DELETE
  TO authenticated
  USING (get_my_role() = 'admin');


-- ─────────────────────────────────────────────────────────────
-- PROJECT ASSIGNMENTS POLICIES
-- ─────────────────────────────────────────────────────────────

-- Admin and office see all assignments.
-- Others see only their own assignment rows.
CREATE POLICY "assignments: read based on role"
  ON project_assignments FOR SELECT
  TO authenticated
  USING (
    get_my_role() IN ('admin', 'office')
    OR user_id = auth.uid()
  );

-- Admin only can create or remove assignments.
CREATE POLICY "assignments: admin can insert"
  ON project_assignments FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "assignments: admin can delete"
  ON project_assignments FOR DELETE
  TO authenticated
  USING (get_my_role() = 'admin');


-- ─────────────────────────────────────────────────────────────
-- MEDIA FILES POLICIES
-- ─────────────────────────────────────────────────────────────

-- Admin and office see all. Assigned users see their project's files.
CREATE POLICY "media: read based on role"
  ON media_files FOR SELECT
  TO authenticated
  USING (
    get_my_role() IN ('admin', 'office')
    OR is_assigned_to_project(project_id)
  );

-- Admin, PM, worker can upload — only on assigned projects.
CREATE POLICY "media: insert for assigned users"
  ON media_files FOR INSERT
  TO authenticated
  WITH CHECK (
    get_my_role() IN ('admin', 'project_manager', 'worker')
    AND is_assigned_to_project(project_id)
  );

-- Uploader can update their own file's description. Admin can update any.
CREATE POLICY "media: update own or admin"
  ON media_files FOR UPDATE
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR get_my_role() = 'admin'
  );

-- Admin only.
CREATE POLICY "media: admin can delete"
  ON media_files FOR DELETE
  TO authenticated
  USING (get_my_role() = 'admin');


-- ─────────────────────────────────────────────────────────────
-- IMPORT LOGS POLICIES
-- ─────────────────────────────────────────────────────────────

-- Admin and office see all logs. Others see only their own.
CREATE POLICY "import_logs: read based on role"
  ON import_logs FOR SELECT
  TO authenticated
  USING (
    get_my_role() IN ('admin', 'office')
    OR uploaded_by = auth.uid()
  );

-- Admin and office can create import logs.
CREATE POLICY "import_logs: admin and office can insert"
  ON import_logs FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'office'));

-- Admin only.
CREATE POLICY "import_logs: admin can delete"
  ON import_logs FOR DELETE
  TO authenticated
  USING (get_my_role() = 'admin');
