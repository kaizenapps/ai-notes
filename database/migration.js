#!/usr/bin/env node

/**
 * Database Migration Script for Session Notes Generator
 * Runs the database schema and sample data setup
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

// Database configuration
const dbConfig = {
  user: process.env.DB_USER || 'session_notes_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'session_notes_db',
  password: process.env.DB_PASSWORD || 'your_secure_password_here',
  port: process.env.DB_PORT || 5432,
};

async function runMigration() {
  const pool = new Pool(dbConfig);
  const includeSampleData = process.argv.includes('--sample-data');
  
  try {
    console.log('🚀 Starting database migration...');
    console.log(`📊 Database: ${dbConfig.database}@${dbConfig.host}:${dbConfig.port}`);
    
    // Test connection
    const client = await pool.connect();
    console.log('✅ Database connection successful');
    
    // Read and execute schema
    console.log('📋 Creating database schema...');
    const schemaSQL = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(schemaSQL);
    console.log('✅ Database schema created successfully');
    
    // Insert sample data if requested
    if (includeSampleData) {
      console.log('📝 Inserting sample data...');
      const sampleDataSQL = fs.readFileSync(path.join(__dirname, 'sample_data.sql'), 'utf8');
      await client.query(sampleDataSQL);
      console.log('✅ Sample data inserted successfully');
    }
    
    // Verify setup
    console.log('🔍 Verifying database setup...');
    const result = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as users_count,
        (SELECT COUNT(*) FROM clients) as clients_count,
        (SELECT COUNT(*) FROM session_locations) as locations_count,
        (SELECT COUNT(*) FROM treatment_objectives) as objectives_count,
        (SELECT COUNT(*) FROM interventions) as interventions_count,
        (SELECT COUNT(*) FROM session_notes) as notes_count
    `);
    
    const stats = result.rows[0];
    console.log('📊 Database Statistics:');
    console.log(`   👥 Users: ${stats.users_count}`);
    console.log(`   🏥 Clients: ${stats.clients_count}`);
    console.log(`   📍 Locations: ${stats.locations_count}`);
    console.log(`   🎯 Objectives: ${stats.objectives_count}`);
    console.log(`   🛠️  Interventions: ${stats.interventions_count}`);
    console.log(`   📄 Session Notes: ${stats.notes_count}`);
    
    client.release();
    console.log('🎉 Database migration completed successfully!');
    
    if (!includeSampleData) {
      console.log('\n💡 Tip: Run with --sample-data flag to include test data');
    }
    
    console.log('\n🔐 Default Login Credentials (if sample data was loaded):');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
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
