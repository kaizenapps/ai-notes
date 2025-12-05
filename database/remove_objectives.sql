-- ============================================================================
-- Migration: Remove Goals/Objectives Feature
-- ============================================================================
-- This migration removes all objectives-related tables and columns
-- Session notes now rely on Treatment Plan and Peer Support Interventions
-- ============================================================================

-- First, drop the junction table (depends on other tables)
DROP TABLE IF EXISTS session_objectives CASCADE;

-- Drop the treatment_objectives table
DROP TABLE IF EXISTS treatment_objectives CASCADE;

-- Remove objectives_selected column from clients table
ALTER TABLE clients DROP COLUMN IF EXISTS objectives_selected;

-- Drop the index on objectives_selected (if it exists)
DROP INDEX IF EXISTS idx_clients_objectives_selected;

-- Remove the comment on objectives_selected (cleanup)
-- (Comment is automatically removed when column is dropped)

-- ============================================================================
-- Update comments to reflect new structure
-- ============================================================================
COMMENT ON TABLE clients IS 'Stores client information. Treatment plan is required for session note generation.';
COMMENT ON COLUMN clients.treatment_plan IS 'Treatment plan text - required for generating session notes. Peer Support Interventions are extracted from this.';

-- ============================================================================
-- Verification queries (run these to confirm migration success)
-- ============================================================================
-- SELECT table_name FROM information_schema.tables WHERE table_name IN ('treatment_objectives', 'session_objectives');
-- Should return empty result

-- SELECT column_name FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'objectives_selected';
-- Should return empty result

-- ============================================================================
-- Rollback script (if needed - save this separately)
-- ============================================================================
-- To rollback this migration, you would need to:
-- 1. Recreate the treatment_objectives table
-- 2. Recreate the session_objectives table
-- 3. Add back the objectives_selected column to clients
-- Note: Data cannot be recovered after this migration
