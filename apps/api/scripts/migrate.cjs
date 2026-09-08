/**
 * Migration runner. Loads `.env` from the repo root, then invokes
 * node-pg-migrate (direction: up|down|redo).
 * Usage: node scripts/migrate.cjs up
 */
const path = require('path');
const { spawnSync } = require('child_process');

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const direction = process.argv[2] || 'up';
const bin = path.resolve(__dirname, '../../../node_modules/.bin/node-pg-migrate');
const migrationsDir = path.resolve(__dirname, '../src/db/migrations');

const args = [
  bin,
  '-m',
  migrationsDir,
  '-j',
  'js',
  direction,
  ...process.argv.slice(3),
];

const result = spawnSync('node', args, { stdio: 'inherit', env: process.env });
process.exit(result.status ?? 1);
