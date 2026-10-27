import { randomUUID } from 'node:crypto';
import { pool } from './db.js';

const entityNamePattern = /^[A-Z][A-Za-z0-9]{0,79}$/;
const fieldPattern = /^[A-Za-z_][A-Za-z0-9_]{0,79}$/;

export function validateEntityName(value) {
  if (!entityNamePattern.test(value)) throw Object.assign(new Error('Invalid entity name.'), { status: 400 });
  return value;
}

function isAdmin(user) {
  return user?.role === 'admin';
}

const adminWriteEntities = new Set([
  'AiLearnedLessons',
  'AiPromptConfig',
  'InspectionStandard',
  'IssueArchive',
  'PicklistOption',
]);

export function authorizeEntityAccess(entity, user, action, record) {
  if (isAdmin(user)) return;
  if (entity === 'User') {
    if (action !== 'create' && record?.id === user?.id) return;
    throw Object.assign(new Error('Administrator access required.'), { status: 403 });
  }
  if (action === 'create' && adminWriteEntities.has(entity)) {
    throw Object.assign(new Error('Administrator access required.'), { status: 403 });
  }
  if (action === 'update' && adminWriteEntities.has(entity)) {
    throw Object.assign(new Error('Administrator access required.'), { status: 403 });
  }
  if (action === 'delete' && ['ProductionIssue', 'ProductionBatch', 'Document', 'VisualInspectionEntry', ...adminWriteEntities].includes(entity)) {
    throw Object.assign(new Error('Administrator access required.'), { status: 403 });
  }
  if (action === 'read' && entity === 'Document' && record?.created_by !== user?.email) {
    throw Object.assign(new Error('You can only view documents that you created.'), { status: 403 });
  }
  if (action === 'update' && ['ProductionIssue', 'Document'].includes(entity) && record?.created_by !== user?.email) {
    throw Object.assign(new Error('You can only update records that you created.'), { status: 403 });
  }
}

function normalizeLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 200;
  return Math.max(1, Math.min(parsed, 50000));
}

function normalizeSort(value) {
  if (!value) return { field: 'created_date', direction: 'DESC' };
  const desc = value.startsWith('-');
  const field = desc ? value.slice(1) : value;
  if (!fieldPattern.test(field)) throw Object.assign(new Error('Invalid sort field.'), { status: 400 });
  return { field, direction: desc ? 'DESC' : 'ASC' };
}

export async function listRecords(entity, { filters = {}, sort, limit } = {}, user) {
  validateEntityName(entity);
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
    throw Object.assign(new Error('Filters must be an object.'), { status: 400 });
  }
  const safeFilters = entity === 'User' && !isAdmin(user) ? { ...filters, id: user.id } : filters;
  if (entity === 'User' && !isAdmin(user)) authorizeEntityAccess(entity, user, 'read', { id: safeFilters.id });
  if (entity === 'Document' && !isAdmin(user)) safeFilters.created_by = user.email;
  const ordering = normalizeSort(sort);
  const result = await pool.query(
    `SELECT data FROM entity_records
     WHERE entity_name = $1 AND data @> $2::jsonb
     ORDER BY data ->> $3 ${ordering.direction} NULLS LAST, created_at DESC
     LIMIT $4`,
    [entity, JSON.stringify(safeFilters), ordering.field, normalizeLimit(limit)],
  );
  return result.rows.map((row) => row.data);
}

export async function getRecord(entity, id, user) {
  validateEntityName(entity);
  const result = await pool.query(
    `SELECT data FROM entity_records WHERE entity_name = $1 AND id = $2`,
    [entity, id],
  );
  const record = result.rows[0]?.data || null;
  if (record) authorizeEntityAccess(entity, user, 'read', record);
  return record;
}

async function insertRecord(client, entity, fields, user) {
  validateEntityName(entity);
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    throw Object.assign(new Error('Record must be an object.'), { status: 400 });
  }
  authorizeEntityAccess(entity, user, 'create', fields);
  if (!isAdmin(user) && fields.created_by && fields.created_by !== user.email) {
    throw Object.assign(new Error('Record owner must match the signed-in user.'), { status: 403 });
  }
  if (Object.hasOwn(fields, 'password_hash')) {
    throw Object.assign(new Error('Credential fields cannot be written through entity records.'), { status: 400 });
  }
  const id = String(fields.id || randomUUID());
  const now = new Date().toISOString();
  const record = {
    ...fields,
    id,
    created_date: fields.created_date || now,
    updated_date: now,
    created_by: fields.created_by || user.email,
  };
  if (entity === 'User') {
    record.email = String(record.email || '').trim().toLowerCase();
    if (!record.email) throw Object.assign(new Error('User email is required.'), { status: 400 });
    record.role = record.role === 'admin' ? 'admin' : 'user';
  }
  await client.query(
    `INSERT INTO entity_records (entity_name, id, data, created_at, updated_at)
     VALUES ($1, $2, $3::jsonb, $4, $4)`,
    [entity, id, JSON.stringify(record), record.created_date],
  );
  return record;
}

export async function createRecord(entity, fields, user) {
  const record = await insertRecord(pool, entity, fields, user);
  return record;
}

async function updateRecordWithClient(client, entity, id, patch, user) {
  validateEntityName(entity);
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw Object.assign(new Error('Update must be an object.'), { status: 400 });
  }
  if (Object.hasOwn(patch, 'password_hash')) {
    throw Object.assign(new Error('Credential fields cannot be written through entity records.'), { status: 400 });
  }
  if (entity === 'User' && !isAdmin(user)) {
    const allowed = new Set(['display_name', 'page_permissions']);
    if (Object.keys(patch).some((key) => !allowed.has(key))) {
      throw Object.assign(new Error('You can only change your own display name and page permissions.'), { status: 403 });
    }
  }
  if (!isAdmin(user) && (Object.hasOwn(patch, 'created_by') || Object.hasOwn(patch, 'created_date'))) {
    throw Object.assign(new Error('Record ownership and creation dates cannot be changed.'), { status: 403 });
  }
  const previous = await getRecord(entity, id, user);
  if (!previous) return null;
  authorizeEntityAccess(entity, user, 'update', previous);
  const next = { ...previous, ...patch, id, updated_date: new Date().toISOString() };
  if (entity === 'User') {
    if (patch.email !== undefined) next.email = String(patch.email).trim().toLowerCase();
    if (patch.role !== undefined) next.role = patch.role === 'admin' ? 'admin' : 'user';
    await client.query(
      `UPDATE auth_credentials SET email = $1 WHERE user_id = $2`,
      [next.email, id],
    );
  }
  await client.query(
    `UPDATE entity_records SET data = $1::jsonb, updated_at = now()
     WHERE entity_name = $2 AND id = $3`,
    [JSON.stringify(next), entity, id],
  );
  return next;
}

export async function updateRecord(entity, id, patch, user) {
  return updateRecordWithClient(pool, entity, id, patch, user);
}

export async function deleteRecord(entity, id, user) {
  validateEntityName(entity);
  const current = await pool.query(
    `SELECT data FROM entity_records WHERE entity_name = $1 AND id = $2`,
    [entity, id],
  );
  if (!current.rowCount) return null;
  authorizeEntityAccess(entity, user, 'delete', current.rows[0].data);
  const result = await pool.query(
    `DELETE FROM entity_records WHERE entity_name = $1 AND id = $2 RETURNING data`,
    [entity, id],
  );
  return result.rows[0]?.data || null;
}

export async function createRecords(entity, records, user) {
  if (!Array.isArray(records) || records.length > 2000) {
    throw Object.assign(new Error('Bulk create expects at most 2,000 records.'), { status: 400 });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const created = [];
    for (const record of records) created.push(await insertRecord(client, entity, record, user));
    await client.query('COMMIT');
    return created;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateRecords(entity, records, user) {
  if (!Array.isArray(records) || records.length > 2000) {
    throw Object.assign(new Error('Bulk update expects at most 2,000 records.'), { status: 400 });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = [];
    for (const { id, ...patch } of records) {
      if (!id) throw Object.assign(new Error('Every bulk update record must include an id.'), { status: 400 });
      const record = await updateRecordWithClient(client, entity, String(id), patch, user);
      if (record) updated.push(record);
    }
    await client.query('COMMIT');
    return updated;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
