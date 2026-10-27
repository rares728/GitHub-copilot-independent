import React, { useState, useEffect } from 'react';
import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, GripVertical, ToggleLeft, ToggleRight } from 'lucide-react';
import PicklistFileActions from './PicklistFileActions';

const CATEGORIES = [
  { value: 'document_type', label: 'Document Type' },
  { value: 'department', label: 'Department / Assigned Dept' },
  { value: 'DefectType_Picklist', label: 'Defect Type' },
  { value: 'IssueType_Picklist', label: 'Predefined Cause' },
  { value: 'ProcessStep_Picklist', label: 'Process Step' },
  { value: 'Part Number vs Alias_Picklist', label: 'Part Number vs Alias' },
  { value: 'Utilaj - Serial#_Picklist', label: 'Utilaj - Serial#' },
];

const TWO_FIELD_CONFIG = {
  'Part Number vs Alias_Picklist': { primary: 'Part Number', secondary: 'Alias (optional)', hasClient: true },
  'Utilaj - Serial#_Picklist': { primary: 'Utilaj', secondary: 'Serial# (optional)', hasClient: false },
};

const CLIENT_OPTIONS = ['HW', 'COL', 'PW', 'EVK', 'PK', 'AEC'];
const CLIENT_COLORS = {
  HW: 'bg-blue-100 text-blue-700',
  COL: 'bg-purple-100 text-purple-700',
  PW: 'bg-red-100 text-red-700',
  EVK: 'bg-green-100 text-green-700',
  PK: 'bg-orange-100 text-orange-700',
  AEC: 'bg-teal-100 text-teal-700',
};

const isTwoFieldCategory = (cat) => cat in TWO_FIELD_CONFIG;
const isThreeFieldCategory = (cat) => TWO_FIELD_CONFIG[cat]?.hasClient === true;

export default function PicklistManager() {
  const [options, setOptions] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('document_type');
  const [newLabel, setNewLabel] = useState('');
  const [newPartNumber, setNewPartNumber] = useState('');
  const [newClient, setNewClient] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingClientId, setEditingClientId] = useState(null);
  const [editingClientValue, setEditingClientValue] = useState('');

  const loadOptions = () => {
    setLoading(true);
    apiClient.entities.PicklistOption.list('-sort_order', 500).then(data => {
      setOptions(data);
      setLoading(false);
    });
  };

  useEffect(() => { loadOptions(); }, []);

  const filtered = options.filter(o => o.category === selectedCategory)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const cfg = TWO_FIELD_CONFIG[selectedCategory];
  const exportHeaders = isTwoFieldCategory(selectedCategory)
    ? [cfg.primary, cfg.secondary, ...(isThreeFieldCategory(selectedCategory) ? ['Client'] : [])]
    : ['Label', 'Value'];
  const exportRows = filtered.map(o => isTwoFieldCategory(selectedCategory)
    ? [o.value, o.label || '', ...(isThreeFieldCategory(selectedCategory) ? [o.client || ''] : [])]
    : [o.label, o.value]);

  const addOption = async () => {
    if (isTwoFieldCategory(selectedCategory)) {
      if (!newPartNumber.trim()) return;
      const maxOrder = filtered.length ? Math.max(...filtered.map(o => o.sort_order || 0)) : 0;
      const payload = {
        category: selectedCategory,
        label: newLabel.trim(),
        value: newPartNumber.trim(),
        sort_order: maxOrder + 1,
        is_active: true,
      };
      if (isThreeFieldCategory(selectedCategory)) {
        payload.client = newClient.trim() || null;
      }
      const created = await apiClient.entities.PicklistOption.create(payload);
      setOptions(prev => [...prev, created]);
      setNewPartNumber('');
      setNewLabel('');
      setNewClient('');
    } else {
      if (!newLabel.trim()) return;
      const value = newLabel.trim().toLowerCase().replace(/\s+/g, '_');
      const maxOrder = filtered.length ? Math.max(...filtered.map(o => o.sort_order || 0)) : 0;
      const created = await apiClient.entities.PicklistOption.create({
        category: selectedCategory,
        label: newLabel.trim(),
        value,
        sort_order: maxOrder + 1,
        is_active: true,
      });
      setOptions(prev => [...prev, created]);
      setNewLabel('');
    }
  };

  const toggleActive = async (opt) => {
    const updated = await apiClient.entities.PicklistOption.update(opt.id, { is_active: !opt.is_active });
    setOptions(prev => prev.map(o => o.id === opt.id ? updated : o));
  };

  const deleteOption = async (opt) => {
    await apiClient.entities.PicklistOption.delete(opt.id);
    setOptions(prev => prev.filter(o => o.id !== opt.id));
  };

  const saveClient = async (opt) => {
    const updated = await apiClient.entities.PicklistOption.update(opt.id, { client: editingClientValue || null });
    setOptions(prev => prev.map(o => o.id === opt.id ? updated : o));
    setEditingClientId(null);
    setEditingClientValue('');
  };

  const startEditClient = (opt) => {
    setEditingClientId(opt.id);
    setEditingClientValue(opt.client || '');
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-700">Picklist Manager</h3>

      {/* Category selector */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => setSelectedCategory(cat.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              selectedCategory === cat.value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Export / Import */}
      <PicklistFileActions
        category={selectedCategory}
        headers={exportHeaders}
        rows={exportRows}
        isTwoField={isTwoFieldCategory(selectedCategory)}
        isThreeField={isThreeFieldCategory(selectedCategory)}
        existingValues={filtered.map(o => o.value)}
        allowedClients={CLIENT_OPTIONS}
        onImported={loadOptions}
      />

      {/* Options list */}
      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
        {loading ? (
          <p className="text-xs text-slate-400">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No options yet. Add one below.</p>
        ) : (
          filtered.map(opt => (
            <div key={opt.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-slate-200 bg-white">
              <GripVertical className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
              {isTwoFieldCategory(selectedCategory) ? (
                <>
                  <span className={`font-mono text-sm font-semibold ${opt.is_active ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{opt.value}</span>
                  {opt.label && <span className={`flex-1 text-xs ${opt.is_active ? 'text-slate-500' : 'text-slate-300 line-through'}`}>{opt.label}</span>}
                  {isThreeFieldCategory(selectedCategory) && (
                    editingClientId === opt.id ? (
                      <select
                        value={editingClientValue}
                        onChange={e => setEditingClientValue(e.target.value)}
                        onBlur={() => saveClient(opt)}
                        autoFocus
                        className="text-xs border border-slate-300 rounded px-1 py-0.5 bg-white"
                      >
                        <option value="">—</option>
                        {CLIENT_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : (
                      <button
                        onClick={() => startEditClient(opt)}
                        className={`text-xs font-semibold px-2 py-0.5 rounded ${opt.client ? CLIENT_COLORS[opt.client] || 'bg-slate-100 text-slate-600' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                      >
                        {opt.client || '—'}
                      </button>
                    )
                  )}
                </>
              ) : (
                <>
                  <span className={`flex-1 text-sm ${opt.is_active ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{opt.label}</span>
                  <Badge variant="outline" className="text-xs text-slate-400">{opt.value}</Badge>
                </>
              )}
              <button onClick={() => toggleActive(opt)} className="text-slate-400 hover:text-blue-500 flex-shrink-0">
                {opt.is_active ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4" />}
              </button>
              <button onClick={() => deleteOption(opt)} className="text-slate-300 hover:text-red-500 flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add input */}
      {isTwoFieldCategory(selectedCategory) ? (
        <div className="flex gap-2">
          <Input
            value={newPartNumber}
            onChange={e => setNewPartNumber(e.target.value)}
            placeholder={`${TWO_FIELD_CONFIG[selectedCategory].primary}...`}
            className="text-sm font-mono w-36"
            onKeyDown={e => e.key === 'Enter' && addOption()}
          />
          <Input
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder={`${TWO_FIELD_CONFIG[selectedCategory].secondary}...`}
            className="text-sm flex-1"
            onKeyDown={e => e.key === 'Enter' && addOption()}
          />
          {isThreeFieldCategory(selectedCategory) && (
            <select
              value={newClient}
              onChange={e => setNewClient(e.target.value)}
              className="text-xs border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-700"
            >
              <option value="">Client…</option>
              {CLIENT_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <Button size="sm" onClick={addOption} disabled={!newPartNumber.trim()}>
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="New option label..."
            className="text-sm"
            onKeyDown={e => e.key === 'Enter' && addOption()}
          />
          <Button size="sm" onClick={addOption} disabled={!newLabel.trim()}>
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>
      )}
    </div>
  );
}