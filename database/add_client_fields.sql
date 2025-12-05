-- Migration: Add Gender, Address, Date of Birth, and Last Name fields to clients table
-- This migration relaxes HIPAA compliance to store more client information
-- Run this on existing databases to add the new columns

-- Step 1: Add new columns
ALTER TABLE clients ADD COLUMN IF NOT EXISTS gender VARCHAR(10) CHECK (gender IN ('male', 'female'));
ALTER TABLE clients ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);

-- Step 2: Migrate existing last_initial data to last_name (if last_name is empty)
UPDATE clients SET last_name = last_initial WHERE last_name IS NULL OR last_name = '';

-- Step 3: Add comments for documentation
COMMENT ON COLUMN clients.gender IS 'Client gender (male/female) - used for AI pronoun generation';
COMMENT ON COLUMN clients.address IS 'Client home address - used for location context, not displayed in session notes';
COMMENT ON COLUMN clients.date_of_birth IS 'Client date of birth';
COMMENT ON COLUMN clients.last_name IS 'Client full last name (replaces last_initial for relaxed HIPAA compliance)';

-- Step 4: Create index for gender (useful for filtering)
CREATE INDEX IF NOT EXISTS idx_clients_gender ON clients(gender);

-- Note: The last_initial column is kept for backward compatibility
-- New code will use last_name, but last_initial can remain as a fallback

-- Step 5: Add "Client's Home" location option if not exists
INSERT INTO session_locations (name, description, is_active)
SELECT 'Client''s Home', 'Session conducted at the client''s residence', true
WHERE NOT EXISTS (
    SELECT 1 FROM session_locations WHERE name = 'Client''s Home'
);

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Added columns to clients table:';
    RAISE NOTICE '  - gender (male/female)';
    RAISE NOTICE '  - address (text)';
    RAISE NOTICE '  - date_of_birth (date)';
    RAISE NOTICE '  - last_name (varchar)';
    RAISE NOTICE '';
    RAISE NOTICE 'Added location option:';
    RAISE NOTICE '  - Client''s Home';
    RAISE NOTICE '========================================';
END $$;
