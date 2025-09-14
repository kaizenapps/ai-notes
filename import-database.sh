#!/bin/bash

# Database Import Script for Session Notes App
# This script helps import data from an existing database dump

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🗄️  Database Import Script${NC}"

# Check if docker-compose is running
if ! docker-compose ps | grep -q "session-notes-db.*Up"; then
    echo -e "${YELLOW}⚠️  Starting database container...${NC}"
    docker-compose up -d postgres
    sleep 10
fi

# Function to import from SQL file
import_sql_file() {
    local file_path=$1
    local description=$2
    
    if [ -f "$file_path" ]; then
        echo -e "${GREEN}📥 Importing $description...${NC}"
        docker-compose exec -T postgres psql -U session_user -d session_notes < "$file_path"
        echo -e "${GREEN}✅ $description imported successfully${NC}"
    else
        echo -e "${RED}❌ File not found: $file_path${NC}"
    fi
}

# Function to import from database dump
import_dump() {
    local dump_file=$1
    
    if [ -f "$dump_file" ]; then
        echo -e "${GREEN}📥 Importing database dump: $dump_file${NC}"
        docker-compose exec -T postgres psql -U session_user -d session_notes < "$dump_file"
        echo -e "${GREEN}✅ Database dump imported successfully${NC}"
    else
        echo -e "${RED}❌ Dump file not found: $dump_file${NC}"
        exit 1
    fi
}

# Main menu
echo -e "${YELLOW}Choose import method:${NC}"
echo "1. Import from SQL file"
echo "2. Import from database dump (.sql file)"
echo "3. Import from PostgreSQL dump (.dump file)"
echo "4. Import sample data only"
echo "5. Reset database and import schema + sample data"

read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        read -p "Enter path to SQL file: " sql_file
        import_sql_file "$sql_file" "SQL file"
        ;;
    2)
        read -p "Enter path to database dump (.sql): " dump_file
        import_dump "$dump_file"
        ;;
    3)
        read -p "Enter path to PostgreSQL dump (.dump): " dump_file
        echo -e "${GREEN}📥 Importing PostgreSQL dump: $dump_file${NC}"
        docker-compose exec -T postgres pg_restore -U session_user -d session_notes < "$dump_file"
        echo -e "${GREEN}✅ PostgreSQL dump imported successfully${NC}"
        ;;
    4)
        import_sql_file "./database/sample_data.sql" "sample data"
        ;;
    5)
        echo -e "${YELLOW}🔄 Resetting database...${NC}"
        docker-compose down
        docker volume rm session-notes-app_postgres_data 2>/dev/null || true
        docker-compose up -d postgres
        sleep 10
        echo -e "${GREEN}✅ Database reset and schema imported${NC}"
        ;;
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}🎉 Database import completed!${NC}"
echo -e "${YELLOW}📋 You can now start the application with: docker-compose up -d${NC}"
