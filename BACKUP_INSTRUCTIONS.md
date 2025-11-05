# PostgreSQL Database Backup Instructions

Quick reference guide for backing up and migrating your Session Notes database.

## 🔄 Local PostgreSQL → Docker PostgreSQL Migration

### Step 1: Backup from Local PostgreSQL

**Using pg_dump (if installed locally):**
```bash
# Backup to uncompressed SQL file
pg_dump -U your_local_user -d your_local_database -h localhost -p 5432 > local_backup.sql

# Or compressed backup (smaller file)
pg_dump -U your_local_user -d your_local_database -h localhost -p 5432 | gzip > local_backup.sql.gz
```

**Using psql (if pg_dump not available):**
```bash
# Connect and dump
psql -U your_local_user -d your_local_database -h localhost -p 5432 -c "\copy (SELECT * FROM table_name) TO 'backup.csv' CSV HEADER"
```

**Using Docker to connect to local PostgreSQL:**
```bash
# If your local PostgreSQL is accessible
docker run --rm -it --network host postgres:17-alpine \
  pg_dump -h host.docker.internal -U your_local_user -d your_local_database > local_backup.sql
```

### Step 2: Import into Docker PostgreSQL

**Uncompressed SQL file:**
```bash
# Import into Docker database
docker exec -i session-notes-db psql \
  -U session_user \
  -d session_notes \
  < local_backup.sql
```

**Compressed SQL file:**
```bash
# Import compressed backup
gunzip -c local_backup.sql.gz | \
  docker exec -i session-notes-db psql \
    -U session_user \
    -d session_notes
```

**Using Docker Compose:**
```bash
# Import using docker-compose
docker-compose exec -T postgres psql \
  -U session_user \
  -d session_notes \
  < local_backup.sql
```

## 📋 Complete Migration Example

### Example: Migrate from Local PostgreSQL to Docker

```bash
# Step 1: Backup from local PostgreSQL
# Replace with your actual credentials
pg_dump -U postgres -d session_notes_db -h localhost -p 5432 | \
  gzip > migration_backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Step 2: Ensure Docker database is running
docker-compose up -d postgres

# Step 3: Wait for database to be ready
sleep 5

# Step 4: Import into Docker database
gunzip -c migration_backup_*.sql.gz | \
  docker exec -i session-notes-db psql \
    -U session_user \
    -d session_notes

# Step 5: Verify import
docker exec session-notes-db psql \
  -U session_user \
  -d session_notes \
  -c "\dt"  # List all tables
```

## 🔧 Local PostgreSQL Connection Methods

### Method 1: Direct Connection (pg_dump installed)

```bash
# Basic connection
pg_dump -U username -d database_name -h localhost -p 5432 > backup.sql

# With password prompt (safer)
PGPASSWORD=your_password pg_dump -U username -d database_name -h localhost -p 5432 > backup.sql

# Using .pgpass file (recommended)
# Create ~/.pgpass file with: hostname:port:database:username:password
chmod 600 ~/.pgpass
pg_dump -U username -d database_name -h localhost -p 5432 > backup.sql
```

### Method 2: Using Docker to Access Local PostgreSQL

```bash
# Connect to local PostgreSQL from Docker
docker run --rm -it \
  -v $(pwd):/backup \
  --network host \
  postgres:17-alpine \
  pg_dump -h localhost -U your_local_user -d your_local_database > /backup/local_backup.sql
```

### Method 3: Using psql Connection String

```bash
# Using connection string
pg_dump "postgresql://username:password@localhost:5432/database_name" > backup.sql

# Example with dummy credentials
pg_dump "postgresql://myuser:mypass123@localhost:5432/mydb" > backup.sql
```

## 🚀 Quick Migration Script

Create `scripts/migrate-local-to-docker.sh`:

```bash
#!/bin/bash

# ============================================================================
# Migrate Database from Local PostgreSQL to Docker PostgreSQL
# ============================================================================

# Local PostgreSQL Configuration
LOCAL_DB_USER="${LOCAL_DB_USER:-postgres}"
LOCAL_DB_NAME="${LOCAL_DB_NAME:-session_notes_db}"
LOCAL_DB_HOST="${LOCAL_DB_HOST:-localhost}"
LOCAL_DB_PORT="${LOCAL_DB_PORT:-5432}"

# Docker PostgreSQL Configuration
DOCKER_DB_USER="${DB_USER:-session_user}"
DOCKER_DB_NAME="${DB_NAME:-session_notes}"
DOCKER_CONTAINER="${DB_CONTAINER_NAME:-session-notes-db}"

# Backup file
BACKUP_FILE="migration_backup_$(date +%Y%m%d_%H%M%S).sql.gz"

echo "🔄 Starting migration from local PostgreSQL to Docker..."
echo "📊 Source: $LOCAL_DB_USER@$LOCAL_DB_HOST:$LOCAL_DB_PORT/$LOCAL_DB_NAME"
echo "📊 Target: Docker container '$DOCKER_CONTAINER'"

# Step 1: Backup from local PostgreSQL
echo "📦 Step 1: Creating backup from local PostgreSQL..."
if pg_dump -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -h "$LOCAL_DB_HOST" -p "$LOCAL_DB_PORT" | gzip > "$BACKUP_FILE"; then
    echo "✅ Backup created: $BACKUP_FILE"
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "📦 Backup size: $BACKUP_SIZE"
else
    echo "❌ Failed to create backup from local PostgreSQL"
    exit 1
fi

# Step 2: Check if Docker container is running
echo "🐳 Step 2: Checking Docker container..."
if ! docker ps --format '{{.Names}}' | grep -q "^${DOCKER_CONTAINER}$"; then
    echo "⚠️  Docker container '$DOCKER_CONTAINER' is not running"
    echo "🔄 Starting Docker container..."
    docker-compose up -d postgres
    sleep 5
fi

# Step 3: Import into Docker
echo "📥 Step 3: Importing into Docker PostgreSQL..."
if gunzip -c "$BACKUP_FILE" | docker exec -i "$DOCKER_CONTAINER" psql -U "$DOCKER_DB_USER" -d "$DOCKER_DB_NAME"; then
    echo "✅ Successfully imported into Docker database"
else
    echo "❌ Failed to import into Docker database"
    exit 1
fi

# Step 4: Verify
echo "🔍 Step 4: Verifying import..."
TABLE_COUNT=$(docker exec "$DOCKER_CONTAINER" psql -U "$DOCKER_DB_USER" -d "$DOCKER_DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo "✅ Import complete! Found $TABLE_COUNT tables in Docker database"

echo "🎉 Migration completed successfully!"
echo "📁 Backup file saved as: $BACKUP_FILE"
```

**Make executable:**
```bash
chmod +x scripts/migrate-local-to-docker.sh
```

**Usage:**
```bash
# Set environment variables (optional)
export LOCAL_DB_USER=postgres
export LOCAL_DB_NAME=session_notes_db
export LOCAL_DB_PASSWORD=your_password

# Run migration
./scripts/migrate-local-to-docker.sh
```

## 🔄 Docker PostgreSQL → Local PostgreSQL

If you need to export FROM Docker TO local PostgreSQL:

```bash
# Step 1: Export from Docker
docker exec session-notes-db pg_dump \
  -U session_user \
  -d session_notes \
  | gzip > docker_backup.sql.gz

# Step 2: Import to local PostgreSQL
gunzip -c docker_backup.sql.gz | \
  psql -U your_local_user -d your_local_database -h localhost -p 5432
```

## 📝 Environment Variables Setup

Create `.env.local` with your local PostgreSQL credentials:

```env
# Local PostgreSQL (Source)
LOCAL_DB_USER=postgres
LOCAL_DB_NAME=session_notes_db
LOCAL_DB_HOST=localhost
LOCAL_DB_PORT=5432
LOCAL_DB_PASSWORD=your_local_password

# Docker PostgreSQL (Target)
DB_USER=session_user
DB_NAME=session_notes
DB_CONTAINER_NAME=session-notes-db
```

## 🔐 Password Handling

### Option 1: Use PGPASSWORD (Quick)

```bash
PGPASSWORD=your_password pg_dump -U username -d database_name -h localhost > backup.sql
```

### Option 2: Use .pgpass File (Secure)

```bash
# Create ~/.pgpass file
echo "localhost:5432:database_name:username:password" >> ~/.pgpass
chmod 600 ~/.pgpass

# Now pg_dump will use it automatically
pg_dump -U username -d database_name -h localhost > backup.sql
```

### Option 3: Use Connection String

```bash
pg_dump "postgresql://username:password@localhost:5432/database_name" > backup.sql
```

## 🚨 Quick Commands Reference

### Backup from Local PostgreSQL

```bash
# Basic backup
pg_dump -U postgres -d session_notes_db -h localhost > backup.sql

# Compressed backup
pg_dump -U postgres -d session_notes_db -h localhost | gzip > backup.sql.gz

# With password
PGPASSWORD=yourpass pg_dump -U postgres -d session_notes_db -h localhost > backup.sql
```

### Import to Docker PostgreSQL

```bash
# Uncompressed
docker exec -i session-notes-db psql -U session_user -d session_notes < backup.sql

# Compressed
gunzip -c backup.sql.gz | docker exec -i session-notes-db psql -U session_user -d session_notes
```

### Complete One-Liner Migration

```bash
# Backup from local and import to Docker in one command
pg_dump -U postgres -d session_notes_db -h localhost | \
  docker exec -i session-notes-db psql -U session_user -d session_notes
```

## 🔍 Verify Migration

### Check Tables in Docker

```bash
# List all tables
docker exec session-notes-db psql \
  -U session_user \
  -d session_notes \
  -c "\dt"

# Count records in a table
docker exec session-notes-db psql \
  -U session_user \
  -d session_notes \
  -c "SELECT COUNT(*) FROM users;"
```

### Compare Data

```bash
# Count in local database
psql -U postgres -d session_notes_db -h localhost -c "SELECT COUNT(*) FROM users;"

# Count in Docker database
docker exec session-notes-db psql -U session_user -d session_notes -c "SELECT COUNT(*) FROM users;"
```

## 🆘 Troubleshooting

**Error: "pg_dump: command not found"**
```bash
# Install PostgreSQL client tools
# macOS
brew install postgresql

# Ubuntu/Debian
sudo apt-get install postgresql-client

# Windows
# Download from: https://www.postgresql.org/download/windows/
```

**Error: "connection refused"**
```bash
# Check if local PostgreSQL is running
# macOS/Linux
pg_isready -h localhost -p 5432

# Check PostgreSQL service
# macOS
brew services list | grep postgresql

# Linux
sudo systemctl status postgresql
```

**Error: "authentication failed"**
```bash
# Check PostgreSQL authentication settings
# Edit pg_hba.conf and ensure local connections are allowed
# Location: /etc/postgresql/*/main/pg_hba.conf or /usr/local/var/postgres/pg_hba.conf
```

**Error: "database does not exist"**
```bash
# List databases
psql -U postgres -h localhost -c "\l"

# Create database if needed
createdb -U postgres -h localhost session_notes_db
```

**Error: "Docker container not found"**
```bash
# Check if container is running
docker ps | grep session-notes-db

# Start container
docker-compose up -d postgres
```

## 📊 Migration Checklist

- [ ] Local PostgreSQL is running
- [ ] Docker PostgreSQL container is running
- [ ] Backup created successfully
- [ ] Backup file size looks reasonable
- [ ] Import completed without errors
- [ ] Tables verified in Docker database
- [ ] Data count matches (optional)
- [ ] Application works with Docker database

---

**💡 Tip**: Always test the migration process with a small test database first!
