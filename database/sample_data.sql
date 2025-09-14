-- Sample Data for Session Notes Generator
-- This file populates the database with sample data for testing and development

-- Insert sample session locations
INSERT INTO session_locations (name, description) VALUES
('Client Home', 'In-person session at client''s residence'),
('Telehealth', 'Remote session via video call or phone'),
('Community', 'Session in community setting (park, cafe, etc.)'),
('Office', 'Session at agency office or clinical setting'),
('Hospital', 'Session at hospital or medical facility'),
('Group Home', 'Session at residential group home'),
('Outpatient Clinic', 'Session at outpatient treatment facility');

-- Insert sample treatment objectives
INSERT INTO treatment_objectives (name, category) VALUES
('Improve coping skills', 'Mental Health'),
('Medication compliance', 'Medical'),
('Social skills development', 'Social'),
('Employment readiness', 'Vocational'),
('Housing stability', 'Basic Needs'),
('Substance abuse recovery', 'Addiction'),
('Crisis management', 'Mental Health'),
('Family relationship improvement', 'Social'),
('Financial management', 'Life Skills'),
('Transportation assistance', 'Basic Needs'),
('Educational goals', 'Academic'),
('Peer support engagement', 'Social'),
('Self-advocacy skills', 'Empowerment'),
('Wellness planning', 'Mental Health'),
('Community integration', 'Social'),
('Trauma recovery', 'Mental Health'),
('Anger management', 'Behavioral'),
('Communication skills', 'Social'),
('Goal setting and planning', 'Life Skills'),
('Stress reduction techniques', 'Mental Health');

-- Insert sample peer support interventions
INSERT INTO interventions (name, category) VALUES
('Active listening', 'Communication'),
('Peer counseling', 'Support'),
('Resource linkage', 'Advocacy'),
('Skills training', 'Education'),
('Crisis support', 'Emergency'),
('Motivational interviewing', 'Counseling'),
('Wellness planning', 'Planning'),
('Advocacy assistance', 'Advocacy'),
('Psychoeducation', 'Education'),
('Behavioral modeling', 'Support'),
('Problem-solving support', 'Counseling'),
('Goal setting assistance', 'Planning'),
('Relapse prevention', 'Prevention'),
('Social skills practice', 'Education'),
('Emotional support', 'Support'),
('Reality testing', 'Counseling'),
('Boundary setting', 'Education'),
('Mindfulness techniques', 'Wellness'),
('Coping strategy development', 'Education'),
('Community resource navigation', 'Advocacy');

-- Insert sample users (passwords should be hashed in production)
INSERT INTO users (username, email, password_hash, role, first_name, last_name) VALUES
('admin', 'admin@agency.com', crypt('admin123', gen_salt('bf')), 'admin', 'System', 'Administrator'),
('jdoe', 'john.doe@agency.com', crypt('password123', gen_salt('bf')), 'peer_support', 'John', 'Doe'),
('msmith', 'mary.smith@agency.com', crypt('password123', gen_salt('bf')), 'peer_support', 'Mary', 'Smith'),
('bwilson', 'bob.wilson@agency.com', crypt('password123', gen_salt('bf')), 'peer_support', 'Bob', 'Wilson'),
('sjohnson', 'sarah.johnson@agency.com', crypt('password123', gen_salt('bf')), 'peer_support', 'Sarah', 'Johnson');

-- Insert sample clients (HIPAA compliant - only first name and last initial)
INSERT INTO clients (first_name, last_initial, treatment_plan, created_by) VALUES
('John', 'D', 'Focus on coping skills development and medication compliance', (SELECT id FROM users WHERE username = 'jdoe')),
('Jane', 'S', 'Social skills development and community integration support', (SELECT id FROM users WHERE username = 'msmith')),
('Michael', 'R', 'Substance abuse recovery and employment readiness', (SELECT id FROM users WHERE username = 'bwilson')),
('Sarah', 'L', 'Trauma recovery and family relationship improvement', (SELECT id FROM users WHERE username = 'sjohnson')),
('David', 'M', 'Crisis management and wellness planning', (SELECT id FROM users WHERE username = 'jdoe')),
('Lisa', 'K', 'Housing stability and financial management skills', (SELECT id FROM users WHERE username = 'msmith')),
('Robert', 'T', 'Peer support engagement and self-advocacy development', (SELECT id FROM users WHERE username = 'bwilson')),
('Emily', 'W', 'Educational goals and communication skills improvement', (SELECT id FROM users WHERE username = 'sjohnson'));

-- Insert sample session templates
INSERT INTO session_templates (name, description, default_duration, default_location_id, created_by) VALUES
('Initial Assessment', 'Comprehensive intake and assessment session', 90, 
    (SELECT id FROM session_locations WHERE name = 'Office'), 
    (SELECT id FROM users WHERE username = 'admin')),
('Weekly Check-in', 'Standard weekly peer support session', 60, 
    (SELECT id FROM session_locations WHERE name = 'Telehealth'), 
    (SELECT id FROM users WHERE username = 'admin')),
('Crisis Intervention', 'Emergency crisis support session', 45, 
    (SELECT id FROM session_locations WHERE name = 'Client Home'), 
    (SELECT id FROM users WHERE username = 'admin')),
('Skills Training', 'Focused skills development session', 75, 
    (SELECT id FROM session_locations WHERE name = 'Community'), 
    (SELECT id FROM users WHERE username = 'admin'));

-- Insert sample session notes with realistic data
DO $$
DECLARE
    client_john UUID;
    client_jane UUID;
    client_michael UUID;
    user_jdoe UUID;
    user_msmith UUID;
    user_bwilson UUID;
    session_note_id UUID;
    location_home UUID;
    location_telehealth UUID;
    location_office UUID;
BEGIN
    -- Get UUIDs for reference
    SELECT id INTO client_john FROM clients WHERE first_name = 'John' AND last_initial = 'D';
    SELECT id INTO client_jane FROM clients WHERE first_name = 'Jane' AND last_initial = 'S';
    SELECT id INTO client_michael FROM clients WHERE first_name = 'Michael' AND last_initial = 'R';
    SELECT id INTO user_jdoe FROM users WHERE username = 'jdoe';
    SELECT id INTO user_msmith FROM users WHERE username = 'msmith';
    SELECT id INTO user_bwilson FROM users WHERE username = 'bwilson';
    SELECT id INTO location_home FROM session_locations WHERE name = 'Client Home';
    SELECT id INTO location_telehealth FROM session_locations WHERE name = 'Telehealth';
    SELECT id INTO location_office FROM session_locations WHERE name = 'Office';

    -- Sample session note 1
    INSERT INTO session_notes (client_id, user_id, session_date, duration_minutes, location_id, generated_note, status)
    VALUES (client_john, user_jdoe, CURRENT_DATE - INTERVAL '3 days', 60, location_telehealth,
        '**Location of Meeting:** Telehealth

**Focus of the meeting:** The session focused on improving coping skills and medication compliance through peer support interventions.

**Activities:**
- 0-10 minutes: Welcome and check-in, established rapport and reviewed previous session goals
- 10-45 minutes: Engaged in active listening and skills training around medication management
- 45-60 minutes: Summary and planning for next session, reviewed coping strategies

**Peer Support Interventions:** Active listening, Skills training, Psychoeducation

**Patient Response/Content:** Client was engaged throughout the session and demonstrated understanding of medication importance. Client expressed willingness to continue working on daily medication routine and stress management techniques.

**Plan for next session:** Continue working on coping skills development and medication compliance. Schedule follow-up within one week to maintain momentum and support progress.',
        'completed')
    RETURNING id INTO session_note_id;

    -- Add objectives for session note 1
    INSERT INTO session_objectives (session_note_id, objective_id) VALUES
    (session_note_id, (SELECT id FROM treatment_objectives WHERE name = 'Improve coping skills')),
    (session_note_id, (SELECT id FROM treatment_objectives WHERE name = 'Medication compliance'));

    -- Add interventions for session note 1
    INSERT INTO session_interventions (session_note_id, intervention_id) VALUES
    (session_note_id, (SELECT id FROM interventions WHERE name = 'Active listening')),
    (session_note_id, (SELECT id FROM interventions WHERE name = 'Skills training')),
    (session_note_id, (SELECT id FROM interventions WHERE name = 'Psychoeducation'));

    -- Sample session note 2
    INSERT INTO session_notes (client_id, user_id, session_date, duration_minutes, location_id, generated_note, status)
    VALUES (client_jane, user_msmith, CURRENT_DATE - INTERVAL '1 day', 75, location_office,
        '**Location of Meeting:** Office

**Focus of the meeting:** The session focused on social skills development and community integration through structured peer support activities.

**Activities:**
- 0-15 minutes: Welcome and rapport building, reviewed weekly goals
- 15-60 minutes: Engaged in social skills practice and community resource navigation
- 60-75 minutes: Planning and goal setting for community integration activities

**Peer Support Interventions:** Social skills practice, Community resource navigation, Goal setting assistance

**Patient Response/Content:** Client actively participated in role-playing exercises and showed increased confidence in social interactions. Client identified specific community activities of interest and committed to attending one group event this week.

**Plan for next session:** Follow up on community integration progress and continue social skills development. Practice conversation skills and review community resource options.',
        'completed')
    RETURNING id INTO session_note_id;

    -- Add objectives for session note 2
    INSERT INTO session_objectives (session_note_id, objective_id) VALUES
    (session_note_id, (SELECT id FROM treatment_objectives WHERE name = 'Social skills development')),
    (session_note_id, (SELECT id FROM treatment_objectives WHERE name = 'Community integration'));

    -- Add interventions for session note 2
    INSERT INTO session_interventions (session_note_id, intervention_id) VALUES
    (session_note_id, (SELECT id FROM interventions WHERE name = 'Social skills practice')),
    (session_note_id, (SELECT id FROM interventions WHERE name = 'Community resource navigation')),
    (session_note_id, (SELECT id FROM interventions WHERE name = 'Goal setting assistance'));

    -- Sample session note 3
    INSERT INTO session_notes (client_id, user_id, session_date, duration_minutes, location_id, generated_note, status)
    VALUES (client_michael, user_bwilson, CURRENT_DATE, 90, location_home,
        '**Location of Meeting:** Client Home

**Focus of the meeting:** Initial assessment session focusing on substance abuse recovery and employment readiness evaluation.

**Activities:**
- 0-20 minutes: Welcome, introductions, and establishing therapeutic rapport
- 20-70 minutes: Comprehensive assessment using motivational interviewing and active listening
- 70-90 minutes: Collaborative goal setting and treatment planning discussion

**Peer Support Interventions:** Motivational interviewing, Active listening, Goal setting assistance, Resource linkage

**Patient Response/Content:** Client was initially hesitant but became more open throughout the session. Client expressed motivation for recovery and interest in vocational training programs. Identified transportation as a barrier to employment.

**Plan for next session:** Continue building trust and motivation. Research vocational training programs and transportation resources. Schedule follow-up in one week to review resource options.',
        'draft')
    RETURNING id INTO session_note_id;

    -- Add objectives for session note 3
    INSERT INTO session_objectives (session_note_id, objective_id) VALUES
    (session_note_id, (SELECT id FROM treatment_objectives WHERE name = 'Substance abuse recovery')),
    (session_note_id, (SELECT id FROM treatment_objectives WHERE name = 'Employment readiness'));

    -- Add interventions for session note 3
    INSERT INTO session_interventions (session_note_id, intervention_id) VALUES
    (session_note_id, (SELECT id FROM interventions WHERE name = 'Motivational interviewing')),
    (session_note_id, (SELECT id FROM interventions WHERE name = 'Active listening')),
    (session_note_id, (SELECT id FROM interventions WHERE name = 'Goal setting assistance')),
    (session_note_id, (SELECT id FROM interventions WHERE name = 'Resource linkage'));

END $$;

-- Create some sample audit log entries (normally these would be created by triggers)
INSERT INTO audit_logs (user_id, table_name, record_id, action, new_values) VALUES
((SELECT id FROM users WHERE username = 'admin'), 'users', (SELECT id FROM users WHERE username = 'jdoe'), 'INSERT', '{"username": "jdoe", "role": "peer_support"}'),
((SELECT id FROM users WHERE username = 'jdoe'), 'clients', (SELECT id FROM clients WHERE first_name = 'John' AND last_initial = 'D'), 'INSERT', '{"first_name": "John", "last_initial": "D"}');

-- Update statistics for better query performance
ANALYZE;
