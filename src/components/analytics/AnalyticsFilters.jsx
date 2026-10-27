import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import MobileSelect from '@/components/ui/MobileSelect';
import { fetchIssueTypes, fetchProcessSteps, fetchDefectTypes } from '@/components/issues/picklists';

const DATE_PRESETS = [
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Last 6 months', days: 180 },
  { label: 'Last 12 months', days: 365 },
  { label: 'All time', days: null },
];

const DEFAULT = { dateFrom: '', dateTo: '', processStep: 'all', issueType: 'all', defectType: 'all', severity: 'all', preset: '365', partNumber: '', batchNumber: '' };

export default function AnalyticsFilters({ filters, setFilters }) {
  const set = (k, v) => setFilters(p => ({ ...p, [k]: v }));
  const [issueTypeOptions, setIssueTypeOptions] = useState([]);
  const [processStepOptions, setProcessStepOptions] = useState([]);
  const [defectTypeOptions, setDefectTypeOptions] = useState([]);

  useEffect(() => {
    fetchIssueTypes().then(opts => setIssueTypeOptions([{ value: 'all', label: 'All Causes' }, ...opts]));
    fetchProcessSteps().then(opts => setProcessStepOptions([{ value: 'all', label: 'All Steps' }, ...opts]));
    fetchDefectTypes().then(opts => setDefectTypeOptions([{ value: 'all', label: 'All Defects' }, ...opts]));
  }, []);

  const applyPreset = (days) => {
    if (!days) {
      set('dateFrom', '');
    } else {
      const d = new Date();
      d.setDate(d.getDate() - days);
      set('dateFrom', d.toISOString().split('T')[0]);
    }
    set('dateTo', '');
    set('preset', days ? String(days) : 'all');
  };

  const reset = () => setFilters(DEFAULT);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Filters</h3>
        <Button variant="ghost" size="sm" onClick={reset} className="h-7 text-xs text-slate-400 gap-1">
          <RotateCcw className="w-3 h-3" /> Reset
        </Button>
      </div>

      <div>
        <Label className="text-xs text-slate-500 mb-1.5 block">Date Range (Preset)</Label>
        <div className="flex flex-wrap gap-1.5">
          {DATE_PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => applyPreset(p.days)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                filters.preset === (p.days ? String(p.days) : 'all')
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs text-slate-500 mb-1 block">From</Label>
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={e => { set('dateFrom', e.target.value); set('preset', 'custom'); }}
            className="text-xs h-8"
          />
        </div>
        <div>
          <Label className="text-xs text-slate-500 mb-1 block">To</Label>
          <Input
            type="date"
            value={filters.dateTo}
            onChange={e => { set('dateTo', e.target.value); set('preset', 'custom'); }}
            className="text-xs h-8"
          />
        </div>
        <div>
          <Label className="text-xs text-slate-500 mb-1 block">Process Step</Label>
          <MobileSelect
            value={filters.processStep || 'all'}
            onValueChange={v => set('processStep', v)}
            placeholder="All Steps"
            triggerClassName="text-xs h-8"
            items={processStepOptions}
          />
        </div>
        <div>
          <Label className="text-xs text-slate-500 mb-1 block">Predefined Cause</Label>
          <MobileSelect
            value={filters.issueType || 'all'}
            onValueChange={v => set('issueType', v)}
            placeholder="All Causes"
            triggerClassName="text-xs h-8"
            items={issueTypeOptions}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs text-slate-500 mb-1 block">Defect Type</Label>
          <MobileSelect
            value={filters.defectType || 'all'}
            onValueChange={v => set('defectType', v)}
            placeholder="All Defects"
            triggerClassName="text-xs h-8"
            items={defectTypeOptions}
          />
        </div>
        <div>
          <Label className="text-xs text-slate-500 mb-1 block">Severity</Label>
          <MobileSelect
            value={filters.severity || 'all'}
            onValueChange={v => set('severity', v)}
            placeholder="All Severities"
            triggerClassName="text-xs h-8"
            items={[
              { value: 'all', label: 'All Severities' },
              { value: 'critical', label: 'Critical' },
              { value: 'high', label: 'High' },
              { value: 'medium', label: 'Medium' },
              { value: 'low', label: 'Low' },
            ]}
          />
        </div>
        <div>
          <Label className="text-xs text-slate-500 mb-1 block">Part Number</Label>
          <Input
            value={filters.partNumber || ''}
            onChange={e => set('partNumber', e.target.value)}
            placeholder="Filter by part…"
            className="text-xs h-8"
          />
        </div>
        <div>
          <Label className="text-xs text-slate-500 mb-1 block">Batch Number</Label>
          <Input
            value={filters.batchNumber || ''}
            onChange={e => set('batchNumber', e.target.value)}
            placeholder="Filter by batch…"
            className="text-xs h-8"
          />
        </div>
      </div>
    </div>
  );
}