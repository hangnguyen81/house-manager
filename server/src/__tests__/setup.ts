import { beforeAll, afterAll, beforeEach } from 'vitest';

// Set test DATABASE_URL BEFORE any module imports db.ts
// vitest.config.ts uses env option to load .env.test
// But as a safety net:
if (!process.env.DATABASE_URL?.includes('_test')) {
  process.env.DATABASE_URL = 'postgresql://household:household@localhost:5432/household_test';
}

// Now we can safely import pool
const { pool } = await import('../db');
const { runMigrations } = await import('../migrate');

beforeAll(async () => {
  await runMigrations();
});

beforeEach(async () => {
  // Clean all data tables (FK order)
  await pool.query('DELETE FROM redemptions');
  await pool.query('DELETE FROM rewards');
  await pool.query('DELETE FROM supply_requests');
  await pool.query('DELETE FROM chores');
  await pool.query('DELETE FROM chore_templates');
  await pool.query('DELETE FROM household_settings');
  await pool.query('DELETE FROM members');
  await pool.query('DELETE FROM households');

  // Seed base test data
  await pool.query(`INSERT INTO households (id, name, created_at) VALUES ('h1', 'The Family', '2026-06-01T00:00:00Z')`);
  await pool.query(`INSERT INTO household_settings (household_id, id) VALUES ('h1', 1)`);
  await pool.query(`INSERT INTO members (id, household_id, name, role, color, points) VALUES
    ('m1', 'h1', 'Mom', 'admin', '#E8743B', 0),
    ('m2', 'h1', 'Dad', 'admin', '#19A979', 0),
    ('m3', 'h1', 'Ava', 'member', '#945ECF', 0),
    ('m4', 'h1', 'Leo', 'member', '#1F77B4', 0)
  `);
});

afterAll(async () => {
  await pool.end();
});
