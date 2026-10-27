import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { pool, initializeDatabase } from '../server/db.js';

const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error('Usage: node scripts/import-hosted-export.js <export.json>');
  process.exitCode = 2;
} else {
  try {
    await initializeDatabase();
    const parsed = JSON.parse(await readFile(sourcePath, 'utf8'));
    const collections = parsed.entities || parsed;
    if (!collections || typeof collections !== 'object' || Array.isArray(collections)) {
      throw new Error('Export must be a JSON object keyed by entity name.');
    }

    const report = {};
    for (const [entity, records] of Object.entries(collections)) {
      if (!/^[A-Z][A-Za-z0-9]{0,79}$/.test(entity) || !Array.isArray(records)) continue;
      let imported = 0;
      let skipped = 0;
      for (const source of records) {
        if (!source || typeof source !== 'object' || Array.isArray(source)) {
          skipped++;
          continue;
        }
        const record = { ...source, id: String(source.id || randomUUID()) };
        if (entity === 'User') {
          record.email = String(record.email || '').trim().toLowerCase();
          if (!record.email) {
            skipped++;
            continue;
          }
          const current = await pool.query(
            `SELECT id FROM entity_records WHERE entity_name = 'User' AND lower(data->>'email') = $1 LIMIT 1`,
            [record.email],
          );
          if (current.rowCount && current.rows[0].id !== record.id) {
            skipped++;
            continue;
          }
          record.role = record.role === 'admin' ? 'admin' : 'user';
        }
        const now = new Date().toISOString();
        record.created_date ||= now;
        record.updated_date ||= now;
        delete record.password;
        delete record.password_hash;
        await pool.query(
          `INSERT INTO entity_records (entity_name, id, data, created_at, updated_at)
           VALUES ($1, $2, $3::jsonb, $4, $4)
           ON CONFLICT (entity_name, id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
          [entity, record.id, JSON.stringify(record), record.created_date],
        );
        if (entity === 'User') {
          await pool.query(
            `INSERT INTO auth_credentials (user_id, email, password_hash) VALUES ($1, $2, NULL)
             ON CONFLICT (user_id) DO NOTHING`,
            [record.id, record.email],
          );
        }
        imported++;
      }
      report[entity] = { imported, skipped };
    }

    console.log(JSON.stringify(report, null, 2));
    console.log('Imported users need a new password. Send invitations from Settings after configuring SMTP.');
  } catch (error) {
    console.error('Import failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
