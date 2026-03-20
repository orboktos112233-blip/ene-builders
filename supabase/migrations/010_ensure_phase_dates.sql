-- ============================================================
-- ENE Builders – Ensure phase date columns exist (010)
-- ============================================================
-- Idempotent: safe to run even if 009 already ran.
-- Also signals PostgREST to reload its schema cache so the
-- new columns are immediately visible to the API.
-- ============================================================

ALTER TABLE construction_phases
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date;

-- Reload PostgREST schema cache so the columns are
-- immediately available without restarting the project.
NOTIFY pgrst, 'reload schema';
