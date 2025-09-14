# Database Import Commands

## 🗄️ Import Methods for Session Notes App

### Method 1: Automatic Import (Recommended)
```bash
# Start services - database will be created automatically
docker-compose up -d

# Database is ready with schema and sample data
```

### Method 2: Import from SQL File
```bash
# Start database only
docker-compose up -d postgres

# Wait for database to be ready
sleep 10

# Import your SQL file
docker-compose exec -T postgres psql -U session_user -d session_notes < your_file.sql
```

### Method 3: Import from Database Dump
```bash
# Start database
docker-compose up -d postgres
sleep 10

# Import from dump file
docker-compose exec -T postgres psql -U session_user -d session_notes < your_dump.sql
```

### Method 4: Using the Import Script
```bash
# Make script executable
chmod +x import-database.sh

# Run import script
./import-database.sh
```

### Method 5: Direct Database Access
```bash
# Connect to database
docker-compose exec postgres psql -U session_user -d session_notes

# Then run SQL commands directly
```

## 🔧 Database Management Commands

### View Database Status
```bash
# Check if database is running
docker-compose ps postgres

# Check database logs
docker-compose logs postgres
```

### Reset Database
```bash
# Stop and remove database volume
docker-compose down
docker volume rm session-notes-app_postgres_data

# Start fresh
docker-compose up -d postgres
```

### Backup Database
```bash
# Create backup
docker-compose exec postgres pg_dump -U session_user session_notes > backup.sql

# Restore from backup
docker-compose exec -T postgres psql -U session_user -d session_notes < backup.sql
```

### Access Database Shell
```bash
# Connect to database
docker-compose exec postgres psql -U session_user -d session_notes

# List tables
\dt

# View table structure
\d table_name

# Exit
\q
```

## 📁 Database Files Location

- **Schema**: `./database/schema.sql`
- **Sample Data**: `./database/sample_data.sql`
- **Migration Script**: `./database/migration.js`

## 🔍 Troubleshooting

### Database Connection Issues
```bash
# Check if database is healthy
docker-compose exec postgres pg_isready -U session_user -d session_notes

# View database logs
docker-compose logs postgres
```

### Import Errors
```bash
# Check if file exists
ls -la your_file.sql

# Check file permissions
chmod 644 your_file.sql

# Test SQL syntax
docker-compose exec postgres psql -U session_user -d session_notes -c "SELECT 1;"
```
