import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';

const RC_LABELS = { man: 'Man', machine: 'Machine', material: 'Material', method: 'Method', measurement: 'Measurement', environment: 'Environment' };
const TYPE_LABELS = { defect: 'Defect', downtime: 'Downtime', safety: 'Safety', quality: 'Quality', process: 'Process', other: 'Other' };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-2.5 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.name === 'Cumulative %' ? `${p.value}%` : p.value}
        </p>
      ))}
    </div>
  );
};

function buildPareto(issues, groupFn, labelFn) {
  const counts = {};
  issues.forEach(i => {
    const key = groupFn(i);
    if (!key) return;
    counts[key] = (counts[key] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((s, [, c]) => s + c, 0);
  let cum = 0;
  return sorted.map(([key, count]) => {
    cum += count;
    return { name: labelFn(key), count, cumPct: Math.round((cum / total) * 100) };
  });
}

export default function ParetoChart({ issues }) {
  const byType = useMemo(() =>
    buildPareto(issues, i => i.issue_type, k => TYPE_LABELS[k] || k),
    [issues]);

  const byRootCause = useMemo(() =>
    buildPareto(issues.filter(i => i.root_cause_category), i => i.root_cause_category, k => RC_LABELS[k] || k),
    [issues]);

  const renderChart = (data, title) => (
    <Card>
      <CardHeader className="px-5 pt-4 pb-1">
        <CardTitle className="text-sm font-semibold text-slate-700">{title}</CardTitle>
        <p className="text-xs text-slate-400 mt-0.5">Bar = count · Line = cumulative %</p>
      </CardHeader>
      <CardContent className="px-2 pb-4">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-52 text-slate-300 text-sm">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={data} margin={{ top: 8, right: 36, left: -16, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="count" allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine yAxisId="pct" y={80} stroke="#94a3b8" strokeDasharray="4 4" />
              <Bar yAxisId="count" dataKey="count" name="Count" fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.85} />
              <Line yAxisId="pct" type="monotone" dataKey="cumPct" name="Cumulative %" stroke="#f97316" strokeWidth={2} dot={{ r: 3, fill: '#f97316' }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {renderChart(byType, 'Pareto – Issues by Type')}
      {renderChart(byRootCause, 'Pareto – Root Cause Categories (6M)')}
    </div>
  );
}