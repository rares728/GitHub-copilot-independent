import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Archive, Upload, FileDown, Trash2, RotateCcw, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import EuDateInput from '@/components/ui/EuDateInput';
import ArchiveKpiExport from '@/components/archive/ArchiveKpiExport';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const fmt = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

export default function ArchivePage() {
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(true);

  // Archive form
  const [archStart, setArchStart] = useState('');
  const [archEnd, setArchEnd] = useState('');
  const [archiving, setArchiving] = useState(false); // 'archive' | 'archive-remove' | false
  const [archMsg, setArchMsg] = useState(null);

  // Restore
  const [restoring, setRestoring] = useState(null);
  const [restoreMsg, setRestoreMsg] = useState(null);
  const [confirmArchiveRemove, setConfirmArchiveRemove] = useState(null); // { count, start, end }
  const [confirmDeleteArchiveId, setConfirmDeleteArchiveId] = useState(null);
  const [confirmRestoreArchive, setConfirmRestoreArchive] = useState(null);

  const fileRef = useRef();

  const loadArchives = async () => {
    setLoading(true);
    const list = await apiClient.entities.IssueArchive.list('-created_date', 100);
    setArchives(list);
    setLoading(false);
  };

  useEffect(() => { loadArchives(); }, []);

  // Archive JSON is too large for an entity field: store it as a private file and keep the URI in `data`.
  // Legacy records (created before this change) keep inline JSON in `data`.
  const uploadArchiveFile = async (records, name) => {
    const { file_uri } = await apiClient.integrations.Core.UploadPrivateFile({
      file: new File([JSON.stringify(records)], `${name}.json`, { type: 'application/json' }),
    });
    return file_uri;
  };

  const getArchiveContent = async (archive) => {
    const d = (archive.data || '').trim();
    if (d.startsWith('[')) return d; // legacy inline JSON
    const { signed_url } = await apiClient.integrations.Core.CreateFileSignedUrl({ file_uri: d, expires_in: 300 });
    const res = await fetch(signed_url);
    if (!res.ok) throw new Error('Could not read the archive file.');
    return await res.text();
  };

  // Unlimited size: save the archive JSON directly to the user's disk (browser download).
  const saveArchiveToDisk = (records, name) => {
    const blob = new Blob([JSON.stringify(records)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doArchive = async (andDelete = false) => {
    if (!archStart || !archEnd) return;
    setArchiving(andDelete ? 'archive-remove' : 'archive');
    setArchMsg(null);
    try {
      const issues = await apiClient.entities.ProductionIssue.list('-reported_date', 5000);
      const filtered = issues.filter(i => {
        const d = i.reported_date || (i.created_date ? i.created_date.split('T')[0] : null);
        if (!d) return false;
        return d >= archStart && d <= archEnd;
      });
      if (filtered.length === 0) {
        setArchMsg({ type: 'warn', text: 'No issues found in this date range.' });
        setArchiving(false);
        return;
      }
      if (andDelete) {
        setConfirmArchiveRemove({ count: filtered.length, start: archStart, end: archEnd, filtered });
        setArchiving(false);
        return;
      }
      const name = `RCCA_Archive_${archStart}_to_${archEnd}`;
      const user = await apiClient.auth.me();
      saveArchiveToDisk(filtered, name);
      const fileUri = await uploadArchiveFile(filtered, name);
      await apiClient.entities.IssueArchive.create({
        archive_name: name,
        start_date: archStart,
        end_date: archEnd,
        record_count: filtered.length,
        data: fileUri,
        archived_by: user?.full_name || user?.email || '',
      });
      setArchMsg({ type: 'ok', text: `Archived ${filtered.length} issues as "${name}" — the JSON file was saved to your disk (browser downloads).` });
      setArchStart('');
      setArchEnd('');
      loadArchives();
    } catch (e) {
      setArchMsg({ type: 'error', text: e.message });
    }
    setArchiving(false);
  };

  const doArchiveAndRemoveConfirmed = async ({ count, start, end, filtered }) => {
    setArchiving('archive-remove');
    setArchMsg(null);
    try {
      const name = `RCCA_Archive_${start}_to_${end}`;
      const user = await apiClient.auth.me();
      saveArchiveToDisk(filtered, name);
      const fileUri = await uploadArchiveFile(filtered, name);
      await apiClient.entities.IssueArchive.create({
        archive_name: name, start_date: start, end_date: end,
        record_count: filtered.length, data: fileUri,
        archived_by: user?.full_name || user?.email || '',
      });
      for (const issue of filtered) await apiClient.entities.ProductionIssue.delete(issue.id);
      setArchMsg({ type: 'ok', text: `Archived and deleted ${filtered.length} issues as "${name}" — the JSON file was saved to your disk (browser downloads).` });
      setArchStart(''); setArchEnd('');
      loadArchives();
    } catch (e) { setArchMsg({ type: 'error', text: e.message }); }
    setArchiving(false);
  };

  const handleArchive = () => doArchive(false);
  const handleArchiveAndRemove = () => doArchive(true);

  const handleDownload = async (archive) => {
    const content = await getArchiveContent(archive);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${archive.archive_name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (id) => {
    await apiClient.entities.IssueArchive.delete(id);
    loadArchives();
  };

  const handleRestoreFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoring('file');
    setRestoreMsg(null);
    try {
      const text = await file.text();
      const records = JSON.parse(text);
      if (!Array.isArray(records)) throw new Error('Invalid archive file format.');
      let restored = 0;
      for (const rec of records) {
        const { id, created_date, updated_date, ...data } = rec;
        await apiClient.entities.ProductionIssue.create(data);
        restored++;
      }
      setRestoreMsg({ type: 'ok', text: `Restored ${restored} issues from file.` });
    } catch (err) {
      setRestoreMsg({ type: 'error', text: err.message });
    }
    setRestoring(null);
    e.target.value = '';
  };

  const handleRestoreFromRecord = async (archive) => {
    setConfirmRestoreArchive(archive);
  };

  const doRestoreFromRecord = async (archive) => {
    setRestoring(archive.id);
    setRestoreMsg(null);
    try {
      const records = JSON.parse(await getArchiveContent(archive));
      let restored = 0;
      for (const rec of records) {
        const { id, created_date, updated_date, ...data } = rec;
        await apiClient.entities.ProductionIssue.create(data);
        restored++;
      }
      setRestoreMsg({ type: 'ok', text: `Restored ${restored} issues from "${archive.archive_name}".` });
    } catch (err) {
      setRestoreMsg({ type: 'error', text: err.message });
    }
    setRestoring(null);
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Archive</h1>
        <p className="text-sm text-slate-500 mt-0.5">Archive, restore, and export issue data</p>
      </div>

      {/* ── 1. Archive Issues ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Archive className="w-4 h-4 text-blue-600" /> Archive Issues
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-slate-500">Select a date range — all issues with a reported date in that range will be saved to an archive record (JSON format, Notion-compatible).</p>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <Label className="text-xs font-medium">Start Date</Label>
              <EuDateInput value={archStart} onChange={e => setArchStart(e.target.value)} className="mt-1 h-9 w-36" />
            </div>
            <div>
              <Label className="text-xs font-medium">End Date</Label>
              <EuDateInput value={archEnd} onChange={e => setArchEnd(e.target.value)} className="mt-1 h-9 w-36" />
            </div>
            <Button
              onClick={handleArchive}
              disabled={!!archiving || !archStart || !archEnd}
              className="bg-blue-600 hover:bg-blue-700 h-9 gap-2"
            >
              {archiving === 'archive' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
              Archive
            </Button>
            <Button
              onClick={handleArchiveAndRemove}
              disabled={!!archiving || !archStart || !archEnd}
              variant="outline"
              className="h-9 gap-2 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              {archiving === 'archive-remove' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Archive &amp; Remove
            </Button>
          </div>
          {archMsg && (
            <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${archMsg.type === 'ok' ? 'bg-green-50 text-green-700' : archMsg.type === 'warn' ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'}`}>
              {archMsg.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {archMsg.text}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 2. Restore ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-green-600" /> Restore from Archive
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-slate-500">Restore from a stored archive record below, or upload a JSON archive file.</p>
          <div className="flex items-center gap-3">
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleRestoreFile} />
            <Button variant="outline" onClick={() => fileRef.current.click()} disabled={!!restoring} className="gap-2 h-9">
              <Upload className="w-4 h-4" /> Upload JSON File
            </Button>
            {restoring === 'file' && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
          </div>
          {restoreMsg && (
            <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${restoreMsg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {restoreMsg.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {restoreMsg.text}
            </div>
          )}

          {/* Archive list */}
          <div className="mt-2 space-y-2">
            {loading && <div className="text-xs text-slate-400 animate-pulse">Loading archives...</div>}
            {!loading && archives.length === 0 && <div className="text-xs text-slate-400">No archives yet.</div>}
            {archives.map(a => (
              <div key={a.id} className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2.5 border border-slate-100 dark:border-slate-700">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{a.archive_name}</p>
                  <p className="text-[10px] text-slate-400">{fmt(a.start_date)} → {fmt(a.end_date)} · {a.record_count} issues · by {a.archived_by || '—'}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Button size="sm" variant="outline" onClick={() => handleDownload(a)} className="h-7 px-2 gap-1 text-xs">
                    <FileDown className="w-3 h-3" /> Download
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleRestoreFromRecord(a)} disabled={!!restoring} className="h-7 px-2 gap-1 text-xs text-green-700 border-green-200 hover:bg-green-50">
                    {restoring === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} Restore
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteArchiveId(a.id)} className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── 3. KPI PDF Export ── */}
      <ArchiveKpiExport />

      {/* Archive & Remove confirmation */}
      <AlertDialog open={!!confirmArchiveRemove} onOpenChange={open => !open && setConfirmArchiveRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive &amp; Delete Issues?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {confirmArchiveRemove?.count} issues from {fmt(confirmArchiveRemove?.start)} to {fmt(confirmArchiveRemove?.end)}. They will be saved in the archive first. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { const d = confirmArchiveRemove; setConfirmArchiveRemove(null); doArchiveAndRemoveConfirmed(d); }}>Archive &amp; Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete archive record confirmation */}
      <AlertDialog open={!!confirmDeleteArchiveId} onOpenChange={open => !open && setConfirmDeleteArchiveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Archive Record?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this archive record.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { handleDelete(confirmDeleteArchiveId); setConfirmDeleteArchiveId(null); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore confirmation */}
      <AlertDialog open={!!confirmRestoreArchive} onOpenChange={open => !open && setConfirmRestoreArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Issues?</AlertDialogTitle>
            <AlertDialogDescription>
              This will re-create {confirmRestoreArchive?.record_count} issues from "{confirmRestoreArchive?.archive_name}" in the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const a = confirmRestoreArchive; setConfirmRestoreArchive(null); doRestoreFromRecord(a); }}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}