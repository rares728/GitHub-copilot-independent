import 'dotenv/config';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import multer from 'multer';
import { pool, initializeDatabase } from './db.js';
import {
  clearSessionCookie,
  createSession,
  hashPassword,
  hashToken,
  readCookie,
  requireAdmin,
  requireUser,
  SESSION_COOKIE,
  setSessionCookie,
  verifyPassword,
} from './security.js';
import {
  createRecord,
  createRecords,
  deleteRecord,
  getRecord,
  listRecords,
  updateRecord,
  updateRecords,
  authorizeEntityAccess,
  validateEntityName,
} from './entities.js';
import {
  extractRows,
  getUsers,
  invokeLlm,
  regenerateLearnedLessons,
  saveOwnerFeedback,
  sendEmail,
} from './integrations.js';
import {
  logActivity,
  scheduleDailyJobs,
  sendCorrectiveActionReminders,
  sendCriticalIssueAlert,
  sendStandupReminders,
} from './jobs.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const storageDir = path.resolve(process.env.STORAGE_DIR || path.join(here, '..', 'storage'));
const upload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => callback(null, storageDir),
    filename: (_request, _file, callback) => callback(null, `${randomBytes(16).toString('hex')}`),
  }),
  limits: { fileSize: Number(process.env.MAX_UPLOAD_BYTES || 25 * 1024 * 1024), files: 1 },
});
const app = express();
const liveClients = new Map();
const maxJsonBytes = process.env.MAX_JSON_BYTES || '5mb';
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Try again later.' },
});
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'AI request limit reached. Try again in a minute.' },
});

app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);
app.use(express.json({ limit: maxJsonBytes }));
app.disable('x-powered-by');

function publicUser(record) {
  if (!record) return null;
  const { password_hash: _passwordHash, ...safe } = record;
  return safe;
}

function emitEntityChange(entity, event) {
  for (const [response, user] of liveClients.get(entity) || []) {
    try {
      authorizeEntityAccess(entity, user, 'read', event.data);
    } catch {
      continue;
    }
    response.write(`data: ${JSON.stringify(event)}\n\n`);
  }
}

async function findStoredFile(id) {
  const result = await pool.query(`SELECT * FROM stored_files WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

function signingSecret() {
  const secret = process.env.FILE_SIGNING_SECRET;
  if (!secret || secret.length < 32) {
    throw Object.assign(new Error('FILE_SIGNING_SECRET must contain at least 32 characters.'), { status: 503 });
  }
  return secret;
}

function signFile(id, expiresAt) {
  return createHmac('sha256', signingSecret()).update(`${id}.${expiresAt}`).digest('hex');
}

function hasValidFileSignature(id, expiresAt, signature) {
  if (!expiresAt || !signature || Number(expiresAt) < Date.now()) return false;
  const expected = Buffer.from(signFile(id, expiresAt), 'hex');
  const actual = Buffer.from(signature, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function requireFileOwner(request, response) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) {
    response.status(401).json({ error: 'Authentication required to access this file.' });
    return false;
  }
  const result = await pool.query(
    `SELECT records.data FROM auth_sessions sessions
     JOIN entity_records records ON records.entity_name = 'User' AND records.id = sessions.user_id
     WHERE sessions.token_hash = $1 AND sessions.expires_at > now()`,
    [hashToken(token)],
  );
  if (!result.rowCount) {
    response.status(401).json({ error: 'Authentication required to access this file.' });
    return false;
  }
  request.user = result.rows[0].data;
  return true;
}

app.get('/api/health', async (_request, response, next) => {
  try {
    await pool.query('SELECT 1');
    response.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', loginLimiter, async (request, response, next) => {
  try {
    const email = String(request.body?.email || '').trim().toLowerCase();
    const password = String(request.body?.password || '');
    const result = await pool.query(
      `SELECT credentials.password_hash, records.data
       FROM auth_credentials credentials
       JOIN entity_records records ON records.entity_name = 'User' AND records.id = credentials.user_id
       WHERE credentials.email = $1`,
      [email],
    );
    if (!result.rowCount || !(await verifyPassword(password, result.rows[0].password_hash))) {
      return response.status(401).json({ error: 'Invalid email or password.' });
    }
    const { token, expiresAt } = await createSession(result.rows[0].data.id);
    setSessionCookie(response, token, expiresAt);
    return response.json({ user: publicUser(result.rows[0].data) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/auth/invitations/complete', async (request, response, next) => {
  try {
    const token = String(request.body?.token || '');
    const password = String(request.body?.password || '');
    if (password.length < 12) return response.status(400).json({ error: 'Password must contain at least 12 characters.' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const invitation = await client.query(
        `SELECT invitations.user_id, records.data
         FROM auth_invitations invitations
         JOIN entity_records records ON records.entity_name = 'User' AND records.id = invitations.user_id
         WHERE invitations.token_hash = $1 AND invitations.expires_at > now()
         FOR UPDATE`,
        [hashToken(token)],
      );
      if (!invitation.rowCount) {
        await client.query('ROLLBACK');
        return response.status(400).json({ error: 'Invitation link is invalid or expired.' });
      }
      const user = invitation.rows[0].data;
      const passwordHash = await hashPassword(password);
      await client.query(
        `INSERT INTO auth_credentials (user_id, email, password_hash) VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash, email = EXCLUDED.email`,
        [invitation.rows[0].user_id, user.email, passwordHash],
      );
      await client.query(`DELETE FROM auth_invitations WHERE user_id = $1`, [invitation.rows[0].user_id]);
      await client.query(`DELETE FROM auth_sessions WHERE user_id = $1`, [invitation.rows[0].user_id]);
      await client.query('COMMIT');
      const session = await createSession(user.id);
      setSessionCookie(response, session.token, session.expiresAt);
      return response.json({ user: publicUser(user) });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return next(error);
  }
});

app.get('/api/auth/me', requireUser, (request, response) => response.json(publicUser(request.user)));

app.post('/api/auth/logout', async (request, response, next) => {
  try {
    const token = readCookie(request, SESSION_COOKIE);
    if (token) await pool.query(`DELETE FROM auth_sessions WHERE token_hash = $1`, [hashToken(token)]);
    clearSessionCookie(response);
    return response.status(204).end();
  } catch (error) {
    return next(error);
  }
});

app.post('/api/users/invite', requireUser, requireAdmin, async (request, response, next) => {
  let createdUser;
  let invitationHash;
  let shouldDeleteUser = false;
  try {
    const email = String(request.body?.email || '').trim().toLowerCase();
    const role = request.body?.role === 'admin' ? 'admin' : 'user';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return response.status(400).json({ error: 'A valid email address is required.' });
    }
    const existing = await pool.query(
      `SELECT data FROM entity_records WHERE entity_name = 'User' AND lower(data->>'email') = $1 LIMIT 1`,
      [email],
    );
    if (existing.rowCount) {
      createdUser = existing.rows[0].data;
    } else {
      createdUser = await createRecord('User', {
        email,
        full_name: email.split('@')[0],
        display_name: '',
        role,
        page_permissions: null,
      }, request.user);
      shouldDeleteUser = true;
    }
    const token = randomBytes(32).toString('base64url');
    invitationHash = hashToken(token);
    await pool.query(
      `INSERT INTO auth_invitations (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '48 hours')`,
      [invitationHash, createdUser.id],
    );
    const origin = process.env.APP_BASE_URL || `${request.protocol}://${request.get('host')}`;
    const invitationUrl = new URL('/login', origin);
    invitationUrl.searchParams.set('invite', token);
    await sendEmail({
      to: email,
      subject: 'Invitation to RCCA Tracker',
      body: `You have been invited to RCCA Tracker. Set your password within 48 hours: ${invitationUrl.toString()}`,
    });
    return response.status(201).json({ success: true });
  } catch (error) {
    if (createdUser) {
      if (invitationHash) await pool.query(`DELETE FROM auth_invitations WHERE token_hash = $1`, [invitationHash]).catch(() => {});
      if (shouldDeleteUser) {
        await pool.query(`DELETE FROM entity_records WHERE entity_name = 'User' AND id = $1`, [createdUser.id]).catch(() => {});
      }
    }
    return next(error);
  }
});

app.post('/api/activity', requireUser, async (request, response, next) => {
  try {
    const page = String(request.body?.page || '').slice(0, 100);
    if (!page) return response.status(400).json({ error: 'Page is required.' });
    await logActivity(request.user.id, page);
    return response.status(204).end();
  } catch (error) {
    return next(error);
  }
});

app.post('/api/files', requireUser, upload.single('file'), async (request, response, next) => {
  try {
    if (!request.file) return response.status(400).json({ error: 'A file is required.' });
    const id = randomBytes(18).toString('hex');
    const fileName = path.basename(request.file.originalname).replace(/[\u0000-\u001f]/g, '').slice(0, 240);
    const visibility = request.query.visibility === 'public' ? 'public' : 'private';
    await pool.query(
      `INSERT INTO stored_files (id, file_name, mime_type, disk_path, visibility, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, fileName, request.file.mimetype || 'application/octet-stream', request.file.path, visibility, request.user.email],
    );
    return response.status(201).json({
      file_uri: `file:${id}`,
      file_url: `/api/files/${id}`,
      file_name: fileName,
    });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/files/signed-url', requireUser, async (request, response, next) => {
  try {
    const id = String(request.body?.file_uri || '').replace(/^file:/, '');
    if (!/^[A-Za-z0-9-]+$/.test(id)) return response.status(400).json({ error: 'Invalid file URI.' });
    if (!(await findStoredFile(id))) return response.status(404).json({ error: 'File not found.' });
    const expiresAt = Date.now() + Math.max(30, Math.min(Number(request.body?.expires_in) || 300, 3600)) * 1000;
    const signature = signFile(id, expiresAt);
    return response.json({
      signed_url: `/api/files/${id}?expires=${expiresAt}&sig=${signature}`,
    });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/files/:id', async (request, response, next) => {
  try {
    const file = await findStoredFile(request.params.id);
    if (!file) return response.status(404).json({ error: 'File not found.' });
    const signed = hasValidFileSignature(request.params.id, request.query.expires, request.query.sig);
    if (file.visibility !== 'public' && !signed && !(await requireFileOwner(request, response))) return;
    response.setHeader('Content-Type', file.mime_type);
    response.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.file_name)}`);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return response.sendFile(file.disk_path);
  } catch (error) {
    return next(error);
  }
});

app.post('/api/integrations/llm', requireUser, aiLimiter, async (request, response, next) => {
  try {
    return response.json(await invokeLlm(request.body || {}));
  } catch (error) {
    return next(error);
  }
});

app.post('/api/integrations/email', requireUser, requireAdmin, async (request, response, next) => {
  try {
    return response.json(await sendEmail(request.body || {}));
  } catch (error) {
    return next(error);
  }
});

app.get('/api/entities/:entity/events', requireUser, async (request, response, next) => {
  try {
    const entity = validateEntityName(request.params.entity);
    if (entity === 'User' && request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Administrator access required.' });
    }
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.flushHeaders();
    const clients = liveClients.get(entity) || new Map();
    clients.set(response, request.user);
    liveClients.set(entity, clients);
    const heartbeat = setInterval(() => response.write(': keep-alive\n\n'), 25000);
    response.on('close', () => {
      clearInterval(heartbeat);
      clients.delete(response);
      if (!clients.size) liveClients.delete(entity);
    });
    return undefined;
  } catch (error) {
    return next(error);
  }
});

app.post('/api/entities/:entity/bulk', requireUser, async (request, response, next) => {
  try {
    const entity = validateEntityName(request.params.entity);
    const records = await createRecords(entity, request.body, request.user);
    records.forEach((record) => emitEntityChange(entity, { type: 'create', data: record }));
    return response.status(201).json(records);
  } catch (error) {
    return next(error);
  }
});

app.patch('/api/entities/:entity/bulk', requireUser, async (request, response, next) => {
  try {
    const entity = validateEntityName(request.params.entity);
    const records = await updateRecords(entity, request.body, request.user);
    records.forEach((record) => emitEntityChange(entity, { type: 'update', data: record }));
    return response.json(records);
  } catch (error) {
    return next(error);
  }
});

app.get('/api/entities/:entity', requireUser, async (request, response, next) => {
  try {
    const filters = request.query.filters ? JSON.parse(request.query.filters) : {};
    const records = await listRecords(request.params.entity, {
      filters,
      sort: request.query.sort,
      limit: request.query.limit,
    }, request.user);
    return response.json(records);
  } catch (error) {
    return next(error);
  }
});

app.post('/api/entities/:entity', requireUser, async (request, response, next) => {
  try {
    const entity = validateEntityName(request.params.entity);
    const record = await createRecord(entity, request.body, request.user);
    emitEntityChange(entity, { type: 'create', data: record });
    if (entity === 'ProductionIssue' && record.severity === 'critical') {
      sendCriticalIssueAlert(record).catch((error) => console.error('Critical issue email failed:', error));
    }
    return response.status(201).json(record);
  } catch (error) {
    return next(error);
  }
});

app.patch('/api/entities/:entity/:id', requireUser, async (request, response, next) => {
  try {
    const entity = validateEntityName(request.params.entity);
    const previous = entity === 'VisualInspectionEntry'
      ? await getRecord(entity, request.params.id, request.user)
      : null;
    const record = await updateRecord(entity, request.params.id, request.body, request.user);
    if (!record) return response.status(404).json({ error: 'Record not found.' });
    emitEntityChange(entity, { type: 'update', data: record });
    if (entity === 'ProductionIssue' && record.severity === 'critical' && previous?.severity !== 'critical') {
      sendCriticalIssueAlert(record).catch((error) => console.error('Critical issue email failed:', error));
    }
    if (entity === 'VisualInspectionEntry' &&
      record.human_validated && record.human_agrees_with_ai === false &&
      (record.human_corrected_label || record.human_feedback)) {
      regenerateLearnedLessons(request.user).catch((error) => console.error('AI lessons regeneration failed:', error));
    }
    return response.json(record);
  } catch (error) {
    return next(error);
  }
});

app.delete('/api/entities/:entity/:id', requireUser, async (request, response, next) => {
  try {
    const entity = validateEntityName(request.params.entity);
    const record = await deleteRecord(entity, request.params.id, request.user);
    if (!record) return response.status(404).json({ error: 'Record not found.' });
    emitEntityChange(entity, { type: 'delete', data: record });
    return response.status(204).end();
  } catch (error) {
    return next(error);
  }
});

app.post('/api/functions/:name', requireUser, async (request, response, next) => {
  try {
    let result;
    switch (request.params.name) {
      case 'getUsers':
        result = await getUsers();
        break;
      case 'importUsersFile':
      case 'importPicklistFile':
        if (request.user.role !== 'admin') return response.status(403).json({ error: 'Administrator access required.' });
        if (typeof request.body?.file_url !== 'string') {
          return response.status(400).json({ error: 'file_url is required.' });
        }
        result = { rows: await extractRows(request.body.file_url, request.params.name === 'importUsersFile' ? 'users' : 'picklists') };
        break;
      case 'saveOwnerFeedback':
        result = await saveOwnerFeedback(request.user, request.body || {});
        break;
      case 'regenerateLearnedLessons':
        if (request.user.role !== 'admin') return response.status(403).json({ error: 'Administrator access required.' });
        result = await regenerateLearnedLessons(request.user);
        break;
      case 'correctiveActionReminder':
        if (request.user.role !== 'admin') return response.status(403).json({ error: 'Administrator access required.' });
        result = await sendCorrectiveActionReminders();
        break;
      case 'sendStandupReminders':
        if (request.user.role !== 'admin') return response.status(403).json({ error: 'Administrator access required.' });
        result = await sendStandupReminders();
        break;
      case 'criticalIssuAlert':
        if (request.user.role !== 'admin') return response.status(403).json({ error: 'Administrator access required.' });
        result = await sendCriticalIssueAlert(request.body?.data);
        break;
      case 'downtimeAlert': {
        if (!process.env.DOWNTIME_ALERT_EMAIL) {
          throw Object.assign(new Error('Set DOWNTIME_ALERT_EMAIL to enable downtime alerts.'), { status: 503 });
        }
        const issueRef = String(request.body?.issueRef || 'New Issue').replace(/[\r\n]/g, ' ').slice(0, 100);
        const description = String(request.body?.description || '(no description)').slice(0, 4000);
        const reportedBy = String(request.body?.reportedBy || 'Unknown').slice(0, 200);
        const reportedDate = String(request.body?.reportedDate || new Date().toISOString().slice(0, 10)).slice(0, 40);
        result = await sendEmail({
          to: process.env.DOWNTIME_ALERT_EMAIL,
          subject: `Downtime Activated – ${issueRef}`,
          body: `Hi,\n\nA downtime has been activated for issue ${issueRef}.\n\nDefect Description:\n${description}\n\nReported by: ${reportedBy}\nDate: ${reportedDate}\n\nBest regards,\nAEE RCCA Tracker`,
        });
        break;
      }
      default:
        return response.status(404).json({ error: `Unknown function: ${request.params.name}` });
    }
    return response.json(result);
  } catch (error) {
    return next(error);
  }
});

app.use('/api', (_request, response) => response.status(404).json({ error: 'API route not found.' }));

const distDir = path.resolve(here, '..', 'dist');
app.use(express.static(distDir));
app.get('*', async (_request, response, next) => {
  try {
    const indexPath = path.join(distDir, 'index.html');
    await stat(indexPath);
    return response.sendFile(indexPath);
  } catch (error) {
    return next(error);
  }
});

app.use((error, _request, response, _next) => {
  const status = Number(error.status || (error instanceof SyntaxError ? 400 : 500));
  if (status >= 500) console.error(error);
  if (error.code === '23505') {
    return response.status(409).json({ error: 'A record with the same unique value already exists.' });
  }
  if (error instanceof multer.MulterError) {
    return response.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: error.message });
  }
  return response.status(status).json({
    error: status >= 500 ? 'The server could not complete the request.' : error.message,
  });
});

export async function startServer() {
  await mkdir(storageDir, { recursive: true });
  await initializeDatabase();
  scheduleDailyJobs();
  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.info(`RCCA Tracker API listening on http://0.0.0.0:${port}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  startServer().catch((error) => {
    console.error('Application startup failed:', error);
    process.exitCode = 1;
  });
}

export default app;
