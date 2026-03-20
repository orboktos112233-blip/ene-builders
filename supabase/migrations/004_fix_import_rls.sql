-- ============================================================
-- ENE Builders – Fix import RLS policies
-- ============================================================
-- Problem: office role can trigger importProjectAction but was
-- blocked from inserting project_sections and project_items.
-- Also allow PM to insert sections/items on their own projects
-- without requiring prior assignment (needed during import).
-- ============================================================

-- ── project_sections: fix INSERT policy ───────────────────────

DROP POLICY IF EXISTS "sections: insert for admin and pm" ON project_sections;

CREATE POLICY "sections: insert for admin, office, pm"
  ON project_sections FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() IN ('admin', 'office')
    OR (get_my_role() = 'project_manager' AND is_assigned_to_project(project_id))
  );


-- ── project_items: fix INSERT policy ─────────────────────────

DROP POLICY IF EXISTS "items: insert for admin and pm" ON project_items;

CREATE POLICY "items: insert for admin, office, pm"
  ON project_items FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() IN ('admin', 'office')
    OR (get_my_role() = 'project_manager' AND is_assigned_to_project(project_id))
  );
