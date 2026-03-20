-- ============================================================
-- ENE Builders – Construction Phases
-- ============================================================
-- Tracks each major construction phase per project.
-- One row per (project_id, phase) — upserted on update.
-- ============================================================

CREATE TABLE IF NOT EXISTS construction_phases (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase       text        NOT NULL
              CHECK (phase IN (
                'planning','demo','framing','plumbing_electrical',
                'drywall','finishes','inspection','completed'
              )),
  status      text        NOT NULL DEFAULT 'not_started'
              CHECK (status IN ('not_started','in_progress','completed')),
  notes       text,
  updated_by  uuid        REFERENCES profiles(id),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, phase)
);

CREATE INDEX IF NOT EXISTS construction_phases_project_id_idx
  ON construction_phases (project_id);

ALTER TABLE construction_phases ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies ─────────────────────────────────────────────

-- Admin and office see all; assigned users see their project's phases.
CREATE POLICY "phases: read based on role"
  ON construction_phases FOR SELECT
  TO authenticated
  USING (
    get_my_role() IN ('admin', 'office')
    OR is_assigned_to_project(project_id)
  );

-- Admin can always insert/update.
-- PM can only update phases for projects they are assigned to.
CREATE POLICY "phases: insert based on role"
  ON construction_phases FOR INSERT
  TO authenticated
  WITH CHECK (
    get_my_role() = 'admin'
    OR (get_my_role() = 'project_manager' AND is_assigned_to_project(project_id))
  );

CREATE POLICY "phases: update based on role"
  ON construction_phases FOR UPDATE
  TO authenticated
  USING (
    get_my_role() = 'admin'
    OR (get_my_role() = 'project_manager' AND is_assigned_to_project(project_id))
  );

-- Admin only for hard deletes.
CREATE POLICY "phases: admin can delete"
  ON construction_phases FOR DELETE
  TO authenticated
  USING (get_my_role() = 'admin');
