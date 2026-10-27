import React, { useState, useEffect } from 'react';
import { apiClient } from '@/api/client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import MobileSelect from '@/components/ui/MobileSelect';
import PartNumberCombobox from '@/components/ui/PartNumberCombobox';
import { Camera, ImagePlus, Loader2, X, Play, PauseCircle, CheckCircle2, Trash2 } from 'lucide-react';
import EuDateInput from '@/components/ui/EuDateInput';
import AiInspectionButton from '../visual/AiInspectionButton';
import { fetchIssueTypes, fetchProcessSteps, fetchPartNumberAlias, fetchDefectTypes, fetchUtilajSerial } from './picklists';
import { useUserOptions } from '@/hooks/useUserOptions';
import { genNextIssueNumber } from './issueNumberGen';

export default function IssueForm({ open, issue, onClose, onSaved, onDeleted, existingBatchNumbers = [], inline = false }) {
  // onSaved(updatedIssue, opts) — opts.silent=true means don't close the dialog
  // Fixed: native select only
  const isEdit = !!issue;

  const buildFormState = (iss) => ({
    issue_number: iss?.issue_number || '',
    title: iss?.title || '',
    issue_type: iss?.issue_type || '',
    defect_description: iss?.defect_description || '',
    severity: iss?.severity || 'medium',
    reported_date: iss?.reported_date || new Date().toISOString().split('T')[0],
    reported_by: iss?.reported_by || '',
    machine: iss?.machine || '',
    part_number: iss?.part_number || '',
    operation: iss?.operation || '',
    description: iss?.description || '',
    total_parts: iss?.total_parts ?? '',
    parts_to_analyze: iss?.parts_to_analyze ?? '',
    parts_nok: iss?.parts_nok ?? '',
  });

  const [form, setForm] = useState(buildFormState(issue));
  const [downtimeActive, setDowntimeActive] = useState(!!(issue?.downtime_start));
  const [downtimeStart, setDowntimeStart] = useState(issue?.downtime_start ? issue.downtime_start.slice(0,16) : '');
  const [downtimeEnd, setDowntimeEnd] = useState(issue?.downtime_end ? issue.downtime_end.slice(0,16) : '');
  const [downtimeEmailError, setDowntimeEmailError] = useState('');
  const [batchNumber, setBatchNumber] = useState(issue?.batch_number || '');
  const [liveIssue, setLiveIssue] = useState(issue || {});
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showRcca, setShowRcca] = useState(false);
  const [pendingImages, setPendingImages] = useState([]);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [defectTypeOptions, setDefectTypeOptions] = useState([]);
  const [issueTypeOptions, setIssueTypeOptions] = useState([]);
  const [processStepOptions, setProcessStepOptions] = useState([]);
  const [partNumberData, setPartNumberData] = useState([]);
  const [masinaData, setMasinaData] = useState([]);
  const [selectMode, setSelectMode] = useState('piese');
  const [currentUser, setCurrentUser] = useState(null);
  const userOptions = useUserOptions();

  // Confirmation dialogs
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [confirmRemoveIdx, setConfirmRemoveIdx] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);


  // Reset all form state whenever the dialog opens or switches issue
  useEffect(() => {
    if (!open) return;
    setLiveIssue(issue || {});
    setForm(buildFormState(issue));
    setDowntimeActive(!!(issue?.downtime_start));
    setDowntimeStart(issue?.downtime_start ? issue.downtime_start.slice(0,16) : '');
    setDowntimeEnd(issue?.downtime_end ? issue.downtime_end.slice(0,16) : '');
    setBatchNumber(issue?.batch_number || '');
    setPendingImages(issue?.image_urls || []);
    setSubmitted(false);
    setShowRcca(!!issue && ['rcca','containment','root_cause_analysis','corrective_action','verification'].includes(issue?.status));

    if (!issue) {
      genNextIssueNumber().then(num => setForm(p => ({ ...p, issue_number: num })));
      apiClient.auth.me().then(async u => {
        if (!u) return;
        // Use the backend function to get display_name (works for all roles)
        apiClient.functions.invoke('getUsers', {}).then(res => {
          const users = res.data?.users || [];
          const match = users.find(usr => usr.email === u.email);
          const name = match?.value || u.full_name || '';
          if (name) setForm(p => ({ ...p, reported_by: name }));
        }).catch(() => {
          if (u.full_name) setForm(p => ({ ...p, reported_by: u.full_name }));
        });
      });
    }
  }, [open, issue?.id]);

  useEffect(() => {
    fetchDefectTypes().then(setDefectTypeOptions);
    fetchIssueTypes().then(setIssueTypeOptions);
    fetchProcessSteps().then(setProcessStepOptions);
    fetchPartNumberAlias().then(setPartNumberData);
    fetchUtilajSerial().then(setMasinaData);
    apiClient.auth.me().then(setCurrentUser);
  }, []);

  const isAdmin = currentUser?.role === 'admin';

  const handlePartNumberChange = (pn, alias) => {
    setForm(p => ({ ...p, part_number: pn, operation: alias !== undefined ? alias : p.operation }));
  };

  const handleBatchNumberChange = (val) => {
    setBatchNumber(val.slice(0, 7));
  };

  const handleImageFiles = async (files) => {
    if (!files || files.length === 0) return;
    setUploadingImg(true);
    const newUrls = [];
    for (const file of Array.from(files)) {
      const { file_url } = await apiClient.integrations.Core.UploadFile({ file });
      newUrls.push(file_url);
    }
    setPendingImages(prev => [...prev, ...newUrls]);
    setUploadingImg(false);
  };

  const handleCameraCapture = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingImg(true);
    const newUrls = [];
    for (const file of Array.from(files)) {
      const { file_url } = await apiClient.integrations.Core.UploadFile({ file });
      newUrls.push(file_url);
    }
    setPendingImages(prev => [...prev, ...newUrls]);
    setUploadingImg(false);
    const issueNum = form.issue_number || 'new';
    for (const url of newUrls) {
      apiClient.entities.Document.create({
        title: `Photo - ${issueNum} - ${new Date().toLocaleString()}`,
        document_type: 'issue_photo',
        file_url: url,
        file_name: `issue_${issueNum}_${Date.now()}.jpg`,
        linked_issue_number: issueNum,
        status: 'active',
        department: 'production',
        tags: ['issue_photo', issueNum],
      }).catch(() => {});
    }
  };

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const partsOk = (form.total_parts !== '' && form.parts_nok !== '')
    ? Math.max(0, Number(form.total_parts) - Number(form.parts_nok))
    : undefined;

  const buildPayload = (extra = {}) => ({
    ...form,
    image_urls: pendingImages,
    total_parts: form.total_parts !== '' ? Number(form.total_parts) : undefined,
    parts_to_analyze: form.parts_to_analyze !== '' ? Number(form.parts_to_analyze) : undefined,
    parts_nok: form.parts_nok !== '' ? Number(form.parts_nok) : undefined,
    ...(partsOk !== undefined ? { parts_ok: partsOk } : {}),
    ...(batchNumber.trim() ? { batch_number: batchNumber } : {}),
    downtime_start: downtimeActive && downtimeStart ? downtimeStart : null,
    downtime_end: downtimeActive && downtimeEnd ? downtimeEnd : null,
    ...extra,
  });

  const handleSubmit = async (statusOverride) => {
    setSubmitted(true);
    if (!valid) return;
    setSaving(true);
    if (isEdit) {
      const payload = buildPayload(statusOverride ? { status: statusOverride } : {});
      await apiClient.entities.ProductionIssue.update(issue.id, payload);
      onSaved(payload);
    } else {
      const payload = buildPayload({ status: 'new' });
      const optimistic = { ...payload, id: `temp-${Date.now()}` };
      onSaved(optimistic);
      const created = await apiClient.entities.ProductionIssue.create(payload);
      onSaved(created);
    }
    setSaving(false);
  };

  const handleStartRcca = async () => {
    setSubmitted(true);
    if (!valid) return;
    setSaving(true);
    const payload = buildPayload({ status: 'rcca' });
    if (isEdit) {
      await apiClient.entities.ProductionIssue.update(issue.id, payload);
      onSaved(payload);
    } else {
      const created = await apiClient.entities.ProductionIssue.create(payload);
      onSaved(created);
    }
    setSaving(false);
    setShowRcca(true);
  };

  const handleStatusAction = async (status) => {
    setSubmitted(true);
    if (!valid) return;
    setSaving(true);
    const payload = buildPayload({ status, ...(status === 'closed' ? { closed_date: new Date().toISOString().split('T')[0] } : {}) });
    if (isEdit) {
      await apiClient.entities.ProductionIssue.update(issue.id, payload);
      onSaved(payload);
    } else {
      const created = await apiClient.entities.ProductionIssue.create(payload);
      onSaved(created);
    }
    setSaving(false);
  };

  const handleDeleteIssue = async () => {
    setDeleting(true);
    await apiClient.entities.ProductionIssue.delete(issue.id);
    setDeleting(false);
    setConfirmDelete(false);
    onClose();
    onDeleted && onDeleted(issue.id);
  };

  // Only defect_description is mandatory
  const valid = form.defect_description?.trim();

  // Don't render the dialog content until options are loaded to prevent Radix Select crashes
  const optionsReady = defectTypeOptions.length > 0 && issueTypeOptions.length > 0 && processStepOptions.length > 0;

  const formBody = !optionsReady ? (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
    </div>
  ) : (
    <>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base sm:text-lg font-semibold">{isEdit ? 'Edit Issue' : 'New Production Issue'}</h2>
        {isEdit && isAdmin && (
          <Button type="button" size="sm" variant="destructive" onClick={() => setConfirmDelete(true)} className="gap-1.5 text-xs h-8">
            <Trash2 className="w-3.5 h-3.5" /> Delete Issue
          </Button>
        )}
      </div>

      <div className="space-y-2 py-1 text-foreground">

            {/* Row 1: Issue Number | Reported Date | Batch # */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs font-medium">Issue Number</Label>
                <Input value={form.issue_number} onChange={e => set('issue_number', e.target.value)} className="mt-1 text-xs sm:text-sm h-8 sm:h-9" />
              </div>
              <div>
                <Label className="text-xs font-medium">Reported Date</Label>
                <EuDateInput value={form.reported_date} onChange={e => set('reported_date', e.target.value)} className="mt-1 text-xs sm:text-sm h-8 sm:h-9" />
              </div>
              <div>
                <Label className="text-xs font-medium">Batch #</Label>
                <Input
                  value={batchNumber}
                  onChange={e => handleBatchNumberChange(e.target.value)}
                  placeholder="0000001"
                  className="mt-1 text-xs sm:text-sm font-mono h-8 sm:h-9"
                  maxLength={7}
                />
              </div>
            </div>

            {/* Row 2: Part Number / Masina defecta | [Piese/Masini] | Alias / Serial # */}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className={`text-xs font-medium ${selectMode === 'masini' ? 'text-blue-600' : ''}`}>{selectMode === 'piese' ? 'Part Number' : 'Defective Machine'}</Label>
                <PartNumberCombobox
                  value={form.part_number || ''}
                  onChange={handlePartNumberChange}
                  partNumberData={selectMode === 'piese' ? partNumberData : masinaData}
                  placeholder={selectMode === 'piese' ? 'Select or type part...' : 'Select or type machine...'}
                  className="mt-1"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectMode(m => m === 'piese' ? 'masini' : 'piese');
                  setForm(p => ({ ...p, part_number: '', operation: '' }));
                }}
                title="Toggle Parts / Machines"
                className="flex flex-col items-center justify-center gap-0.5 px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 flex-shrink-0 leading-none hover:bg-blue-100 transition-colors"
              >
                <span className="text-[15px] font-bold text-slate-800 leading-none">Parts</span>
                <span className="flex flex-col items-center text-blue-500 leading-none text-[6px] gap-0">
                  <span className="leading-none">→</span>
                  <span className="leading-none">←</span>
                </span>
                <span className="text-[15px] font-bold text-blue-600 leading-none">Machines</span>
              </button>
              <div className="flex-1">
                <Label className={`text-xs font-medium ${selectMode === 'masini' ? 'text-blue-600' : ''}`}>{selectMode === 'piese' ? 'Alias' : 'Serial #'}</Label>
                <Input
                  value={form.operation || ''}
                  onChange={e => set('operation', e.target.value)}
                  placeholder="Auto-filled"
                  className="mt-1 text-xs sm:text-sm bg-muted h-8 sm:h-9"
                />
              </div>
            </div>

            {/* Row 3: Defect Description + Downtime */}
            <div className="flex gap-2 items-stretch">
              <div className="flex-1 flex flex-col">
                <Label className={`text-xs font-medium ${submitted && !form.defect_description?.trim() ? 'text-red-600' : ''}`}>
                  Defect Description <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  value={form.defect_description}
                  onChange={e => set('defect_description', e.target.value)}
                  placeholder="Describe the defect / issue..."
                  className={`mt-1 text-xs sm:text-sm flex-1 resize-none ${submitted && !form.defect_description?.trim() ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                />
                {submitted && !form.defect_description?.trim() && (
                  <p className="text-xs text-red-600 mt-0.5">Required</p>
                )}
              </div>
              <div className="flex-shrink-0 flex flex-col items-end gap-1.5 pt-5">
                <button
                  type="button"
                  onClick={() => {
                    const activating = !downtimeActive;
                    setDowntimeActive(activating);
                    setDowntimeEmailError('');
                    if (activating) {
                      const issueRef = form.issue_number || (issue?.id ? `#${issue.id.slice(-6)}` : 'New Issue');
                      apiClient.functions.invoke('downtimeAlert', {
                        issueRef,
                        description: form.defect_description?.trim() || '(no description)',
                        reportedBy: form.reported_by || 'Unknown',
                        reportedDate: form.reported_date || new Date().toISOString().split('T')[0],
                      }).catch((error) => setDowntimeEmailError(`Alert email failed: ${error.message}`));
                    }
                  }}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-semibold border transition-all whitespace-nowrap ${
                    downtimeActive
                      ? 'bg-red-500 text-white border-red-500'
                      : 'bg-background text-foreground border-border hover:bg-muted'
                  }`}
                >
                  ⏱ Downtime
                </button>
                {downtimeEmailError && <p role="alert" className="max-w-40 text-right text-[10px] text-red-600">{downtimeEmailError}</p>}
                {downtimeActive && (
                  <div className="flex flex-col gap-2 mt-1 w-32">
                    <div className="flex flex-col gap-0.5">
                      <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Start</Label>
                      <EuDateInput
                        value={downtimeStart ? downtimeStart.slice(0, 10) : ''}
                        onChange={e => {
                          const date = e.target.value;
                          const hour = downtimeStart ? downtimeStart.slice(11, 13) : '00';
                          setDowntimeStart(date ? `${date}T${hour}:00` : '');
                        }}
                        className="text-xs h-7 w-32"
                      />
                      <select
                        value={downtimeStart ? downtimeStart.slice(11, 13) : '00'}
                        onChange={e => {
                          const date = downtimeStart ? downtimeStart.slice(0, 10) : '';
                          setDowntimeStart(date ? `${date}T${e.target.value}:00` : '');
                        }}
                        className="text-xs h-7 w-32 border border-input rounded-md px-2 bg-background"
                      >
                        {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => (
                          <option key={h} value={h}>{h}:00</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">End</Label>
                      <EuDateInput
                        value={downtimeEnd ? downtimeEnd.slice(0, 10) : ''}
                        onChange={e => {
                          const date = e.target.value;
                          const hour = downtimeEnd ? downtimeEnd.slice(11, 13) : '00';
                          setDowntimeEnd(date ? `${date}T${hour}:00` : '');
                        }}
                        className="text-xs h-7 w-32"
                      />
                      <select
                        value={downtimeEnd ? downtimeEnd.slice(11, 13) : '00'}
                        onChange={e => {
                          const date = downtimeEnd ? downtimeEnd.slice(0, 10) : '';
                          setDowntimeEnd(date ? `${date}T${e.target.value}:00` : '');
                        }}
                        className="text-xs h-7 w-32 border border-input rounded-md px-2 bg-background"
                      >
                        {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => (
                          <option key={h} value={h}>{h}:00</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Row 4: Total Parts | Parts to Analyze (yellow) | Parts NOK (red) | Parts OK (green) */}
            <div className="grid grid-cols-4 gap-2">
              <div>
                <Label className="text-xs font-medium">Total Parts</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.total_parts}
                  onChange={e => set('total_parts', e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="mt-1 text-xs sm:text-sm h-8 sm:h-9"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-yellow-600">Parts to Analyze</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.parts_to_analyze}
                  onChange={e => set('parts_to_analyze', e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="mt-1 text-xs sm:text-sm h-8 sm:h-9 border-yellow-200 focus-visible:ring-yellow-400 bg-yellow-50 text-yellow-700 placeholder:text-yellow-300"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-red-600">Parts NOK</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.parts_nok}
                  onChange={e => set('parts_nok', e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="mt-1 text-xs sm:text-sm h-8 sm:h-9 border-red-200 focus-visible:ring-red-400 bg-red-50 text-red-700 placeholder:text-red-300"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-green-700">Parts OK</Label>
                <Input
                  type="number"
                  value={partsOk !== undefined ? partsOk : ''}
                  readOnly
                  placeholder="Auto"
                  className="mt-1 text-xs sm:text-sm h-8 sm:h-9 border-green-200 bg-green-50 text-green-700 placeholder:text-green-300"
                />
              </div>
            </div>

            {/* Row 5 & 5B: Defect Type | Predefined Cause | Process Step (Labels + Selects) */}
             <div className="space-y-0.5">
               <div className="grid grid-cols-3 gap-2">
                 <div>
                   <Label className="text-xs font-medium">Defect Type</Label>
                 </div>
                 <div>
                   <Label className="text-xs font-medium">Predefined Cause</Label>
                 </div>
                 <div>
                   <Label className="text-xs font-medium">Process Step</Label>
                 </div>
               </div>
               <div className="grid grid-cols-3 gap-2">
                 <div className="flex gap-1">
                   <MobileSelect
                     value={form.title}
                     onValueChange={v => set('title', v)}
                     placeholder="Select defect"
                     triggerClassName="text-xs sm:text-sm h-8 sm:h-9 flex-1"
                     items={defectTypeOptions}
                   />
                   {(form.title || '').toLowerCase().includes('vizual') && (
                     <AiInspectionButton
                       issueNumber={form.issue_number}
                       issueId={issue?.id}
                       partNumber={form.part_number}
                       partAlias={form.operation}
                       batchNumber={batchNumber}
                       imageUrls={pendingImages}
                       currentUser={currentUser}
                     />
                   )}
                 </div>
                 <div>
                   <MobileSelect
                     value={form.issue_type}
                     onValueChange={v => set('issue_type', v)}
                     placeholder="Select cause"
                     triggerClassName="text-xs sm:text-sm h-8 sm:h-9"
                     items={issueTypeOptions}
                   />
                 </div>
                 <div>
                   <MobileSelect
                     value={form.machine || ''}
                     onValueChange={v => set('machine', v)}
                     placeholder="Select step"
                     triggerClassName="text-xs sm:text-sm h-8 sm:h-9"
                     items={processStepOptions}
                   />
                 </div>
               </div>
             </div>

            {/* Row 6 & 6B: Photos | Severity | Reported By (Labels + Inputs) */}
             <div className="space-y-0.5">
               <div className="grid grid-cols-3 gap-2">
                 <div>
                   <Label className="text-xs font-medium">Photos</Label>
                 </div>
                 <div>
                   <Label className="text-xs font-medium">Severity</Label>
                 </div>
                 <div>
                   <Label className="text-xs font-medium">Reported By</Label>
                 </div>
               </div>
               <div className="grid grid-cols-3 gap-2 items-start">
              <div>
                <div className="flex gap-1.5 flex-wrap">
                  <label className={`inline-flex items-center gap-1 text-xs h-8 px-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer font-medium transition-colors ${uploadingImg ? 'opacity-50 pointer-events-none' : ''}`}>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleImageFiles(e.target.files)} />
                    <ImagePlus className="w-3 h-3" /> Upload
                  </label>
                  <label className={`inline-flex items-center gap-1 text-xs h-8 px-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer font-medium transition-colors ${uploadingImg ? 'opacity-50 pointer-events-none' : ''}`}>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCameraCapture} />
                    <Camera className="w-3 h-3" /> Camera
                  </label>
                  {uploadingImg && <Loader2 className="w-4 h-4 animate-spin text-blue-500 self-center" />}
                </div>
                {pendingImages.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {pendingImages.map((url, i) => (
                      <div key={i} className="relative w-12 h-12 rounded-md overflow-hidden border border-border bg-muted">
                        <img
                          src={url}
                          alt=""
                          className="w-full h-full object-cover cursor-zoom-in"
                          onDoubleClick={() => setLightboxUrl(url)}
                        />
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveIdx(i)}
                          className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5"
                        >
                          <X className="w-2 h-2" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <MobileSelect
                  value={form.severity}
                  onValueChange={v => set('severity', v)}
                  placeholder="Severity"
                  triggerClassName="text-xs sm:text-sm h-8 sm:h-9"
                  items={[
                    { value: 'critical', label: 'Critical' },
                    { value: 'high', label: 'High' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'low', label: 'Low' },
                  ]}
                />
              </div>
              <div>
                <Input value={form.reported_by} onChange={e => set('reported_by', e.target.value)} placeholder="Name" className="text-xs sm:text-sm h-8 sm:h-9" />
              </div>
              </div>
              </div>

          </div>

      <div className="mt-4 flex gap-2 flex-wrap sm:flex-nowrap justify-between">
        <div className="flex gap-2 flex-1 justify-start flex-wrap">
          <Button type="button" onClick={handleStartRcca} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white h-9 text-xs gap-1.5">
            <Play className="w-3.5 h-3.5" /> Start RCCA
          </Button>
          <Button type="button" onClick={() => handleStatusAction('on_hold')} disabled={saving} className="bg-yellow-500 hover:bg-yellow-600 text-white h-9 text-xs gap-1.5">
            <PauseCircle className="w-3.5 h-3.5" /> On Hold
          </Button>
          <Button type="button" onClick={() => handleStatusAction('closed')} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white h-9 text-xs gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Closed
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="h-9">Cancel</Button>
          <Button onClick={() => handleSubmit()} disabled={saving} className="bg-blue-600 hover:bg-blue-700 h-9">
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Issue'}
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {inline ? (
        <div className="bg-card rounded-xl border border-border shadow-sm p-4 sm:p-6">
          {formBody}
        </div>
      ) : (
        <Dialog open={open} onOpenChange={onClose}>
          <DialogContent className="w-full max-w-xl sm:max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
            {formBody}
          </DialogContent>
        </Dialog>
      )}

      {/* Lightbox — double-click to enlarge photo */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="Full size"
            className="max-w-full max-h-full rounded-lg shadow-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/80"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Confirm remove photo */}
      <AlertDialog open={confirmRemoveIdx !== null} onOpenChange={() => setConfirmRemoveIdx(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Photo</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this photo? This change will take effect when you save the issue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                setPendingImages(prev => prev.filter((_, idx) => idx !== confirmRemoveIdx));
                setConfirmRemoveIdx(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm delete issue */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Issue</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete issue <strong>{issue?.issue_number || issue?.id}</strong>?
              This action cannot be undone and will remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDeleteIssue}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}