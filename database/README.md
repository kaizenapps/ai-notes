# Database Schema for Session Notes Generator

This directory contains the complete database schema and setup files for the HIPAA-compliant Session Notes Generator application.

## 📋 Overview

The database is designed for PostgreSQL and includes:
- **HIPAA-compliant** data storage with audit trails
- **Role-based access control** for users
- **Flexible session note generation** with customizable objectives and interventions
- **Billing compliance** tracking and status management
- **Performance optimized** with proper indexes

## 🗄️ Database Structure

### Core Tables

| Table | Purpose | Key Features |
|-------|---------|--------------|
| `users` | Staff authentication & roles | Encrypted passwords, role-based access |
| `clients` | Client information | HIPAA-compliant (first name + last initial only) |
| `session_notes` | Generated session notes | AI-generated content, billing status |
| `session_locations` | Session location options | Predefined + custom locations |
| `treatment_objectives` | Available treatment goals | Categorized objectives library |
| `interventions` | Peer support interventions | Categorized interventions library |

### Junction Tables

| Table | Purpose |
|-------|---------|
| `session_objectives` | Links sessions to treatment objectives |
| `session_interventions` | Links sessions to interventions used |

### Compliance & Audit

| Table | Purpose |
|-------|---------|
| `audit_logs` | HIPAA compliance audit trail |
| `session_templates` | Reusable session templates |

## 🚀 Quick Setup

### Prerequisites

1. **PostgreSQL 12+** installed and running
2. **Node.js 18+** for migration scripts
3. **pg** npm package: `npm install pg`

### Step 1: Create Database

```bash
# Connect to PostgreSQL as superuser
psql -U postgres

# Run setup script
\i database/setup.sql
```

### Step 2: Run Schema Migration

```bash
# Install dependencies
npm install pg

# Run migration (schema only)
node database/migration.js

# Run migration with sample data
node database/migration.js --sample-data
```

### Step 3: Configure Environment

```bash
# Copy environment template
cp .env.example .env.local

# Edit .env.local with your database credentials
```

## 📊 Sample Data

The `sample_data.sql` file includes:
- **5 sample users** (1 admin, 4 peer support staff)
- **8 sample clients** with HIPAA-compliant data
- **7 session locations** (common meeting places)
- **20 treatment objectives** (categorized goals)
- **20 peer interventions** (categorized techniques)
- **3 sample session notes** with realistic content
- **4 session templates** for common session types

### Default Login Credentials

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | admin |
| jdoe | password123 | peer_support |
| msmith | password123 | peer_support |
| bwilson | password123 | peer_support |
| sjohnson | password123 | peer_support |

⚠️ **Change these passwords in production!**

## 🔐 Security Features

### HIPAA Compliance
- **Minimal PHI storage** (first name + last initial only)
- **Audit logging** for all data access and changes
- **Data encryption** support via application layer
- **Role-based access control**

### Database Security
- **Separate application user** with limited privileges
- **Read-only user** for reporting/analytics
- **Password hashing** using bcrypt
- **SQL injection protection** via parameterized queries

## 🏗️ Schema Details

### User Roles
- `peer_support`: Can create and manage session notes
- `admin`: Full system access and user management

### Session Status Flow
```
draft → completed → billed → archived
```

### Data Relationships
```
users (1) ←→ (M) session_notes (M) ←→ (1) clients
session_notes (1) ←→ (M) session_objectives (M) ←→ (1) treatment_objectives
session_notes (1) ←→ (M) session_interventions (M) ←→ (1) interventions
```

## 📈 Performance Optimizations

### Indexes Created
- User authentication (username, email)
- Client lookups (name, active status)
- Session queries (client, user, date, status)
- Audit trail (user, table, date)
- Billing reports (billing_code, billed_at)

### Automatic Triggers
- **Updated timestamps** on record changes
- **Audit logging** for compliance tracking
- **Data validation** constraints

## 🔧 Maintenance

### Regular Tasks
```sql
-- Update table statistics
ANALYZE;

-- Check database size
SELECT pg_size_pretty(pg_database_size('session_notes_db'));

-- Monitor audit log size
SELECT COUNT(*) FROM audit_logs WHERE created_at > NOW() - INTERVAL '30 days';

-- Clean old audit logs (optional)
DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '7 years';
```

### Backup Strategy
```bash
# Daily backup
pg_dump -U session_notes_user session_notes_db > backup_$(date +%Y%m%d).sql

# Restore from backup
psql -U session_notes_user session_notes_db < backup_20241207.sql
```

## 🧪 Testing Queries

### Verify Setup
```sql
-- Check all tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' ORDER BY table_name;

-- Count records in each table
SELECT 
  (SELECT COUNT(*) FROM users) as users,
  (SELECT COUNT(*) FROM clients) as clients,
  (SELECT COUNT(*) FROM session_notes) as session_notes,
  (SELECT COUNT(*) FROM treatment_objectives) as objectives,
  (SELECT COUNT(*) FROM interventions) as interventions;
```

### Sample Queries
```sql
-- Get all sessions for a client
SELECT sn.*, u.first_name || ' ' || u.last_name as staff_name
FROM session_notes sn
JOIN users u ON sn.user_id = u.id
WHERE sn.client_id = 'client-uuid-here'
ORDER BY sn.session_date DESC;

-- Get session with objectives and interventions
SELECT 
  sn.generated_note,
  array_agg(DISTINCT COALESCE(to.name, so.custom_objective)) as objectives,
  array_agg(DISTINCT COALESCE(i.name, si.custom_intervention)) as interventions
FROM session_notes sn
LEFT JOIN session_objectives so ON sn.id = so.session_note_id
LEFT JOIN treatment_objectives to ON so.objective_id = to.id
LEFT JOIN session_interventions si ON sn.id = si.session_note_id
LEFT JOIN interventions i ON si.intervention_id = i.id
WHERE sn.id = 'session-uuid-here'
GROUP BY sn.id, sn.generated_note;
```

## 🆘 Troubleshooting

### Common Issues

**Connection refused**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check connection settings
psql -U session_notes_user -d session_notes_db -h localhost
```

**Permission denied**
```sql
-- Grant missing permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO session_notes_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO session_notes_user;
```

**Migration fails**
```bash
# Check Node.js version
node --version  # Should be 18+

# Install pg dependency
npm install pg

# Check database exists
psql -U postgres -l | grep session_notes_db
```

## 📚 Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [HIPAA Compliance Guide](https://www.hhs.gov/hipaa/)
- [Node.js pg Package](https://node-postgres.com/)

---

**Need help?** Check the application logs or contact your system administrator.
