-- ============================================================
-- ENE Builders – Fix project status CHECK constraint + UPDATE RLS
-- ============================================================
-- Problem 1: The original projects table was created with:
--   CHECK (status IN ('planning','demolition','framing','finishing','completed'))
-- The app now uses: planning, in_progress, finishing, inspection, completed
-- Sending 'in_progress' or 'inspection' violates the old constraint → update fails.
--
-- Problem 2: The UPDATE RLS policy only allows admin and project_manager.
-- The office role can reach the server action but Supabase RLS then blocks it.
-- ============================================================

-- ── 1. Fix the status CHECK constraint ────────────────────────

-- Drop the old inline CHECK constraint (auto-named by Postgres).
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;

-- Add the correct constraint matching the application's status enum.
ALTER TABLE projects
  ADD CONSTRAINT projects_status_check
  CHECK (status IN ('planning', 'in_progress', 'finishing', 'inspection', 'completed'));

-- Migrate any rows that still have the old status values
-- (safe to run even if no such rows exist).
UPDATE projects SET status = 'in_progress' WHERE status = 'demolition';
UPDATE projects SET status = 'in_progress' WHERE status = 'framing';


-- ── 2. Fix the UPDATE RLS policy to include office role ────────

DROP POLICY IF EXISTS "projects: update based on role" ON projects;

CREATE POLICY "projects: update based on role"
  ON projects FOR UPDATE
  TO authenticated
  USING (
    get_my_role() IN ('admin', 'office')
    OR (get_my_role() = 'project_manager' AND is_assigned_to_project(id))
  );
