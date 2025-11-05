# Database Query Commands

Quick reference for querying the Session Notes database, especially the users table.

## 🔍 Query Users Table

### Basic Queries

**List all users:**
```bash
docker compose exec postgres psql -U session_user -d session_notes -c "SELECT * FROM users;"
```

**List users with formatted output:**
```bash
docker compose exec postgres psql -U session_user -d session_notes -c "\x" -c "SELECT * FROM users;"
```

**Count users:**
```bash
docker compose exec postgres psql -U session_user -d session_notes -c "SELECT COUNT(*) FROM users;"
```

**List active users only:**
```bash
docker compose exec postgres psql -U session_user -d session_notes -c "SELECT id, username, email, role, is_active FROM users WHERE is_active = true;"
```

**List users by role:**
```bash
# All admins
docker compose exec postgres psql -U session_user -d session_notes -c "SELECT * FROM users WHERE role = 'admin';"

# All peer support users
docker compose exec postgres psql -U session_user -d session_notes -c "SELECT * FROM users WHERE role = 'peer_support';"
```

### Specific User Queries

**Find user by username:**
```bash
docker compose exec postgres psql -U session_user -d session_notes -c "SELECT * FROM users WHERE username = 'admin';"
```

**Find user by email:**
```bash
docker compose exec postgres psql -U session_user -d session_notes -c "SELECT * FROM users WHERE email = 'user@example.com';"
```

**Get user by ID:**
```bash
docker compose exec postgres psql -U session_user -d session_notes -c "SELECT * FROM users WHERE id = 'your-user-id-here';"
```

### User Information Queries

**List users with last login:**
```bash
docker compose exec postgres psql -U session_user -d session_notes -c "SELECT username, email, role, is_active, last_login_at, created_at FROM users ORDER BY created_at DESC;"
```

**List inactive users:**
```bash
docker compose exec postgres psql -U session_user -d session_notes -c "SELECT username, email, role, created_at FROM users WHERE is_active = false;"
```

**Users created in last 30 days:**
```bash
docker compose exec postgres psql -U session_user -d session_notes -c "SELECT username, email, role, created_at FROM users WHERE created_at > NOW() - INTERVAL '30 days';"
```

**Users who never logged in:**
```bash
docker compose exec postgres psql -U session_user -d session_notes -c "SELECT username, email, created_at FROM users WHERE last_login_at IS NULL;"
```

## 📊 Useful Query Patterns

### Formatting Output

**Table format (default):**
```bash
docker compose exec postgres psql -U session_user -d session_notes -c "SELECT * FROM users;"
```

**Expanded format (better for wide tables):**
```bash
docker compose exec postgres psql -U session_user -d session_notes -c "\x" -c "SELECT * FROM users;"
```

**CSV format:**
```bash
docker compose exec postgres psql -U session_user -d session_notes -c "\COPY (SELECT * FROM users) TO STDOUT WITH CSV HEADER"
```

**JSON format:**
```bash
docker compose exec postgres psql -U session_user -d session_notes -t -c "SELECT json_agg(row_to_json(t)) FROM (SELECT * FROM users) t;"
```

### Interactive Mode

**Open interactive psql session:**
```bash
docker compose exec postgres psql -U session_user -d session_notes
```

**Then run queries:**
```sql
-- List all users
SELECT * FROM users;

-- List users with roles
SELECT username, role, is_active FROM users;

-- Count by role
SELECT role, COUNT(*) as count FROM users GROUP BY role;

-- Exit
\q
```

## 🔐 User Management Queries

### Check User Status

**Check if user exists:**
```bash
docker compose exec postgres psql -U session_user -d session_notes -c "SELECT EXISTS(SELECT 1 FROM users WHERE username = 'admin');"
```

**Check user password (hash only - cannot decrypt):**
```bash
docker compose exec postgres psql -U session_user -d session_notes -c "SELECT username, password_hash FROM users WHERE username = 'admin';"
```

**List users with their session counts:**
```bash
docker compose exec postgres psql -U session_user -d session_notes -c "
SELECT 
    u.username,
    u.role,
    u.is_active,
    COUNT(s.id) as session_count
FROM users u
LEFT JOIN session_notes s ON u.id = s.user_id
GROUP BY u.id, u.username, u.role, u.is_active
ORDER BY session_count DESC;
"
```

## 📋 All Tables Queries

### List All Tables

```bash
docker compose exec postgres psql -U session_user -d session_notes -c "\dt"
```

### Describe Table Structure

```bash
# Users table structure
docker compose exec postgres psql -U session_user -d session_notes -c "\d users"

# All tables structure
docker compose exec postgres psql -U session_user -d session_notes -c "\d+"
```

## 🔄 Quick Reference Commands

### Most Common Queries

```bash
# List all users
docker compose exec postgres psql -U session_user -d session_notes -c "SELECT id, username, email, role, is_active FROM users;"

# Count users
docker compose exec postgres psql -U session_user -d session_notes -c "SELECT COUNT(*) as total_users FROM users;"

# List active users
docker compose exec postgres psql -U session_user -d session_notes -c "SELECT username, role FROM users WHERE is_active = true;"

# List users by role
docker compose exec postgres psql -U session_user -d session_notes -c "SELECT role, COUNT(*) FROM users GROUP BY role;"

# Find specific user
docker compose exec postgres psql -U session_user -d session_notes -c "SELECT * FROM users WHERE username = 'admin';"
```

### Advanced Queries

**Users with their created clients:**
```bash
docker compose exec postgres psql -U session_user -d session_notes -c "
SELECT 
    u.username,
    COUNT(c.id) as clients_created
FROM users u
LEFT JOIN clients c ON u.id = c.created_by
GROUP BY u.id, u.username
ORDER BY clients_created DESC;
"
```

**Users with their session notes:**
```bash
docker compose exec postgres psql -U session_user -d session_notes -c "
SELECT 
    u.username,
    u.role,
    COUNT(s.id) as total_sessions,
    COUNT(CASE WHEN s.status = 'completed' THEN 1 END) as completed_sessions
FROM users u
LEFT JOIN session_notes s ON u.id = s.user_id
GROUP BY u.id, u.username, u.role
ORDER BY total_sessions DESC;
"
```

**Recent user activity:**
```bash
docker compose exec postgres psql -U session_user -d session_notes -c "
SELECT 
    username,
    last_login_at,
    created_at,
    CASE 
        WHEN last_login_at IS NULL THEN 'Never'
        WHEN last_login_at > NOW() - INTERVAL '7 days' THEN 'Recent'
        ELSE 'Inactive'
    END as activity_status
FROM users
ORDER BY last_login_at DESC NULLS LAST;
"
```

## 🛠️ Utility Queries

### Export Users to CSV

```bash
docker compose exec postgres psql -U session_user -d session_notes -c "\COPY (SELECT username, email, role, is_active, created_at FROM users) TO '/tmp/users.csv' WITH CSV HEADER"
docker compose cp postgres:/tmp/users.csv ./users_export.csv
```

### Export Users to JSON

```bash
docker compose exec postgres psql -U session_user -d session_notes -t -c "
SELECT json_agg(row_to_json(t)) 
FROM (
    SELECT username, email, role, is_active, created_at 
    FROM users
) t;
" > users_export.json
```

### Backup Users Table Only

```bash
docker compose exec postgres pg_dump -U session_user -d session_notes -t users | gzip > users_backup.sql.gz
```

### Restore Users Table

```bash
gunzip -c users_backup.sql.gz | docker compose exec -T postgres psql -U session_user -d session_notes
```

## 📝 Query Examples with Filters

**Filter by multiple conditions:**
```bash
docker compose exec postgres psql -U session_user -d session_notes -c "
SELECT username, email, role, is_active 
FROM users 
WHERE role = 'admin' AND is_active = true;
"
```

**Search users (case-insensitive):**
```bash
docker compose exec postgres psql -U session_user -d session_notes -c "
SELECT * FROM users 
WHERE LOWER(username) LIKE '%admin%' 
   OR LOWER(email) LIKE '%admin%';
"
```

**Sort and limit results:**
```bash
docker compose exec postgres psql -U session_user -d session_notes -c "
SELECT username, email, created_at 
FROM users 
ORDER BY created_at DESC 
LIMIT 10;
"
```

## 🔍 Table Information

**Get table row count:**
```bash
docker compose exec postgres psql -U session_user -d session_notes -c "
SELECT 
    'users' as table_name, 
    COUNT(*) as row_count 
FROM users;
"
```

**Get table size:**
```bash
docker compose exec postgres psql -U session_user -d session_notes -c "
SELECT 
    pg_size_pretty(pg_total_relation_size('users')) as total_size,
    pg_size_pretty(pg_relation_size('users')) as table_size,
    pg_size_pretty(pg_indexes_size('users')) as indexes_size;
"
```

## 🆘 Troubleshooting

**Cannot connect to database:**
```bash
# Check if container is running
docker compose ps

# Check database logs
docker compose logs postgres

# Test connection
docker compose exec postgres pg_isready -U session_user
```

**Permission denied:**
```bash
# Verify you're using the correct user
docker compose exec postgres psql -U session_user -d session_notes -c "SELECT current_user;"
```

**Table not found:**
```bash
# List all tables
docker compose exec postgres psql -U session_user -d session_notes -c "\dt"

# Check if in correct database
docker compose exec postgres psql -U session_user -d session_notes -c "SELECT current_database();"
```

---

## Quick Reference

```bash
# List all users
docker compose exec postgres psql -U session_user -d session_notes -c "SELECT * FROM users;"

# Count users
docker compose exec postgres psql -U session_user -d session_notes -c "SELECT COUNT(*) FROM users;"

# Find specific user
docker compose exec postgres psql -U session_user -d session_notes -c "SELECT * FROM users WHERE username = 'admin';"

# Interactive mode
docker compose exec postgres psql -U session_user -d session_notes
```

