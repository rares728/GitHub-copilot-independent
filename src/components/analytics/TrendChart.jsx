import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts';
import { format, parseISO, startOfMonth } from 'date-fns';

const TYPE_COLORS = {
  defect:   '#ef4444',
  downtime: '#f97316',
  safety:   '#ec4899',
  quality:  '#3b82f6',
  process:  '#8b5cf6',
  other:    '#94a3b8',
};

const TYPE_LABELS = { defect: 'Defect', downtime: 'Downtime', safety: 'Safety', quality: 'Quality', process: 'Process', other: 'Other' };

export default function TrendChart({ issues }) {
  const { data, types } = useMemo(() => {
    const monthMap = {};
    const typesFound = new Set();

    issues.forEach(issue => {
      if (!issue.reported_date) return;
      const month = format(startOfMonth(parseISO(issue.reported_date)), 'yyyy-MM');
      if (!monthMap[month]) monthMap[month] = { month };
      const t = issue.issue_type || 'other';
      typesFound.add(t);
      monthMap[month][t] = (monthMap[month][t] || 0) + 1;
    });

    const data = Object.keys(monthMap)
      .sort()
      .map(m => ({ ...monthMap[m], label: format(parseISO(m + '-01'), 'MMM yy') }));

    return { data, types: Array.from(typesFound) };
  }, [issues]);

  return (
    <Card>
      <CardHeader className="px-5 pt-4 pb-1">
        <CardTitle className="text-sm font-semibold text-slate-700">Issues Over Time (by Month)</CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-4">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-52 text-slate-300 text-sm">No data for this period</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,.06)' }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              {types.map(t => (
                <Line
                  key={t}
                  type="monotone"
                  dataKey={t}
                  name={TYPE_LABELS[t] || t}
                  stroke={TYPE_COLORS[t] || '#94a3b8'}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}