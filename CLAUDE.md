# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**AI-powered session notes generator** for peer support agencies. Generates HIPAA-compliant session narratives using OpenAI GPT-4, with PostgreSQL database integration and JWT authentication. Designed for **peer support specialists** (NOT therapists/counselors) with strict compliance filters.

**Tech Stack**: Next.js 15.5.2 (App Router + Turbopack), TypeScript, PostgreSQL 17, Tailwind CSS v4, Docker

## Essential Commands

```bash
# Development
npm run dev                  # Start dev server (Turbopack)
npm run build                # Production build
npm run lint                 # Run ESLint

# Database
npm run db:setup             # Initialize schema
npm run db:reset             # Reset with sample data

# Docker (Production)
npm run docker:up            # Start all services
npm run docker:down          # Stop services
npm run docker:build         # Rebuild containers
```

**Default Login**: `admin` / `admin123`

## Session Note Generation Flow

1. **Select Client** → Treatment plan auto-populates from client profile
2. **Treatment Plan** → Required field (can be edited per session)
3. **Select Interventions** → Choose from AI-extracted interventions (checkboxes)
4. **Generate Note** → AI creates note using treatment plan + selected interventions
5. **Refine (Optional)** → Edit or refine with AI feedback from history page

### Key Components:
- `src/app/api/openai/generate/route.ts` - Note generation
- `src/app/api/openai/refine/route.ts` - Note refinement
- `src/app/api/clients/extract-interventions/route.ts` - AI intervention extraction
- `src/components/forms/SessionNoteForm.tsx` - Session creation form

## Architecture

### Database Layer (`src/lib/database.ts`)
- **Connection Pool**: PostgreSQL with configurable SSL (`DB_SSL` env var)
- **Transaction Wrapper**: `withDatabase()` for automatic connection management
- **Audit Tracking**: `setAuditUser()` for HIPAA audit triggers
- **Modules**: `userDb`, `clientDb`, `sessionDb`, `templateDb`, `lookupDb`

### Authentication
- JWT tokens via `POST /api/auth/login`
- Token validation: `verifyToken()` from `src/lib/auth.ts`
- Session timeout: 15 minutes (HIPAA compliance)

## Key Data Models

### Clients (`clients` table)
```typescript
interface Client {
  id: string;
  firstName: string;
  lastInitial: string;           // HIPAA: only initial stored
  lastName?: string;             // Full name (first name only used in notes)
  gender?: 'male' | 'female';    // For AI pronoun generation
  address?: string;              // Location context (not shown in notes)
  dateOfBirth?: string;
  treatmentPlan?: string;        // Required for note generation
  extractedInterventions?: string[]; // AI-extracted from treatment plan
}
```

### Session Notes (`session_notes` table)
```typescript
interface SessionNote {
  id: string;
  clientId: string;
  userId: string;
  date: Date;
  duration: number;              // in minutes
  location: string;
  generatedNote: string;
  feedback?: string;
  treatmentPlan?: string;        // Session-specific treatment plan
  selectedInterventions?: string[]; // Interventions used in this session
  status?: 'draft' | 'completed' | 'archived';
  createdAt: Date;
}
```

### Master Templates (`master_session_templates` table)
- Controls output format/structure of generated notes
- `sections`: JSONB array of `{name, heading, instructions, isVisible, order}`
- Only one template active at a time (`is_active` flag)
- Managed via Admin Dashboard → Template tab

## API Routes

```
src/app/api/
├── auth/login/                    # JWT authentication
├── clients/                       # Client CRUD
│   ├── [id]/                      # Single client operations
│   └── extract-interventions/     # AI intervention extraction
├── sessions/                      # Session CRUD
│   └── [id]/
│       └── export/                # Export (PDF/DOCX/TXT)
├── admin/
│   ├── users/                     # User management
│   ├── locations/                 # Session locations
│   └── template/                  # Master template management
├── openai/
│   ├── generate/                  # AI note generation
│   └── refine/                    # AI note refinement
├── lookup/                        # Get locations (read-only)
└── health/                        # Health check
```

## Component Structure

```
src/components/
├── forms/
│   └── SessionNoteForm.tsx        # Main session creation form
├── admin/
│   └── TemplateManager.tsx        # Master template editor
├── ui/
│   ├── SessionCard.tsx            # Session display card
│   ├── MultiSelect.tsx            # Multi-select dropdown
│   ├── LoadingSpinner.tsx
│   └── Notification.tsx
└── auth/
    └── LoginForm.tsx
```

## HIPAA Compliance

### Strict Rules:
1. **Names**: Only store `first_name` + `last_initial` (1 char)
2. **Terminology**: Use "peer support specialist" - NEVER "therapist", "therapy", "counselor"
3. **Compliance Filters**: `applyComplianceFilters()` in `src/lib/security.ts`
4. **Audit Logging**: Database triggers log all modifications
5. **Session Timeout**: 15-minute inactivity logout

### Security:
- Parameterized SQL queries (no injection)
- JWT validation on all protected routes
- XSS protection via input sanitization
- `setAuditUser()` for PostgreSQL audit context

## Environment Configuration

### Required
```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=your-secret-key-min-32-chars
OPENAI_API_KEY=sk-proj-...
```

### Recommended
```bash
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_TEMPERATURE=0.85          # Higher = more variety
OPENAI_MAX_TOKENS=2000
SESSION_TIMEOUT_MINUTES=15
DB_SSL=false                      # Set true if PostgreSQL has SSL
ENCRYPTION_KEY=64-char-hex-key
NEXT_PUBLIC_APP_URL=https://your-domain.com
NODE_ENV=production
```

See `.env.production.example` for complete configuration.

## Docker Setup

- **Containers**: PostgreSQL 17 + Next.js app
- **Auto-init**: `database/database.sql` loaded on first startup
- **Network**: `session-notes-network` bridge
- **Volume**: `postgres_data` for persistence

## Development Patterns

### Adding API Endpoint
1. Create `route.ts` in `src/app/api/` subdirectory
2. Export `GET`, `POST`, `PUT`, `DELETE` functions
3. Validate JWT with `verifyToken()`
4. Use `withDatabase()` for DB operations
5. Call `setAuditUser()` before data modifications
6. Return `Response.json()` with status codes

### Adding Database Operation
1. Add function to module in `src/lib/database.ts`
2. Use `withDatabase()` wrapper
3. Use parameterized queries: `$1`, `$2`, etc.
4. Call `setAuditUser()` for write operations

## Path Aliases

- `@/*` → `src/*` (configured in `tsconfig.json`)
- Example: `import { sessionDb } from '@/lib/database'`

## Important Notes

- **Treatment Plan is required** for session note generation
- **Interventions are extracted** from treatment plan via AI, then selected per session
- **Master Template** controls note output structure (managed in admin)
- **Gender field** is used for AI pronoun generation (he/she)
- **Client's Home** location option uses address for context (address not shown in notes)
- **Refine feature** in history page allows AI-powered note improvements
- **Always use peer support terminology** in AI prompts and outputs
