-- Migration: Add treatment_plan column to session_notes table
-- Date: 2024
-- Description: Adds a column to store treatment plan specific to each session (not linked to client)

-- Add the column
ALTER TABLE session_notes 
ADD COLUMN IF NOT EXISTS treatment_plan TEXT;

-- Add comment for documentation
COMMENT ON COLUMN session_notes.treatment_plan IS 'Treatment plan text specific to this session. This is independent from the client''s treatment plan and is only used for this session note generation.';

