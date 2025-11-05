#!/bin/bash

# Database Import Script for Session Notes App
# This script helps import data from an existing database dump or backup files

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🗄️  Database Import Script${NC}"

# Load Docker database credentials from .env (production) or docker-compose defaults
DOCKER_DB_USER="${POSTGRES_USER:-session_user}"
DOCKER_DB_NAME="${POSTGRES_DB:-session_notes}"

# If .env exists, try to load it for Docker container credentials
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    DOCKER_DB_USER="${POSTGRES_USER:-session_user}"
    DOCKER_DB_NAME="${POSTGRES_DB:-session_notes}"
fi

# Check if docker compose is running
if ! docker compose ps | grep -q "session-notes-db.*Up"; then
    echo -e "${YELLOW}⚠️  Starting database container...${NC}"
    docker compose up -d postgres
    sleep 10
fi

# Function to list backup files
list_backup_files() {
    local backup_dir="${BACKUP_DIR:-./backups}"
    local backup_files=()
    
    # Find all backup files
    if [ -d "$backup_dir" ]; then
        while IFS= read -r -d '' file; do
            backup_files+=("$file")
        done < <(find "$backup_dir" -type f \( -name "*.sql" -o -name "*.sql.gz" -o -name "*.dump" \) -print0 2>/dev/null | sort -z)
    fi
    
    # Also check current directory
    while IFS= read -r -d '' file; do
        backup_files+=("$file")
    done < <(find . -maxdepth 1 -type f \( -name "backup_*.sql" -o -name "backup_*.sql.gz" -o -name "local_backup_*.sql" -o -name "local_backup_*.sql.gz" -o -name "migration_backup_*.sql.gz" \) -print0 2>/dev/null | sort -z)
    
    if [ ${#backup_files[@]} -eq 0 ]; then
        echo -e "${YELLOW}⚠️  No backup files found in $backup_dir or current directory${NC}"
        return 1
    fi
    
    echo -e "${BLUE}📁 Found ${#backup_files[@]} backup file(s):${NC}"
    echo ""
    for i in "${!backup_files[@]}"; do
        local file="${backup_files[$i]}"
        local size=$(du -h "$file" 2>/dev/null | cut -f1 || echo "unknown")
        
        # Get file date - try multiple methods for cross-platform compatibility
        local date=""
        if date=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$file" 2>/dev/null); then
            : # macOS format worked
        elif date=$(stat -c "%y" "$file" 2>/dev/null | cut -d' ' -f1,2 | cut -d'.' -f1); then
            : # Linux format worked
        elif date=$(ls -l "$file" 2>/dev/null | awk '{print $6, $7, $8}'); then
            : # Fallback to ls
        else
            date="unknown"
        fi
        
        echo -e "  ${GREEN}[$((i+1))]${NC} $file"
        echo -e "      Size: $size | Modified: $date"
    done
    echo ""
    
    # Export array for use in caller
    BACKUP_FILES=("${backup_files[@]}")
    return 0
}

# Function to check if database has existing data
check_existing_data() {
    local table_count=$(docker compose exec -T postgres psql -U "$DOCKER_DB_USER" -d "$DOCKER_DB_NAME" -t -c \
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' \n')
    
    if [ "$table_count" -gt 0 ] 2>/dev/null; then
        return 0  # Has tables
    else
        return 1  # Empty database
    fi
}

# Function to ensure fresh database (no tables)
ensure_fresh_database() {
    echo -e "${YELLOW}🔄 Ensuring fresh database (removing existing tables if any)...${NC}"
    
    # Drop all tables if they exist
    docker compose exec -T postgres psql -U "$DOCKER_DB_USER" -d "$DOCKER_DB_NAME" -c "
        DO \$\$ 
        DECLARE 
            r RECORD;
        BEGIN
            FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
                EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
            END LOOP;
        END \$\$;
    " 2>/dev/null || true
    
    # Drop all extensions and recreate them
    docker compose exec -T postgres psql -U "$DOCKER_DB_USER" -d "$DOCKER_DB_NAME" -c "
        DROP EXTENSION IF EXISTS pgcrypto CASCADE;
        DROP EXTENSION IF EXISTS \"uuid-ossp\" CASCADE;
    " 2>/dev/null || true
    
    echo -e "${GREEN}✅ Database is now fresh and ready for import${NC}"
}

# Function to import from SQL file
import_sql_file() {
    local file_path=$1
    local description=$2
    local force="${3:-false}"
    
    if [ ! -f "$file_path" ]; then
        echo -e "${RED}❌ File not found: $file_path${NC}"
        return 1
    fi
    
    # Check if database has existing data
    if [ "$force" != "true" ] && check_existing_data; then
        echo -e "${YELLOW}⚠️  WARNING: Database already contains tables!${NC}"
        echo -e "${YELLOW}   Importing may cause errors or conflicts.${NC}"
        read -p "Do you want to clear existing tables first? (yes/no): " reset_choice
        if [ "$reset_choice" = "yes" ]; then
            ensure_fresh_database
        fi
    fi
    
    echo -e "${GREEN}📥 Importing $description...${NC}"
    echo -e "${BLUE}   File: $file_path${NC}"
    
    # Check if file is compressed
    if [[ "$file_path" == *.gz ]]; then
        echo -e "${BLUE}   Decompressing and importing...${NC}"
        
        # Use psql with error handling - suppress expected errors but keep important ones
        echo -e "${BLUE}   Importing (this may take a moment)...${NC}"
        
        # Import and filter out expected/harmless errors
        import_output=$(gunzip -c "$file_path" | \
            docker compose exec -T postgres psql \
                -U "$DOCKER_DB_USER" \
                -d "$DOCKER_DB_NAME" \
                -v ON_ERROR_STOP=0 \
                2>&1)
        
        # Count errors
        error_count=$(echo "$import_output" | grep -c "ERROR:" || echo "0")
        warning_count=$(echo "$import_output" | grep -c "WARNING:" || echo "0")
        
        # Show only important errors (filter out expected ones)
        important_errors=$(echo "$import_output" | \
            grep "ERROR:" | \
            grep -v "role \"postgres\" does not exist" | \
            grep -v "already exists" | \
            grep -v "trailing junk" | \
            grep -v "column.*does not exist" || true)
        
        # Show warnings if any
        if [ "$warning_count" -gt 0 ]; then
            echo -e "${YELLOW}   ⚠️  $warning_count warning(s) during import${NC}"
        fi
        
        # Show important errors if any
        if [ -n "$important_errors" ]; then
            echo -e "${RED}   ❌ Important errors found:${NC}"
            echo "$important_errors" | head -5
            if [ "$(echo "$important_errors" | wc -l)" -gt 5 ]; then
                echo -e "${RED}   ... and $(($(echo "$important_errors" | wc -l) - 5)) more${NC}"
            fi
        elif [ "$error_count" -gt 0 ]; then
            # Only expected errors were found
            echo -e "${GREEN}   ✓ Import completed (ignored $error_count expected error(s))${NC}"
        fi
        
    else
        echo -e "${BLUE}   Importing (this may take a moment)...${NC}"
        
        # Import and filter out expected/harmless errors
        import_output=$(docker compose exec -T postgres psql \
            -U "$DOCKER_DB_USER" \
            -d "$DOCKER_DB_NAME" \
            -v ON_ERROR_STOP=0 \
            < "$file_path" 2>&1)
        
        # Count errors
        error_count=$(echo "$import_output" | grep -c "ERROR:" || echo "0")
        
        # Show only important errors
        important_errors=$(echo "$import_output" | \
            grep "ERROR:" | \
            grep -v "role \"postgres\" does not exist" | \
            grep -v "already exists" | \
            grep -v "trailing junk" | \
            grep -v "column.*does not exist" || true)
        
        if [ -n "$important_errors" ]; then
            echo -e "${RED}   ❌ Important errors found:${NC}"
            echo "$important_errors" | head -5
        elif [ "$error_count" -gt 0 ]; then
            echo -e "${GREEN}   ✓ Import completed (ignored $error_count expected error(s))${NC}"
        fi
    fi
    
    # Verify import
    if check_existing_data; then
        local table_count=$(docker compose exec -T postgres psql -U "$DOCKER_DB_USER" -d "$DOCKER_DB_NAME" -t -c \
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' \n')
        echo -e "${GREEN}✅ Import completed! Found $table_count table(s) in database${NC}"
        
        # Check for data
        local user_count=$(docker compose exec -T postgres psql -U "$DOCKER_DB_USER" -d "$DOCKER_DB_NAME" -t -c \
            "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d ' \n')
        local client_count=$(docker compose exec -T postgres psql -U "$DOCKER_DB_USER" -d "$DOCKER_DB_NAME" -t -c \
            "SELECT COUNT(*) FROM clients;" 2>/dev/null | tr -d ' \n')
        
        if [ "$user_count" -gt 0 ] 2>/dev/null || [ "$client_count" -gt 0 ] 2>/dev/null; then
            echo -e "${GREEN}   Users: $user_count | Clients: $client_count${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Import completed but database appears empty${NC}"
        echo -e "${YELLOW}   Check the errors above - backup file may be incompatible${NC}"
    fi
}

# Function to import from database dump
import_dump() {
    local dump_file=$1
    
    if [ -f "$dump_file" ]; then
        echo -e "${GREEN}📥 Importing database dump: $dump_file${NC}"
        
        # Check file type
        if [[ "$dump_file" == *.gz ]]; then
            gunzip -c "$dump_file" | docker compose exec -T postgres psql -U "$DOCKER_DB_USER" -d "$DOCKER_DB_NAME"
        else
            docker compose exec -T postgres psql -U "$DOCKER_DB_USER" -d "$DOCKER_DB_NAME" < "$dump_file"
        fi
        
        echo -e "${GREEN}✅ Database dump imported successfully${NC}"
    else
        echo -e "${RED}❌ Dump file not found: $dump_file${NC}"
        return 1
    fi
}

# Main menu
echo -e "${YELLOW}Choose import method:${NC}"
echo "1. Select from existing backup files"
echo "2. Import from SQL file (enter path manually)"
echo "3. Import from database dump (.sql file)"
echo "4. Import from PostgreSQL dump (.dump file)"
echo "5. Import from local PostgreSQL (using .env - production)"
echo "6. Reset database and import schema only"

read -p "Enter your choice (1-6): " choice

case $choice in
    1)
        # List and select from backup files
        if list_backup_files; then
            echo -e "${YELLOW}Select a backup file to import:${NC}"
            read -p "Enter file number (1-${#BACKUP_FILES[@]}): " file_num
            
            if [ "$file_num" -ge 1 ] && [ "$file_num" -le "${#BACKUP_FILES[@]}" ]; then
                selected_file="${BACKUP_FILES[$((file_num-1))]}"
                echo -e "${BLUE}Selected: $selected_file${NC}"
                echo ""
                
                # Ensure fresh database before import
                if check_existing_data; then
                    echo -e "${YELLOW}⚠️  Database contains existing tables. Clearing them for fresh import...${NC}"
                    ensure_fresh_database
                fi
                
                import_sql_file "$selected_file" "backup file" "true"
            else
                echo -e "${RED}❌ Invalid file number${NC}"
                exit 1
            fi
        else
            echo -e "${RED}❌ No backup files available${NC}"
            exit 1
        fi
        ;;
    2)
        read -p "Enter path to SQL file: " sql_file
        import_sql_file "$sql_file" "SQL file"
        ;;
    3)
        read -p "Enter path to database dump (.sql): " dump_file
        import_dump "$dump_file"
        ;;
    4)
        read -p "Enter path to PostgreSQL dump (.dump): " dump_file
        if [ -f "$dump_file" ]; then
            echo -e "${GREEN}📥 Importing PostgreSQL dump: $dump_file${NC}"
            docker compose exec -T postgres pg_restore -U "$DOCKER_DB_USER" -d "$DOCKER_DB_NAME" --clean --if-exists < "$dump_file"
            echo -e "${GREEN}✅ PostgreSQL dump imported successfully${NC}"
        else
            echo -e "${RED}❌ Dump file not found: $dump_file${NC}"
            exit 1
        fi
        ;;
    5)
        # Import from local PostgreSQL using .env (production)
        if [ -f .env ]; then
            echo -e "${BLUE}📋 Loading credentials from .env (production)...${NC}"
            # Re-load .env to ensure we have the latest values
            export $(cat .env | grep -v '^#' | xargs)
            
            # Try to extract from DATABASE_URL first, then fall back to individual vars
            if [ -n "$DATABASE_URL" ]; then
                # Parse DATABASE_URL format: postgresql://user:password@host:port/database
                LOCAL_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
                LOCAL_PASS=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
                LOCAL_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
                LOCAL_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
                LOCAL_DB=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
            else
                # Fall back to individual environment variables
                LOCAL_USER="${POSTGRES_USER:-${DB_USER:-session_user}}"
                LOCAL_DB="${POSTGRES_DB:-${DB_NAME:-session_notes}}"
                LOCAL_HOST="${DB_HOST:-localhost}"
                LOCAL_PORT="${DB_PORT:-5432}"
                LOCAL_PASS="${POSTGRES_PASSWORD:-${DB_PASSWORD}}"
            fi
            
            if [ -z "$LOCAL_PASS" ]; then
                echo -e "${RED}❌ Database password not found in .env${NC}"
                echo -e "${YELLOW}   Please set DATABASE_URL or POSTGRES_PASSWORD/DB_PASSWORD in .env${NC}"
                exit 1
            fi
            
            echo -e "${GREEN}📥 Importing from local PostgreSQL...${NC}"
            echo -e "${BLUE}   Source: $LOCAL_USER@$LOCAL_HOST:$LOCAL_PORT/$LOCAL_DB${NC}"
            
            # Ensure fresh database
            if check_existing_data; then
                echo -e "${YELLOW}⚠️  Clearing existing tables for fresh import...${NC}"
                ensure_fresh_database
            fi
            
            PGPASSWORD="$LOCAL_PASS" pg_dump \
                -U "$LOCAL_USER" \
                -d "$LOCAL_DB" \
                -h "$LOCAL_HOST" \
                -p "$LOCAL_PORT" | \
                docker compose exec -T postgres psql \
                    -U "$DOCKER_DB_USER" \
                    -d "$DOCKER_DB_NAME" \
                    -v ON_ERROR_STOP=0
            
            echo -e "${GREEN}✅ Import from local PostgreSQL completed successfully${NC}"
        else
            echo -e "${RED}❌ .env file not found${NC}"
            echo -e "${YELLOW}   Please create .env file with database credentials${NC}"
            exit 1
        fi
        ;;
    6)
        echo -e "${YELLOW}🔄 Resetting database...${NC}"
        echo -e "${RED}⚠️  WARNING: This will delete all existing data!${NC}"
        read -p "Are you sure? (yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            docker compose down
            docker volume rm session-notes-app_postgres_data 2>/dev/null || true
            docker compose up -d postgres
            sleep 10
            echo -e "${GREEN}✅ Database reset and schema imported${NC}"
        else
            echo -e "${YELLOW}❌ Reset cancelled${NC}"
            exit 0
        fi
        ;;
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}🎉 Database import completed!${NC}"
echo -e "${YELLOW}📋 You can now start the application with: docker compose up -d${NC}"

