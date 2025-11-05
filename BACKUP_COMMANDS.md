# Backup Commands Using .env.local Credentials

Quick reference commands using credentials from `.env.local` file.

## 📋 Load Environment Variables

First, load your `.env.local` file:

**Linux/Mac:**
```bash
export $(cat .env.local | grep -v '^#' | xargs)
```

**Windows PowerShell:**
```powershell
Get-Content .env.local | ForEach-Object {
    if ($_ -match '^([^#][^=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
    }
}
```

**Windows CMD:**
```cmd
for /f "tokens=1,* delims==" %a in (.env.local) do set %a=%b
```

## 🔄 Backup from Local PostgreSQL → Docker

### Using DATABASE_URL from .env.local

**Step 1: Backup from Local PostgreSQL**
```bash
# Load environment variables
export $(cat .env.local | grep -v '^#' | xargs)

# Backup using DATABASE_URL (if it points to local PostgreSQL)
pg_dump "$DATABASE_URL" | gzip > local_backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Or using individual variables
pg_dump -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" | \
  gzip > local_backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

**Step 2: Import to Docker**
```bash
# Load environment variables
export $(cat .env.local | grep -v '^#' | xargs)

# Import using Docker credentials from docker-compose.yml
gunzip -c local_backup_*.sql.gz | \
  docker exec -i session-notes-db psql \
    -U session_user \
    -d session_notes
```

### Using Docker Compose Credentials

**Backup from Local → Docker (one command):**
```bash
# Load .env.local
export $(cat .env.local | grep -v '^#' | xargs)

# Backup from local and import to Docker
pg_dump -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" | \
  docker exec -i session-notes-db psql -U session_user -d session_notes
```

## 📝 Complete Example with .env.local Variables

### Example .env.local Structure

```env
# Local PostgreSQL Credentials
DB_HOST=localhost
DB_PORT=5432
DB_NAME=session_notes_db
DB_USER=session_notes_user
DB_PASSWORD=your_secure_password_here

# Or using DATABASE_URL
DATABASE_URL=postgresql://session_notes_user:your_secure_password_here@localhost:5432/session_notes_db
```

### Backup Commands

**Method 1: Using Individual Variables**
```bash
# Load environment
export $(cat .env.local | grep -v '^#' | xargs)

# Backup from local PostgreSQL
PGPASSWORD="$DB_PASSWORD" pg_dump \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  | gzip > local_backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Import to Docker
gunzip -c local_backup_*.sql.gz | \
  docker exec -i session-notes-db psql \
    -U session_user \
    -d session_notes
```

**Method 2: Using DATABASE_URL**
```bash
# Load environment
export $(cat .env.local | grep -v '^#' | xargs)

# Backup from local (if DATABASE_URL points to local)
pg_dump "$DATABASE_URL" | gzip > local_backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Import to Docker
gunzip -c local_backup_*.sql.gz | \
  docker exec -i session-notes-db psql \
    -U session_user \
    -d session_notes
```

## 🚀 One-Liner Migration Script

Create `scripts/migrate-with-env.sh`:

```bash
#!/bin/bash

# Load .env.local
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
else
    echo "❌ Error: .env.local file not found"
    exit 1
fi

# Local PostgreSQL credentials (from .env.local)
LOCAL_USER="${DB_USER:-session_notes_user}"
LOCAL_DB="${DB_NAME:-session_notes_db}"
LOCAL_HOST="${DB_HOST:-localhost}"
LOCAL_PORT="${DB_PORT:-5432}"
LOCAL_PASS="${DB_PASSWORD}"

# Docker credentials (from docker-compose.yml)
DOCKER_USER="session_user"
DOCKER_DB="session_notes"
DOCKER_CONTAINER="session-notes-db"

BACKUP_FILE="migration_backup_$(date +%Y%m%d_%H%M%S).sql.gz"

echo "🔄 Migrating from local PostgreSQL to Docker..."
echo "📊 Source: $LOCAL_USER@$LOCAL_HOST:$LOCAL_PORT/$LOCAL_DB"
echo "📊 Target: $DOCKER_USER@$DOCKER_CONTAINER/$DOCKER_DB"

# Backup from local
echo "📦 Creating backup..."
PGPASSWORD="$LOCAL_PASS" pg_dump \
  -U "$LOCAL_USER" \
  -d "$LOCAL_DB" \
  -h "$LOCAL_HOST" \
  -p "$LOCAL_PORT" \
  | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Backup created: $BACKUP_FILE"
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "📦 Size: $BACKUP_SIZE"
else
    echo "❌ Backup failed"
    exit 1
fi

# Check Docker container
if ! docker ps --format '{{.Names}}' | grep -q "^${DOCKER_CONTAINER}$"; then
    echo "🔄 Starting Docker container..."
    docker-compose up -d postgres
    sleep 5
fi

# Import to Docker
echo "📥 Importing to Docker..."
gunzip -c "$BACKUP_FILE" | \
  docker exec -i "$DOCKER_CONTAINER" psql \
    -U "$DOCKER_USER" \
    -d "$DOCKER_DB"

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully!"
    echo "📁 Backup saved: $BACKUP_FILE"
else
    echo "❌ Import failed"
    exit 1
fi
```

**Make executable and run:**
```bash
chmod +x scripts/migrate-with-env.sh
./scripts/migrate-with-env.sh
```

## 🔧 Quick Commands Reference

### Using .env.local Variables

```bash
# Load environment
export $(cat .env.local | grep -v '^#' | xargs)

# Backup from local PostgreSQL
PGPASSWORD="$DB_PASSWORD" pg_dump \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  > backup.sql

# Compressed backup
PGPASSWORD="$DB_PASSWORD" pg_dump \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  | gzip > backup.sql.gz

# Import to Docker
docker exec -i session-notes-db psql \
  -U session_user \
  -d session_notes \
  < backup.sql

# Or compressed
gunzip -c backup.sql.gz | \
  docker exec -i session-notes-db psql \
    -U session_user \
    -d session_notes
```

### Using DATABASE_URL from .env.local

```bash
# Load environment
export $(cat .env.local | grep -v '^#' | xargs)

# Backup (if DATABASE_URL points to local)
pg_dump "$DATABASE_URL" > backup.sql

# Compressed
pg_dump "$DATABASE_URL" | gzip > backup.sql.gz

# Import to Docker
gunzip -c backup.sql.gz | \
  docker exec -i session-notes-db psql \
    -U session_user \
    -d session_notes
```

## 📋 Specific Examples

### Example 1: Typical .env.local Setup

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=session_notes_db
DB_USER=session_notes_user
DB_PASSWORD=mySecurePass123
```

**Commands:**
```bash
# Load variables
export $(cat .env.local | grep -v '^#' | xargs)

# Backup
PGPASSWORD="$DB_PASSWORD" pg_dump \
  -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" \
  | gzip > backup.sql.gz

# Import
gunzip -c backup.sql.gz | \
  docker exec -i session-notes-db psql -U session_user -d session_notes
```

### Example 2: Using DATABASE_URL

```env
DATABASE_URL=postgresql://session_notes_user:mySecurePass123@localhost:5432/session_notes_db
```

**Commands:**
```bash
# Load variables
export $(cat .env.local | grep -v '^#' | xargs)

# Backup
pg_dump "$DATABASE_URL" | gzip > backup.sql.gz

# Import
gunzip -c backup.sql.gz | \
  docker exec -i session-notes-db psql -U session_user -d session_notes
```

### Example 3: Different Port (Common Scenario)

```env
DB_HOST=localhost
DB_PORT=5433
DB_NAME=session_notes_db
DB_USER=session_notes_user
DB_PASSWORD=mySecurePass123
```

**Commands:**
```bash
# Load variables
export $(cat .env.local | grep -v '^#' | xargs)

# Backup from port 5433
PGPASSWORD="$DB_PASSWORD" pg_dump \
  -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" \
  | gzip > backup.sql.gz

# Import to Docker (always port 5432 internally)
gunzip -c backup.sql.gz | \
  docker exec -i session-notes-db psql -U session_user -d session_notes
```

## 🔄 Complete Migration Script (Ready to Use)

Save as `scripts/backup-and-migrate.sh`:

```bash
#!/bin/bash
set -e

# Load .env.local
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
else
    echo "❌ .env.local not found"
    exit 1
fi

# Configuration
LOCAL_USER="${DB_USER:-session_notes_user}"
LOCAL_DB="${DB_NAME:-session_notes_db}"
LOCAL_HOST="${DB_HOST:-localhost}"
LOCAL_PORT="${DB_PORT:-5432}"
LOCAL_PASS="${DB_PASSWORD}"

DOCKER_USER="session_user"
DOCKER_DB="session_notes"
DOCKER_CONTAINER="session-notes-db"

BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql.gz"

echo "📦 Backing up from local PostgreSQL..."
PGPASSWORD="$LOCAL_PASS" pg_dump \
  -U "$LOCAL_USER" \
  -d "$LOCAL_DB" \
  -h "$LOCAL_HOST" \
  -p "$LOCAL_PORT" \
  | gzip > "$BACKUP_FILE"

echo "✅ Backup created: $BACKUP_FILE"

echo "📥 Importing to Docker..."
docker-compose up -d postgres
sleep 5

gunzip -c "$BACKUP_FILE" | \
  docker exec -i "$DOCKER_CONTAINER" psql \
    -U "$DOCKER_USER" \
    -d "$DOCKER_DB"

echo "✅ Migration complete!"
```

**Usage:**
```bash
chmod +x scripts/backup-and-migrate.sh
./scripts/backup-and-migrate.sh
```

## ⚡ Quick One-Liner

```bash
# Load .env.local and migrate in one command
export $(cat .env.local | grep -v '^#' | xargs) && \
PGPASSWORD="$DB_PASSWORD" pg_dump -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" | \
docker exec -i session-notes-db psql -U session_user -d session_notes
```

---

**💡 Tip**: The Docker credentials (session_user, session_notes) are hardcoded in docker-compose.yml. If you change them there, update the import commands accordingly.

