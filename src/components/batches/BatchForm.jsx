import React, { useState, useEffect } from 'react';
import { apiClient } from '@/api/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ExternalLink, Plus, Trash2, AlertTriangle } from 'lucide-react';
import MobileSelect from '@/components/ui/MobileSelect';
import PartNumberCombobox from '@/components/ui/PartNumberCombobox';
import EuDateInput from '@/components/ui/EuDateInput';
import { fetchProcessSteps, fetchIssueTypes, fetchPartNumberAlias } from '../issues/picklists';

// A single operation row
function OperationRow({ row, index, processStepOptions, issueTypeOptions, onChange, onRemove }) {
  return (
    <div className="flex gap-2 items-end">
      <div className="flex-1">
        <Label className="text-xs font-medium">Process Step</Label>
        <MobileSelect
          value={row.machine || ''}
          onValueChange={v => onChange(index, 'machine', v)}
          placeholder="Select"
          triggerClassName="mt-1 text-sm h-9"
          items={processStepOptions}
        />
      </div>
      <div className="w-24">
        <Label className="text-xs font-medium">Q-ty NOK</Label>
        <Input
          type="number"
          min="0"
          inputMode="numeric"
          value={row.operation_number || ''}
          onChange={e => onChange(index, 'operation_number', e.target.value)}
          className="mt-1 text-sm h-9"
          placeholder="0"
        />
      </div>
      <div className="flex-1">
        <Label className="text-xs font-medium">Issue Type</Label>
        <MobileSelect
          value={row.operation_name || ''}
          onValueChange={v => onChange(index, 'operation_name', v)}
          placeholder="Select"
          triggerClassName="mt-1 text-sm h-9"
          items={issueTypeOptions}
        />
      </div>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={() => onRemove(index)}
        className="h-9 w-9 text-red-400 hover:text-red-600 flex-shrink-0 self-end"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

const EMPTY_ROW = { machine: '', operation_number: '', operation_name: '' };

function parseRows(batch) {
  if (!batch) return [{ ...EMPTY_ROW }];
  try {
    const parsed = JSON.parse(batch._operation_rows);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (_) {}
  return [{
    machine: batch.machine || '',
    operation_number: batch.operation_number || '',
    operation_name: batch.operation_name || '',
  }];
}

export default function BatchForm({ open, batch, onClose, onSaved, onDeleted, existingBatchNumbers = [] }) {
  const isEdit = !!batch;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Batch number: 7 digit manual input
  const [batchNumber, setBatchNumber] = useState(batch?.batch_number || '');
  const [batchDuplicateWarning, setBatchDuplicateWarning] = useState(false);
  const [duplicateId, setDuplicateId] = useState(null);

  const [form, setForm] = useState({
    production_date: batch?.production_date || new Date().toISOString().split('T')[0],
    part_number: batch?.part_number || '',
    part_description: batch?.part_description || '',
    notes: batch?.notes || '',
    rcca_issue_id: batch?.rcca_issue_id || '',
    rcca_issue_number: batch?.rcca_issue_number || '',
    ncr_number: batch?.ncr_number || '',
    saved_by: batch?.saved_by || '',
  });

  const [total_parts, setTotalParts] = useState(batch?.total_parts ?? '');
  const [parts_reprocessed, setPartsReprocessed] = useState(batch?.parts_reprocessed ?? '');

  const [opRows, setOpRows] = useState(() => parseRows(batch));

  const [submitted, setSubmitted] = useState(false);
  const [issues, setIssues] = useState([]);
  const [saving, setSaving] = useState(false);
  const [processStepOptions, setProcessStepOptions] = useState([]);
  const [issueTypeOptions, setIssueTypeOptions] = useState([]);
  const [partNumberData, setPartNumberData] = useState([]);

  useEffect(() => {
    apiClient.entities.ProductionIssue.list('-created_date', 200).then(data => setIssues(data || []));
    fetchProcessSteps().then(setProcessStepOptions);
    fetchIssueTypes().then(setIssueTypeOptions);
    fetchPartNumberAlias().then(setPartNumberData);
    // Load current user
    apiClient.auth.me().then(u => {
      if (u && !batch) setForm(p => ({ ...p, saved_by: u.full_name || u.email || '' }));
    });
  }, []);

  // Computed: parts_nok = sum of Q-ty NOK rows, parts_ok = total - nok
  const parts_nok = opRows.reduce((s, r) => s + (Number(r.operation_number) || 0), 0);
  const parts_ok = (Number(total_parts) || 0) - parts_nok;

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handlePartNumberChange = (pn, alias) => {
    setForm(p => ({ ...p, part_number: pn, part_description: alias !== undefined ? alias : p.part_description }));
  };

  const linkIssue = (issueId) => {
    const found = issues.find(i => i.id === issueId);
    set('rcca_issue_id', issueId === 'none' ? '' : issueId);
    set('rcca_issue_number', found?.issue_number || '');
  };

  const updateOpRow = (index, key, value) => {
    setOpRows(prev => prev.map((r, i) => i === index ? { ...r, [key]: value } : r));
  };
  const addOpRow = () => setOpRows(prev => [...prev, { ...EMPTY_ROW }]);
  const removeOpRow = (index) => setOpRows(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);

  const handleBatchNumberChange = (val) => {
    const newVal = val.slice(0, 7);
    setBatchNumber(newVal);
    if (!isEdit && newVal.length > 0) {
      const dup = existingBatchNumbers.find(b => b.batch_number === newVal);
      if (dup) { setBatchDuplicateWarning(true); setDuplicateId(dup.id); }
      else { setBatchDuplicateWarning(false); setDuplicateId(null); }
    } else {
      setBatchDuplicateWarning(false);
      setDuplicateId(null);
    }
  };

  const handleSubmit = async () => {
    setSubmitted(true);
    if (!valid) return;
    setSaving(true);
    const firstRow = opRows[0] || EMPTY_ROW;
    const user = await apiClient.auth.me().catch(() => null);
    const data = {
      ...form,
      batch_number: batchNumber.trim(),
      machine: firstRow.machine,
      operation_number: firstRow.operation_number,
      operation_name: firstRow.operation_name,
      _operation_rows: JSON.stringify(opRows),
      total_parts: total_parts !== '' ? Number(total_parts) : undefined,
      parts_ok: parts_ok >= 0 ? parts_ok : 0,
      parts_reprocessed: parts_reprocessed !== '' ? Number(parts_reprocessed) : undefined,
      parts_nok,
      saved_by: user?.full_name || user?.email || form.saved_by,
    };
    if (isEdit) {
      await apiClient.entities.ProductionBatch.update(batch.id, data);
      onSaved({ ...batch, ...data });
    } else {
      const created = await apiClient.entities.ProductionBatch.create(data);
      onSaved(created);
    }
    setSaving(false);
  };

  const valid = batchNumber.trim() && form.part_number.trim() && !batchDuplicateWarning;

  const handleDelete = async () => {
    setDeleting(true);
    await apiClient.entities.ProductionBatch.delete(batch.id);
    setDeleting(false);
    onClose();
    if (onDeleted) onDeleted(batch.id);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Batch' : 'New Production Batch'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Row 1: Batch Number, Production Date, Part Number, Alias */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label className={`text-xs font-medium ${submitted && !batchNumber.trim() ? 'text-red-600' : ''}`}>Batch Number <span className="text-red-500">*</span></Label>
              <Input
                value={batchNumber}
                onChange={e => handleBatchNumberChange(e.target.value)}
                placeholder="0000001"
                className={`mt-1 text-sm font-mono ${submitted && !batchNumber.trim() ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                maxLength={7}
              />
              {submitted && !batchNumber.trim() && <p className="text-xs text-red-600 mt-0.5">Required</p>}
              {batchDuplicateWarning && (
                <div className="flex items-center gap-1 mt-1 text-xs text-amber-600 font-medium">
                  <AlertTriangle className="w-3 h-3" />
                  Batch Number exists
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs font-medium">Production Date</Label>
              <EuDateInput value={form.production_date} onChange={e => set('production_date', e.target.value)} className="mt-1 text-sm" />
            </div>
            <div>
              <Label className={`text-xs font-medium ${submitted && !form.part_number.trim() ? 'text-red-600' : ''}`}>Part Number <span className="text-red-500">*</span></Label>
              <PartNumberCombobox
                value={form.part_number || ''}
                onChange={handlePartNumberChange}
                partNumberData={partNumberData}
                placeholder="Select or type part..."
                className={`mt-1 ${submitted && !form.part_number.trim() ? '[&>button]:border-red-400' : ''}`}
              />
              {submitted && !form.part_number.trim() && <p className="text-xs text-red-600 mt-0.5">Required</p>}
            </div>
            <div>
              <Label className="text-xs font-medium">Alias</Label>
              <Input value={form.part_description} onChange={e => set('part_description', e.target.value)} placeholder="Auto-filled" className="mt-1 text-sm bg-slate-50" />
            </div>
          </div>

          {/* Operation Rows */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-slate-600">Operations</Label>
              <Button type="button" size="sm" variant="outline" onClick={addOpRow} className="h-7 text-xs gap-1">
                <Plus className="w-3 h-3" /> Add Row
              </Button>
            </div>
            {opRows.map((row, i) => (
              <OperationRow
                key={i}
                row={row}
                index={i}
                processStepOptions={processStepOptions}
                issueTypeOptions={issueTypeOptions}
                onChange={updateOpRow}
                onRemove={removeOpRow}
              />
            ))}
          </div>

          {/* Quantities - NOK auto-computed, OK derived */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">Total Parts</Label>
              <Input type="number" min="0" inputMode="numeric" value={total_parts} onChange={e => setTotalParts(e.target.value)} className="mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-medium">Parts NOK <span className="text-xs text-slate-400">(auto = sum of Q-ty NOK)</span></Label>
              <Input type="number" value={parts_nok} readOnly className="mt-1 text-sm bg-red-50 font-semibold text-red-700" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">Parts OK <span className="text-xs text-slate-400">(auto = Total − NOK)</span></Label>
              <Input type="number" value={parts_ok >= 0 ? parts_ok : 0} readOnly className="mt-1 text-sm bg-green-50 font-semibold text-green-700" />
            </div>
            <div>
              <Label className="text-xs font-medium">Parts Reprocessed</Label>
              <Input type="number" min="0" inputMode="numeric" value={parts_reprocessed} onChange={e => setPartsReprocessed(e.target.value)} className="mt-1 text-sm bg-yellow-50" />
            </div>
          </div>

          {/* RCCA Issue + NCR # on same line */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">Link to RCCA Issue</Label>
              <MobileSelect
                value={form.rcca_issue_id || 'none'}
                onValueChange={linkIssue}
                placeholder="None"
                triggerClassName="mt-1 text-sm h-9"
                items={[
                  { value: 'none', label: 'None' },
                  ...issues.map(i => ({ value: i.id, label: `${i.issue_number ? i.issue_number + ' – ' : ''}${i.title}` }))
                ]}
              />
              {form.rcca_issue_id && (
                <Link to={createPageUrl('IssueDetail') + '?id=' + form.rcca_issue_id} target="_blank">
                  <p className="text-xs text-blue-600 mt-1 flex items-center gap-1 hover:underline">
                    <ExternalLink className="w-3 h-3" /> View linked RCCA
                  </p>
                </Link>
              )}
            </div>
            <div>
              <Label className="text-xs font-medium">NCR # in ARAS</Label>
              <Input value={form.ncr_number} onChange={e => set('ncr_number', e.target.value)} placeholder="NCR number" className="mt-1 text-sm" />
            </div>
          </div>

          <div>
            <Label className="text-xs font-medium">Notes</Label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className="mt-1 text-sm" />
          </div>

          <div>
            <Label className="text-xs font-medium">Recorded By</Label>
            <Input value={form.saved_by} readOnly className="mt-1 text-sm bg-slate-50 text-slate-500" />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {isEdit && !confirmDelete && (
            <Button
              variant="outline"
              className="text-red-500 hover:text-red-700 hover:border-red-300 sm:mr-auto"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="w-4 h-4 mr-1" /> Delete Batch
            </Button>
          )}
          {isEdit && confirmDelete && (
            <div className="flex items-center gap-2 sm:mr-auto">
              <span className="text-sm text-red-600 font-medium">Are you sure?</span>
              <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>No</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </Button>
            </div>
          )}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !valid} className="bg-blue-600 hover:bg-blue-700">
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Batch'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}