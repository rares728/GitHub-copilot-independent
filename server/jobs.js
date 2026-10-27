import cron from 'node-cron';
import { pool } from './db.js';
import { listRecords } from './entities.js';
import { sendEmail } from './integrations.js';

const systemUser = { id: 'system', email: 'system', role: 'admin' };

export async function sendCorrectiveActionReminders() {
  const [issues, users] = await Promise.all([
    listRecords('ProductionIssue', { limit: 50000 }, systemUser),
    listRecords('User', { limit: 500 }, systemUser),
  ]);
  const openIssues = issues.filter((issue) => issue.status !== 'closed');
  const userEmails = new Map();
  for (const user of users) {
    if (!user.email) continue;
    userEmails.set((user.display_name || user.full_name || user.email).toLowerCase(), user.email);
    userEmails.set(user.email.toLowerCase(), user.email);
  }
  const today = new Date().toISOString().slice(0, 10);
  const sent = [];
  for (const issue of openIssues) {
    let actions = [];
    try { actions = JSON.parse(issue.corrective_actions_json || '[]'); } catch { actions = []; }
    for (const action of actions) {
      if (!action.owner || !action.due_date || action.completed_date || action.due_date > today) continue;
      const email = userEmails.get(action.owner.toLowerCase());
      if (!email) continue;
      const issueRef = issue.issue_number || issue.id;
      const title = issue.title || issue.defect_description || issueRef || 'Unknown';
      const description = action.action || action.description || action.corrective_action || '(no description)';
      await sendEmail({
        to: email,
        subject: `Action reminder – ${issueRef}: ${title}`,
        body: `This is a daily reminder that you have an open corrective action due.\n\nIssue: ${issueRef} – ${title}\nAction owner: ${action.owner}\nDue date: ${action.due_date}\n\nCorrective action:\n${description}\n\nPlease update the RCCA Tracker.`,
      });
      sent.push({ email, issue: issueRef, action: description, due_date: action.due_date });
    }
  }
  return { sent, count: sent.length };
}

export async function sendStandupReminders() {
  const points = await listRecords('StandupPoint', { limit: 500 }, systemUser);
  const today = new Date().toISOString().slice(0, 10);
  const sent = [];
  for (const point of points) {
    if (point.is_archived || point.status === 'Resolved') continue;
    if (point.category === 'Materiale') {
      let rows = [];
      try { rows = JSON.parse(point.description || '[]'); } catch { rows = []; }
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        const { responsabil: email, actiune: action, termen: dueDate } = row;
        if (!email || !action || !dueDate || dueDate > today) continue;
        await sendEmail({
          to: email,
          subject: 'Standup reminder – Materiale',
          body: `P/N blocat: ${row.pn_blocat || '-'}\nMaterial lipsă: ${row.mat_lipsa || '-'}\nTermen limită: ${dueDate}\n\nAcțiune:\n${action}`,
        });
        sent.push({ email, category: 'Materiale', due_date: dueDate });
      }
      continue;
    }
    if (!point.owner_email || !point.action || !point.due_date || point.due_date > today) continue;
    await sendEmail({
      to: point.owner_email,
      subject: `Standup reminder – ${point.category}`,
      body: `Categorie: ${point.category}\nDescriere: ${point.description || '-'}\nTermen limită: ${point.due_date}\n\nAcțiune:\n${point.action}`,
    });
    sent.push({ email: point.owner_email, category: point.category, due_date: point.due_date });
  }
  return { sent, count: sent.length };
}

export async function sendCriticalIssueAlert(issue) {
  if (issue?.severity !== 'critical') return { skipped: true, reason: 'Not critical' };
  if (!process.env.CRITICAL_ALERT_EMAIL) {
    throw Object.assign(new Error('Set CRITICAL_ALERT_EMAIL to enable critical-issue alerts.'), { status: 503 });
  }
  const issueNumber = issue.issue_number || issue.id || '—';
  const title = issue.title || '—';
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
  const body = `<p>A <strong>CRITICAL</strong> production issue requires immediate attention.</p><ul><li>Issue: ${escapeHtml(issueNumber)}</li><li>Title: ${escapeHtml(title)}</li><li>Description: ${escapeHtml(issue.defect_description || '—')}</li><li>Downtime start: ${escapeHtml(issue.downtime_start || '—')}</li></ul>`;
  await sendEmail({
    to: process.env.CRITICAL_ALERT_EMAIL,
    from_name: 'Aeronamic RCCA System',
    subject: `CRITICAL Issue Alert: ${issueNumber} — ${title}`,
    body,
  });
  return { sent: true, issue_number: issueNumber };
}

export function scheduleDailyJobs() {
  const expression = process.env.REMINDER_CRON || '0 8 * * *';
  if (!cron.validate(expression)) throw new Error('REMINDER_CRON is not a valid cron expression.');
  cron.schedule(expression, async () => {
    for (const [name, run] of [
      ['corrective action reminders', sendCorrectiveActionReminders],
      ['standup reminders', sendStandupReminders],
    ]) {
      try {
        const result = await run();
        console.info(`Sent ${result.count} ${name}.`);
      } catch (error) {
        console.error(`Scheduled ${name} failed:`, error);
      }
    }
  }, { timezone: process.env.TZ || 'UTC' });
}

export async function logActivity(userId, page) {
  await pool.query(`INSERT INTO activity_log (user_id, page) VALUES ($1, $2)`, [userId, page]);
}
