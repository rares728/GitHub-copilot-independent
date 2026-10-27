import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import MobileSelect from '@/components/ui/MobileSelect';
import { CheckCircle2, Lock, Pencil, ShieldAlert, Search, Wrench, CheckSquare, Plus, Trash2 } from 'lucide-react';
import EuDateInput from '@/components/ui/EuDateInput';
import { fetchAssignDpt } from './picklists';
import { useUserOptions } from '@/hooks/useUserOptions';
import { useAuth } from '@/lib/AuthContext';

const STAGE_ORDER = ['containment', 'root_cause_analysis', 'corrective_action', 'verification', 'closed'];

// Map top-level status to internal RCCA sub-stage for display
const getRccaSubStage = (status) => {
  if (STAGE_ORDER.includes(status)) return status;
  if (status === 'rcca') return 'containment'; // default entry point
  return null;
};

// ─── Containment Stage ───────────────────────────────────────────────────────
function ContainmentStage({ issue, isLocked, isActive, isCompleted, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [formData, setFormData] = useState({
    containment_necessary: issue.containment_necessary || '',
    wip_qty: issue.wip_qty ?? '',
    stock_qty: issue.stock_qty ?? '',
    transit_qty: issue.transit_qty ?? '',
  });

  useEffect(() => {
    if (!editing) {
      setFormData({
        containment_necessary: issue.containment_necessary || '',
        wip_qty: issue.wip_qty ?? '',
        stock_qty: issue.stock_qty ?? '',
        transit_qty: issue.transit_qty ?? '',
      });
    }
  }, [issue.updated_date, issue.id]);

  const set = (k, v) => setFormData(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    savingRef.current = true;
    setSaving(true);
    const data = { ...formData };
    data.wip_qty = data.wip_qty !== '' ? Number(data.wip_qty) : undefined;
    data.stock_qty = data.stock_qty !== '' ? Number(data.stock_qty) : undefined;
    data.transit_qty = data.transit_qty !== '' ? Number(data.transit_qty) : undefined;
    try {
      await onUpdate(data);
      setEditing(false);
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  };

  const showQty = formData.containment_necessary === 'yes';

  const containmentLabel = { yes: 'Yes', no: 'No', na: 'N/A' }[issue.containment_necessary] || '—';

  return (
    <Card className={`transition-all ${isLocked ? 'opacity-40' : ''} ${isActive ? 'border-blue-300 shadow-sm' : ''}`}>
      <CardHeader className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isCompleted ? 'bg-green-100' : isActive ? 'bg-blue-100' : 'bg-slate-100'}`}>
              {isCompleted ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : isLocked ? <Lock className="w-4 h-4 text-slate-400" /> : <ShieldAlert className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />}
            </div>
            <CardTitle className={`text-sm font-semibold ${isActive ? 'text-blue-700' : 'text-slate-700'}`}>Containment</CardTitle>
          </div>
          {!isLocked && !editing && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="h-7 px-2 text-xs text-slate-500">
              <Pencil className="w-3 h-3 mr-1" /> Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {editing ? (
          <div className="space-y-3">
            {/* Containment necessary */}
            <div>
              <Label className="text-xs font-medium text-slate-500">Containment Necessary?</Label>
              <div className="flex gap-2 mt-1">
                {['yes', 'no', 'na'].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => set('containment_necessary', v)}
                    className={`flex-1 py-1.5 rounded-md text-xs font-semibold border transition-all ${
                      formData.containment_necessary === v
                        ? v === 'yes' ? 'bg-red-500 text-white border-red-500' : 'bg-slate-700 text-white border-slate-700'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {v === 'na' ? 'N/A' : v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Qty row — only when Yes */}
            {showQty && (
              <div className="grid grid-cols-3 gap-2">
                {[['wip_qty', 'WIP Q-ty'], ['stock_qty', 'Stock Q-ty'], ['transit_qty', 'Transit Q-ty']].map(([k, lbl]) => (
                  <div key={k}>
                    <Label className="text-xs font-medium text-slate-500">{lbl}</Label>
                    <Input type="number" min="0" value={formData[k]} onChange={e => set(k, e.target.value)} placeholder="0" className="mt-1 text-sm h-8" />
                  </div>
                ))}
              </div>
            )}



            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="text-xs h-8 flex-1">Cancel</Button>
              <Button size="sm" variant="outline" onClick={() => handleSave()} disabled={saving} className="text-xs h-8 flex-1">Save</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <span className="text-slate-400 text-xs min-w-32 pt-0.5 flex-shrink-0">Containment Necessary:</span>
              <span className={`text-xs font-semibold ${issue.containment_necessary === 'yes' ? 'text-red-600' : 'text-slate-700'}`}>{containmentLabel}</span>
            </div>
            {issue.containment_necessary === 'yes' && (
              <div className="flex gap-4 text-xs text-slate-600 ml-0">
                <span>WIP: <b>{issue.wip_qty ?? '—'}</b></span>
                <span>Stock: <b>{issue.stock_qty ?? '—'}</b></span>
                <span>Transit: <b>{issue.transit_qty ?? '—'}</b></span>
              </div>
            )}

          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Root Cause Stage ─────────────────────────────────────────────────────────
function RootCauseStage({ issue, isLocked, isActive, isCompleted, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [formData, setFormData] = useState({
    root_cause_category: issue.root_cause_category || '',
    why_1: issue.why_1 || '',
    why_2: issue.why_2 || '',
    why_3: issue.why_3 || '',
    why_4: issue.why_4 || '',
    why_5: issue.why_5 || '',
    root_cause: issue.root_cause || '',
  });

  useEffect(() => {
    if (!editing) {
      setFormData({
        root_cause_category: issue.root_cause_category || '',
        why_1: issue.why_1 || '',
        why_2: issue.why_2 || '',
        why_3: issue.why_3 || '',
        why_4: issue.why_4 || '',
        why_5: issue.why_5 || '',
        root_cause: issue.root_cause || '',
      });
    }
  }, [issue.updated_date, issue.id]);

  const set = (k, v) => setFormData(p => ({ ...p, [k]: v }));

  // Auto-copy last non-empty Why to root_cause
  const handleWhyChange = (k, v) => {
    const updated = { ...formData, [k]: v };
    const whys = ['why_1', 'why_2', 'why_3', 'why_4', 'why_5'];
    const lastFilled = [...whys].reverse().find(w => (w === k ? v : updated[w])?.trim());
    const lastVal = lastFilled ? (lastFilled === k ? v : updated[lastFilled]) : '';
    setFormData({ ...updated, root_cause: lastVal });
  };

  const handleSave = async () => {
    savingRef.current = true;
    setSaving(true);
    const data = { ...formData };
    await onUpdate(data);
    setEditing(false);
    setSaving(false);
    savingRef.current = false;
  };

  const categoryLabel = {
    man: 'Man', machine: 'Machine', material: 'Material',
    method: 'Method', measurement: 'Measurement', environment: 'Environment'
  }[issue.root_cause_category] || '—';

  return (
    <Card className={`transition-all ${isLocked ? 'opacity-40' : ''} ${isActive ? 'border-blue-300 shadow-sm' : ''}`}>
      <CardHeader className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isCompleted ? 'bg-green-100' : isActive ? 'bg-blue-100' : 'bg-slate-100'}`}>
              {isCompleted ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : isLocked ? <Lock className="w-4 h-4 text-slate-400" /> : <Search className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />}
            </div>
            <CardTitle className={`text-sm font-semibold ${isActive ? 'text-blue-700' : 'text-slate-700'}`}>Root Cause</CardTitle>
          </div>
          {!isLocked && !editing && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="h-7 px-2 text-xs text-slate-500">
              <Pencil className="w-3 h-3 mr-1" /> Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {editing ? (
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-medium text-slate-500">Root Cause Category (6M)</Label>
              <MobileSelect
                value={formData.root_cause_category}
                onValueChange={v => set('root_cause_category', v)}
                placeholder="Select category"
                triggerClassName="mt-1 text-sm h-8"
                items={[
                  { value: 'man', label: 'Man' },
                  { value: 'machine', label: 'Machine' },
                  { value: 'material', label: 'Material' },
                  { value: 'method', label: 'Method' },
                  { value: 'measurement', label: 'Measurement' },
                  { value: 'environment', label: 'Environment' },
                ]}
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-500">5 Why? Analysis</Label>
              {['why_1','why_2','why_3','why_4','why_5'].map((k, i) => (
                <div key={k} className="mt-1.5">
                  <Label className="text-xs text-slate-400">Why {i + 1}?</Label>
                  <Textarea
                    value={formData[k]}
                    onChange={e => handleWhyChange(k, e.target.value)}
                    rows={2}
                    className="mt-0.5 text-sm"
                    placeholder={`Why ${i + 1}...`}
                  />
                </div>
              ))}
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-500">Root Cause Description</Label>
              <Textarea
                value={formData.root_cause}
                onChange={e => set('root_cause', e.target.value)}
                rows={3}
                className="mt-1 text-sm"
                placeholder="Auto-filled from last Why, or enter manually..."
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="text-xs h-8 flex-1">Cancel</Button>
              <Button size="sm" variant="outline" onClick={() => handleSave()} disabled={saving} className="text-xs h-8 flex-1">Save</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <span className="text-slate-400 text-xs min-w-32 pt-0.5 flex-shrink-0">Category (6M):</span>
              <span className="text-xs text-slate-700">{categoryLabel}</span>
            </div>
            {['why_1','why_2','why_3','why_4','why_5'].map((k, i) => issue[k] ? (
              <div key={k} className="flex gap-2">
                <span className="text-slate-400 text-xs min-w-32 pt-0.5 flex-shrink-0">Why {i + 1}:</span>
                <span className="text-xs text-slate-700">{issue[k]}</span>
              </div>
            ) : null)}
            <div className="flex gap-2">
              <span className="text-slate-400 text-xs min-w-32 pt-0.5 flex-shrink-0">Root Cause:</span>
              <span className="text-xs text-slate-700">{issue.root_cause || '—'}</span>
            </div>

          </div>
        )}
      </CardContent>
    </Card>
  );
}

const emptyAction = () => ({ description: '', owner_feedback: '', owner: '', department: '', due_date: '', feedback_date: '', completed_date: '' });

// ─── Corrective Actions Stage ─────────────────────────────────────────────────
function CorrectiveActionStage({ issue, isLocked, isActive, isCompleted, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const userOptions = useUserOptions();
  const { user } = useAuth();

  // Resolve current user's display name using the same priority as Settings & getUsers:
  // display_name (editable in Settings) > full_name > email
  // userOptions entries have { value: display_name||full_name||email, email }
  const currentUserDisplayName = userOptions.find(u => u.email === user?.email)?.value || user?.full_name || user?.email;

  const isAdmin = user?.role === 'admin';

  const canEditFeedback = (action) => {
    if (!user) return false;
    if (isAdmin) return true;
    if (!action.owner) return false;
    return action.owner === currentUserDisplayName;
  };

  // Check if current user is an owner of ANY action (to decide if they can open Edit mode)
  const isAnyActionOwner = (actionsArr) => {
    if (isAdmin) return true;
    return actionsArr.some(a => a.owner === currentUserDisplayName);
  };

  useEffect(() => {
    fetchAssignDpt().then(setDepartmentOptions);
  }, []);

  const parseActions = () => {
    try {
      const parsed = JSON.parse(issue.corrective_actions_json || '[]');
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
    // Migrate legacy single-action fields
    if (issue.corrective_action || issue.corrective_action_owner) {
      return [{
        description: issue.corrective_action || '',
        owner: issue.corrective_action_owner || '',
        due_date: issue.corrective_action_due_date || '',
        completed_date: issue.corrective_action_completed_date || '',
      }];
    }
    return [emptyAction()];
  };

  const [actions, setActions] = useState(parseActions);
  const [preventiveAction, setPreventiveAction] = useState(issue.preventive_action || '');

  useEffect(() => {
    if (!editing) {
      setActions(parseActions());
      setPreventiveAction(issue.preventive_action || '');
    }
  }, [issue.updated_date, issue.id]);

  const setAction = (idx, k, v) => setActions(prev => prev.map((a, i) => i === idx ? { ...a, [k]: v } : a));
  const addAction = () => setActions(prev => [...prev, emptyAction()]);
  const removeAction = (idx) => setActions(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    savingRef.current = true;
    setSaving(true);
    // Non-admin owners can only save feedback fields via the dedicated backend function
    if (!isAdmin && isAnyActionOwner(actions)) {
      const res = await apiClient.functions.invoke('saveOwnerFeedback', {
        issue_id: issue.id,
        actions: actions.map(a => ({ owner_feedback: a.owner_feedback, feedback_date: a.feedback_date })),
      });
      if (res.data?.corrective_actions_json) {
        await onUpdate({ corrective_actions_json: res.data.corrective_actions_json, feedback_pending: true });
      }
      setEditing(false);
      setSaving(false);
      savingRef.current = false;
      return;
    }
    const first = actions[0] || emptyAction();
    const hasFeedback = actions.some(a => a.owner_feedback && a.owner_feedback.trim());
    const data = {
      corrective_actions_json: JSON.stringify(actions),
      corrective_action: first.description,
      corrective_action_owner: first.owner,
      corrective_action_due_date: first.due_date,
      corrective_action_completed_date: first.completed_date,
      preventive_action: preventiveAction,
    };
    if (hasFeedback) data.feedback_pending = true;
    await onUpdate(data);
    setEditing(false);
    setSaving(false);
    savingRef.current = false;
  };

  return (
    <Card className={`transition-all ${isLocked ? 'opacity-40' : ''} ${isActive ? 'border-blue-300 shadow-sm' : ''}`}>
      <CardHeader className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isCompleted ? 'bg-green-100' : isActive ? 'bg-blue-100' : 'bg-slate-100'}`}>
              {isCompleted ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : isLocked ? <Lock className="w-4 h-4 text-slate-400" /> : <Wrench className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />}
            </div>
            <CardTitle className={`text-sm font-semibold ${isActive ? 'text-blue-700' : 'text-slate-700'}`}>Corrective Actions</CardTitle>
          </div>
          {!editing && !isLocked && (isAdmin || isAnyActionOwner(actions)) && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="h-7 px-2 text-xs text-slate-500">
              <Pencil className="w-3 h-3 mr-1" /> {isAdmin ? 'Edit' : 'Add Feedback'}
            </Button>
          )}
          {!editing && isLocked && isAdmin && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="h-7 px-2 text-xs text-slate-400">
              <Pencil className="w-3 h-3 mr-1" /> Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {editing ? (
          <div className="space-y-4">
            {actions.map((action, idx) => (
              <div key={idx} className="space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">Action {idx + 1}</span>
                  {actions.length > 1 && (
                    <Button size="sm" variant="ghost" onClick={() => removeAction(idx)} className="h-6 w-6 p-0 text-red-400 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                {isAdmin && (
                  <div>
                    <Label className="text-xs font-medium text-slate-500">Corrective Action</Label>
                    <Textarea value={action.description} onChange={e => setAction(idx, 'description', e.target.value)} rows={2} className="mt-1 text-sm" placeholder="Describe the corrective action..." />
                  </div>
                )}
                {!isAdmin && (
                  <div className="text-xs text-slate-500 bg-slate-100 rounded p-2">
                    <span className="font-medium text-slate-600">Action:</span> {action.description || '—'}
                  </div>
                )}
                <div>
                  <Label className="text-xs font-medium text-slate-500">Owner Feedback</Label>
                  <Textarea
                    value={action.owner_feedback || ''}
                    onChange={e => {
                      const val = e.target.value;
                      const today = new Date().toISOString().split('T')[0];
                      setAction(idx, 'owner_feedback', val);
                      // Auto-set feedback_date to today when feedback is first written
                      if (val && !action.feedback_date) {
                        setAction(idx, 'feedback_date', today);
                      }
                    }}
                    rows={2}
                    className="mt-1 text-sm"
                    placeholder="Owner feedback..."
                    disabled={!canEditFeedback(action)}
                  />
                  {!canEditFeedback(action) && (
                    <p className="text-xs text-slate-400 mt-0.5">Only the action owner or an admin can edit this field.</p>
                  )}
                </div>
                {isAdmin ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs font-medium text-slate-500">Action Owner</Label>
                        <MobileSelect
                          value={action.owner || ''}
                          onValueChange={v => setAction(idx, 'owner', v)}
                          placeholder="Select owner"
                          triggerClassName="mt-1 text-sm h-8"
                          items={userOptions}
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-slate-500">Department</Label>
                        <MobileSelect
                          value={action.department || ''}
                          onValueChange={v => setAction(idx, 'department', v)}
                          placeholder="Select dept"
                          triggerClassName="mt-1 text-sm h-8"
                          items={departmentOptions}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs font-medium text-slate-500">Due Date</Label>
                        <EuDateInput value={action.due_date} onChange={e => setAction(idx, 'due_date', e.target.value)} className="mt-1 text-sm h-8" />
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-slate-500">Feedback Date</Label>
                        <EuDateInput value={action.feedback_date || ''} onChange={e => setAction(idx, 'feedback_date', e.target.value)} className="mt-1 text-sm h-8" />
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-slate-500">Completion Date</Label>
                        <EuDateInput value={action.completed_date} onChange={e => setAction(idx, 'completed_date', e.target.value)} className="mt-1 text-sm h-8" />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-3 gap-2 text-xs text-slate-500">
                    <span>Owner: <b className="text-slate-700">{action.owner || '—'}</b></span>
                    <span>Due: <b className="text-slate-700">{action.due_date || '—'}</b></span>
                    <div>
                      <Label className="text-xs font-medium text-slate-500">Feedback Date</Label>
                      <EuDateInput value={action.feedback_date || ''} onChange={e => setAction(idx, 'feedback_date', e.target.value)} className="mt-1 text-sm h-8" />
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isAdmin && (
              <Button size="sm" variant="outline" onClick={addAction} className="w-full text-xs h-8 border-dashed border-slate-300 text-slate-500 hover:text-slate-700">
                <Plus className="w-3 h-3 mr-1" /> Add Corrective Action
              </Button>
            )}

            {isAdmin && (
              <div>
                <Label className="text-xs font-medium text-slate-500">Preventive Action</Label>
                <Textarea value={preventiveAction} onChange={e => setPreventiveAction(e.target.value)} rows={3} className="mt-1 text-sm" />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="text-xs h-8 flex-1">Cancel</Button>
              <Button size="sm" variant="outline" onClick={() => handleSave()} disabled={saving} className="text-xs h-8 flex-1">{isAdmin ? 'Save' : 'Save Feedback'}</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {parseActions().map((action, idx, arr) => (
              <div key={idx} className={`space-y-1 ${arr.length > 1 ? 'border border-slate-100 rounded-lg p-2.5 bg-slate-50' : ''}`}>
                {arr.length > 1 && <span className="text-xs font-semibold text-slate-500">Action {idx + 1}</span>}
                <div className="flex gap-2">
                  <span className="text-slate-400 text-xs min-w-32 pt-0.5 flex-shrink-0">Corrective Action:</span>
                  <span className="text-xs text-slate-700">{action.description || '—'}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-slate-400 text-xs min-w-32 pt-0.5 flex-shrink-0">Owner Feedback:</span>
                  <span className="text-xs text-slate-700">{action.owner_feedback || '—'}</span>
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                  <span>Owner: <b className="text-slate-700">{action.owner || '—'}</b></span>
                  {action.department && <span>Dept: <b className="text-slate-700">{action.department}</b></span>}
                  <span>Due: <b className="text-slate-700">{action.due_date || '—'}</b></span>
                  <span>Feedback: <b className="text-slate-700">{action.feedback_date || '—'}</b></span>
                  <span>Completed: <b className="text-slate-700">{action.completed_date || '—'}</b></span>
                </div>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <span className="text-slate-400 text-xs min-w-32 pt-0.5 flex-shrink-0">Preventive Action:</span>
              <span className="text-xs text-slate-700">{issue.preventive_action || '—'}</span>
            </div>

          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Verification & Closure Stage ─────────────────────────────────────────────
function VerificationStage({ issue, isLocked, isActive, isCompleted, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const { user } = useAuth();
  const userOptions = useUserOptions();
  const currentUserDisplayName = userOptions.find(u => u.email === user?.email)?.value || user?.full_name || user?.email || '';

  const [formData, setFormData] = useState({
    verification_notes: issue.verification_notes || '',
    verified_by: issue.verified_by || '',
    verified_date: issue.verified_date || '',
    ncr_number: issue.ncr_number || '',
  });

  useEffect(() => {
    if (!editing) {
      setFormData({
        verification_notes: issue.verification_notes || '',
        verified_by: issue.verified_by || '',
        verified_date: issue.verified_date || '',
        ncr_number: issue.ncr_number || '',
      });
    }
  }, [issue.updated_date, issue.id]);

  const set = (k, v) => setFormData(p => ({ ...p, [k]: v }));

  const handleVerificationNotesChange = (val) => {
    const today = new Date().toISOString().split('T')[0];
    setFormData(p => ({
      ...p,
      verification_notes: val,
      verified_by: p.verified_by || currentUserDisplayName,
      verified_date: p.verified_date || today,
    }));
  };

  const handleSave = async () => {
    savingRef.current = true;
    setSaving(true);
    const data = { ...formData };
    await onUpdate(data);
    setEditing(false);
    setSaving(false);
    savingRef.current = false;
  };

  return (
    <Card className={`transition-all ${isLocked ? 'opacity-40' : ''} ${isActive ? 'border-blue-300 shadow-sm' : ''}`}>
      <CardHeader className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isCompleted ? 'bg-green-100' : isActive ? 'bg-blue-100' : 'bg-slate-100'}`}>
              {isCompleted ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : isLocked ? <Lock className="w-4 h-4 text-slate-400" /> : <CheckSquare className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />}
            </div>
            <CardTitle className={`text-sm font-semibold ${isActive ? 'text-blue-700' : 'text-slate-700'}`}>Verification & Closure</CardTitle>
          </div>
          {!editing && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className={`h-7 px-2 text-xs ${isLocked ? 'text-slate-400' : 'text-slate-500'}`}>
              <Pencil className="w-3 h-3 mr-1" /> Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {editing ? (
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-medium text-slate-500">Verification Notes</Label>
              <Textarea value={formData.verification_notes} onChange={e => handleVerificationNotesChange(e.target.value)} rows={3} className="mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-500">Verified By</Label>
              <Input value={formData.verified_by} onChange={e => set('verified_by', e.target.value)} className="mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-500">Verification Date</Label>
              <EuDateInput value={formData.verified_date} onChange={e => set('verified_date', e.target.value)} className="mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-500">NCR #</Label>
              <Input value={formData.ncr_number} onChange={e => set('ncr_number', e.target.value)} className="mt-1 text-sm" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="text-xs h-8 flex-1">Cancel</Button>
              <Button size="sm" variant="outline" onClick={() => handleSave()} disabled={saving} className="text-xs h-8 flex-1">Save</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {[
              { key: 'verification_notes', label: 'Verification Notes' },
              { key: 'verified_by', label: 'Verified By' },
              { key: 'verified_date', label: 'Verification Date' },
              { key: 'ncr_number', label: 'NCR #' },
            ].map(f => (
              <div key={f.key} className="flex gap-2">
                <span className="text-slate-400 text-xs min-w-32 pt-0.5 flex-shrink-0">{f.label}:</span>
                <span className="text-xs text-slate-700">{issue[f.key] || '—'}</span>
              </div>
            ))}

          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function IssueStages({ issue, onUpdate }) {
  const effectiveStatus = getRccaSubStage(issue.status) || 'containment';
  const currentIdx = STAGE_ORDER.indexOf(effectiveStatus);

  const getState = (key) => {
    const idx = STAGE_ORDER.indexOf(key);
    if (idx < currentIdx) return 'completed';
    if (idx === currentIdx) return 'active';
    return 'pending';
  };

  const props = (key) => ({
    issue,
    onUpdate,
    isLocked: false,
    isActive: getState(key) === 'active',
    isCompleted: getState(key) === 'completed',
  });

  return (
    <div className="space-y-3">
      <ContainmentStage {...props('containment')} />
      <RootCauseStage {...props('root_cause_analysis')} />
      <CorrectiveActionStage {...props('corrective_action')} />
      <VerificationStage {...props('verification')} />
    </div>
  );
}