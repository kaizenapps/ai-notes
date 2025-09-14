-- Session Notes Generator Database Schema
-- PostgreSQL Database Schema for HIPAA-compliant session note generation
-- Created for peer support agencies with billing compliance requirements

-- Enable UUID extension for generating unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create ENUM types for better data integrity
CREATE TYPE user_role AS ENUM ('peer_support', 'admin');
CREATE TYPE session_status AS ENUM ('draft', 'completed', 'archived');

-- Users table for authentication and role management
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'peer_support',
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Clients table (HIPAA compliant - minimal personal data)
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_initial CHAR(1) NOT NULL,
    treatment_plan TEXT,
    date_of_birth DATE, -- For age calculation, not display
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Session locations lookup table
CREATE TABLE session_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Treatment objectives lookup table
CREATE TABLE treatment_objectives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Peer support interventions lookup table
CREATE TABLE interventions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Main session notes table
CREATE TABLE session_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    session_date DATE NOT NULL,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    location_id UUID REFERENCES session_locations(id),
    location_other VARCHAR(200), -- For custom locations
    generated_note TEXT NOT NULL,
    custom_feedback TEXT,
    status session_status DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure session date is not in the future
    CONSTRAINT session_date_not_future CHECK (session_date <= CURRENT_DATE)
);

-- Junction table for session objectives (many-to-many)
CREATE TABLE session_objectives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_note_id UUID NOT NULL REFERENCES session_notes(id) ON DELETE CASCADE,
    objective_id UUID REFERENCES treatment_objectives(id),
    custom_objective VARCHAR(500), -- For custom objectives not in lookup
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure either objective_id or custom_objective is provided
    CONSTRAINT objective_or_custom CHECK (
        (objective_id IS NOT NULL AND custom_objective IS NULL) OR
        (objective_id IS NULL AND custom_objective IS NOT NULL)
    )
);

-- Junction table for session interventions (many-to-many)
CREATE TABLE session_interventions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_note_id UUID NOT NULL REFERENCES session_notes(id) ON DELETE CASCADE,
    intervention_id UUID REFERENCES interventions(id),
    custom_intervention VARCHAR(500), -- For custom interventions not in lookup
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure either intervention_id or custom_intervention is provided
    CONSTRAINT intervention_or_custom CHECK (
        (intervention_id IS NOT NULL AND custom_intervention IS NULL) OR
        (intervention_id IS NULL AND custom_intervention IS NOT NULL)
    )
);

-- Audit log for HIPAA compliance
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE, VIEW
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Session templates for common session types
CREATE TABLE session_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    default_duration INTEGER,
    default_location_id UUID REFERENCES session_locations(id),
    template_objectives UUID[] DEFAULT '{}',
    template_interventions UUID[] DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);

CREATE INDEX idx_clients_name ON clients(first_name, last_initial);
CREATE INDEX idx_clients_active ON clients(is_active);
CREATE INDEX idx_clients_created_by ON clients(created_by);

CREATE INDEX idx_session_notes_client ON session_notes(client_id);
CREATE INDEX idx_session_notes_user ON session_notes(user_id);
CREATE INDEX idx_session_notes_date ON session_notes(session_date);
CREATE INDEX idx_session_notes_status ON session_notes(status);
CREATE INDEX idx_session_notes_created ON session_notes(created_at);
-- Removed billing index as billing functionality is not needed

CREATE INDEX idx_session_objectives_session ON session_objectives(session_note_id);
CREATE INDEX idx_session_objectives_objective ON session_objectives(objective_id);

CREATE INDEX idx_session_interventions_session ON session_interventions(session_note_id);
CREATE INDEX idx_session_interventions_intervention ON session_interventions(intervention_id);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_session_notes_updated_at BEFORE UPDATE ON session_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_session_templates_updated_at BEFORE UPDATE ON session_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create audit trigger function for HIPAA compliance
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    audit_user_id UUID;
BEGIN
    -- Get user_id from session if available
    audit_user_id := current_setting('app.current_user_id', true)::UUID;
    
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (user_id, table_name, record_id, action, old_values)
        VALUES (audit_user_id, TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD));
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (user_id, table_name, record_id, action, old_values, new_values)
        VALUES (audit_user_id, TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (user_id, table_name, record_id, action, new_values)
        VALUES (audit_user_id, TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to sensitive tables
CREATE TRIGGER audit_users AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_clients AFTER INSERT OR UPDATE OR DELETE ON clients
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_session_notes AFTER INSERT OR UPDATE OR DELETE ON session_notes
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Comments for documentation
COMMENT ON TABLE users IS 'User accounts for peer support staff and administrators';
COMMENT ON TABLE clients IS 'Client records with HIPAA-compliant minimal data storage';
COMMENT ON TABLE session_notes IS 'Generated session notes for billing and compliance';
COMMENT ON TABLE session_objectives IS 'Treatment objectives addressed in each session';
COMMENT ON TABLE session_interventions IS 'Peer support interventions used in each session';
COMMENT ON TABLE audit_logs IS 'HIPAA compliance audit trail for all data access and changes';

COMMENT ON COLUMN clients.last_initial IS 'HIPAA: Store only last initial, not full last name';
COMMENT ON COLUMN session_notes.generated_note IS 'AI-generated session note content for billing';
COMMENT ON COLUMN audit_logs.action IS 'Type of action: INSERT, UPDATE, DELETE, or VIEW';
