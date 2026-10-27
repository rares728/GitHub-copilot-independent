import React, { useRef, useState } from 'react';
import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { FileText, FileSpreadsheet, Table, Upload } from 'lucide-react';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';

const slug = (s) => s.toLowerCase().replace(/\s+/g, '_');

export default function PicklistFileActions({ category, headers, rows, isTwoField, isThreeField, existingValues, allowedClients, onImported }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);

  const fileBase = () => `Picklist_${category}_${new Date().toISOString().split('T')[0]}`;

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
    workbook.addWorksheet('Picklist').addRows([headers, ...rows]);
    const content = await workbook.xlsx.writeBuffer();
    downloadBlob(content, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `${fileBase()}.xlsx`);
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 14;
    const colW = (pageW - margin * 2) / headers.length;
    doc.setFontSize(14);
    doc.text(`Picklist: ${category}`, margin, 15);
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
    try {
      const { file_url } = await apiClient.integrations.Core.UploadPublicFile({ file });
      const res = await apiClient.functions.invoke('importPicklistFile', { file_url });
      const extracted = res.data?.rows || [];
      const existing = new Set(existingValues);
      const toCreate = [];
      extracted.forEach((row) => {
        const label = String(row.label ?? '').trim() || String(row.value ?? '').trim();
        const value = isTwoField
          ? String(row.value ?? '').trim()
          : (String(row.value ?? '').trim() || slug(label));
        if (!value || existing.has(value)) return;
        const payload = {
          category,
          label,
          value,
          sort_order: existing.size + toCreate.length + 1,
          is_active: row.active !== false,
        };
        if (isThreeField) {
          const clientVal = String(row.client ?? '').trim().toUpperCase();
          payload.client = (allowedClients || []).includes(clientVal) ? clientVal : null;
        }
        existing.add(value);
        toCreate.push(payload);
      });
      if (toCreate.length) await apiClient.entities.PicklistOption.bulkCreate(toCreate);
      setStatus(`Imported ${toCreate.length} of ${extracted.length} rows.`);
      onImported();
    } catch (err) {
      setStatus(`Import failed: ${err.message}`);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
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
      {busy && <span className="text-xs text-slate-500">Importing...</span>}
      {status && <span className="text-xs text-slate-500">{status}</span>}
    </div>
  );
}