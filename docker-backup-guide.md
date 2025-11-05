# Docker PostgreSQL Backup Guide

## What is `postgres_data` Volume?

The `postgres_data` volume in `docker-compose.yml` is a **persistent storage** location where PostgreSQL stores all your database data. When you run `docker-compose up`, Docker creates this volume and stores it on your host machine.

**Why it matters:**
- Contains all your database tables, users, sessions, clients, etc.
- Persists even when you stop/restart containers
- If lost or corrupted, you lose all your data
- **No backup = No recovery if something goes wrong**

## Automated Daily Backups (Production)

This strategy provides automated, scheduled backups with retention policies and optional cloud storage integration.

### Backup Script

**File: `scripts/backup-database.sh`**

```bash
#!/bin/bash

# ============================================================================
# Automated Database Backup Script for Session Notes Generator
# Reads database configuration from environment variables
# ============================================================================

# Load environment variables from .env.local (if it exists)
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
fi

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/session_notes_backup_$TIMESTAMP.sql"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"  # Keep backups for 30 days
LOG_FILE="${BACKUP_LOG_FILE:-./logs/backup.log}"

# Database configuration from environment variables
# Supports both DATABASE_URL and individual variables
if [ -n "$DATABASE_URL" ]; then
    # Parse DATABASE_URL format: postgresql://user:password@host:port/database
    DB_USER=$(echo $DATABASE_URL | sed -n 's|postgresql://\([^:]*\):.*|\1|p')
    DB_PASS=$(echo $DATABASE_URL | sed -n 's|postgresql://[^:]*:\([^@]*\)@.*|\1|p')
    DB_HOST=$(echo $DATABASE_URL | sed -n 's|postgresql://[^@]*@\([^:]*\):.*|\1|p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's|postgresql://[^@]*@[^:]*:\([^/]*\)/.*|\1|p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's|postgresql://[^@]*@[^/]*/\(.*\)|\1|p' | sed 's/?.*//')
else
    # Use individual environment variables
    DB_USER="${DB_USER:-session_user}"
    DB_PASS="${DB_PASSWORD:-session_password_123}"
    DB_HOST="${DB_HOST:-localhost}"
    DB_PORT="${DB_PORT:-5432}"
    DB_NAME="${DB_NAME:-session_notes}"
fi

# Docker container name (default from docker-compose.yml)
CONTAINER_NAME="${DB_CONTAINER_NAME:-session-notes-db}"

# Create backup directory
mkdir -p "$BACKUP_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "🔄 Starting database backup..."

# Check if Docker container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    log "❌ Error: Docker container '${CONTAINER_NAME}' is not running"
    exit 1
fi

# Create backup using pg_dump
log "📦 Creating database backup..."
if docker exec "$CONTAINER_NAME" pg_dump \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -F p \
  > "$BACKUP_FILE" 2>>"$LOG_FILE"; then
    
    # Compress backup
    if gzip "$BACKUP_FILE" 2>>"$LOG_FILE"; then
        BACKUP_FILE="${BACKUP_FILE}.gz"
        BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        log "✅ Backup created successfully: ${BACKUP_FILE}"
        log "📊 Backup size: $BACKUP_SIZE"
        
        # Remove old backups (older than RETENTION_DAYS)
        log "🗑️  Cleaning up backups older than $RETENTION_DAYS days..."
        DELETED_COUNT=$(find "$BACKUP_DIR" -name "session_notes_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
        if [ "$DELETED_COUNT" -gt 0 ]; then
            log "   Removed $DELETED_COUNT old backup(s)"
        else
            log "   No old backups to remove"
        fi
        
        # Optional: Upload to cloud storage (uncomment and configure as needed)
        # 
        # AWS S3 Example:
        # if [ -n "$AWS_ACCESS_KEY_ID" ] && [ -n "$AWS_SECRET_ACCESS_KEY" ]; then
        #     log "☁️  Uploading to S3..."
        #     aws s3 cp "$BACKUP_FILE" "s3://${S3_BUCKET_NAME}/session-notes/" && \
        #     log "✅ Uploaded to S3: s3://${S3_BUCKET_NAME}/session-notes/$(basename $BACKUP_FILE)"
        # fi
        #
        # Google Cloud Storage Example:
        # if [ -n "$GOOGLE_CLOUD_KEYFILE" ]; then
        #     log "☁️  Uploading to Google Cloud Storage..."
        #     gsutil cp "$BACKUP_FILE" "gs://${GCS_BUCKET_NAME}/session-notes/" && \
        #     log "✅ Uploaded to GCS: gs://${GCS_BUCKET_NAME}/session-notes/$(basename $BACKUP_FILE)"
        # fi
        #
        # FTP/SFTP Example:
        # if [ -n "$FTP_HOST" ]; then
        #     log "☁️  Uploading via FTP..."
        #     curl -T "$BACKUP_FILE" "ftp://${FTP_USER}:${FTP_PASS}@${FTP_HOST}/backups/" && \
        #     log "✅ Uploaded via FTP"
        # fi
        
        log "🎉 Backup process completed successfully"
        exit 0
    else
        log "❌ Error: Failed to compress backup"
        rm -f "$BACKUP_FILE"
        exit 1
    fi
else
    log "❌ Error: Failed to create database backup"
    rm -f "$BACKUP_FILE"
    exit 1
fi
```

### Setup Instructions

#### 1. Create the Backup Script

```bash
# Create scripts directory if it doesn't exist
mkdir -p scripts

# Create the backup script
cat > scripts/backup-database.sh << 'EOF'
[paste the script content above]
EOF

# Make it executable
chmod +x scripts/backup-database.sh
```

#### 2. Configure Environment Variables

The script reads database configuration from environment variables. Add these to your `.env.local` file:

**Example with DATABASE_URL:**
```env
# Database Configuration (Docker)
DATABASE_URL=postgresql://session_user:session_password_123@localhost:5432/session_notes

# Backup Configuration
BACKUP_DIR=./backups
BACKUP_RETENTION_DAYS=30
BACKUP_LOG_FILE=./logs/backup.log
DB_CONTAINER_NAME=session-notes-db
```

**Example with Individual Variables:**
```env
# Database Configuration (Individual Variables)
DB_USER=session_user
DB_PASSWORD=session_password_123
DB_HOST=localhost
DB_PORT=5432
DB_NAME=session_notes

# Backup Configuration
BACKUP_DIR=./backups
BACKUP_RETENTION_DAYS=30
BACKUP_LOG_FILE=./logs/backup.log
DB_CONTAINER_NAME=session-notes-db
```

**Example with Dummy/Test Values:**
```env
# Example Database Configuration (for testing)
DATABASE_URL=postgresql://testuser:testpass123@localhost:5432/test_db

# Or using individual variables:
DB_USER=testuser
DB_PASSWORD=testpass123
DB_HOST=localhost
DB_PORT=5432
DB_NAME=test_db

# Backup Settings
BACKUP_DIR=./backups
BACKUP_RETENTION_DAYS=7
BACKUP_LOG_FILE=./logs/backup.log
DB_CONTAINER_NAME=session-notes-db
```

#### 3. Test the Backup Script

```bash
# Test backup manually
./scripts/backup-database.sh

# Check if backup was created
ls -lh backups/

# View backup log
tail -f logs/backup.log
```

### Automation

#### Schedule with Cron (Linux/Mac)

```bash
# Edit crontab
crontab -e

# Add this line to backup daily at 2 AM
# Make sure to use the full path to your script
0 2 * * * cd /path/to/session-notes-app && ./scripts/backup-database.sh >> logs/backup.log 2>&1

# Or backup every 6 hours
0 */6 * * * cd /path/to/session-notes-app && ./scripts/backup-database.sh >> logs/backup.log 2>&1
```

#### Schedule with Task Scheduler (Windows)

1. Open **Task Scheduler** (search for it in Start menu)
2. Click **Create Basic Task**
3. **Name**: "Daily Database Backup"
4. **Trigger**: Daily at 2:00 AM
5. **Action**: Start a program
6. **Program/script**: `bash` (or `wsl bash` if using WSL)
7. **Add arguments**: `-c "cd /path/to/session-notes-app && ./scripts/backup-database.sh"`
8. **Start in**: `/path/to/session-notes-app`
9. Click **Finish**

#### Schedule with Docker (Recommended)

Create a backup service in your `docker-compose.yml`:

```yaml
services:
  # ... existing services ...

  # Backup Service
  backup:
    image: alpine:latest
    container_name: session-notes-backup
    restart: "no"
    volumes:
      - ./backups:/backups
      - ./scripts:/scripts
      - ./.env.local:/app/.env.local:ro
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - BACKUP_DIR=/backups
      - DB_CONTAINER_NAME=session-notes-db
    entrypoint: /bin/sh
    command: -c "apk add --no-cache postgresql-client bash && chmod +x /scripts/backup-database.sh && /scripts/backup-database.sh"
    depends_on:
      - postgres
    networks:
      - session-notes-network
```

Then schedule it with cron or a scheduler that runs:
```bash
docker-compose run --rm backup
```

### Restore from Backup

#### Restore from SQL Dump:

```bash
# Decompress if needed
gunzip backups/session_notes_backup_20240101_120000.sql.gz

# Restore to Docker container
docker exec -i session-notes-db psql \
  -U session_user \
  -d session_notes \
  < backups/session_notes_backup_20240101_120000.sql
```

#### Restore with Environment Variables:

```bash
# Load environment variables
source .env.local

# Parse DATABASE_URL or use individual variables
if [ -n "$DATABASE_URL" ]; then
    DB_USER=$(echo $DATABASE_URL | sed -n 's|postgresql://\([^:]*\):.*|\1|p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's|postgresql://[^@]*@[^/]*/\(.*\)|\1|p' | sed 's/?.*//')
else
    DB_USER="${DB_USER:-session_user}"
    DB_NAME="${DB_NAME:-session_notes}"
fi

# Restore
gunzip -c backups/session_notes_backup_*.sql.gz | \
  docker exec -i session-notes-db psql -U "$DB_USER" -d "$DB_NAME"
```

### Monitoring Backup Health

#### Email Notification on Failure

Add to the end of your backup script:

```bash
# Send email notification if backup fails
if [ $? -ne 0 ]; then
    echo "Database backup failed at $(date)" | \
        mail -s "⚠️ Database Backup Failed" admin@example.com
fi
```

#### Slack/Discord Webhook

Add to your backup script after successful backup:

```bash
# Slack notification
if [ -n "$SLACK_WEBHOOK_URL" ]; then
    curl -X POST "$SLACK_WEBHOOK_URL" \
      -H 'Content-Type: application/json' \
      -d "{\"text\":\"✅ Database backup completed: ${BACKUP_FILE}\"}"
fi

# Discord notification
if [ -n "$DISCORD_WEBHOOK_URL" ]; then
    curl -X POST "$DISCORD_WEBHOOK_URL" \
      -H 'Content-Type: application/json' \
      -d "{\"content\":\"✅ Database backup completed: ${BACKUP_FILE}\"}"
fi
```

### Best Practices

#### ✅ DO:
1. **Test your backups regularly** - Make sure you can restore from them
2. **Keep multiple backup copies** - Local + Cloud storage
3. **Automate backups** - Don't rely on manual backups
4. **Monitor backup success** - Get alerts if backups fail
5. **Document your restore process** - Know how to restore before you need to
6. **Encrypt sensitive backups** - Especially if uploading to cloud
7. **Use environment variables** - Never hardcode credentials
8. **Verify backup integrity** - Check backup files are not corrupted

#### ❌ DON'T:
1. Store backups on the same server as the database
2. Rely on only one backup method
3. Forget to test restore procedures
4. Keep backups indefinitely (storage costs)
5. Store backups without encryption
6. Hardcode database credentials in scripts
7. Ignore backup failures

### Quick Reference

```bash
# Create backup directory
mkdir -p backups logs

# Make backup script executable
chmod +x scripts/backup-database.sh

# Test backup
./scripts/backup-database.sh

# List backups
ls -lh backups/

# View latest backup log
tail -20 logs/backup.log

# Restore from latest backup
gunzip -c backups/session_notes_backup_*.sql.gz | \
  docker exec -i session-notes-db psql -U session_user -d session_notes

# Check backup age
find backups/ -name "*.sql.gz" -mtime -1  # Backups from last 24 hours
```

### Troubleshooting

**Backup fails with "container not running":**
- Ensure Docker container is running: `docker ps | grep session-notes-db`
- Check container name matches `DB_CONTAINER_NAME` in environment

**Backup fails with "authentication failed":**
- Verify database credentials in `.env.local`
- Check `DATABASE_URL` format is correct
- Ensure user has backup permissions

**Backups are too large:**
- Consider using `pg_dump` with compression: `pg_dump ... | gzip > backup.sql.gz`
- Implement incremental backups for large databases

**Backup script not executable:**
- Run: `chmod +x scripts/backup-database.sh`

---

## Summary

- **What**: Automated daily backups of PostgreSQL database
- **How**: Script reads from environment variables, creates SQL dumps, compresses, and manages retention
- **When**: Schedule daily (or as needed) via cron or Task Scheduler
- **Where**: Local storage + optional cloud storage
- **Test**: Regularly verify you can restore from backups

**Remember**: A backup is only as good as your ability to restore it. Test your restore process regularly!
