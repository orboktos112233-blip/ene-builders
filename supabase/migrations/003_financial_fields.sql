-- ============================================================
-- ENE Builders – Phase 2.1: Financial fields on project_items
-- ============================================================
-- Adds unit_price and total_price to project_items.
-- notes already exists from 002_sections_and_items.sql.
-- Run after 002_sections_and_items.sql
-- ============================================================

ALTER TABLE project_items
  ADD COLUMN IF NOT EXISTS unit_price  numeric(12,2),
  ADD COLUMN IF NOT EXISTS total_price numeric(12,2);

COMMENT ON COLUMN project_items.unit_price  IS 'Price per unit in USD';
COMMENT ON COLUMN project_items.total_price IS 'Line total in USD. Stored from Excel or calculated as quantity * unit_price.';
