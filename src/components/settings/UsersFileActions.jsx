import React, { useRef, useState } from 'react';
import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { FileText, FileSpreadsheet, Table, Upload, UserPlus, X } from 'lucide-react';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function UsersFileActions({ title, headers, rows, existingEmails, onInvited }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [pending, setPending] = useState(null);
  const [inviting, setInviting] = useState(false);

  const fileBase = () => `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`;

  const downloadBlob = (content, mime, filename) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const csv = [headers, ...rows]
      .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    downloadBlob('\uFEFF' + csv, 'text/csv;charset=utf-8', `${fileBase()}.csv`);
  };

  const exportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Users').addRows([headers, ...rows]);
    const content = await workbook.xlsx.writeBuffer();
    downloadBlob(content, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `${fileBase()}.xlsx`);
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 14;
    const colW = (pageW - margin * 2) / headers.length;
    doc.setFontSize(14);
    doc.text(title, margin, 15);
    let y = 24;
    doc.setFontSize(10);
    doc.setFillColor(37, 99, 235);
    doc.setTextColor(255, 255, 255);
    doc.rect(margin, y, pageW - margin * 2, 7, 'F');
    headers.forEach((h, i) => doc.text(String(h), margin + colW * i + 2, y + 5));
    y += 7;
    doc.setTextColor(30, 41, 59);
    rows.forEach((r, ri) => {
      if (y > 280) { doc.addPage(); y = 15; }
      if (ri % 2 === 1) { doc.setFillColor(241, 245, 249); doc.rect(margin, y, pageW - margin * 2, 6, 'F'); }
      r.forEach((c, i) => {
        const lines = doc.splitTextToSize(String(c ?? ''), colW - 4);
        doc.text(lines[0] || '', margin + colW * i + 2, y + 4.5);
      });
      y += 6;
    });
    doc.save(`${fileBase()}.pdf`);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true);
    setStatus(null);
    setPending(null);
    try {
      const { file_uri } = await apiClient.integrations.Core.UploadPrivateFile({ file });
      const { signed_url } = await apiClient.integrations.Core.CreateFileSignedUrl({ file_uri, expires_in: 600 });
      const res = await apiClient.functions.invoke('importUsersFile', { file_url: signed_url });
      const extracted = res.data?.rows || [];
      const existing = new Set((existingEmails || []).map(em => String(em).toLowerCase()));
      const seen = new Set();
      const toInvite = [];
      extracted.forEach((row) => {
        const email = String(row.email ?? '').trim();
        const role = String(row.role ?? '').trim().toLowerCase() === 'admin' ? 'admin' : 'user';
        const key = email.toLowerCase();
        if (!EMAIL_RE.test(email) || existing.has(key) || seen.has(key)) return;
        seen.add(key);
        toInvite.push({ email, role });
      });
      if (!toInvite.length) {
        setStatus(extracted.length ? 'No new users found in file.' : 'No users found in file.');
      } else {
        setPending(toInvite);
      }
    } catch (err) {
      setStatus(`Import failed: ${err.message}`);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const doInvite = async () => {
    setInviting(true);
    let ok = 0;
    let fail = 0;
    for (const row of pending) {
      try { await apiClient.users.inviteUser(row.email, row.role); ok++; }
      catch { fail++; }
    }
    setStatus(`Invited ${ok} user(s)${fail ? `, ${fail} failed (already registered?)` : ''}.`);
    setPending(null);
    setInviting(false);
    onInvited?.();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-400">Export:</span>
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={exportPdf} disabled={!rows.length}>
          <FileText className="w-3.5 h-3.5" /> PDF
        </Button>
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={exportExcel} disabled={!rows.length}>
          <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
        </Button>
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={exportCsv} disabled={!rows.length}>
          <Table className="w-3.5 h-3.5" /> CSV
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.pdf"
          className="hidden"
          onChange={handleImport}
        />
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => fileRef.current?.click()} disabled={busy}>
          <Upload className="w-3.5 h-3.5" /> Import (PDF / Excel / CSV)
        </Button>
        {busy && <span className="text-xs text-slate-500">Reading file...</span>}
        {status && <span className="text-xs text-slate-500">{status}</span>}
      </div>
      {pending && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <span className="text-xs text-slate-700">
            {pending.length} new user(s) ready to invite. Each one receives an invite email.
          </span>
          <Button size="sm" className="h-7 px-2 text-xs gap-1" onClick={doInvite} disabled={inviting}>
            <UserPlus className="w-3.5 h-3.5" /> {inviting ? 'Inviting...' : `Invite ${pending.length}`}
          </Button>
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => setPending(null)} disabled={inviting}>
            <X className="w-3.5 h-3.5" /> Cancel
          </Button>
        </div>
      )}
    </div>
  );
}