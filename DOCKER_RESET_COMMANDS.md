# Docker Reset Commands - Fresh Deployment

Commands to completely reset Docker containers and volumes for fresh deployment with new updates and data.

## 🛑 Complete Reset (Remove Everything)

### Step 1: Stop and Remove Containers

```bash
# Stop all containers
docker-compose down

# Or stop and remove containers, networks (keeps volumes)
docker-compose down --remove-orphans
```

### Step 2: Remove Volumes (⚠️ This deletes all database data!)

```bash
# Remove specific volume (recommended)
docker volume rm session-notes-app_postgres_data

# Or remove all volumes for this project
docker-compose down -v
```

### Step 3: Verify Everything is Removed

```bash
# Check containers
docker ps -a | grep session-notes

# Check volumes
docker volume ls | grep session-notes

# Check networks
docker network ls | grep session-notes
```

## 🚀 Complete Reset Script

**One command to reset everything:**

```bash
# Stop containers, remove volumes, and clean up
docker-compose down -v --remove-orphans
```

**Or step by step:**

```bash
# 1. Stop containers
docker-compose stop

# 2. Remove containers
docker-compose rm -f

# 3. Remove volumes
docker volume rm session-notes-app_postgres_data

# 4. Remove networks (optional)
docker network rm session-notes-app_session-notes-network 2>/dev/null || true
```

## 📋 Commands Reference

### Stop Containers

```bash
# Stop all services
docker-compose stop

# Stop specific service
docker-compose stop postgres
docker-compose stop app

# Force stop (if containers hang)
docker-compose kill
```

### Remove Containers

```bash
# Remove stopped containers
docker-compose rm -f

# Remove containers and networks
docker-compose down

# Remove containers, networks, and volumes
docker-compose down -v
```

### Remove Volumes

```bash
# Remove specific volume
docker volume rm session-notes-app_postgres_data

# Remove all volumes for this project
docker-compose down -v

# List volumes to see what exists
docker volume ls

# Inspect volume (check size, etc.)
docker volume inspect session-notes-app_postgres_data
```

### Remove Everything (Nuclear Option)

```bash
# Complete cleanup - removes containers, volumes, networks
docker-compose down -v --remove-orphans

# Verify everything is gone
docker ps -a
docker volume ls
docker network ls
```

## 🔄 Fresh Deployment After Reset

### Step 1: Reset Everything

```bash
# Stop and remove everything including volumes
docker-compose down -v --remove-orphans
```

### Step 2: Import New Data (Optional)

If you have a backup to import:

```bash
# Start fresh containers
docker-compose up -d postgres

# Wait for database to initialize
sleep 10

# Import your backup
gunzip -c your_backup.sql.gz | \
  docker exec -i session-notes-db psql -U session_user -d session_notes
```

### Step 3: Start Fresh Containers

```bash
# Start all services with fresh database
docker-compose up -d

# Or build and start
docker-compose up -d --build
```

### Step 4: Verify Fresh Deployment

```bash
# Check containers are running
docker-compose ps

# Check database is initialized
docker exec session-notes-db psql -U session_user -d session_notes -c "\dt"

# Check application logs
docker-compose logs app
```

## 📝 Complete Reset and Deploy Script

Create `scripts/reset-and-deploy.sh`:

```bash
#!/bin/bash
set -e

echo "🛑 Stopping and removing containers..."
docker-compose down -v --remove-orphans

echo "🧹 Cleaning up..."
# Remove any dangling containers
docker container prune -f

# Remove any dangling volumes
docker volume prune -f

echo "✅ Cleanup complete!"

echo "🚀 Starting fresh deployment..."
docker-compose up -d --build

echo "⏳ Waiting for services to start..."
sleep 10

echo "🔍 Verifying deployment..."
if docker-compose ps | grep -q "Up"; then
    echo "✅ Services are running!"
    echo ""
    echo "📊 Container status:"
    docker-compose ps
    echo ""
    echo "📋 Database tables:"
    docker exec session-notes-db psql -U session_user -d session_notes -c "\dt" || echo "Database not ready yet"
else
    echo "❌ Some services failed to start"
    docker-compose logs
    exit 1
fi

echo ""
echo "🎉 Fresh deployment complete!"
echo "🌐 Application: http://localhost:3000"
```

**Make executable and run:**
```bash
chmod +x scripts/reset-and-deploy.sh
./scripts/reset-and-deploy.sh
```

## 🔄 Reset and Import New Data

If you want to reset and import new data:

```bash
# Step 1: Reset everything
docker-compose down -v --remove-orphans

# Step 2: Start database only
docker-compose up -d postgres

# Step 3: Wait for initialization
sleep 10

# Step 4: Import your new data
# Option A: From local PostgreSQL
export $(cat .env.local | grep -v '^#' | xargs)
PGPASSWORD="$DB_PASSWORD" pg_dump \
  -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" | \
  docker exec -i session-notes-db psql -U session_user -d session_notes

# Option B: From backup file
gunzip -c your_backup.sql.gz | \
  docker exec -i session-notes-db psql -U session_user -d session_notes

# Step 5: Start all services
docker-compose up -d
```

## ⚠️ Important Notes

### Before Resetting

1. **Backup your data first!**
   ```bash
   # Backup before reset
   docker exec session-notes-db pg_dump -U session_user -d session_notes | \
     gzip > backup_before_reset_$(date +%Y%m%d_%H%M%S).sql.gz
   ```

2. **Stop the application** if it's running to avoid data corruption

3. **Note your current database credentials** if you need to restore

### After Resetting

1. **Database will be re-initialized** from `database/database.sql`
2. **All existing data will be lost** unless you restore from backup
3. **New containers will be created** with fresh state

## 🧹 Cleanup Commands

### Remove Only Containers (Keep Volumes)

```bash
# Stop and remove containers but keep data
docker-compose down
```

### Remove Only Volumes (Keep Containers)

```bash
# Stop containers first
docker-compose stop

# Remove specific volume
docker volume rm session-notes-app_postgres_data

# Start containers again (will create new empty volume)
docker-compose up -d
```

### Remove Everything Docker-Related (Project Only)

```bash
# Remove containers, volumes, networks
docker-compose down -v --remove-orphans

# Remove images (optional)
docker-compose down --rmi all
```

## 🔍 Verification Commands

### Check What Will Be Removed

```bash
# List containers
docker-compose ps

# List volumes
docker volume ls | grep session-notes

# List networks
docker network ls | grep session-notes
```

### After Reset - Verify Fresh State

```bash
# Check containers are running
docker-compose ps

# Check database is empty/fresh
docker exec session-notes-db psql -U session_user -d session_notes -c "\dt"

# Check application is responding
curl http://localhost:3000/api/health
```

## 📋 Quick Reference

```bash
# COMPLETE RESET (removes everything)
docker-compose down -v --remove-orphans

# RESET AND START FRESH
docker-compose down -v --remove-orphans && docker-compose up -d --build

# RESET AND IMPORT DATA
docker-compose down -v --remove-orphans && \
docker-compose up -d postgres && \
sleep 10 && \
gunzip -c backup.sql.gz | docker exec -i session-notes-db psql -U session_user -d session_notes && \
docker-compose up -d

# BACKUP BEFORE RESET
docker exec session-notes-db pg_dump -U session_user -d session_notes | \
  gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

## 🆘 Troubleshooting

**Error: "volume is in use"**
```bash
# Stop containers first
docker-compose stop

# Then remove volume
docker volume rm session-notes-app_postgres_data
```

**Error: "container name already in use"**
```bash
# Remove container explicitly
docker rm -f session-notes-db session-notes-app

# Or remove all
docker-compose rm -f
```

**Volume still exists after removal**
```bash
# Force remove
docker volume rm -f session-notes-app_postgres_data

# Check if it's really gone
docker volume ls | grep session-notes
```

**Can't connect after reset**
```bash
# Wait for database to initialize
docker-compose logs postgres

# Check if database is ready
docker exec session-notes-db pg_isready -U session_user
```

---

**💡 Remember**: Always backup before resetting! Once volumes are deleted, data cannot be recovered without a backup.

