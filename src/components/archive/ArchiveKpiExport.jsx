import React, { useState } from 'react';
import { apiClient } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FileDown, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import EuDateInput from '@/components/ui/EuDateInput';
import jsPDF from 'jspdf';

const TYPE_LABELS = { defect: 'Defect', downtime: 'Downtime', safety: 'Safety', quality: 'Quality', process: 'Process', other: 'Other' };

function calcKpis(issues) {
  const open = issues.filter(i => i.status !== 'closed').length;
  const criticalOpen = issues.filter(i => i.severity === 'critical' && i.status !== 'closed').length;
  const closed = issues.filter(i => i.status === 'closed').length;
  const totalDowntimeMs = issues.reduce((sum, i) => {
    if (!i.downtime_start || !i.downtime_end) return sum;
    const ms = new Date(i.downtime_end) - new Date(i.downtime_start);
    return ms > 0 ? sum + ms : sum;
  }, 0);
  const totalDowntimeHours = totalDowntimeMs / 3600000;
  const downtimeDays = Math.floor(totalDowntimeHours / 24);
  const downtimeRemHours = Math.round(totalDowntimeHours % 24);
  const downtimeLabel = totalDowntimeMs > 0
    ? downtimeDays > 0 ? `${downtimeDays}d ${downtimeRemHours}h` : `${downtimeRemHours}h`
    : '0h';
  return { total: issues.length, open, criticalOpen, closed, downtimeLabel };
}

function buildPareto(issues, keyFn, labelFn) {
  const counts = {};
  issues.forEach(i => { const k = keyFn(i); counts[k] = (counts[k] || 0) + 1; });
  const total = Object.values(counts).reduce((s, v) => s + v, 0);
  return Object.entries(counts)
    .map(([k, count]) => ({ name: labelFn ? labelFn(k) : k, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

export default function ArchiveKpiExport() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exporting, setExporting] = useState(false);
  const [msg, setMsg] = useState(null);

  const fmt = (iso) => {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  const handleExport = async () => {
    if (!startDate || !endDate) return;
    setExporting(true);
    setMsg(null);
    try {
      const allIssues = await apiClient.entities.ProductionIssue.list('-reported_date', 5000);
      const issues = allIssues.filter(i => {
        const d = i.reported_date || (i.created_date ? i.created_date.split('T')[0] : null);
        if (!d) return false;
        return d >= startDate && d <= endDate;
      });

      const kpis = calcKpis(issues);
      const byType = buildPareto(issues, i => i.issue_type || 'other', k => TYPE_LABELS[k] || k);
      const byStep = buildPareto(issues, i => i.machine || 'Unknown');
      const byDefect = buildPareto(issues, i => i.title || 'Unknown');
      const byPart = buildPareto(issues, i => i.part_number || 'Unknown');

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const W = 210;
      let y = 15;

      // Header
      doc.setFillColor(30, 64, 175);
      doc.rect(0, 0, W, 28, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('RCCA Tracker — KPI Report', 14, 12);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Period: ${fmt(startDate)} — ${fmt(endDate)}`, 14, 20);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, W - 14, 20, { align: 'right' });
      y = 36;

      // KPI Cards
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Key Performance Indicators', 14, y);
      y += 5;

      const kpiDefs = [
        { label: 'Total Issues', value: kpis.total, color: [71, 85, 105] },
        { label: 'Open Issues', value: kpis.open, color: [37, 99, 235] },
        { label: 'Critical Open', value: kpis.criticalOpen, color: [220, 38, 38] },
        { label: 'Closed', value: kpis.closed, color: [22, 163, 74] },
        { label: 'Total Downtime', value: kpis.downtimeLabel, color: [239, 68, 68] },
      ];

      const cardW = (W - 28) / kpiDefs.length;
      kpiDefs.forEach((k, idx) => {
        const x = 14 + idx * (cardW + 2);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, y, cardW, 18, 2, 2, 'FD');
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...k.color);
        doc.text(String(k.value), x + cardW / 2, y + 10, { align: 'center' });
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(k.label, x + cardW / 2, y + 15.5, { align: 'center' });
      });
      y += 25;

      // Pareto tables
      const paretos = [
        { title: 'Issues by Type (Pareto)', data: byType },
        { title: 'Issues by Process Step (Pareto)', data: byStep },
        { title: 'Issues by Defect (Pareto)', data: byDefect },
        { title: 'Issues by Part Number (Top 10)', data: byPart },
      ];

      for (const pareto of paretos) {
        if (y > 240) { doc.addPage(); y = 15; }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 30, 30);
        doc.text(pareto.title, 14, y);
        y += 4;

        // Table header
        doc.setFillColor(241, 245, 249);
        doc.rect(14, y, W - 28, 6, 'F');
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text('#', 17, y + 4);
        doc.text('Name', 25, y + 4);
        doc.text('Count', W - 50, y + 4, { align: 'right' });
        doc.text('%', W - 28, y + 4, { align: 'right' });
        y += 6;

        let cumPct = 0;
        pareto.data.forEach((row, i) => {
          if (y > 270) { doc.addPage(); y = 15; }
          cumPct += row.pct;
          doc.setFillColor(i % 2 === 0 ? 255 : 248, i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 255 : 252);
          doc.rect(14, y, W - 28, 6, 'F');
          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(51, 65, 85);
          doc.text(String(i + 1), 17, y + 4);
          doc.text(String(row.name).slice(0, 36), 25, y + 4);
          doc.text(String(row.count), W - 50, y + 4, { align: 'right' });
          doc.text(`${row.pct}% (cum ${cumPct}%)`, W - 28, y + 4, { align: 'right' });

          // Bar
          const barMax = 60;
          const barW = Math.round((row.pct / 100) * barMax);
          doc.setFillColor(row.pct >= 80 ? 239 : 59, row.pct >= 80 ? 68 : 130, row.pct >= 80 ? 68 : 246);
          doc.rect(W - 50 - barMax - 5, y + 1.5, barW, 3, 'F');
          y += 6;
        });
        y += 6;
      }

      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`Page ${p} of ${pageCount}`, W / 2, 290, { align: 'center' });
        doc.text('RCCA Tracker — Confidential', 14, 290);
      }

      const filename = `KPI_Report_${startDate}_to_${endDate}.pdf`;
      doc.save(filename);
      setMsg({ type: 'ok', text: `Exported "${filename}"` });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
    setExporting(false);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <FileDown className="w-4 h-4 text-purple-600" /> Export KPI Report (PDF)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-slate-500">Select a date range to export a PDF with all KPI cards and Pareto charts for that period.</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <Label className="text-xs font-medium">Start Date</Label>
            <EuDateInput value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 h-9 w-36" />
          </div>
          <div>
            <Label className="text-xs font-medium">End Date</Label>
            <EuDateInput value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 h-9 w-36" />
          </div>
          <Button
            onClick={handleExport}
            disabled={exporting || !startDate || !endDate}
            className="bg-purple-600 hover:bg-purple-700 h-9 gap-2"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            Export PDF
          </Button>
        </div>
        {msg && (
          <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {msg.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {msg.text}
          </div>
        )}
      </CardContent>
    </Card>
  );
}