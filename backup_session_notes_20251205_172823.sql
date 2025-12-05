--
-- PostgreSQL database dump
--

\restrict M0j1EvJlsivs386IJ9rBQpuZe0nBFlaeJx59mpywbcTtivODdxCR3anHnfVAUpi

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: session_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.session_status AS ENUM (
    'draft',
    'completed',
    'archived'
);


ALTER TYPE public.session_status OWNER TO postgres;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'peer_support',
    'admin'
);


ALTER TYPE public.user_role OWNER TO postgres;

--
-- Name: audit_trigger_function(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.audit_trigger_function() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.audit_trigger_function() OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    table_name character varying(50) NOT NULL,
    record_id uuid NOT NULL,
    action character varying(20) NOT NULL,
    old_values jsonb,
    new_values jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: TABLE audit_logs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.audit_logs IS 'HIPAA compliance audit trail for all data access and changes';


--
-- Name: COLUMN audit_logs.action; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.audit_logs.action IS 'Type of action: INSERT, UPDATE, DELETE, or VIEW';


--
-- Name: clients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clients (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    first_name character varying(100) NOT NULL,
    last_initial character(1) NOT NULL,
    treatment_plan text,
    date_of_birth date,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    extracted_interventions text[] DEFAULT '{}'::text[],
    gender character varying(10),
    address text,
    last_name character varying(100),
    CONSTRAINT clients_gender_check CHECK (((gender)::text = ANY ((ARRAY['male'::character varying, 'female'::character varying])::text[])))
);


ALTER TABLE public.clients OWNER TO postgres;

--
-- Name: TABLE clients; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.clients IS 'Stores client information. Treatment plan is required for session note generation.';


--
-- Name: COLUMN clients.last_initial; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.clients.last_initial IS 'HIPAA: Store only last initial, not full last name';


--
-- Name: COLUMN clients.treatment_plan; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.clients.treatment_plan IS 'Treatment plan text - required for generating session notes. Peer Support Interventions are extracted from this.';


--
-- Name: COLUMN clients.date_of_birth; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.clients.date_of_birth IS 'Client date of birth';


--
-- Name: COLUMN clients.extracted_interventions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.clients.extracted_interventions IS 'AI-extracted peer support interventions from treatment plan. Format: "[Category] - [Description]"';


--
-- Name: COLUMN clients.gender; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.clients.gender IS 'Client gender (male/female) - used for AI pronoun generation';


--
-- Name: COLUMN clients.address; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.clients.address IS 'Client home address - used for location context, not displayed in session notes';


--
-- Name: COLUMN clients.last_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.clients.last_name IS 'Client full last name (replaces last_initial for relaxed HIPAA compliance)';


--
-- Name: master_session_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.master_session_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) DEFAULT 'Default Template'::character varying NOT NULL,
    sections jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.master_session_templates OWNER TO postgres;

--
-- Name: TABLE master_session_templates; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.master_session_templates IS 'Master template for AI-generated session notes. Defines sections, instructions, and structure.';


--
-- Name: COLUMN master_session_templates.sections; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.master_session_templates.sections IS 'JSONB array of section objects. Each section has: name, heading, instructions, placeholders, isVisible, order';


--
-- Name: session_locations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.session_locations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.session_locations OWNER TO postgres;

--
-- Name: session_notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.session_notes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid NOT NULL,
    session_date date NOT NULL,
    duration_minutes integer NOT NULL,
    location_id uuid,
    location_other character varying(200),
    generated_note text NOT NULL,
    custom_feedback text,
    status public.session_status DEFAULT 'draft'::public.session_status,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    selected_interventions text[] DEFAULT '{}'::text[],
    treatment_plan text,
    CONSTRAINT session_date_not_future CHECK ((session_date <= CURRENT_DATE)),
    CONSTRAINT session_notes_duration_minutes_check CHECK ((duration_minutes > 0))
);


ALTER TABLE public.session_notes OWNER TO postgres;

--
-- Name: TABLE session_notes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.session_notes IS 'Generated session notes for billing and compliance';


--
-- Name: COLUMN session_notes.generated_note; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.session_notes.generated_note IS 'AI-generated session note content for billing';


--
-- Name: COLUMN session_notes.selected_interventions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.session_notes.selected_interventions IS 'Array of peer support interventions selected for this specific session. These are selected from the client''s extracted interventions.';


--
-- Name: COLUMN session_notes.treatment_plan; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.session_notes.treatment_plan IS 'Treatment plan text specific to this session. This is independent from the client''s treatment plan and is only used for this session note generation.';


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    username character varying(50) NOT NULL,
    email character varying(255),
    password_hash character varying(255) NOT NULL,
    role public.user_role DEFAULT 'peer_support'::public.user_role NOT NULL,
    first_name character varying(100),
    last_name character varying(100),
    is_active boolean DEFAULT true,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.users IS 'User accounts for peer support staff and administrators';


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, user_id, table_name, record_id, action, old_values, new_values, ip_address, user_agent, created_at) FROM stdin;
\.


--
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.clients (id, first_name, last_initial, treatment_plan, date_of_birth, is_active, created_by, created_at, updated_at, extracted_interventions, gender, address, last_name) FROM stdin;
5a8f87ed-96f7-4c98-80ab-85ae81951a0b	John	D	Focus on coping skills development and medication compliance	\N	t	28224a49-6863-420f-9045-58a433948c9b	2025-09-08 00:03:47.849171+03	2025-12-05 16:10:09.602723+03	{}	\N	\N	D
8b41e65d-7783-4128-ad9f-92ac1eb53535	Michael	R	Substance abuse recovery and employment readiness	\N	t	73496734-c379-43dd-a796-638f741e3694	2025-09-08 00:03:47.849171+03	2025-12-05 16:10:09.602723+03	{}	\N	\N	R
95710986-677b-475f-b114-f2e1d8c7a85e	David	M	Crisis management and wellness planning	\N	t	28224a49-6863-420f-9045-58a433948c9b	2025-09-08 00:03:47.849171+03	2025-12-05 16:10:09.602723+03	{}	\N	\N	M
fe6821fd-dbc4-4857-8ff2-1fa2c041f783	Lisa	K	Housing stability and financial management skills	\N	t	0f9f1311-91b7-4e4c-8330-0197264792de	2025-09-08 00:03:47.849171+03	2025-12-05 16:10:09.602723+03	{}	\N	\N	K
162e89fd-aa44-4c45-a9a6-4d540a108d57	Robert	T	Peer support engagement and self-advocacy development	\N	t	73496734-c379-43dd-a796-638f741e3694	2025-09-08 00:03:47.849171+03	2025-12-05 16:10:09.602723+03	{}	\N	\N	T
9ea2bd51-d522-4d45-b5f4-145ffa75e1d3	Emily	W	Educational goals and communication skills improvement	\N	t	3d721fc1-e812-49fa-848e-b5009a264a7c	2025-09-08 00:03:47.849171+03	2025-12-05 16:10:09.602723+03	{}	\N	\N	W
a439184b-212b-48a8-8432-1f0cce93882d	test	T	test	\N	t	76c00b5d-8300-4482-934c-53496deed884	2025-09-14 12:47:07.505124+03	2025-12-05 16:10:09.602723+03	{}	\N	\N	T
28c3ef76-53a6-4f26-9330-0820f7c7decb	Sarah	L	Trauma recovery and family relationship improvement	\N	t	3d721fc1-e812-49fa-848e-b5009a264a7c	2025-09-08 00:03:47.849171+03	2025-12-05 16:10:09.602723+03	{"Self-Esteem Building - Peer-led workshops on self-care practices and positive self-talk","Employment Readiness - Job search support group meetings for resume building and interview preparation","Communication Skills - Peer role-playing exercises to practice assertive communication techniques","Stress Reduction Techniques - Mindfulness meditation sessions led by peers for relaxation and stress management"}	\N	\N	L
1e1aad76-7156-4375-9b46-cf6d4789fcd5	Jane	S	Social skills development and community integration support	\N	t	0f9f1311-91b7-4e4c-8330-0197264792de	2025-09-08 00:03:47.849171+03	2025-12-05 16:10:09.602723+03	{"Self-Esteem Building - Peer-led self-esteem workshops and group activities focusing on positive self-talk and self-acceptance","Employment Readiness - Peer support for resume building, job search strategies, and mock interviews to enhance employment skills","Anxiety Management - Peer-led relaxation techniques sessions such as deep breathing exercises and mindfulness practices","Financial Management - Peer support groups to share budgeting tips, money-saving strategies, and financial literacy resources","Anger Management - Peer support circles for sharing coping mechanisms, anger triggers identification, and healthy communication skills practice"}	\N	\N	S
a29fb89b-0afe-4d71-b9bc-208dbcbf297f	Dark	T	Long-term Goal 1: Improve overall mental health and well-being\n     Short-term Goal 1: Reduce anxiety symptoms	\N	t	76c00b5d-8300-4482-934c-53496deed884	2025-11-05 21:32:17.620736+03	2025-12-05 16:10:09.602723+03	{"Anxiety Management - Peer-led group sessions to share and practice relaxation techniques","Social Support Building - Establish a buddy system for clients to check in with each other daily for emotional support","Coping Skills Development - Peer support network to share personal coping strategies for managing anxiety symptoms"}	\N	\N	T
\.


--
-- Data for Name: master_session_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.master_session_templates (id, name, sections, is_active, created_at, updated_at) FROM stdin;
06fb6229-acc1-4d0d-871c-c69c00cba57a	Default Template	[{"name": "location", "order": 1, "heading": "Location of Meeting:", "isVisible": true, "instructions": "Provide the location where the session took place", "placeholders": ["{{location}}"]}, {"name": "focus", "order": 2, "heading": "Focus of the Meeting:", "isVisible": true, "instructions": "Describe the primary focus of this peer support session. Explain what the session addressed and why it was important for the client. Reference the treatment plan if provided. Be specific and narrative - do not list goals or objectives separately.", "placeholders": ["{{objectives}}", "{{treatmentPlan}}"]}, {"name": "activities", "order": 3, "heading": "Session Activities:", "isVisible": true, "instructions": "Provide a DETAILED and ROBUST breakdown of all activities during the {{duration}}-minute session. Be very descriptive and specific. Include: 1) Opening/check-in (first 5-10 minutes): How did the session start? What was discussed? 2) Main Activities: Describe EACH activity in detail - what was done, how it was done, what materials or techniques were used. Include play activities, interactive exercises, discussions, skill-building activities, games, creative activities, role-playing, or any other engagement methods used. 3) Closing (last 5-10 minutes): How did the session wrap up? What was summarized? Use specific time ranges (e.g., 0-10 min, 10-30 min, etc.). Be thorough and paint a clear picture of what happened during the session.", "placeholders": ["{{duration}}", "{{objectives}}"]}, {"name": "interventions", "order": 4, "heading": "Peer Support Interventions:", "isVisible": true, "instructions": "CRITICAL: If selected interventions are provided, you MUST use ONLY those interventions. For each selected intervention, describe: How it was applied during this session, The specific activities or approaches used, The client's engagement with that intervention, Any outcomes or observations related to that intervention. Do NOT include any interventions that are NOT in the selected list. If no selected interventions are provided, describe the peer support interventions used during the session. Reference interventions from the treatment plan if provided. Use peer support language - avoid clinical terms. Examples: active listening, shared experiences, mutual support, goal-setting, resource sharing, peer mentoring, etc.", "placeholders": ["{{selectedInterventions}}", "{{treatmentPlan}}"]}, {"name": "patientResponse", "order": 5, "heading": "Client Response:", "isVisible": true, "instructions": "Describe how the client engaged with the session, their responses, participation level, any insights shared, progress observed, and their feedback. IMPORTANT: Use ONLY the client's first name {{clientName}} - never use last names or full names. Be specific and factual about the client's engagement and any notable responses or behaviors.", "placeholders": ["{{clientName}}"]}, {"name": "nextSession", "order": 6, "heading": "Plan for Next Session:", "isVisible": true, "instructions": "Based on what was covered in this session and the treatment plan if provided, outline what should be addressed in the next session. Keep it focused and actionable - describe specific activities or topics to cover.", "placeholders": ["{{objectives}}", "{{treatmentPlan}}"]}]	t	2025-11-07 23:10:19.980724+03	2025-12-05 16:10:30.067668+03
\.


--
-- Data for Name: session_locations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.session_locations (id, name, description, is_active, created_at) FROM stdin;
5d483ab7-b10b-418e-9ccf-55c3cdd3f04b	Client Home	In-person session at client's residence	t	2025-09-08 00:03:47.849171+03
20af657b-b37a-48ab-91f2-89fd59581b1f	Telehealth	Remote session via video call or phone	t	2025-09-08 00:03:47.849171+03
cd8fffd2-38ff-4028-881f-db5123d4000b	Community	Session in community setting (park, cafe, etc.)	t	2025-09-08 00:03:47.849171+03
f65bd398-be42-4a15-b57a-e966371f27b8	Office	Session at agency office or clinical setting	t	2025-09-08 00:03:47.849171+03
75571a4f-f464-4120-b715-c6cea3a8afe3	Hospital	Session at hospital or medical facility	t	2025-09-08 00:03:47.849171+03
341231b0-44e6-4ed2-8473-7bb1e86fef3f	Group Home	Session at residential group home	t	2025-09-08 00:03:47.849171+03
36541a82-773f-4914-9ecf-02aa0b6edd1b	Outpatient Clinic	Session at outpatient treatment facility	t	2025-09-08 00:03:47.849171+03
bf79a32c-1489-4278-864e-c579bab02069	Client's Home	Session conducted at the client's residence	t	2025-12-05 16:10:09.872135+03
\.


--
-- Data for Name: session_notes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.session_notes (id, client_id, user_id, session_date, duration_minutes, location_id, location_other, generated_note, custom_feedback, status, created_at, updated_at, selected_interventions, treatment_plan) FROM stdin;
27fafd57-151f-48bb-ac03-19f4f7d19ee9	a29fb89b-0afe-4d71-b9bc-208dbcbf297f	76c00b5d-8300-4482-934c-53496deed884	2025-11-05	60	\N	Community	Location of Meeting:\nCommunity\n\nFocus of the Meeting:\nThe primary focus of the session was on self-esteem building and anxiety management as outlined in the treatment plan. We aimed to work on reducing anxiety symptoms through peer support interventions and activities related to breathing exercises and mindfulness techniques.\n\nActivities (time-based breakdown):\n- Opening/check-in period (0-15 min): Dark T. shared their recent experiences and expressed their current feelings of anxiety and self-doubt.\n- Main activities aligned with objectives (15-45 min): We practiced breathing exercises together and discussed how mindfulness techniques can help in managing anxiety.\n- Closing/summary period (45-60 min): We reflected on the session, identified positive aspects of self-esteem, and set goals for practicing mindfulness daily.\n\nPeer S. Interventions:\nDuring the session, we engaged in active listening, shared personal experiences related to anxiety management, provided mutual support in exploring self-esteem issues, and encouraged each other to practice self-care and self-compassion.\n\nPatient R./Content:\nDark T. actively participated in the session, sharing their struggles with anxiety and acknowledging the importance of self-care. They expressed gratitude for the peer support and mentioned feeling more hopeful about incorporating mindfulness into their daily routine to manage anxiety better.\n\nPlan for Next S.:\nIn the next session, we plan to continue focusing on anxiety management and self-esteem building. We will explore additional coping strategies, set specific goals for practicing mindfulness, and reflect on any progress made since our last meeting.		completed	2025-11-06 02:30:55.874606+03	2025-11-06 02:30:55.874606+03	{}	\N
4aae39f8-ad15-4fc7-a1b1-151d17b0b5cf	28c3ef76-53a6-4f26-9330-0820f7c7decb	76c00b5d-8300-4482-934c-53496deed884	2025-11-06	60	\N	Community	Location of Meeting:\nCommunity\n\nFocus of the Meeting:\nThe session primarily focused on self-esteem building, employment readiness, communication skills, and stress reduction techniques as outlined in Sarah L.'s treatment plan, specifically targeting trauma recovery and family relationship improvement.\n\nActivities (time-based breakdown):\n- Opening/check-in period (0-10 min): Sarah shared her current challenges with self-esteem and job search struggles.\n- Main activities (10-50 min): \n   - Self-Esteem B.: Engaged in a peer-led workshop on positive self-talk and self-care practices.\n   - Employment R.: Participated in a job search support group meeting focusing on resume building and interview preparation.\n   - Communication S.: Practiced assertive communication techniques through peer role-playing exercises.\n   - Stress R. Techniques: Led and participated in a mindfulness meditation session for relaxation and stress management.\n- Closing/summary period (50-60 min): Reviewed key takeaways and set goals for the upcoming week.\n\nPeer S. Interventions:\nDuring the session, the following peer support interventions were applied:\n- Self-Esteem B.: Sarah actively participated in the workshop, sharing her struggles with negative self-talk and receiving support from peers who shared similar experiences.\n- Employment R.: Sarah engaged in resume building activities and received feedback from peers, boosting her confidence for future job interviews.\n- Communication S.: Through peer role-playing, Sarah practiced assertive communication, gaining insights from shared experiences and mutual support.\n- Stress R. Techniques: Sarah led a mindfulness meditation session, fostering relaxation and stress management techniques among peers.\n\nPatient R./Content:\nSarah L. actively engaged in the session, sharing her challenges openly and participating in all activities with enthusiasm. She expressed gratitude for the peer support received and mentioned feeling more confident about her job search and communication skills. Sarah actively contributed to the group discussions, showing a willingness to learn and grow.\n\nPlan for Next S.:\nIn the next session, we plan to continue building on the progress made in self-esteem, employment readiness, communication skills, and stress reduction. The focus will be on further enhancing Sarah's confidence, job search strategies, assertive communication, and mindfulness practices to support her trauma recovery and family relationship improvement goals.		completed	2025-11-07 01:19:55.131056+03	2025-11-07 01:19:55.131056+03	{}	\N
b5fff868-c1ec-49d0-bb4e-39c9bae80d65	1e1aad76-7156-4375-9b46-cf6d4789fcd5	76c00b5d-8300-4482-934c-53496deed884	2025-11-06	165	\N	Hospital	Location of Meeting:\nHospital\n\nFocus of the Meeting:\nThe primary focus of the session was on self-esteem building, employment readiness, anxiety management, financial management, anger management, and incorporating board game activities and social groups as suggested for further support. Activities centered around peer support interventions tailored to address these specific objectives.\n\nActivities (time-based breakdown):\n- Opening/check-in period (0-30 min): Jane S. shared her recent experiences and identified her current challenges related to self-esteem, employment, anxiety, finances, and anger, and expressed interest in board game activities and social groups.\n- Main activities aligned with objectives (30-135 min): \n   - Self-esteem building workshop: Peer-led activities focusing on positive self-talk and self-acceptance, incorporating board game activities.\n   - Employment readiness support: Peer assistance with resume building, job search strategies, and discussions on social groups.\n   - Anxiety management session: Peer-led relaxation techniques including deep breathing exercises and exploring board game activities for relaxation.\n   - Financial management group: Shared budgeting tips, financial literacy resources, and discussions on managing finances within social groups.\n   - Anger management circle: Shared coping mechanisms, practiced healthy communication skills, and explored incorporating board games in anger management strategies.\n- Closing/summary period (135-165 min): Summarized key takeaways from each activity, discussed Jane S.'s feelings, insights gained during the session, and plans for integrating board game activities and social groups in future sessions.\n\nPeer S. Interventions:\nDuring the session, the following peer support interventions were applied:\n1. Self-Esteem B.: Engaged J. S. in positive self-talk exercises, encouraged self-acceptance, and introduced board game activities for enhancing self-esteem.\n2. Employment R.: Assisted J. S. with resume building, practiced mock interviews, explored job search strategies within social groups, and discussed the benefits of social interaction in employment readiness.\n3. Anxiety M.: Led J. S. through deep breathing exercises, mindfulness practices, introduced board game activities for relaxation, and discussed the role of social groups in managing anxiety.\n4. Financial M.: Shared budgeting tips, financial literacy resources, discussed financial management within social groups, and explored group dynamics in financial planning.\n5. Anger M.: Facilitated a peer support circle where Jane S. shared coping mechanisms, identified anger triggers, practiced healthy communication skills, and explored using board games in anger management techniques.\n\nPatient R./Content:\nJane S. actively participated in all activities, sharing openly about her struggles, engaging with peers in a supportive manner, and expressing interest in incorporating board game activities and social groups for additional support. She showed enthusiasm in practicing healthy communication skills during the anger management circle and demonstrated a positive attitude towards enhancing her self-esteem and employability skills.\n\nPlan for Next S.:\nIn the next session, the focus will continue to be on self-esteem building, employment readiness, anxiety management, financial management, and anger management, with an emphasis on integrating board game activities and social groups for added peer support. We plan to explore coping strategies for managing anxiety, delve deeper into job search techniques within social groups, reinforce positive self-talk practices, and further build on financial management skills while incorporating social interactions.		completed	2025-11-07 01:21:25.79545+03	2025-11-07 01:22:17.506067+03	{}	\N
0449ee50-a1b7-4852-bc75-43eeaa683db6	a29fb89b-0afe-4d71-b9bc-208dbcbf297f	76c00b5d-8300-4482-934c-53496deed884	2025-11-07	60	\N	Group Home	Location of Meeting:\nGroup H.\n\nFocus of the Meeting:\nThe session focused on self-esteem building and anxiety management.\n\nActivities (time-based breakdown):\n- 0-10 minutes: Opening/check-in period. Dark T. shared feelings of anxiety and low self-esteem.\n- 10-40 minutes: Engaged in social support building through establishing a buddy system for emotional check-ins. Shared experiences of managing anxiety and building self-esteem were discussed.\n- 40-60 minutes: Peer-led group session on anxiety management techniques, including deep breathing exercises and progressive muscle relaxation.\n\nPeer S. Interventions:\n1. Social S. Building:\nWe applied the intervention by pairing Dark T. with another client for daily emotional support check-ins. Dark T. actively participated in sharing experiences and offering support to their buddy. The outcome was increased feelings of connectedness and support.\n\n2. Anxiety M.:\nDuring the peer-led group session, Dark T. engaged in practicing relaxation techniques with peers. They actively shared their experiences with anxiety and found the relaxation exercises helpful in managing their symptoms. The outcome was a sense of empowerment and improved anxiety coping skills.\n\nPatient R./Content:\nDark T. actively engaged in the session, sharing openly about their struggles with anxiety and self-esteem. They expressed gratitude for the peer support received and mentioned feeling more hopeful about managing their anxiety. Dark T. actively participated in all activities and showed enthusiasm for continuing to work on self-improvement.\n\nPlan for Next S.:\nIn the next session, we will continue focusing on self-esteem building and anxiety management. The plan includes exploring additional relaxation techniques and setting personal goals related to self-esteem improvement. Dark T. will be encouraged to share their progress and challenges during the next session.		completed	2025-11-07 23:22:47.472211+03	2025-11-07 23:22:47.472211+03	{"Social Support Building - Establish a buddy system for clients to check in with each other daily for emotional support","Anxiety Management - Peer-led group sessions to share and practice relaxation techniques"}	Long-term Goal 1: Improve overall mental health and well-being\n     Short-term Goal 1: Reduce anxiety symptoms
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, email, password_hash, role, first_name, last_name, is_active, last_login_at, created_at, updated_at) FROM stdin;
0f9f1311-91b7-4e4c-8330-0197264792de	msmith	mary.smith@agency.com	$2a$06$dqaQ0E0y.JCVx7GgPBN5x.s1eWeobevx4BWCga7Q4PZKLKaXxYHZy	peer_support	Mary	Smith	t	\N	2025-09-08 00:03:47.849171+03	2025-09-08 00:03:47.849171+03
73496734-c379-43dd-a796-638f741e3694	bwilson	bob.wilson@agency.com	$2a$06$4.BZE10hmDSYyjdAPRaUZOdi/ia29HC/BWpKGrTr6WcxnKUKVDABy	peer_support	Bob	Wilson	t	\N	2025-09-08 00:03:47.849171+03	2025-09-08 00:03:47.849171+03
3d721fc1-e812-49fa-848e-b5009a264a7c	sjohnson	sarah.johnson@agency.com	$2a$06$uhtcr6115xIJsOWK6U7zYeK/rkzpGrDoHhG/dC0kFWWahGBWM01Ty	peer_support	Sarah	Johnson	t	\N	2025-09-08 00:03:47.849171+03	2025-09-08 00:03:47.849171+03
28224a49-6863-420f-9045-58a433948c9b	jdoe	john.doe@agency.com	$2a$06$4zzthCgUkkWMtunSeD0ZYuCuIVgxFh/dvvA2Xu/z99kJ97Wd9HMpu	peer_support	John	Doe	t	2025-09-14 12:10:32.050657+03	2025-09-08 00:03:47.849171+03	2025-09-14 12:10:32.050657+03
76c00b5d-8300-4482-934c-53496deed884	admin	admin@agency.com	$2a$06$PE2lAeHdL6kGQJIgg8skuu6AjT/dcM/e7dOeKwiDPlmfMdpoyEifa	admin	System	Administrator	t	2025-11-07 23:10:45.167377+03	2025-09-08 00:03:47.849171+03	2025-11-07 23:10:45.167377+03
\.


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: master_session_templates master_session_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.master_session_templates
    ADD CONSTRAINT master_session_templates_pkey PRIMARY KEY (id);


--
-- Name: session_locations session_locations_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session_locations
    ADD CONSTRAINT session_locations_name_key UNIQUE (name);


--
-- Name: session_locations session_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session_locations
    ADD CONSTRAINT session_locations_pkey PRIMARY KEY (id);


--
-- Name: session_notes session_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session_notes
    ADD CONSTRAINT session_notes_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: idx_audit_logs_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree (created_at);


--
-- Name: idx_audit_logs_table_record; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_table_record ON public.audit_logs USING btree (table_name, record_id);


--
-- Name: idx_audit_logs_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_user ON public.audit_logs USING btree (user_id);


--
-- Name: idx_clients_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clients_active ON public.clients USING btree (is_active);


--
-- Name: idx_clients_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clients_created_by ON public.clients USING btree (created_by);


--
-- Name: idx_clients_extracted_interventions; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clients_extracted_interventions ON public.clients USING gin (extracted_interventions);


--
-- Name: idx_clients_gender; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clients_gender ON public.clients USING btree (gender);


--
-- Name: idx_clients_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clients_name ON public.clients USING btree (first_name, last_initial);


--
-- Name: idx_master_session_templates_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_master_session_templates_is_active ON public.master_session_templates USING btree (is_active);


--
-- Name: idx_master_session_templates_sections; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_master_session_templates_sections ON public.master_session_templates USING gin (sections);


--
-- Name: idx_session_notes_client; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_session_notes_client ON public.session_notes USING btree (client_id);


--
-- Name: idx_session_notes_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_session_notes_created ON public.session_notes USING btree (created_at);


--
-- Name: idx_session_notes_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_session_notes_date ON public.session_notes USING btree (session_date);


--
-- Name: idx_session_notes_selected_interventions; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_session_notes_selected_interventions ON public.session_notes USING gin (selected_interventions);


--
-- Name: idx_session_notes_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_session_notes_status ON public.session_notes USING btree (status);


--
-- Name: idx_session_notes_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_session_notes_user ON public.session_notes USING btree (user_id);


--
-- Name: idx_users_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_active ON public.users USING btree (is_active);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_username ON public.users USING btree (username);


--
-- Name: clients update_clients_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: session_notes update_session_notes_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_session_notes_updated_at BEFORE UPDATE ON public.session_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: clients clients_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: session_notes session_notes_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session_notes
    ADD CONSTRAINT session_notes_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: session_notes session_notes_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session_notes
    ADD CONSTRAINT session_notes_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.session_locations(id);


--
-- Name: session_notes session_notes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session_notes
    ADD CONSTRAINT session_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict M0j1EvJlsivs386IJ9rBQpuZe0nBFlaeJx59mpywbcTtivODdxCR3anHnfVAUpi

