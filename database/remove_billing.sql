-- Migration script to remove billing functionality
-- Run this script to clean up existing databases

-- First, update the session_status enum to remove 'billed'
-- Note: This requires careful handling in PostgreSQL

-- Step 1: Add new enum without 'billed'
CREATE TYPE session_status_new AS ENUM ('draft', 'completed', 'archived');

-- Step 2: Update any sessions with 'billed' status to 'completed'
UPDATE session_notes SET status = 'completed' WHERE status = 'billed';

-- Step 3: Alter table to use new enum
ALTER TABLE session_notes 
  ALTER COLUMN status TYPE session_status_new 
  USING status::text::session_status_new;

-- Step 4: Drop old enum and rename new one
DROP TYPE session_status;
ALTER TYPE session_status_new RENAME TO session_status;

-- Step 5: Remove billing columns from session_notes table
ALTER TABLE session_notes DROP COLUMN IF EXISTS billing_code;
ALTER TABLE session_notes DROP COLUMN IF EXISTS billing_amount;
ALTER TABLE session_notes DROP COLUMN IF EXISTS billed_at;

-- Step 6: Drop the billing index if it exists
DROP INDEX IF EXISTS idx_session_notes_billing;

-- Step 7: Update any existing templates that might reference billing
-- (This is just for safety, templates shouldn't have billing references)

-- Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'session_notes' 
ORDER BY ordinal_position;

-- Show the updated enum values
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'session_status')
ORDER BY enumsortorder;

-- Update any existing sessions that might have had billing status
UPDATE session_notes 
SET status = 'completed', updated_at = CURRENT_TIMESTAMP 
WHERE status::text = 'billed';

COMMENT ON TABLE session_notes IS 'Generated session notes for documentation and compliance (billing functionality removed)';
