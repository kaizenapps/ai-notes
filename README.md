# Session Notes Generator

AI-powered session note generator for peer support agencies that automates documentation and compliance. The application generates HIPAA-compliant session narratives based on treatment plans and selected objectives, with full database integration and file export capabilities.

## 🚀 Features

### 🔐 Authentication & Security
- **JWT Authentication**: Secure token-based authentication
- **HIPAA Compliance**: Built-in privacy protections and data encryption
- **Session Timeout**: Automatic logout after 15 minutes of inactivity
- **Compliance Filters**: Automatically removes non-compliant terminology
- **Data Encryption**: AES-256-CBC encryption for sensitive data
- **Custom UI Components**: Beautiful confirmation dialogs and toast notifications

### 🤖 AI Integration
- **OpenAI GPT-4**: Professional session note generation
- **Treatment Plan Integration**: Auto-extracts interventions from client treatment plans
- **Dynamic Objectives**: Auto-populates objectives based on client profile
- **Peer Support Focus**: Specifically designed for peer support specialists
- **Customizable Prompts**: Tailored for billing compliance

### 💾 Database Integration
- **PostgreSQL**: Full database integration with connection pooling
- **CRUD Operations**: Complete session and client management
- **Audit Logging**: HIPAA-compliant audit trails
- **Data Relationships**: Proper foreign key relationships and constraints
- **JSONB Support**: Flexible storage for objectives and metadata

### 🌐 User Interface
- **Dashboard**: Main application interface with session note generation
- **Session History**: View, edit, and manage previous sessions
- **Admin Dashboard**: Comprehensive management for users, clients, objectives, and locations
- **Multi-Select Interface**: Easy selection of objectives
- **Responsive Design**: Works on all device sizes
- **Loading States**: Proper loading and error handling
- **Modern UI**: Clean, professional design with Tailwind CSS v4

### 📄 File Export
- **Multiple Formats**: Export to PDF, DOCX, and TXT
- **Session Metadata**: Optional metadata inclusion
- **Secure Downloads**: Direct download from browser

## 🛠️ Tech Stack

- **Framework**: Next.js 15.5.2 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: PostgreSQL 17
- **Authentication**: JWT-based authentication
- **AI Integration**: OpenAI GPT-4
- **Containerization**: Docker & Docker Compose

## 📋 Prerequisites

- **Node.js**: 18+ (for local development)
- **PostgreSQL**: 12+ (for local development)
- **Docker**: 20.10+ and Docker Compose 2.0+ (for Docker deployment)
- **OpenAI API Key**: (optional, but recommended for production)

## 🚀 Quick Start

### Option 1: Docker Deployment (Recommended)

The easiest way to get started is using Docker Compose:

#### 1. Clone the Repository
```bash
git clone <repository-url>
cd session-notes-app
```

#### 2. Set Up Environment Variables
```bash
cp .env.example .env.local
```

Edit `.env.local` and set your `OPENAI_API_KEY`:
```env
OPENAI_API_KEY=your-openai-api-key-here
```

#### 3. Start with Docker Compose
```bash
# Build and start all services
npm run docker:up

# Or manually:
docker-compose up -d --build
```

This will:
- Start PostgreSQL database container
- Initialize the database schema
- Build and start the Next.js application
- Set up networking between services

#### 4. Access the Application
- **Application**: http://localhost:3000
- **Database**: localhost:5432 (internal Docker network)

#### 5. View Logs
```bash
npm run docker:logs

# Or manually:
docker-compose logs -f
```

#### 6. Stop Services
```bash
npm run docker:down

# Or manually:
docker-compose down
```

#### 7. Rebuild After Changes
```bash
npm run docker:build

# Or manually:
docker-compose up -d --build
```

### Option 2: Local Development

#### 1. Clone and Install
```bash
git clone <repository-url>
cd session-notes-app
npm install
```

#### 2. Set Up PostgreSQL Database

**Option A: Using Docker (PostgreSQL only)**
```bash
docker run -d \
  --name session-notes-db \
  -e POSTGRES_DB=session_notes_db \
  -e POSTGRES_USER=session_notes_user \
  -e POSTGRES_PASSWORD=your_secure_password \
  -p 5432:5432 \
  postgres:17-alpine
```

**Option B: Local PostgreSQL Installation**
- Install PostgreSQL 12+ on your system
- Create database: `createdb session_notes_db`
- Create user: `createuser session_notes_user`

#### 3. Initialize Database Schema
```bash
# Set up database schema
npm run db:setup

# Or with sample data
npm run db:setup-with-data
```

If running manually:
```bash
psql -U session_notes_user -d session_notes_db -f database/database.sql
```

#### 4. Environment Configuration
```bash
cp .env.example .env.local
```

Update `.env.local` with your values:

**Required Variables:**
```env
# Database Connection
DATABASE_URL=postgresql://session_notes_user:your_secure_password@localhost:5432/session_notes_db

# Or individual variables:
DB_HOST=localhost
DB_PORT=5432
DB_NAME=session_notes_db
DB_USER=session_notes_user
DB_PASSWORD=your_secure_password

# Authentication
JWT_SECRET=your-super-secure-jwt-secret-key-change-this-in-production

# OpenAI (required for note generation)
OPENAI_API_KEY=your-openai-api-key-here
```

**Optional Variables:**
```env
# Session Configuration
SESSION_TIMEOUT_MINUTES=15

# Application Settings
NODE_ENV=development
PORT=3000
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

#### 5. Run the Application
```bash
# Development mode
npm run dev

# Production build
npm run build
npm run start
```

Navigate to [http://localhost:3000](http://localhost:3000)

## 🔑 Default Credentials

After initial database setup, you can log in with:
- **Username**: `admin`
- **Password**: `admin123`

**⚠️ Important**: Change the default admin password immediately in production!

## 🐳 Docker Configuration

### Docker Compose Services

The `docker-compose.yml` file includes:

1. **PostgreSQL Database** (`postgres`)
   - Image: `postgres:17-alpine`
   - Port: 5432 (internal)
   - Volume: Persistent data storage
   - Auto-initialization: Database schema loaded on first run

2. **Next.js Application** (`app`)
   - Built from Dockerfile
   - Port: 3000 (exposed to host)
   - Health checks included
   - Depends on PostgreSQL

### Docker Volumes

- `postgres_data`: Persistent PostgreSQL data storage

### Docker Networks

- `session-notes-network`: Internal bridge network for service communication

### Environment Variables in Docker

The Docker Compose file uses these default values (override in `.env.local`):
```env
DATABASE_URL=postgresql://session_user:session_password_123@postgres:5432/session_notes
JWT_SECRET=s3ssion-notes-super-secret-jwt-key-9a7f4c2d8b1e
```

**⚠️ Change these default values for production!**

### Customizing Docker Configuration

To override Docker Compose settings, create a `.env` file:
```env
OPENAI_API_KEY=your-key-here
JWT_SECRET=your-secret-here
POSTGRES_PASSWORD=your-password-here
```

## 📁 Project Structure

```
session-notes-app/
├── src/
│   ├── app/                    # Next.js app router
│   │   ├── api/               # API routes
│   │   │   ├── auth/         # Authentication endpoints
│   │   │   ├── clients/       # Client management
│   │   │   ├── sessions/     # Session CRUD + exports
│   │   │   ├── admin/        # Admin endpoints
│   │   │   ├── lookup/       # Lookup data
│   │   │   └── openai/        # AI generation
│   │   ├── dashboard/         # Main application
│   │   │   ├── admin/        # Admin dashboard
│   │   │   └── history/      # Session history
│   │   ├── layout.tsx        # Root layout
│   │   └── page.tsx          # Login page
│   ├── components/            # React components
│   │   ├── ui/               # Reusable UI components
│   │   ├── forms/            # Form components
│   │   ├── admin/            # Admin components
│   │   └── auth/             # Authentication components
│   ├── lib/                  # Core utilities
│   │   ├── database.ts       # PostgreSQL operations
│   │   ├── security.ts       # Encryption & compliance
│   │   ├── api.ts           # API client functions
│   │   ├── auth.ts           # JWT utilities
│   │   ├── openai.ts         # OpenAI integration
│   │   └── treatmentPlanParser.ts  # Treatment plan parsing
│   ├── hooks/                # Custom React hooks
│   ├── types/                # TypeScript definitions
│   └── context/              # React context providers
├── database/
│   ├── database.sql          # Main database schema
│   └── migration.js          # Database migration script
├── docker-compose.yml        # Docker Compose configuration
├── Dockerfile                # Docker image definition
├── .env.example              # Environment variables template
└── package.json              # Dependencies and scripts
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - User login

### Clients
- `GET /api/clients` - List all clients
- `POST /api/clients` - Create new client
- `GET /api/clients/[id]` - Get client details
- `PUT /api/clients/[id]` - Update client
- `DELETE /api/clients/[id]` - Delete client

### Sessions
- `GET /api/sessions` - List user sessions (with pagination)
- `POST /api/sessions` - Create new session
- `GET /api/sessions/[id]` - Get session details
- `PUT /api/sessions/[id]` - Update session
- `DELETE /api/sessions/[id]` - Archive session
- `GET /api/sessions/[id]/export` - Export session (PDF/DOCX/TXT)

### Admin
- `GET /api/admin/users` - List all users
- `POST /api/admin/users` - Create user
- `PUT /api/admin/users/[id]` - Update user
- `DELETE /api/admin/users/[id]` - Delete user
- `POST /api/admin/users/[id]/reset-password` - Reset user password
- `GET /api/admin/objectives` - List objectives
- `POST /api/admin/objectives` - Create objective
- `PUT /api/admin/objectives/[id]` - Update objective
- `DELETE /api/admin/objectives/[id]` - Delete objective
- Similar endpoints for `locations`

### Lookup Data
- `GET /api/lookup` - Get locations, objectives, clients

### AI Generation
- `POST /api/openai/generate` - Generate session note

### Health Check
- `GET /api/health` - Application health status

## 🗄️ Database Schema

The application uses a comprehensive PostgreSQL schema with:

- **users**: Authentication and role management
- **clients**: HIPAA-compliant client records (first name + last initial only)
  - `objectives_selected`: JSONB array of selected objective IDs
  - `treatment_plan`: Text field for treatment plan
- **session_notes**: Generated notes with metadata
- **session_objectives**: Junction table for session objectives
- **treatment_objectives**: Lookup table for objectives
- **session_locations**: Lookup table for session locations
- **audit_logs**: HIPAA compliance audit trails
- **Triggers**: Automatic audit logging and timestamp updates

## 🔒 HIPAA Compliance Features

### ✅ Implemented
- **Session Timeout**: 15-minute automatic logout
- **Data Encryption**: AES-256-CBC for sensitive data
- **Minimal Data Storage**: Only first name + last initial
- **Compliance Filters**: Remove clinical/therapeutic terminology
- **Audit Logging**: Database-level audit triggers
- **Secure Authentication**: JWT with proper expiration
- **Role-Based Access**: User role management (admin/peer_support)
- **Data Retention**: Archive functionality for soft deletes

### 🔒 Security Measures
- **SQL Injection Protection**: Parameterized queries
- **XSS Protection**: Proper input sanitization
- **CSRF Protection**: SameSite cookies and CSRF tokens
- **Environment Isolation**: Separate dev/prod configurations
- **Secure Headers**: Next.js security headers

## 📝 Development Commands

```bash
# Development
npm run dev              # Start development server with Turbopack
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint

# Database
npm run db:setup         # Set up database schema
npm run db:setup-with-data # Set up with sample data
npm run db:reset         # Reset database with sample data

# Docker
npm run docker:up        # Start Docker services
npm run docker:down      # Stop Docker services
npm run docker:logs      # View Docker logs
npm run docker:build     # Rebuild and restart services
```

## 🚢 Production Deployment

### Using Docker (Recommended)

1. **Set Production Environment Variables**
   ```bash
   # Create .env.production
   OPENAI_API_KEY=your-production-key
   JWT_SECRET=your-production-secret
   POSTGRES_PASSWORD=your-secure-password
   ```

2. **Update docker-compose.yml**
   - Change default passwords
   - Update JWT_SECRET
   - Set production database credentials

3. **Build and Deploy**
   ```bash
   docker-compose -f docker-compose.yml up -d --build
   ```

4. **Set Up Reverse Proxy** (Optional)
   - Use Nginx or Traefik for SSL termination
   - Configure domain name and SSL certificates

### Using Traditional Deployment

1. **Set up PostgreSQL database** on your server
2. **Run database migrations**:
   ```bash
   npm run db:setup
   ```
3. **Build the application**:
   ```bash
   npm run build
   ```
4. **Start production server**:
   ```bash
   npm run start
   ```
5. **Use a process manager** like PM2:
   ```bash
   npm install -g pm2
   pm2 start npm --name "session-notes" -- start
   ```

### Production Checklist

- [ ] Change default admin password
- [ ] Set strong JWT_SECRET
- [ ] Set secure database password
- [ ] Configure OpenAI API key
- [ ] Set NODE_ENV=production
- [ ] Enable HTTPS/SSL
- [ ] Set up database backups
- [ ] Configure firewall rules
- [ ] Set up monitoring/logging
- [ ] Review and update security settings

## 🧪 Testing

### Manual Testing Steps

1. **Login**: Test with default admin credentials
2. **Create Client**: Add a new client with objectives
3. **Generate Session Note**: Create a session and generate note
4. **Export Session**: Test PDF, DOCX, and TXT exports
5. **Admin Dashboard**: Test user, client, objective, and location management
6. **Session History**: View, edit, and archive sessions

## 🐛 Troubleshooting

### Docker Issues

**Database not connecting:**
- Check if PostgreSQL container is running: `docker ps`
- Verify DATABASE_URL in docker-compose.yml
- Check database logs: `docker-compose logs postgres`

**Application won't start:**
- Check application logs: `docker-compose logs app`
- Verify environment variables are set
- Ensure database is healthy before app starts

**Port already in use:**
- Change port in docker-compose.yml:
  ```yaml
  ports:
    - "3001:3000"  # Use port 3001 instead
  ```

### Local Development Issues

**Database connection errors:**
- Verify PostgreSQL is running: `pg_isready`
- Check DATABASE_URL format
- Ensure database and user exist

**Build errors:**
- Clear Next.js cache: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check Node.js version: `node --version` (should be 18+)

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Docker Documentation](https://docs.docker.com/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting (`npm run lint`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 💬 Support

For support, please create an issue in the GitHub repository or contact the development team.

---

**Made with ❤️ for peer support agencies**
