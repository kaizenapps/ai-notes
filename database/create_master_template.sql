-- Migration: Create master_session_templates table and default template
-- Date: 2024
-- Description: Creates the master template table and populates it with the default template based on current format

-- Create table if not exists
CREATE TABLE IF NOT EXISTS master_session_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL DEFAULT 'Default Template',
    sections JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_master_session_templates_is_active ON master_session_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_master_session_templates_sections ON master_session_templates USING GIN (sections);

-- Insert default template (based on current format)
INSERT INTO master_session_templates (name, sections, is_active)
VALUES (
    'Default Template',
    '[
        {
            "name": "location",
            "heading": "Location of Meeting:",
            "instructions": "Provide the location where the session took place",
            "placeholders": ["{{location}}"],
            "isVisible": true,
            "order": 1
        },
        {
            "name": "focus",
            "heading": "Focus of the Meeting:",
            "instructions": "Describe the primary focus based on the session objectives. Reference the treatment plan for this session if provided. Be specific about what was addressed in this session.",
            "placeholders": ["{{objectives}}", "{{treatmentPlan}}"],
            "isVisible": true,
            "order": 2
        },
        {
            "name": "activities",
            "heading": "Activities (time-based breakdown):",
            "instructions": "Break down activities by time segments. Include: Opening/check-in period, Main activities aligned with objectives, Closing/summary period. Use specific time ranges based on the {{duration}}-minute duration. Include line breaks between each time segment.",
            "placeholders": ["{{duration}}", "{{objectives}}"],
            "isVisible": true,
            "order": 3
        },
        {
            "name": "interventions",
            "heading": "Peer Support Interventions:",
            "instructions": "CRITICAL: If selected interventions are provided, you MUST use ONLY those interventions. For each selected intervention, describe: How it was applied during this session, The specific activities or approaches used, The client''s engagement with that intervention, Any outcomes or observations related to that intervention. Do NOT include any interventions that are NOT in the selected list. If no selected interventions are provided, describe the peer support interventions used during the session. Reference interventions from the treatment plan if provided. Use peer support language - avoid clinical terms. Examples: active listening, shared experiences, mutual support, goal-setting, resource sharing, peer mentoring, etc.",
            "placeholders": ["{{selectedInterventions}}", "{{treatmentPlan}}"],
            "isVisible": true,
            "order": 4
        },
        {
            "name": "patientResponse",
            "heading": "Patient Response/Content:",
            "instructions": "Describe how the client engaged with the session, their responses, participation level, any insights shared, progress observed, and their feedback. IMPORTANT: Use the client''s name {{clientName}} exactly as provided. Do NOT use generic names like \"J.\", \"R.\", or other initials unless that is the actual client''s name. Be specific and factual.",
            "placeholders": ["{{clientName}}"],
            "isVisible": true,
            "order": 5
        },
        {
            "name": "nextSession",
            "heading": "Plan for Next Session:",
            "instructions": "Based on the session objectives and the treatment plan for this session if provided, outline what should be addressed in the next session. Reference the treatment plan goals from this session if applicable. Keep it focused and actionable.",
            "placeholders": ["{{objectives}}", "{{treatmentPlan}}"],
            "isVisible": true,
            "order": 6
        }
    ]'::jsonb,
    true
)
ON CONFLICT DO NOTHING;

-- Add comments
COMMENT ON TABLE master_session_templates IS 'Master template for AI-generated session notes. Defines sections, instructions, and structure.';
COMMENT ON COLUMN master_session_templates.sections IS 'JSONB array of section objects. Each section has: name, heading, instructions, placeholders, isVisible, order';

