#!/usr/bin/env node

const os = require('os');

function getHost() {
  // Prefer hostname, fallback to localhost
  const envHost = process.env.HOSTNAME || process.env.HOST || 'localhost';
  return envHost;
}

const host = getHost();

const webHttp = `http://${host}`;
const webHttps = `https://${host}`;

// Compose defaults
const dbUser = process.env.POSTGRES_USER || 'session_user';
const dbPass = process.env.POSTGRES_PASSWORD || 'session_password_123';
const dbName = process.env.POSTGRES_DB || 'session_notes';
const dbHost = 'localhost';
const dbPort = 5432;

const lines = [
  '',
  '============================================================',
  ' Session Notes App is starting in Docker',
  '============================================================',
  '',
  'Web App:',
  `  HTTP:  ${webHttp}`,
  `  HTTPS: ${webHttps}`,
  '',
  'Backend API (Next.js routes under /api):',
  `  Base:  ${webHttps}/api`,
  '',
  'Database (PostgreSQL):',
  `  Host:     ${dbHost}`,
  `  Port:     ${dbPort}`,
  `  Database: ${dbName}`,
  `  User:     ${dbUser}`,
  `  Password: ${dbPass}`,
  `  URL:      postgresql://${dbUser}:${dbPass}@${dbHost}:${dbPort}/${dbName}`,
  '',
  'Nginx:',
  '  Ports: 80 (HTTP), 443 (HTTPS)',
  '',
  'Health Checks:',
  `  App: ${webHttps}/health`,
  '',
  'Tips:',
  '  - If running on a remote server, replace hostname with your domain or IP.',
  '  - Default credentials/ports can be changed in docker-compose.yml.',
  '',
  '============================================================',
  ''
];

console.log(lines.join('\n'));
