-- ============================================================================
-- Session Notes Generator - Complete Database Schema
-- ============================================================================
-- Updated: Latest version with all recent changes
-- - Removed: session_templates table
-- - Removed: interventions table
-- - Removed: session_interventions table
-- - Removed: treatment_objectives table (objectives feature removed)
-- - Removed: session_objectives table (objectives feature removed)
-- - Removed: objectives_selected column from clients (now using treatment plan)
-- - Treatment plan is now the primary source for session note generation
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE
-- ============================================================================
-- Stores staff user accounts with role-based access control
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255),
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'peer_support' CHECK (role IN ('peer_support', 'admin')),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for users
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- ============================================================================
-- CLIENTS TABLE
-- ============================================================================
-- Stores client information
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_initial VARCHAR(1) NOT NULL,
    last_name VARCHAR(100),
    gender VARCHAR(10) CHECK (gender IN ('male', 'female')),
    address TEXT,
    date_of_birth DATE,
    treatment_plan TEXT NOT NULL, -- Required for session note generation
    extracted_interventions TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for clients
CREATE INDEX IF NOT EXISTS idx_clients_first_name ON clients(first_name);
CREATE INDEX IF NOT EXISTS idx_clients_is_active ON clients(is_active);
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON clients(created_by);
CREATE INDEX IF NOT EXISTS idx_clients_extracted_interventions ON clients USING GIN (extracted_interventions);
CREATE INDEX IF NOT EXISTS idx_clients_gender ON clients(gender);

-- Comments for documentation
COMMENT ON COLUMN clients.treatment_plan IS 'Treatment plan text - required for generating session notes. Peer Support Interventions are extracted from this.';
COMMENT ON COLUMN clients.extracted_interventions IS 'AI-extracted peer support interventions from treatment plan. Format: "[Category] - [Description]"';
COMMENT ON COLUMN clients.gender IS 'Client gender (male/female) - used for AI pronoun generation';
COMMENT ON COLUMN clients.address IS 'Client home address - used for location context, not displayed in session notes';
COMMENT ON COLUMN clients.date_of_birth IS 'Client date of birth';
COMMENT ON COLUMN clients.last_name IS 'Client full last name';

-- ============================================================================
-- SESSION LOCATIONS TABLE
-- ============================================================================
-- Stores predefined session location options
CREATE TABLE IF NOT EXISTS session_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for session_locations
CREATE INDEX IF NOT EXISTS idx_session_locations_name ON session_locations(name);
CREATE INDEX IF NOT EXISTS idx_session_locations_is_active ON session_locations(is_active);

-- Default location: Client's Home
INSERT INTO session_locations (name, description, is_active)
SELECT 'Client''s Home', 'Session conducted at the client''s residence', true
WHERE NOT EXISTS (SELECT 1 FROM session_locations WHERE name = 'Client''s Home');

-- ============================================================================
-- NOTE: TREATMENT OBJECTIVES TABLE REMOVED
-- ============================================================================
-- The treatment_objectives table has been removed.
-- Session notes now rely on Treatment Plan and extracted Peer Support Interventions.
-- See migration: database/remove_objectives.sql

-- ============================================================================
-- SESSION NOTES TABLE
-- ============================================================================
-- Stores generated session notes with AI-generated content
CREATE TABLE IF NOT EXISTS session_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    session_date DATE NOT NULL,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    location_id UUID REFERENCES session_locations(id),
    location_other VARCHAR(255),
    generated_note TEXT NOT NULL,
    custom_feedback TEXT,
    treatment_plan TEXT,
    selected_interventions TEXT[] DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for session_notes
CREATE INDEX IF NOT EXISTS idx_session_notes_client_id ON session_notes(client_id);
CREATE INDEX IF NOT EXISTS idx_session_notes_user_id ON session_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_session_notes_session_date ON session_notes(session_date);
CREATE INDEX IF NOT EXISTS idx_session_notes_status ON session_notes(status);
CREATE INDEX IF NOT EXISTS idx_session_notes_location_id ON session_notes(location_id);
CREATE INDEX IF NOT EXISTS idx_session_notes_created_at ON session_notes(created_at);
CREATE INDEX IF NOT EXISTS idx_session_notes_selected_interventions ON session_notes USING GIN (selected_interventions);

-- ============================================================================
-- NOTE: SESSION OBJECTIVES JUNCTION TABLE REMOVED
-- ============================================================================
-- The session_objectives table has been removed.
-- Session notes now use treatment_plan and selected_interventions columns directly.
-- See migration: database/remove_objectives.sql

-- ============================================================================
-- MASTER SESSION NOTE TEMPLATE TABLE
-- ============================================================================
-- Stores the master template configuration for AI-generated session notes
CREATE TABLE IF NOT EXISTS master_session_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL DEFAULT 'Default Template',
    sections JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for master_session_templates
CREATE INDEX IF NOT EXISTS idx_master_session_templates_is_active ON master_session_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_master_session_templates_sections ON master_session_templates USING GIN (sections);

-- Comments for documentation
COMMENT ON TABLE master_session_templates IS 'Master template for AI-generated session notes. Defines sections, instructions, and structure.';
COMMENT ON COLUMN master_session_templates.sections IS 'JSONB array of section objects. Each section has: name, heading, instructions, placeholders, isVisible, order';

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
            "instructions": "Describe the primary focus of this peer support session. Explain what the session addressed and why it was important for the client. Reference the treatment plan if provided. Be specific and narrative - do not list goals or objectives separately.",
            "placeholders": ["{{objectives}}", "{{treatmentPlan}}"],
            "isVisible": true,
            "order": 2
        },
        {
            "name": "activities",
            "heading": "Session Activities:",
            "instructions": "Provide a DETAILED and ROBUST breakdown of all activities during the {{duration}}-minute session. Be very descriptive and specific. Include: 1) Opening/check-in (first 5-10 minutes): How did the session start? What was discussed? 2) Main Activities: Describe EACH activity in detail - what was done, how it was done, what materials or techniques were used. Include play activities, interactive exercises, discussions, skill-building activities, games, creative activities, role-playing, or any other engagement methods used. 3) Closing (last 5-10 minutes): How did the session wrap up? What was summarized? Use specific time ranges (e.g., 0-10 min, 10-30 min, etc.). Be thorough and paint a clear picture of what happened during the session.",
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
            "heading": "Client Response:",
            "instructions": "Describe how the client engaged with the session, their responses, participation level, any insights shared, progress observed, and their feedback. IMPORTANT: Use ONLY the client''s first name {{clientName}} - never use last names or full names. Be specific and factual about the client''s engagement and any notable responses or behaviors.",
            "placeholders": ["{{clientName}}"],
            "isVisible": true,
            "order": 5
        },
        {
            "name": "nextSession",
            "heading": "Plan for Next Session:",
            "instructions": "Based on what was covered in this session and the treatment plan if provided, outline what should be addressed in the next session. Keep it focused and actionable - describe specific activities or topics to cover.",
            "placeholders": ["{{objectives}}", "{{treatmentPlan}}"],
            "isVisible": true,
            "order": 6
        }
    ]'::jsonb,
    true
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- AUDIT LOGS TABLE
-- ============================================================================
-- HIPAA compliance: Audit trail for all data access and changes
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to clients table
DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to session_notes table
DROP TRIGGER IF EXISTS update_session_notes_updated_at ON session_notes;
CREATE TRIGGER update_session_notes_updated_at
    BEFORE UPDATE ON session_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- AUDIT LOGGING TRIGGER FUNCTION
-- ============================================================================

-- Function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (
        user_id,
        action,
        table_name,
        record_id,
        old_values,
        new_values
    ) VALUES (
        current_setting('app.current_user_id', true)::UUID,
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD)::jsonb ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW)::jsonb ELSE NULL END
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Database schema created successfully!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Tables created:';
    RAISE NOTICE '  - users';
    RAISE NOTICE '  - clients (with objectives_selected)';
    RAISE NOTICE '  - session_locations';
    RAISE NOTICE '  - treatment_objectives';
    RAISE NOTICE '  - session_notes';
    RAISE NOTICE '  - session_objectives';
    RAISE NOTICE '  - audit_logs';
    RAISE NOTICE '';
    RAISE NOTICE 'Note: session_templates, interventions, and session_interventions tables have been removed.';
    RAISE NOTICE '========================================';
END $$;

