-- Add extracted_interventions column to clients table
-- This stores AI-extracted interventions from treatment plans

ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS extracted_interventions TEXT[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN clients.extracted_interventions IS 'AI-extracted peer support interventions from treatment plan. Format: "[Category] - [Description]"';

-- Create index for faster queries (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_clients_extracted_interventions ON clients USING GIN (extracted_interventions);

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'clients' 
  AND column_name = 'extracted_interventions';

