import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { hashPassword } from './security.js';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set before the application can start.');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
});

export async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS entity_records (
      entity_name text NOT NULL,
      id text NOT NULL,
      data jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (entity_name, id)
    );
    CREATE INDEX IF NOT EXISTS entity_records_data_idx ON entity_records USING gin (data);
    CREATE TABLE IF NOT EXISTS auth_credentials (
      user_id text PRIMARY KEY,
      entity_name text NOT NULL DEFAULT 'User',
      email text NOT NULL UNIQUE,
      password_hash text,
      FOREIGN KEY (entity_name, user_id) REFERENCES entity_records (entity_name, id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash text PRIMARY KEY,
      user_id text NOT NULL,
      entity_name text NOT NULL DEFAULT 'User',
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      FOREIGN KEY (entity_name, user_id) REFERENCES entity_records (entity_name, id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions (expires_at);
    CREATE TABLE IF NOT EXISTS auth_invitations (
      token_hash text PRIMARY KEY,
      user_id text NOT NULL,
      entity_name text NOT NULL DEFAULT 'User',
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      FOREIGN KEY (entity_name, user_id) REFERENCES entity_records (entity_name, id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS stored_files (
      id text PRIMARY KEY,
      file_name text NOT NULL,
      mime_type text NOT NULL,
      disk_path text NOT NULL,
      visibility text NOT NULL CHECK (visibility IN ('private', 'public')),
      created_by text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS activity_log (
      id bigserial PRIMARY KEY,
      user_id text NOT NULL,
      page text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    console.warn('No bootstrap administrator configured; set ADMIN_EMAIL and ADMIN_PASSWORD to initialize access.');
    return;
  }
  if (adminPassword.length < 12) {
    throw new Error('ADMIN_PASSWORD must contain at least 12 characters.');
  }

  const existing = await pool.query(
    `SELECT id FROM entity_records WHERE entity_name = 'User' AND lower(data->>'email') = $1 LIMIT 1`,
    [adminEmail],
  );
  if (existing.rowCount) return;

  const id = randomUUID();
  const fullName = process.env.ADMIN_NAME?.trim() || 'Administrator';
  const now = new Date().toISOString();
  const data = {
    id,
    email: adminEmail,
    full_name: fullName,
    display_name: fullName,
    role: 'admin',
    page_permissions: null,
    created_date: now,
    updated_date: now,
  };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO entity_records (entity_name, id, data) VALUES ('User', $1, $2)`,
      [id, data],
    );
    await client.query(
      `INSERT INTO auth_credentials (user_id, email, password_hash) VALUES ($1, $2, $3)`,
      [id, adminEmail, await hashPassword(adminPassword)],
    );
    await client.query('COMMIT');
    console.info(`Created bootstrap administrator ${adminEmail}.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
