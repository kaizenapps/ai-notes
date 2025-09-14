# Session Notes Generator

AI-powered session note generator for peer support agencies that automates documentation and compliance. The application generates HIPAA-compliant session narratives based on treatment plans and selected objectives, with full database integration and file export capabilities.

## ✅ Complete Features

### 🔐 Authentication & Security
- **JWT Authentication**: Secure token-based authentication
- **HIPAA Compliance**: Built-in privacy protections and data encryption
- **Session Timeout**: Automatic logout after 15 minutes of inactivity
- **Compliance Filters**: Automatically removes non-compliant terminology
- **Data Encryption**: AES-256-CBC encryption for sensitive data

### 🤖 AI Integration
- **OpenAI GPT-4**: Professional session note generation
- **Mock Fallback**: Works without API key using demo responses
- **Peer Support Focus**: Specifically designed for peer support specialists
- **Customizable Prompts**: Tailored for billing compliance

### 💾 Database Integration
- **PostgreSQL**: Full database integration with connection pooling
- **CRUD Operations**: Complete session and client management
- **Audit Logging**: HIPAA-compliant audit trails
- **Data Relationships**: Proper foreign key relationships and constraints

### 🌐 User Interface
- **Dashboard**: Main application interface
- **Session History**: View and manage previous sessions
- **Multi-Select Interface**: Easy selection of objectives and interventions
- **Responsive Design**: Works on all device sizes
- **Loading States**: Proper loading and error handling

### 📄 File Export (Cloudflare R2)
- **Multiple Formats**: Export to PDF, DOCX, and TXT
- **Cloud Storage**: Cloudflare R2 integration for file storage
- **Encryption Option**: Optional file encryption
- **Secure URLs**: Time-limited download links
- **Bulk Export**: Export multiple sessions at once

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: PostgreSQL with connection pooling
- **Authentication**: JWT-based authentication
- **AI Integration**: OpenAI GPT-4
- **File Storage**: Cloudflare R2
- **Encryption**: Node.js crypto module

## Getting Started

### 1. Prerequisites
- Node.js 18+ 
- PostgreSQL 12+
- Cloudflare R2 account (optional, for file exports)
- OpenAI API key (optional, uses mock data without it)

### 2. Clone and Install
```bash
git clone <repository-url>
cd session-notes-app
npm install
```

### 3. Database Setup
```bash
# Set up PostgreSQL database
npm run db:setup

# Or with sample data
npm run db:setup-with-data
```

### 4. Environment Configuration
```bash
cp .env.example .env.local
```

Update `.env.local` with your values:

#### Required Variables
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/session_notes_db

# Authentication
JWT_SECRET=your-super-secure-jwt-secret-key

# Encryption (64-character hex key)
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

#### Optional Variables
```env
# OpenAI (uses mock data if not provided)
OPENAI_API_KEY=your-openai-api-key-here

# Cloudflare R2 (for file exports)
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=session-notes-exports
R2_PUBLIC_URL=https://your-r2-public-url.com
```

### 5. Run the Application
```bash
npm run dev
```

Navigate to [http://localhost:3000](http://localhost:3000)

## Demo Credentials

- **Username**: admin
- **Password**: admin123

## Complete Project Structure

```
src/
├── app/                    # Next.js app router
│   ├── api/               # API routes
│   │   ├── auth/login/    # Authentication
│   │   ├── clients/       # Client management
│   │   ├── sessions/      # Session CRUD + exports
│   │   ├── lookup/        # Lookup data (locations, objectives)
│   │   └── openai/        # AI generation
│   ├── dashboard/         # Main application
│   │   └── history/       # Session history page
│   ├── layout.tsx         # Root layout
│   └── page.tsx          # Login page (redirects to dashboard)
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   ├── forms/            # Form components
│   └── auth/             # Authentication components
├── lib/                  # Core utilities
│   ├── database.ts       # PostgreSQL operations
│   ├── storage.ts        # Cloudflare R2 integration
│   ├── security.ts       # Encryption & compliance
│   ├── api.ts           # API client functions
│   ├── auth.ts          # JWT utilities
│   └── openai.ts        # OpenAI integration
├── hooks/                # Custom React hooks
├── types/                # TypeScript definitions
└── context/              # React context providers
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login

### Clients
- `GET /api/clients` - List all clients
- `POST /api/clients` - Create new client
- `GET /api/clients/[id]` - Get client details
- `PUT /api/clients/[id]` - Update client

### Sessions
- `GET /api/sessions` - List user sessions
- `POST /api/sessions` - Create new session
- `GET /api/sessions/[id]` - Get session details
- `POST /api/sessions/[id]/export` - Export session

### Lookup Data
- `GET /api/lookup` - Get locations, objectives, interventions

### AI Generation
- `POST /api/openai/generate` - Generate session note

## Database Schema

The application uses a comprehensive PostgreSQL schema with:

- **Users**: Authentication and role management
- **Clients**: HIPAA-compliant client records (first name + last initial only)
- **Session Notes**: Generated notes with metadata
- **Objectives & Interventions**: Lookup tables for session components
- **Audit Logs**: HIPAA compliance audit trails
- **Triggers**: Automatic audit logging and timestamp updates

## HIPAA Compliance Features

### ✅ Implemented
- **Session Timeout**: 15-minute automatic logout
- **Data Encryption**: AES-256-CBC for sensitive data
- **Minimal Data Storage**: Only first name + last initial
- **Compliance Filters**: Remove therapist terminology
- **Audit Logging**: Database-level audit triggers
- **Secure Authentication**: JWT with proper expiration
- **Role-Based Access**: User role management

### 🔒 Security Measures
- **SQL Injection Protection**: Parameterized queries
- **XSS Protection**: Proper input sanitization
- **CSRF Protection**: SameSite cookies and CSRF tokens
- **File Upload Security**: Secure file handling with R2
- **Environment Isolation**: Separate dev/prod configurations

## File Export System

### Supported Formats
- **PDF**: HTML-based PDF generation
- **DOCX**: XML format for Word documents  
- **TXT**: Plain text format

### Export Features
- **Metadata Inclusion**: Optional session metadata
- **Encryption**: Optional file encryption
- **Cloud Storage**: Automatic upload to Cloudflare R2
- **Secure Downloads**: Time-limited signed URLs
- **Bulk Operations**: Export multiple sessions

## Development Commands

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
npm run db:setup         # Set up database schema
npm run db:setup-with-data # Set up with sample data
npm run db:reset         # Reset database with sample data
```

## Production Deployment

### Environment Setup
1. Set up PostgreSQL database
2. Configure Cloudflare R2 bucket
3. Set all required environment variables
4. Run database migrations

### Build and Deploy
```bash
npm run build
npm run start
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting (`npm run lint`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please create an issue in the GitHub repository or contact the development team.