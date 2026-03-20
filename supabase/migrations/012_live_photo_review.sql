-- ============================================================
-- ENE Builders – Live photo review tracking (012)
-- ============================================================
-- Adds reviewed / reviewed_by / reviewed_at to media_files.
-- Safe to run: IF NOT EXISTS guards prevent duplicates.
-- ============================================================

ALTER TABLE media_files
  ADD COLUMN IF NOT EXISTS reviewed      boolean   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reviewed_by   uuid      REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS reviewed_at   timestamptz;

-- Reload PostgREST schema cache.
NOTIFY pgrst, 'reload schema';
