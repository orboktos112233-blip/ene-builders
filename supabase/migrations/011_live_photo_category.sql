-- ============================================================
-- ENE Builders – Add live_photo media category (011)
-- ============================================================
-- Extends the media_files category CHECK constraint to include
-- 'live_photo' for the dedicated Photo Live tab.
-- ============================================================

-- Drop old constraint and recreate with live_photo included.
ALTER TABLE media_files
  DROP CONSTRAINT IF EXISTS media_files_category_check;

ALTER TABLE media_files
  ADD CONSTRAINT media_files_category_check
  CHECK (category IN (
    'before', 'progress', 'after', 'final_result',
    'contract', 'invoice', 'budget', 'plan', 'other',
    'live_photo'
  ));
