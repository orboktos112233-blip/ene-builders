-- ============================================================
-- ENE Builders – Update Construction Phases (008)
-- ============================================================
-- Replaces the 8-phase list with the full 19-phase list.
-- Safely migrates any existing rows where possible.
-- ============================================================

-- Step 1: Drop old CHECK constraint on phase column
ALTER TABLE construction_phases
  DROP CONSTRAINT IF EXISTS construction_phases_phase_check;

-- Step 2: Migrate old phase values to their nearest new equivalent
--   demo     → demo     (same)
--   framing  → framing  (same)
--   drywall  → dry_wall (renamed)
--   planning, plumbing_electrical, finishes, inspection, completed
--     → no clean mapping, remove these rows so the new constraint can be applied
UPDATE construction_phases SET phase = 'dry_wall' WHERE phase = 'drywall';
DELETE FROM construction_phases
  WHERE phase IN ('planning', 'plumbing_electrical', 'finishes', 'inspection', 'completed');

-- Step 3: Add new CHECK constraint with the full 19-phase list
ALTER TABLE construction_phases
  ADD CONSTRAINT construction_phases_phase_check
  CHECK (phase IN (
    'progress',
    'demo',
    'foundation',
    'underground_plumbing',
    'framing',
    'plumbing',
    'electric',
    'windows',
    'black_paper',
    'ac',
    'insulation',
    'dry_wall',
    'tapping',
    'paint',
    'floor',
    'hot_mop',
    'tile',
    'kitchen_installation',
    'finish_materials_install'
  ));

-- Step 4: Also update the RLS SELECT policy to allow project-level read
--   (re-drop and recreate in case it didn't apply correctly)
DROP POLICY IF EXISTS "phases: read based on role" ON construction_phases;
CREATE POLICY "phases: read based on role"
  ON construction_phases FOR SELECT
  TO authenticated
  USING (
    get_my_role() IN ('admin', 'office', 'project_manager', 'worker', 'client')
    OR is_assigned_to_project(project_id)
  );
