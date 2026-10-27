import path from 'node:path';
import nodemailer from 'nodemailer';
import ExcelJS from 'exceljs';
import { pool } from './db.js';
import { listRecords, updateRecord, createRecord } from './entities.js';

let mailTransport;

function configuredModel(logicalName) {
  let modelMap = {};
  try {
    modelMap = JSON.parse(process.env.AI_MODELS_JSON || '{}');
  } catch {
    throw new Error('AI_MODELS_JSON must be valid JSON.');
  }
  const override = modelMap[logicalName] || {};
  const baseUrl = override.baseUrl || process.env.AI_BASE_URL;
  const model = override.model || process.env.AI_MODEL;
  const apiKey = override.apiKeyEnv
    ? process.env[override.apiKeyEnv]
    : override.apiKey || process.env.AI_API_KEY;
  if (!baseUrl || !model) {
    throw Object.assign(
      new Error(`No AI model is configured for "${logicalName}". Set AI_BASE_URL and AI_MODEL, or add it to AI_MODELS_JSON.`),
      { status: 503 },
    );
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ''), model, apiKey };
}

export async function invokeLlm({ prompt, file_urls = [], model, response_json_schema }) {
  if (typeof prompt !== 'string' || !prompt.trim()) {
    throw Object.assign(new Error('A prompt is required.'), { status: 400 });
  }
  const config = configuredModel(model || 'default');
  const content = [{ type: 'text', text: prompt }];
  for (const fileUrl of file_urls) {
    const file = await resolveStoredFile(fileUrl);
    if (file.mime_type.startsWith('image/')) {
      const bytes = await import('node:fs/promises').then(({ readFile }) => readFile(file.disk_path));
      content.push({
        type: 'image_url',
        image_url: { url: `data:${file.mime_type};base64,${bytes.toString('base64')}` },
      });
    } else {
      throw Object.assign(new Error(`AI image input does not support ${file.mime_type}.`), { status: 415 });
    }
  }
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: content.length === 1 ? prompt : content }],
      ...(response_json_schema ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(result.error?.message || `AI provider request failed (${response.status}).`), { status: 502 });
  }
  const text = result.choices?.[0]?.message?.content;
  if (typeof text !== 'string') throw new Error('AI provider returned no text content.');
  if (!response_json_schema) return text;
  const jsonText = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  try {
    return JSON.parse(jsonText);
  } catch {
    throw new Error('AI provider did not return valid JSON for the requested response schema.');
  }
}

async function resolveStoredFile(fileUrl) {
  const match = String(fileUrl).match(/(?:file:|\/api\/files\/)([A-Za-z0-9-]+)/);
  if (!match) throw Object.assign(new Error('Only files stored by this application may be sent to AI.'), { status: 400 });
  const result = await pool.query(`SELECT * FROM stored_files WHERE id = $1`, [match[1]]);
  if (!result.rowCount) throw Object.assign(new Error('File not found.'), { status: 404 });
  return result.rows[0];
}

function getMailTransport() {
  if (mailTransport) return mailTransport;
  if (process.env.SMTP_URL) {
    mailTransport = nodemailer.createTransport(process.env.SMTP_URL);
  } else if (process.env.SMTP_HOST) {
    mailTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    });
  } else {
    throw Object.assign(new Error('Email is not configured. Set SMTP_URL or SMTP_HOST.'), { status: 503 });
  }
  return mailTransport;
}

export async function sendEmail({ to, subject, body, from_name }) {
  if (!to || !subject || body === undefined) {
    throw Object.assign(new Error('Email requires recipient, subject, and body.'), { status: 400 });
  }
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) throw Object.assign(new Error('SMTP_FROM or SMTP_USER must be configured.'), { status: 503 });
  const message = {
    from: from_name ? { name: from_name, address: from } : from,
    to,
    subject,
    text: String(body).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
    ...(String(body).includes('<') ? { html: String(body) } : {}),
  };
  await getMailTransport().sendMail(message);
  return { success: true };
}

export async function extractRows(fileUrl, kind) {
  const file = await resolveStoredFile(fileUrl);
  const extension = path.extname(file.file_name).toLowerCase();
  if (['.csv', '.xlsx'].includes(extension)) {
    const workbook = new ExcelJS.Workbook();
    if (extension === '.csv') await workbook.csv.readFile(file.disk_path);
    else await workbook.xlsx.readFile(file.disk_path);
    const sheet = workbook.worksheets[0];
    if (!sheet) return [];
    const headers = sheet.getRow(1).values.slice(1).map((value) => String(value ?? '').trim());
    const rows = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const record = {};
      headers.forEach((header, index) => {
        if (header) record[header] = row.getCell(index + 1).text;
      });
      rows.push(record);
    });
    return normalizeImportRows(rows, kind);
  }
  if (extension === '.pdf') {
    const { PDFParse } = await import('pdf-parse');
    const { readFile } = await import('node:fs/promises');
    const parser = new PDFParse({ data: await readFile(file.disk_path) });
    const pdf = await parser.getText();
    await parser.destroy();
    if (kind === 'users') {
      const emails = [...new Set(pdf.text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])];
      return emails.map((email) => ({ email, role: 'user', name: '' }));
    }
    const prompt = `Extract the picklist rows from this document and return a JSON object with a "rows" array. Each row may contain "label", "value", "client", and "active". Document text:\n${pdf.text}`;
    const result = await invokeLlm({
      prompt,
      response_json_schema: { type: 'object', properties: { rows: { type: 'array' } }, required: ['rows'] },
    });
    return normalizeImportRows(result.rows || [], kind);
  }
  throw Object.assign(new Error('Supported file types are CSV, XLSX, and PDF.'), { status: 415 });
}

function normalizeHeader(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function normalizeImportRows(rows, kind) {
  return rows.map((row) => {
    const values = Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]));
    if (kind === 'users') {
      return {
        email: String(values.email || values.e_mail || values.username || '').trim(),
        role: String(values.role || '').trim().toLowerCase() === 'admin' ? 'admin' : 'user',
        name: String(values.name || values.full_name || values.display_name || '').trim(),
      };
    }
    return {
      label: String(values.label || values.name || values.title || values.value || '').trim(),
      value: String(values.value || values.code || values.part_number || '').trim(),
      client: String(values.client || values.customer || '').trim(),
      active: !['false', '0', 'no'].includes(String(values.active ?? values.is_active ?? true).toLowerCase()),
    };
  }).filter((row) => kind === 'users' ? row.email : (row.label || row.value));
}

export async function getUsers() {
  const users = await listRecords('User', { sort: 'full_name', limit: 500 }, { role: 'admin' });
  const credentials = await pool.query(`SELECT user_id, password_hash IS NOT NULL AS has_login FROM auth_credentials`);
  const loginById = new Map(credentials.rows.map((row) => [row.user_id, row.has_login]));
  const full = users.map((user) => ({
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    display_name: user.display_name || null,
    role: user.role,
    page_permissions: user.page_permissions || null,
    has_login: loginById.get(user.id) || false,
  }));
  const options = full.map((user) => ({
    value: user.display_name || user.full_name || user.email,
    label: user.display_name || user.full_name || user.email,
    email: user.email,
  })).filter((user) => user.value);
  return { users: options, full };
}

export async function saveOwnerFeedback(user, { issue_id, actions }) {
  if (!issue_id || !Array.isArray(actions)) {
    throw Object.assign(new Error('Missing issue_id or actions.'), { status: 400 });
  }
  const issue = await getRecordById('ProductionIssue', issue_id);
  if (!issue) throw Object.assign(new Error('Issue not found.'), { status: 404 });
  const users = await listRecords('User', { limit: 500 }, { role: 'admin' });
  const currentUser = users.find((item) => item.email === user.email);
  const displayName = currentUser?.display_name || currentUser?.full_name || user.email;
  let existing = [];
  try { existing = JSON.parse(issue.corrective_actions_json || '[]'); } catch { existing = []; }
  if (!existing.some((action) => action.owner === displayName) && user.role !== 'admin') {
    throw Object.assign(new Error('You are not an owner of an action on this issue.'), { status: 403 });
  }
  const merged = existing.map((action, index) => {
    const incoming = actions[index];
    if (!incoming || (user.role !== 'admin' && action.owner !== displayName)) return action;
    return {
      ...action,
      owner_feedback: incoming.owner_feedback ?? action.owner_feedback,
      feedback_date: incoming.feedback_date ?? action.feedback_date,
    };
  });
  const feedbackPending = merged.some((action) => action.owner_feedback?.trim());
  const updated = await updateRecord('ProductionIssue', issue_id, {
    corrective_actions_json: JSON.stringify(merged),
    feedback_pending: feedbackPending,
  }, { ...user, role: 'admin' });
  return { success: true, corrective_actions_json: updated.corrective_actions_json };
}

async function getRecordById(entity, id) {
  const result = await pool.query(`SELECT data FROM entity_records WHERE entity_name = $1 AND id = $2`, [entity, id]);
  return result.rows[0]?.data || null;
}

export async function regenerateLearnedLessons(user = null) {
  const entries = await listRecords('VisualInspectionEntry', {
    filters: { human_validated: true, human_agrees_with_ai: false },
    sort: '-validated_at',
    limit: 500,
  }, { role: 'admin' });
  const corrections = entries.filter((entry) =>
    entry.human_corrected_label?.trim() || entry.human_feedback?.trim(),
  );
  let summary = '';
  if (corrections.length) {
    const correctionText = corrections.map((entry, index) => [
      `${index + 1}. Part: ${entry.part_number || '—'}, Client: ${entry.client || '—'}`,
      entry.human_corrected_label ? `Human correction: ${entry.human_corrected_label}` : '',
      entry.human_feedback ? `Feedback: ${entry.human_feedback}` : '',
    ].filter(Boolean).join('\n')).join('\n');
    const response = await invokeLlm({
      prompt: `You are a quality inspection expert for aviation parts. Create a compact summary (maximum 500 words) of actionable patterns in these human corrections. Return bullet points and do not list each correction.\n\n${correctionText}`,
      response_json_schema: { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] },
    });
    summary = response.summary || '';
  }
  const existing = await listRecords('AiLearnedLessons', { sort: '-generated_at', limit: 1 }, { role: 'admin' });
  const data = {
    summary_text: summary,
    corrections_count: corrections.length,
    last_correction_id: corrections[0]?.id || '',
    generated_at: new Date().toISOString(),
    generated_by: user?.email || '',
  };
  const saved = existing[0]
    ? await updateRecord('AiLearnedLessons', existing[0].id, data, { ...user, role: 'admin' })
    : await createRecord('AiLearnedLessons', data, { ...user, email: user?.email || 'system', role: 'admin' });
  return { summary, count: corrections.length, message: 'Lessons regenerated successfully', record: saved };
}
