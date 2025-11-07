-- Migration: Add selected_interventions column to session_notes table
-- Date: 2024
-- Description: Adds a column to store interventions selected for each session

-- Add the column
ALTER TABLE session_notes 
ADD COLUMN IF NOT EXISTS selected_interventions TEXT[] DEFAULT '{}';

-- Create GIN index for efficient querying
CREATE INDEX IF NOT EXISTS idx_session_notes_selected_interventions 
ON session_notes USING GIN (selected_interventions);

-- Add comment for documentation
COMMENT ON COLUMN session_notes.selected_interventions IS 'Array of peer support interventions selected for this specific session. These are selected from the client''s extracted interventions.';

