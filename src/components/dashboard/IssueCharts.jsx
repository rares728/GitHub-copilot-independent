import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Line, ReferenceLine } from
'recharts';

const TYPE_LABELS = { defect: 'Defect', downtime: 'Downtime', safety: 'Safety', quality: 'Quality', process: 'Process', other: 'Other' };
const TYPE_COLORS = { defect: '#ef4444', downtime: '#f97316', safety: '#ec4899', quality: '#3b82f6', process: '#8b5cf6', other: '#94a3b8' };
const DEFECT_COLOR = '#8b5cf6';

const PARETO_BAR = '#3b82f6';
const PARETO_LINE = '#ef4444';

function ParetoChart({ title, data, colorKey, onBarClick, selectedKey, byNok }) {
  if (!data || data.length === 0) return (
    <div className="flex items-center justify-center h-48 text-slate-300 text-sm">No data</div>);


  const total = data.reduce((s, d) => s + d.count, 0);
  let cumulative = 0;
  const chartData = [...data].
  sort((a, b) => b.count - a.count).
  map((d) => {
    cumulative += d.count;
    return {
      ...d,
      pct: total > 0 ? Math.round(d.count / total * 100) : 0,
      cumPct: total > 0 ? Math.round(cumulative / total * 100) : 0
    };
  });

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    const qtyLabel = byNok ? 'Parts NOK' : 'Issues';
    return (
      <div style={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', padding: '8px 12px' }}>
        <p className="font-semibold text-slate-700 mb-1">{d.name}</p>
        <p className="text-slate-500">Share: <span className="font-semibold text-slate-700">{d.pct}%</span></p>
        <p className="text-slate-500">{qtyLabel}: <span className="font-semibold text-slate-700">{d.count}</span></p>
        <p className="text-slate-400">Cumulative: {d.cumPct}%</p>
      </div>);

  };

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}
      onClick={(e) => e?.activePayload && onBarClick && onBarClick(e.activePayload[0]?.payload)}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} angle={-45} textAnchor="end" interval={0} height={60} />
        <YAxis yAxisId="left" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={[0, 100]} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} className="recharts-text recharts-cartesian-axis-tick-value" />
        <Tooltip content={<CustomTooltip />} />
        <Bar yAxisId="left" dataKey="pct" radius={[4, 4, 0, 0]} cursor="pointer">
          {chartData.map((entry, i) =>
          <Cell
            key={i}
            fill={entry.name === selectedKey ? '#1d4ed8' : colorKey ? entry.fill : PARETO_BAR}
            opacity={selectedKey && entry.name !== selectedKey ? 0.5 : 1} />

          )}
        </Bar>
        <Line yAxisId="left" type="monotone" dataKey="cumPct" stroke={PARETO_LINE} dot={false} strokeWidth={2} />
        <ReferenceLine yAxisId="left" y={80} stroke="#fbbf24" strokeDasharray="4 4" label={{ value: '80%', fill: '#fbbf24', fontSize: 10 }} />
      </BarChart>
    </ResponsiveContainer>);

}

export default function IssueCharts({ issues, loading }) {
  const [chartMode, setChartMode] = useState('count'); // 'count' | 'parts_nok'
  const [selectedType, setSelectedType] = useState(null);
  const [selectedStep, setSelectedStep] = useState(null);
  const [selectedDefect, setSelectedDefect] = useState(null);
  const [selectedPartNumber, setSelectedPartNumber] = useState(null);

  const byNok = chartMode === 'parts_nok';
  const getValue = (arr) => byNok ? arr.reduce((s, i) => s + (i.parts_nok || 0), 0) : arr.length;

  const byType = Object.entries(
    issues.reduce((acc, i) => {const k = i.issue_type;if (!acc[k]) acc[k] = [];acc[k].push(i);return acc;}, {})
  ).
  map(([type, arr]) => ({ name: TYPE_LABELS[type] || type, rawKey: type, count: getValue(arr), fill: TYPE_COLORS[type] || '#94a3b8' })).
  sort((a, b) => b.count - a.count);

  const byStep = Object.entries(
    issues.reduce((acc, i) => {const k = i.machine || 'Unknown';if (!acc[k]) acc[k] = [];acc[k].push(i);return acc;}, {})
  ).
  map(([step, arr]) => ({ name: step, count: getValue(arr) })).
  sort((a, b) => b.count - a.count);

  const byDefect = Object.entries(
    issues.reduce((acc, i) => {const k = i.title || 'Unknown';if (!acc[k]) acc[k] = [];acc[k].push(i);return acc;}, {})
  ).
  map(([defect, arr]) => ({ name: defect, count: getValue(arr), fill: DEFECT_COLOR })).
  sort((a, b) => b.count - a.count);

  const byPartNumber = Object.entries(
    issues.reduce((acc, i) => {const k = i.part_number || 'Unknown';if (!acc[k]) acc[k] = [];acc[k].push(i);return acc;}, {})
  ).
  map(([pn, arr]) => ({ name: pn, count: getValue(arr), fill: '#0ea5e9' })).
  sort((a, b) => b.count - a.count).
  slice(0, 10);

  const filteredByType = selectedType ?
  issues.filter((i) => (TYPE_LABELS[i.issue_type] || i.issue_type) === selectedType) :
  [];

  const filteredByStep = selectedStep ?
  issues.filter((i) => (i.machine || 'Unknown') === selectedStep) :
  [];

  const filteredByDefect = selectedDefect ?
  issues.filter((i) => (i.title || 'Unknown') === selectedDefect) :
  [];

  const filteredByPartNumber = selectedPartNumber ?
  issues.filter((i) => (i.part_number || 'Unknown') === selectedPartNumber) :
  [];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[0, 1, 2, 3].map((i) =>
        <Card key={i} className="h-64">
            <CardContent className="flex items-center justify-center h-full">
              <div className="animate-pulse text-slate-300 text-sm">Loading chart...</div>
            </CardContent>
          </Card>
        )}
      </div>);

  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setChartMode('count')}
          className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${chartMode === 'count' ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}>
          
          Number of Issues
        </button>
        <button
          onClick={() => setChartMode('parts_nok')}
          className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${chartMode === 'parts_nok' ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}>
          
          Parts NOK
        </button>
      </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Issues by Type */}
      <div>
        <Card>
          <CardHeader className="pb-1 pt-4 px-5">
            <CardTitle className="text-sm font-semibold text-slate-700">{byNok ? 'Parts NOK by Type (Pareto, %)' : 'Issues by Type (Pareto, %)'}</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ParetoChart
                data={byType}
                colorKey={true}
                selectedKey={selectedType}
                onBarClick={(d) => setSelectedType((prev) => prev === d?.name ? null : d?.name)}
                byNok={byNok} />
              
          </CardContent>
        </Card>
        {selectedType && filteredByType.length > 0 &&
          <div className="mt-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">{selectedType} — {filteredByType.length} issues</span>
              <button onClick={() => setSelectedType(null)} className="text-xs text-slate-400 hover:text-slate-600">✕ Close</button>
            </div>
            <div className="divide-y divide-slate-50 max-h-48 overflow-y-auto">
              {filteredByType.map((i) =>
              <div key={i.id} className="px-4 py-2 text-xs text-slate-700 flex gap-2">
                  <span className="font-mono text-slate-400 flex-shrink-0">{i.issue_number || '—'}</span>
                  <span className="flex-1 truncate">{i.title}</span>
                  <span className="text-slate-400 flex-shrink-0">{i.machine || '—'}</span>
                </div>
              )}
            </div>
          </div>
          }
      </div>

      {/* Issues by Process Step */}
      <div>
        <Card>
          <CardHeader className="pb-1 pt-4 px-5">
            <CardTitle className="text-sm font-semibold text-slate-700">{byNok ? 'Parts NOK by Process Step (Pareto, %)' : 'Issues by Process Step (Pareto, %)'}</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ParetoChart
                data={byStep}
                selectedKey={selectedStep}
                onBarClick={(d) => setSelectedStep((prev) => prev === d?.name ? null : d?.name)}
                byNok={byNok} />
              
          </CardContent>
        </Card>
        {selectedStep && filteredByStep.length > 0 &&
          <div className="mt-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">{selectedStep} — {filteredByStep.length} issues</span>
              <button onClick={() => setSelectedStep(null)} className="text-xs text-slate-400 hover:text-slate-600">✕ Close</button>
            </div>
            <div className="divide-y divide-slate-50 max-h-48 overflow-y-auto">
              {filteredByStep.map((i) =>
              <div key={i.id} className="px-4 py-2 text-xs text-slate-700 flex gap-2">
                  <span className="font-mono text-slate-400 flex-shrink-0">{i.issue_number || '—'}</span>
                  <span className="flex-1 truncate">{i.title}</span>
                  <span className="text-slate-400 flex-shrink-0">{TYPE_LABELS[i.issue_type] || i.issue_type || '—'}</span>
                </div>
              )}
            </div>
          </div>
          }
      </div>

      {/* Issues by Defect */}
      <div>
        <Card>
          <CardHeader className="pb-1 pt-4 px-5">
            <CardTitle className="text-sm font-semibold text-slate-700">{byNok ? 'Parts NOK by Defect (Pareto, %)' : 'Issues by Defect (Pareto, %)'}</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ParetoChart
                data={byDefect}
                colorKey={true}
                selectedKey={selectedDefect}
                onBarClick={(d) => setSelectedDefect((prev) => prev === d?.name ? null : d?.name)}
                byNok={byNok} />
              
          </CardContent>
        </Card>
        {selectedDefect && filteredByDefect.length > 0 &&
          <div className="mt-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">{selectedDefect} — {filteredByDefect.length} issues</span>
              <button onClick={() => setSelectedDefect(null)} className="text-xs text-slate-400 hover:text-slate-600">✕ Close</button>
            </div>
            <div className="divide-y divide-slate-50 max-h-48 overflow-y-auto">
              {filteredByDefect.map((i) =>
              <div key={i.id} className="px-4 py-2 text-xs text-slate-700 flex gap-2">
                  <span className="font-mono text-slate-400 flex-shrink-0">{i.issue_number || '—'}</span>
                  <span className="flex-1 truncate">{i.title}</span>
                  <span className="text-slate-400 flex-shrink-0">{i.machine || '—'}</span>
                </div>
              )}
            </div>
          </div>
          }
      </div>

      {/* Issues by Part Number */}
      <div>
        <Card>
          <CardHeader className="pb-1 pt-4 px-5">
            <CardTitle className="text-sm font-semibold text-slate-700">{byNok ? 'Parts NOK by Part Number (Top 10, %)' : 'Issues by Part Number (Top 10, %)'}</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ParetoChart
                data={byPartNumber}
                colorKey={true}
                selectedKey={selectedPartNumber}
                onBarClick={(d) => setSelectedPartNumber((prev) => prev === d?.name ? null : d?.name)}
                byNok={byNok} />
              
          </CardContent>
        </Card>
        {selectedPartNumber && filteredByPartNumber.length > 0 &&
          <div className="mt-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">{selectedPartNumber} — {filteredByPartNumber.length} issues</span>
              <button onClick={() => setSelectedPartNumber(null)} className="text-xs text-slate-400 hover:text-slate-600">✕ Close</button>
            </div>
            <div className="divide-y divide-slate-50 max-h-48 overflow-y-auto">
              {filteredByPartNumber.map((i) =>
              <div key={i.id} className="px-4 py-2 text-xs text-slate-700 flex gap-2">
                  <span className="font-mono text-slate-400 flex-shrink-0">{i.issue_number || '—'}</span>
                  <span className="flex-1 truncate">{i.title}</span>
                  <span className="font-mono text-slate-400 flex-shrink-0">{i.batch_number || '—'}</span>
                </div>
              )}
            </div>
          </div>
          }
      </div>
    </div>
    </div>);

}