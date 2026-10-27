import React, { useState, useEffect } from 'react';
import { apiClient } from '@/api/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import MobileSelect from '@/components/ui/MobileSelect';
import { Upload, Loader2, X, Paperclip } from 'lucide-react';

export default function DocumentForm({ open, onClose, onSaved, document: doc }) {
  const [form, setForm] = useState({
    title: '', document_type: '', description: '', version: 'v1.0',
    status: 'draft', department: '',
    linked_issue_id: '', linked_issue_number: '',
    linked_batch_id: '', linked_batch_number: '',
    file_url: '', file_name: ''
  });
  const [docTypes, setDocTypes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [issues, setIssues] = useState([]);
  const [batches, setBatches] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (doc) setForm({ title: '', document_type: '', description: '', version: 'v1.0', status: 'draft', department: '', linked_issue_id: '', linked_issue_number: '', linked_batch_id: '', linked_batch_number: '', file_url: '', file_name: '', ...doc });
      else setForm({ title: '', document_type: '', description: '', version: 'v1.0', status: 'draft', department: '', linked_issue_id: '', linked_issue_number: '', linked_batch_id: '', linked_batch_number: '', file_url: '', file_name: '' });
      loadOptions();
    }
  }, [open, doc?.id]);

  const loadOptions = async () => {
    const [opts, iss, bat] = await Promise.all([
      apiClient.entities.PicklistOption.filter({ is_active: true }, 'sort_order', 100),
      apiClient.entities.ProductionIssue.list('-created_date', 50),
      apiClient.entities.ProductionBatch.list('-created_date', 50),
    ]);
    setDocTypes(opts.filter(o => o.category === 'document_type'));
    setDepartments(opts.filter(o => o.category === 'department'));
    setIssues(iss);
    setBatches(bat);
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await apiClient.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, file_url, file_name: file.name }));
    setUploading(false);
  };

  const handleIssueChange = (val) => {
    if (val === '__none__') { setForm(f => ({ ...f, linked_issue_id: '', linked_issue_number: '' })); return; }
    const iss = issues.find(i => i.id === val);
    setForm(f => ({ ...f, linked_issue_id: val, linked_issue_number: iss?.issue_number || '' }));
  };

  const handleBatchChange = (val) => {
    if (val === '__none__') { setForm(f => ({ ...f, linked_batch_id: '', linked_batch_number: '' })); return; }
    const bat = batches.find(b => b.id === val);
    setForm(f => ({ ...f, linked_batch_id: val, linked_batch_number: bat?.batch_number || '' }));
  };

  const handleSave = async () => {
    if (!form.title || !form.document_type) return;
    setSaving(true);
    if (doc?.id) await apiClient.entities.Document.update(doc.id, form);
    else await apiClient.entities.Document.create(form);
    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{doc ? 'Edit Document' : 'New Document'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Title *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Document title" />
            </div>

            <div>
              <Label>Type *</Label>
              <MobileSelect
                value={form.document_type}
                onValueChange={v => setForm(f => ({ ...f, document_type: v }))}
                placeholder="Select type"
                triggerClassName="mt-1 text-sm h-9 w-full"
                items={docTypes.map(t => ({ value: t.value, label: t.label }))}
              />
            </div>

            <div>
              <Label>Department</Label>
              <MobileSelect
                value={form.department || '__none__'}
                onValueChange={v => setForm(f => ({ ...f, department: v === '__none__' ? '' : v }))}
                placeholder="Select dept."
                triggerClassName="mt-1 text-sm h-9 w-full"
                items={[{ value: '__none__', label: '— None —' }, ...departments.map(d => ({ value: d.value, label: d.label }))]}
              />
            </div>

            <div>
              <Label>Version</Label>
              <Input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} placeholder="v1.0" />
            </div>

            <div>
              <Label>Status</Label>
              <MobileSelect
                value={form.status}
                onValueChange={v => setForm(f => ({ ...f, status: v }))}
                placeholder="Status"
                triggerClassName="mt-1 text-sm h-9 w-full"
                items={[
                  { value: 'draft', label: 'Draft' },
                  { value: 'active', label: 'Active' },
                  { value: 'obsolete', label: 'Obsolete' },
                ]}
              />
            </div>

            <div className="col-span-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Brief description..." />
            </div>

            <div>
              <Label>Linked Issue</Label>
              <MobileSelect
                value={form.linked_issue_id || '__none__'}
                onValueChange={handleIssueChange}
                placeholder="None"
                triggerClassName="mt-1 text-sm h-9 w-full"
                items={[{ value: '__none__', label: '— None —' }, ...issues.map(i => ({ value: i.id, label: `${i.issue_number} – ${i.title?.slice(0, 30)}` }))]}
              />
            </div>

            <div>
              <Label>Linked Batch</Label>
              <MobileSelect
                value={form.linked_batch_id || '__none__'}
                onValueChange={handleBatchChange}
                placeholder="None"
                triggerClassName="mt-1 text-sm h-9 w-full"
                items={[{ value: '__none__', label: '— None —' }, ...batches.map(b => ({ value: b.id, label: `${b.batch_number} – ${b.part_number}` }))]}
              />
            </div>

            <div className="col-span-2">
              <Label>Attach File</Label>
              <label className="flex items-center gap-2 mt-1 cursor-pointer border border-dashed border-slate-300 rounded-lg px-3 py-3 hover:bg-slate-50 transition-colors">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> : <Upload className="w-4 h-4 text-slate-400" />}
                <span className="text-sm text-slate-500">{form.file_name || 'Click to upload file'}</span>
                <input type="file" className="hidden" onChange={handleFile} />
              </label>
              {form.file_url && (
                <div className="flex items-center gap-2 mt-2 text-xs text-blue-600">
                  <Paperclip className="w-3 h-3" />
                  <a href={form.file_url} target="_blank" rel="noreferrer" className="underline truncate">{form.file_name}</a>
                  <button onClick={() => setForm(f => ({ ...f, file_url: '', file_name: '' }))}><X className="w-3 h-3 text-slate-400" /></button>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!form.title || !form.document_type || saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            {doc ? 'Save Changes' : 'Create Document'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}