#!/usr/bin/env node

/**
 * Database Migration Script for Session Notes Generator
 * Runs the database schema and sample data setup
 * 
 * Updated: Reflects latest schema changes
 * - Removed: session_templates, interventions, session_interventions tables
 * - Added: objectives_selected column to clients table
 * 
 * Usage:
 *   node database/migration.js [--sample-data]
 * 
 * Options:
 *   --sample-data  Include sample data insertion
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Database configuration - supports DATABASE_URL or individual variables
let dbConfig;
if (process.env.DATABASE_URL) {
  // Use DATABASE_URL if provided (common in Docker/production)
  dbConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  };
} else {
  // Fallback to individual variables
  dbConfig = {
    user: process.env.DB_USER || 'session_notes_user',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'session_notes_db',
    password: process.env.DB_PASSWORD || 'your_secure_password_here',
    port: parseInt(process.env.DB_PORT || '5432', 10),
  };
}

async function runMigration() {
  const pool = new Pool(dbConfig);
  const includeSampleData = process.argv.includes('--sample-data');
  
  try {
    console.log('🚀 Starting database migration...');
    
    // Display database connection info (without password)
    if (dbConfig.connectionString) {
      const url = new URL(dbConfig.connectionString);
      console.log(`📊 Database: ${url.pathname.slice(1)}@${url.hostname}:${url.port || 5432}`);
    } else {
      console.log(`📊 Database: ${dbConfig.database}@${dbConfig.host}:${dbConfig.port}`);
    }
    
    // Test connection
    const client = await pool.connect();
    console.log('✅ Database connection successful');
    
    // Read and execute schema from database.sql
    console.log('📋 Creating database schema...');
    const schemaSQL = fs.readFileSync(path.join(__dirname, 'database.sql'), 'utf8');
    
    // Execute the entire SQL file
    // PostgreSQL handles multiple statements separated by semicolons
    try {
      await client.query(schemaSQL);
      console.log('✅ Database schema created successfully');
    } catch (error) {
      // Some errors are expected (like "already exists" for IF NOT EXISTS)
      if (error.message.includes('already exists') || 
          error.message.includes('duplicate key') ||
          error.message.includes('does not exist')) {
        console.log('✅ Database schema applied (some objects may already exist)');
      } else {
        // Re-throw unexpected errors
        throw error;
      }
    }
    
    // Insert sample data if requested
    if (includeSampleData) {
      console.log('📝 Inserting sample data...');
      
      // Insert default admin user
      const adminPasswordHash = await client.query(
        `SELECT crypt('admin123', gen_salt('bf')) as hash`
      );
      const adminHash = adminPasswordHash.rows[0].hash;
      
      await client.query(`
        INSERT INTO users (username, password_hash, role, first_name, last_name, is_active)
        VALUES ('admin', $1, 'admin', 'Admin', 'User', true)
        ON CONFLICT (username) DO NOTHING
      `, [adminHash]);
      
      // Insert sample peer support user
      const peerPasswordHash = await client.query(
        `SELECT crypt('peer123', gen_salt('bf')) as hash`
      );
      const peerHash = peerPasswordHash.rows[0].hash;
      
      await client.query(`
        INSERT INTO users (username, password_hash, role, first_name, last_name, is_active)
        VALUES ('peer', $1, 'peer_support', 'Peer', 'Support', true)
        ON CONFLICT (username) DO NOTHING
      `, [peerHash]);
      
      // Insert sample locations
      await client.query(`
        INSERT INTO session_locations (name, description, is_active)
        VALUES 
          ('Home', 'Client residence', true),
          ('Office', 'Agency office location', true),
          ('Community Center', 'Community-based setting', true),
          ('Telehealth', 'Virtual session', true)
        ON CONFLICT DO NOTHING
      `);
      
      // Insert sample objectives
      await client.query(`
        INSERT INTO treatment_objectives (name, category, description, is_active)
        VALUES 
          ('Anxiety management', 'Mental Health', 'Reduce anxiety symptoms through peer support', true),
          ('Self-esteem building', 'Personal Development', 'Build confidence and self-worth', true),
          ('Substance abuse recovery', 'Recovery', 'Support recovery journey', true),
          ('Parenting skills', 'Life Skills', 'Develop effective parenting strategies', true),
          ('Educational goals', 'Education', 'Support educational achievement', true)
        ON CONFLICT DO NOTHING
      `);
      
      console.log('✅ Sample data inserted successfully');
    }
    
    // Verify setup
    console.log('🔍 Verifying database setup...');
    
    // Check if tables exist
    const tablesCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'clients', 'session_locations', 'treatment_objectives', 'session_notes', 'session_objectives', 'audit_logs')
      ORDER BY table_name
    `);
    
    const existingTables = tablesCheck.rows.map(r => r.table_name);
    console.log('📋 Tables created:', existingTables.join(', '));
    
    // Verify removed tables don't exist
    const removedTablesCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('session_templates', 'interventions', 'session_interventions')
    `);
    
    if (removedTablesCheck.rows.length > 0) {
      console.warn('⚠️  Warning: Found old tables that should be removed:');
      removedTablesCheck.rows.forEach(r => console.warn(`   - ${r.table_name}`));
    }
    
    // Get statistics
    const result = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as users_count,
        (SELECT COUNT(*) FROM clients) as clients_count,
        (SELECT COUNT(*) FROM session_locations) as locations_count,
        (SELECT COUNT(*) FROM treatment_objectives) as objectives_count,
        (SELECT COUNT(*) FROM session_notes) as notes_count
    `);
    
    const stats = result.rows[0];
    console.log('\n📊 Database Statistics:');
    console.log(`   👥 Users: ${stats.users_count}`);
    console.log(`   🏥 Clients: ${stats.clients_count}`);
    console.log(`   📍 Locations: ${stats.locations_count}`);
    console.log(`   🎯 Objectives: ${stats.objectives_count}`);
    console.log(`   📄 Session Notes: ${stats.notes_count}`);
    
    // Check for objectives_selected column
    const columnCheck = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'clients' 
      AND column_name = 'objectives_selected'
    `);
    
    if (columnCheck.rows.length > 0) {
      console.log(`   ✅ Clients table has objectives_selected column (${columnCheck.rows[0].data_type})`);
    } else {
      console.warn('   ⚠️  Warning: objectives_selected column not found in clients table');
    }
    
    client.release();
    console.log('\n🎉 Database migration completed successfully!');
    
    if (!includeSampleData) {
      console.log('\n💡 Tip: Run with --sample-data flag to include test data');
    } else {
      console.log('\n🔐 Default Login Credentials:');
      console.log('   Admin - Username: admin, Password: admin123');
      console.log('   Peer Support - Username: peer, Password: peer123');
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run migration
runMigration();
