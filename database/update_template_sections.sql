-- Migration: Update master template sections
-- This migration updates the default template with enhanced instructions:
-- 1. Enhanced "activities" section to be more robust and include play activities
-- 2. Updated "focus" section to avoid listing goals/objectives separately
-- 3. Updated "patientResponse" heading to "Client Response"
-- 4. Enhanced instructions throughout for better peer support context

-- Update the active template's sections
UPDATE master_session_templates
SET sections = '[
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
updated_at = CURRENT_TIMESTAMP
WHERE is_active = true;

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Template migration completed successfully!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Updated sections:';
    RAISE NOTICE '  - Focus: narrative style, no separate goals/objectives';
    RAISE NOTICE '  - Activities: DETAILED breakdown with play activities';
    RAISE NOTICE '  - Client Response: renamed from Patient Response';
    RAISE NOTICE '  - All sections: enhanced peer support context';
    RAISE NOTICE '========================================';
END $$;
