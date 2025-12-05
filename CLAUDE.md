# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **AI-powered session notes generator** for peer support agencies. It generates HIPAA-compliant session narratives using OpenAI GPT-4, with full PostgreSQL database integration and JWT authentication. The application is specifically designed for peer support specialists (NOT therapists/counselors) and includes strict compliance filters.

**Tech Stack**: Next.js 15.5.2 (App Router), TypeScript, PostgreSQL 17, Tailwind CSS v4, Docker

## Essential Development Commands

```bash
# Development
npm run dev              # Start dev server with Turbopack
npm run build            # Production build with Turbopack
npm run start            # Start production server
npm run lint             # Run ESLint

# Database Setup (requires PostgreSQL running)
npm run db:setup         # Initialize database schema
npm run db:setup-with-data # Initialize with sample data
npm run db:reset         # Reset database with sample data

# Docker Deployment (Recommended)
npm run docker:up        # Start PostgreSQL + Next.js app
npm run docker:down      # Stop all Docker services
npm run docker:logs      # View container logs
npm run docker:build     # Rebuild and restart containers
```

**Default Login**: username: `admin`, password: `admin123` (created by db setup scripts)

## Architecture Overview

### Database Layer (`src/lib/database.ts`)

- **Connection Pool**: PostgreSQL with configurable SSL (controlled by `DB_SSL` env var - disabled by default for Docker)
- **Transaction Wrapper**: `withDatabase()` provides automatic connection management
- **Audit Tracking**: `setAuditUser()` sets `app.current_user_id` for HIPAA audit triggers
- **Database Modules**: Organized as object exports (e.g., `userDb`, `clientDb`, `sessionDb`, `templateDb`)

### Authentication Flow

1. Login via `POST /api/auth/login` returns JWT token
2. JWT stored in cookies and validated via middleware
3. Token contains `userId`, validated with `verifyToken()` from `src/lib/auth.ts`
4. Session timeout: 15 minutes (configurable via `SESSION_TIMEOUT_MINUTES`)

### AI Session Note Generation Flow

1. **User Input**: Client selection, location, duration, objectives, optional feedback
2. **Data Enrichment**:
   - Client's pre-selected objectives loaded from `clients.objectives_selected` (JSONB array)
   - Treatment plan parsed for interventions (if available)
3. **Template Loading**: Active master template fetched from `master_session_templates` table
4. **Prompt Generation**: `buildPrompt()` in `src/app/api/openai/generate/route.ts` constructs structured prompt with:
   - System role: "professional peer support specialist" (never clinical/therapeutic)
   - Template sections with specific instructions
   - Session data (objectives, duration, location, feedback)
5. **OpenAI Call**: GPT-4 generates note following template structure
6. **Compliance Filtering**: `applyComplianceFilters()` removes clinical terms and full names
7. **Storage**: Note saved to `session_notes` table with all metadata

### Key Data Models

**Clients** (`clients` table):
- HIPAA-compliant: stores only `first_name` + `last_initial` (never full last names)
- `objectives_selected`: JSONB array of pre-selected objective IDs
- `extracted_interventions`: Array of AI-extracted interventions from treatment plan
- `treatment_plan`: Text field for treatment plan document

**Session Notes** (`session_notes` table):
- Stores generated notes with metadata (duration, location, status)
- Foreign keys to user, client, location
- Many-to-many relationship with objectives via `session_objectives` junction table
- `treatment_plan` field: session-specific treatment plan (independent of client's treatment plan)
- `selected_interventions`: array of interventions selected for this specific session

**Templates** (`master_session_templates` table):
- Stores note generation templates with multiple sections
- `sections`: JSONB array of `{name, instructions, placeholder}` objects
- Only one template can be active at a time (`is_active` flag)

### API Route Organization

```
src/app/api/
├── auth/login/          # JWT authentication
├── clients/             # CRUD for clients
├── sessions/            # CRUD + export (PDF/DOCX/TXT)
├── admin/
│   ├── users/          # User management (admin only)
│   ├── objectives/     # Treatment objectives CRUD
│   ├── locations/      # Session locations CRUD
│   └── template/       # Master template management
├── lookup/             # Get locations, objectives, clients (read-only)
├── openai/generate/    # AI note generation
└── health/             # Health check endpoint
```

### Component Structure

- **`src/components/forms/`**: Form components for session creation, client management
- **`src/components/admin/`**: Admin-specific components (user/objective/location management)
- **`src/components/ui/`**: Reusable UI components (modals, toasts, loading states)
- **`src/components/auth/`**: Login and auth-related components

### Important Type Definitions (`src/types/index.ts`)

- `User`: id, username, role ('peer_support' | 'admin')
- `Client`: id, firstName, lastInitial, treatmentPlan, objectivesSelected, extractedInterventions
- `SessionNote`: Full session metadata including generatedNote, objectives, status
- `MasterSessionTemplate`: id, title, sections (array), description, is_active

## HIPAA Compliance Requirements

### Strict Rules - NEVER Violate These:

1. **Name Storage**: Only store `first_name` + `last_initial` (1 character) in database
2. **Terminology**: Use "peer support specialist" language - NEVER "therapist", "therapy", "counselor", "psychologist"
3. **Compliance Filters**: `applyComplianceFilters()` in `src/lib/security.ts` automatically replaces clinical terms
4. **Full Name Pattern**: Any full names in generated text are auto-converted to "FirstName L." format
5. **Audit Logging**: Database triggers automatically log all data modifications to `audit_logs` table
6. **Session Timeout**: 15-minute inactivity logout enforced client-side

### Security Measures in Code:

- **SQL Injection**: All queries use parameterized statements
- **JWT Validation**: All API routes validate JWT tokens (except `/api/auth/login`)
- **XSS Protection**: Input sanitization on all user inputs
- **Audit User Context**: `setAuditUser()` sets PostgreSQL session variable for audit triggers

## Environment Configuration

**Required Variables**:
- `DATABASE_URL`: PostgreSQL connection string (format: `postgresql://user:pass@host:port/dbname`)
- `JWT_SECRET`: Secret key for JWT signing (change in production!)
- `OPENAI_API_KEY`: OpenAI API key for note generation

**Optional Variables**:
- `DB_SSL`: Set to `"true"` to enable SSL for PostgreSQL (default: false for Docker)
- `OPENAI_MODEL`: Model name (default: "gpt-4-turbo-preview")
- `OPENAI_TEMPERATURE`: 0.0-1.0 (default: "0.7")
- `OPENAI_MAX_TOKENS`: Token limit (default: "2000")
- `SESSION_TIMEOUT_MINUTES`: Inactivity timeout (default: 15)

## Database Schema Key Points

- **UUID Primary Keys**: All tables use `uuid_generate_v4()` for IDs
- **Soft Deletes**: `is_active` boolean flags instead of hard deletes
- **JSONB Fields**: Used for flexible data (objectives_selected, template sections)
- **Audit Triggers**: Automatic logging triggers on users, clients, session_notes tables
- **Indexes**: GIN indexes on JSONB columns for efficient querying

### Master Template System

Templates stored in `master_session_templates` table define note structure:
- Only one template can be `is_active` at a time
- Templates have multiple `sections` (JSONB array)
- Each section has: `name`, `instructions` (for AI), `placeholder` (for UI)
- Retrieved via `templateDb.findActive()` when generating notes

## Path Aliases

- `@/*` maps to `src/*` (configured in `tsconfig.json`)
- Example: `import { userDb } from '@/lib/database'`

## Docker Setup Notes

- **Two containers**: PostgreSQL (postgres:17-alpine) + Next.js app
- **Database auto-init**: `database/database.sql` loaded on first PostgreSQL startup
- **Network**: `session-notes-network` bridge network for inter-container communication
- **Volumes**: `postgres_data` for persistent storage
- **Default DB credentials in docker-compose.yml**:
  - User: `session_user`
  - Password: `session_password_123`
  - Database: `session_notes`
  - Connection string: `postgresql://session_user:session_password_123@postgres:5432/session_notes`

## Common Development Patterns

### Adding a New API Endpoint

1. Create `route.ts` in appropriate `src/app/api/` subdirectory
2. Export `GET`, `POST`, `PUT`, `DELETE` as async functions
3. Validate JWT token using `verifyToken()`
4. Use `withDatabase()` wrapper for database operations
5. Call `setAuditUser()` for operations that modify data
6. Return `Response.json()` with appropriate status codes

### Adding a New Database Operation

1. Add function to appropriate module in `src/lib/database.ts` (e.g., `userDb`, `clientDb`)
2. Use `withDatabase()` wrapper for connection management
3. Use parameterized queries: `client.query('SELECT ... WHERE id = $1', [id])`
4. Call `setAuditUser()` before INSERT/UPDATE/DELETE operations
5. Export function for use in API routes

### Working with Sessions

- Session notes can be in status: 'draft', 'completed', or 'archived'
- Deleting a session sets `is_archived = true` (soft delete)
- Export functionality generates PDF/DOCX/TXT via `/api/sessions/[id]/export?format=pdf`
- Sessions have both direct fields (location, duration) and relationships (objectives via junction table)

## Testing Approach

No automated test suite currently exists. Manual testing workflow:

1. Start app: `npm run docker:up` or `npm run dev`
2. Login with default admin credentials
3. Create test client with objectives
4. Generate session note and verify compliance filters
5. Test export in all formats (PDF, DOCX, TXT)
6. Test admin CRUD operations for users/objectives/locations

## Important Notes for AI Code Generation

- **Always use peer support terminology** - never suggest "therapist" or clinical terms
- **Treatment plans are dual-purpose**: stored on `clients` table AND optionally on individual session
- **Objectives selection is two-stage**:
  1. Client profile has pre-selected objectives (`clients.objectives_selected`)
  2. User can add/remove objectives when creating session
- **Template system is dynamic**: Don't hardcode note structure - always fetch active template
- **Database connection SSL**: Default is disabled for Docker compatibility - only enable if server supports it