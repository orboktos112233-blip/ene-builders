-- ============================================================
-- ENE Builders – Phase 2: Project Sections, Items, Import Runs
-- ============================================================
-- Run this in the Supabase SQL editor after 001_initial_schema.sql
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- PROJECT SECTIONS
-- Dynamic per project. Created via import or manually in-app.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_sections (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name           text        NOT NULL,
  display_order  integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, name)
);

DROP TRIGGER IF EXISTS project_sections_set_updated_at ON project_sections;
CREATE TRIGGER project_sections_set_updated_at
  BEFORE UPDATE ON project_sections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─────────────────────────────────────────────────────────────
-- PROJECT ITEMS
-- One row per line item. All fields free-text except quantity.
-- raw_quantity is only populated on import; null for manual rows.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_items (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  section_id     uuid        NOT NULL REFERENCES project_sections(id) ON DELETE CASCADE,
  category       text,
  worker         text,
  material       text,
  quantity       numeric(12,4),
  raw_quantity   text,        -- import audit: original cell string; null for manual entries
  unit           text,
  vendor         text,
  status         text,        -- free text; UI maps to badge color
  notes          text,
  display_order  integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS project_items_set_updated_at ON project_items;
CREATE TRIGGER project_items_set_updated_at
  BEFORE UPDATE ON project_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─────────────────────────────────────────────────────────────
-- PROJECT IMPORT RUNS
-- One record per Excel import. Audit trail only.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_import_runs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  imported_by         uuid        NOT NULL REFERENCES profiles(id),
  source_file_name    text        NOT NULL,
  source_file_path    text,
  total_rows_found    integer     NOT NULL DEFAULT 0,
  sections_created    integer     NOT NULL DEFAULT 0,
  items_created       integer     NOT NULL DEFAULT 0,
  total_rows_skipped  integer     NOT NULL DEFAULT 0,
  empty_rows_skipped  integer     NOT NULL DEFAULT 0,
  parse_warnings      jsonb,      -- [{row_number, message}]
  status              text        NOT NULL DEFAULT 'completed'
                      CHECK (status IN ('completed', 'failed_partial', 'failed')),
  created_at          timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE project_sections    ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_import_runs ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────
-- PROJECT SECTIONS POLICIES
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "sections: read based on role"
  ON project_sections FOR SELECT TO authenticated
  USING (
    get_my_role() IN ('admin', 'office')
    OR is_assigned_to_project(project_id)
  );

CREATE POLICY "sections: insert for admin and pm"
  ON project_sections FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'admin'
    OR (get_my_role() = 'project_manager' AND is_assigned_to_project(project_id))
  );

CREATE POLICY "sections: update for admin and pm"
  ON project_sections FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'admin'
    OR (get_my_role() = 'project_manager' AND is_assigned_to_project(project_id))
  );

CREATE POLICY "sections: delete admin only"
  ON project_sections FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');


-- ─────────────────────────────────────────────────────────────
-- PROJECT ITEMS POLICIES
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "items: read based on role"
  ON project_items FOR SELECT TO authenticated
  USING (
    get_my_role() IN ('admin', 'office')
    OR is_assigned_to_project(project_id)
  );

CREATE POLICY "items: insert for admin and pm"
  ON project_items FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'admin'
    OR (get_my_role() = 'project_manager' AND is_assigned_to_project(project_id))
  );

CREATE POLICY "items: update for admin, pm, office"
  ON project_items FOR UPDATE TO authenticated
  USING (
    get_my_role() IN ('admin', 'office')
    OR (get_my_role() = 'project_manager' AND is_assigned_to_project(project_id))
  );

CREATE POLICY "items: delete admin only"
  ON project_items FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');


-- ─────────────────────────────────────────────────────────────
-- PROJECT IMPORT RUNS POLICIES
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "import_runs: read based on role"
  ON project_import_runs FOR SELECT TO authenticated
  USING (
    get_my_role() IN ('admin', 'office')
    OR imported_by = auth.uid()
  );

CREATE POLICY "import_runs: insert for admin and office"
  ON project_import_runs FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'office'));

CREATE POLICY "import_runs: delete admin only"
  ON project_import_runs FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');
