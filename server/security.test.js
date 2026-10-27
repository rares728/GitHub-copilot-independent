import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/rcca_test';

const { hashPassword, hashToken, verifyPassword } = await import('./security.js');
const { authorizeEntityAccess, validateEntityName } = await import('./entities.js');

test('password hashing verifies only the original password', async () => {
  const hash = await hashPassword('a sufficiently long password');
  assert.notEqual(hash, 'a sufficiently long password');
  assert.equal(await verifyPassword('a sufficiently long password', hash), true);
  assert.equal(await verifyPassword('a different password', hash), false);
});

test('session tokens are stored as deterministic one-way hashes', () => {
  const firstHash = hashToken('session-token');
  assert.equal(firstHash, hashToken('session-token'));
  assert.notEqual(firstHash, 'session-token');
  assert.notEqual(firstHash, hashToken('another-session-token'));
});

test('entity names are constrained before becoming API resources', () => {
  assert.equal(validateEntityName('ProductionIssue'), 'ProductionIssue');
  assert.throws(() => validateEntityName('Production-Issue'), { status: 400 });
  assert.throws(() => validateEntityName('entity;DROP TABLE users'), { status: 400 });
});

test('record mutations retain the original owner/admin access rules', () => {
  const owner = { id: 'owner-id', email: 'owner@example.com', role: 'user' };
  const admin = { id: 'admin-id', email: 'admin@example.com', role: 'admin' };
  const issue = { id: 'issue-1', created_by: owner.email };
  const document = { id: 'document-1', created_by: owner.email };
  assert.doesNotThrow(() => authorizeEntityAccess('ProductionIssue', owner, 'update', issue));
  assert.throws(() => authorizeEntityAccess('ProductionIssue', { ...owner, email: 'other@example.com' }, 'update', issue), { status: 403 });
  assert.throws(() => authorizeEntityAccess('ProductionIssue', owner, 'delete', issue), { status: 403 });
  assert.throws(() => authorizeEntityAccess('PicklistOption', owner, 'create', {}), { status: 403 });
  assert.doesNotThrow(() => authorizeEntityAccess('Document', owner, 'read', document));
  assert.throws(() => authorizeEntityAccess('Document', { ...owner, email: 'other@example.com' }, 'read', document), { status: 403 });
  assert.doesNotThrow(() => authorizeEntityAccess('Document', admin, 'read', document));
  assert.doesNotThrow(() => authorizeEntityAccess('ProductionIssue', admin, 'delete', issue));
});
