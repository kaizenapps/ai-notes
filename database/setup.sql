-- Database Setup Script for Session Notes Generator
-- Run this script to create the database and user

-- Create database (run as superuser)
CREATE DATABASE session_notes_db
    WITH 
    OWNER = postgres
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF-8'
    LC_CTYPE = 'en_US.UTF-8'
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1
    TEMPLATE = template0;

-- Create application user with limited privileges
CREATE USER session_notes_user WITH
    LOGIN
    NOSUPERUSER
    NOCREATEDB
    NOCREATEROLE
    INHERIT
    NOREPLICATION
    CONNECTION LIMIT -1
    PASSWORD 'your_secure_password_here';

-- Grant necessary privileges to the application user
GRANT CONNECT ON DATABASE session_notes_db TO session_notes_user;

-- Connect to the session_notes_db database
\c session_notes_db;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO session_notes_user;

-- Grant table privileges (run after creating tables)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO session_notes_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO session_notes_user;

-- Grant privileges on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO session_notes_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO session_notes_user;

-- Create read-only user for reporting/analytics
CREATE USER session_notes_readonly WITH
    LOGIN
    NOSUPERUSER
    NOCREATEDB
    NOCREATEROLE
    INHERIT
    NOREPLICATION
    CONNECTION LIMIT -1
    PASSWORD 'readonly_password_here';

GRANT CONNECT ON DATABASE session_notes_db TO session_notes_readonly;
GRANT USAGE ON SCHEMA public TO session_notes_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO session_notes_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO session_notes_readonly;
