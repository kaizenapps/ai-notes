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
        local size=$(du -h "$file" | cut -f1)
        local date=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$file" 2>/dev/null || stat -c "%y" "$file" 2>/dev/null | cut -d' ' -f1,2 | cut -d'.' -f1)
        echo -e "  ${GREEN}[$((i+1))]${NC} $file"
        echo -e "      Size: $size | Date: $date"
    done
    echo ""
    
    # Export array for use in caller
    BACKUP_FILES=("${backup_files[@]}")
    return 0
}

# Function to import from SQL file
import_sql_file() {
    local file_path=$1
    local description=$2
    
    if [ -f "$file_path" ]; then
        echo -e "${GREEN}📥 Importing $description...${NC}"
        
        # Check if file is compressed
        if [[ "$file_path" == *.gz ]]; then
            echo -e "${BLUE}   Decompressing and importing...${NC}"
            gunzip -c "$file_path" | docker compose exec -T postgres psql -U session_user -d session_notes
        else
            docker compose exec -T postgres psql -U session_user -d session_notes < "$file_path"
        fi
        
        echo -e "${GREEN}✅ $description imported successfully${NC}"
    else
        echo -e "${RED}❌ File not found: $file_path${NC}"
        return 1
    fi
}

# Function to import from database dump
import_dump() {
    local dump_file=$1
    
    if [ -f "$dump_file" ]; then
        echo -e "${GREEN}📥 Importing database dump: $dump_file${NC}"
        
        # Check file type
        if [[ "$dump_file" == *.gz ]]; then
            gunzip -c "$dump_file" | docker compose exec -T postgres psql -U session_user -d session_notes
        else
            docker compose exec -T postgres psql -U session_user -d session_notes < "$dump_file"
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
echo "5. Import from local PostgreSQL (using .env.local)"
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
                import_sql_file "$selected_file" "backup file"
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
            docker compose exec -T postgres pg_restore -U session_user -d session_notes --clean --if-exists < "$dump_file"
            echo -e "${GREEN}✅ PostgreSQL dump imported successfully${NC}"
        else
            echo -e "${RED}❌ Dump file not found: $dump_file${NC}"
            exit 1
        fi
        ;;
    5)
        # Import from local PostgreSQL using .env.local
        if [ -f .env.local ]; then
            echo -e "${BLUE}📋 Loading credentials from .env.local...${NC}"
            export $(cat .env.local | grep -v '^#' | xargs)
            
            LOCAL_USER="${DB_USER:-session_notes_user}"
            LOCAL_DB="${DB_NAME:-session_notes_db}"
            LOCAL_HOST="${DB_HOST:-localhost}"
            LOCAL_PORT="${DB_PORT:-5432}"
            LOCAL_PASS="${DB_PASSWORD}"
            
            if [ -z "$LOCAL_PASS" ]; then
                echo -e "${RED}❌ DB_PASSWORD not found in .env.local${NC}"
                exit 1
            fi
            
            echo -e "${GREEN}📥 Importing from local PostgreSQL...${NC}"
            echo -e "${BLUE}   Source: $LOCAL_USER@$LOCAL_HOST:$LOCAL_PORT/$LOCAL_DB${NC}"
            
            PGPASSWORD="$LOCAL_PASS" pg_dump \
                -U "$LOCAL_USER" \
                -d "$LOCAL_DB" \
                -h "$LOCAL_HOST" \
                -p "$LOCAL_PORT" | \
                docker compose exec -T postgres psql -U session_user -d session_notes
            
            echo -e "${GREEN}✅ Import from local PostgreSQL completed successfully${NC}"
        else
            echo -e "${RED}❌ .env.local file not found${NC}"
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

