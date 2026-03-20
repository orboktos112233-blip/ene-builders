-- ============================================================
-- ENE Builders – Add dates to construction_phases (009)
-- ============================================================
-- Adds start_date and end_date to each phase row.
-- Nullable — no default, no impact on existing rows.
-- ============================================================

ALTER TABLE construction_phases
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date;
