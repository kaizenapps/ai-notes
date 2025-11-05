# Docker PostgreSQL Backup Guide

## What is `postgres_data` Volume?

The `postgres_data` volume in `docker-compose.yml` is a **persistent storage** location where PostgreSQL stores all your database data. When you run `docker-compose up`, Docker creates this volume and stores it on your host machine.

**Why it matters:**
- Contains all your database tables, users, sessions, clients, etc.
- Persists even when you stop/restart containers
- If lost or corrupted, you lose all your data
- **No backup = No recovery if something goes wrong**

## Backup Strategies

### Strategy 1: Manual Backup Script (Recommended for Development/Small Deployments)

Create a backup script that you can run manually or schedule:

**File: `scripts/backup-database.sh`**
```bash
#!/bin/bash

# Configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/session_notes_backup_$TIMESTAMP.sql"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Create backup using pg_dump
docker exec session-notes-db pg_dump \
  -U session_user \
  -d session_notes \
  -F p \
  > "$BACKUP_FILE"

# Compress the backup
gzip "$BACKUP_FILE"

echo "✅ Backup created: ${BACKUP_FILE}.gz"
echo "📦 Backup size: $(du -h ${BACKUP_FILE}.gz | cut -f1)"
```

**Usage:**
```bash
chmod +x scripts/backup-database.sh
./scripts/backup-database.sh
```

### Strategy 2: Automated Daily Backups (Production)

**File: `scripts/backup-database.sh` (Enhanced version)**
```bash
#!/bin/bash

# Configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/session_notes_backup_$TIMESTAMP.sql"
RETENTION_DAYS=30  # Keep backups for 30 days

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Create backup
echo "🔄 Creating database backup..."
docker exec session-notes-db pg_dump \
  -U session_user \
  -d session_notes \
  -F p \
  > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  # Compress backup
  gzip "$BACKUP_FILE"
  echo "✅ Backup created: ${BACKUP_FILE}.gz"
  
  # Remove old backups (older than RETENTION_DAYS)
  find "$BACKUP_DIR" -name "session_notes_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete
  echo "🗑️  Removed backups older than $RETENTION_DAYS days"
  
  # Optional: Upload to cloud storage (S3, Google Drive, etc.)
  # aws s3 cp "${BACKUP_FILE}.gz" s3://your-backup-bucket/
else
  echo "❌ Backup failed!"
  exit 1
fi
```

**Schedule with cron (Linux/Mac):**
```bash
# Edit crontab
crontab -e

# Add this line to backup daily at 2 AM
0 2 * * * cd /path/to/session-notes-app && ./scripts/backup-database.sh >> logs/backup.log 2>&1
```

**Schedule with Task Scheduler (Windows):**
1. Open Task Scheduler
2. Create Basic Task
3. Set trigger: Daily at 2:00 AM
4. Action: Start a program
5. Program: `bash` (or `wsl bash` if using WSL)
6. Arguments: `-c "cd /path/to/session-notes-app && ./scripts/backup-database.sh"`

### Strategy 3: Docker Volume Backup (Full Volume Backup)

This backs up the entire PostgreSQL data directory, not just a SQL dump:

**File: `scripts/backup-volume.sh`**
```bash
#!/bin/bash

BACKUP_DIR="./backups/volumes"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/postgres_data_$TIMESTAMP.tar.gz"

mkdir -p "$BACKUP_DIR"

echo "🔄 Stopping PostgreSQL container..."
docker stop session-notes-db

echo "🔄 Creating volume backup..."
docker run --rm \
  -v session-notes-app_postgres_data:/data \
  -v $(pwd)/$BACKUP_DIR:/backup \
  alpine tar czf /backup/postgres_data_$TIMESTAMP.tar.gz -C /data .

echo "🔄 Starting PostgreSQL container..."
docker start session-notes-db

echo "✅ Volume backup created: $BACKUP_FILE"
```

### Strategy 4: Cloud Storage Integration

**Add to your backup script to upload to cloud:**

**AWS S3:**
```bash
# After creating backup
aws s3 cp "${BACKUP_FILE}.gz" s3://your-backup-bucket/session-notes/
```

**Google Cloud Storage:**
```bash
gsutil cp "${BACKUP_FILE}.gz" gs://your-backup-bucket/session-notes/
```

**FTP/SFTP:**
```bash
scp "${BACKUP_FILE}.gz" user@backup-server:/backups/session-notes/
```

## Restore from Backup

### Restore from SQL Dump:
```bash
# Decompress if needed
gunzip backups/session_notes_backup_20240101_120000.sql.gz

# Restore
docker exec -i session-notes-db psql \
  -U session_user \
  -d session_notes \
  < backups/session_notes_backup_20240101_120000.sql
```

### Restore from Volume Backup:
```bash
# Stop container
docker stop session-notes-db

# Remove old volume (⚠️ WARNING: This deletes current data!)
docker volume rm session-notes-app_postgres_data

# Restore volume
docker run --rm \
  -v session-notes-app_postgres_data:/data \
  -v $(pwd)/backups/volumes:/backup \
  alpine tar xzf /backup/postgres_data_20240101_120000.tar.gz -C /data

# Start container
docker start session-notes-db
```

## Best Practices

### ✅ DO:
1. **Test your backups regularly** - Make sure you can restore from them
2. **Keep multiple backup copies** - Local + Cloud storage
3. **Automate backups** - Don't rely on manual backups
4. **Monitor backup success** - Get alerts if backups fail
5. **Document your restore process** - Know how to restore before you need to
6. **Encrypt sensitive backups** - Especially if uploading to cloud

### ❌ DON'T:
1. Store backups on the same server as the database
2. Rely on only one backup method
3. Forget to test restore procedures
4. Keep backups indefinitely (storage costs)
5. Store backups without encryption

## Quick Setup Commands

```bash
# Create backup directory
mkdir -p backups

# Make backup script executable
chmod +x scripts/backup-database.sh

# Test backup
./scripts/backup-database.sh

# List backups
ls -lh backups/

# Restore from latest backup
gunzip -c backups/session_notes_backup_*.sql.gz | \
  docker exec -i session-notes-db psql -U session_user -d session_notes
```

## Monitoring Backup Health

Add to your backup script to send notifications:

```bash
# Email notification on failure
if [ $? -ne 0 ]; then
  echo "Backup failed at $(date)" | mail -s "Database Backup Failed" admin@example.com
fi

# Slack/Discord webhook
curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  -H 'Content-Type: application/json' \
  -d '{"text":"✅ Database backup completed successfully"}'
```

## Summary

- **What**: `postgres_data` is persistent storage for your database
- **Why**: Protect against data loss from hardware failure, corruption, or mistakes
- **How**: Regular automated backups (SQL dumps recommended)
- **Where**: Local + Cloud storage for redundancy
- **When**: Daily backups for production, weekly for development
- **Test**: Regularly verify you can restore from backups

---

**Remember**: A backup is only as good as your ability to restore it. Test your restore process regularly!

