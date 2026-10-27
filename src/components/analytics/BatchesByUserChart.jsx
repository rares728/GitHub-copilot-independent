import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#f97316', '#ec4899'];

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', padding: '8px 12px' }}>
      <p className="font-semibold text-slate-700 mb-1">{d.name}</p>
      <p className="text-slate-500">Batches: <span className="font-semibold text-slate-700">{d.count}</span></p>
    </div>
  );
};

export default function BatchesByUserChart({ batches, loading }) {
  const data = React.useMemo(() => {
    const counts = {};
    (batches || []).forEach(b => {
      const key = b.saved_by || 'Unknown';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [batches]);

  if (loading) {
    return <div className="h-64 bg-white rounded-xl border border-slate-200 animate-pulse" />;
  }

  return (
    <Card>
      <CardHeader className="pb-1 pt-4 px-5">
        <CardTitle className="text-sm font-semibold text-slate-700">Batches Recorded by User</CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-4">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-slate-300 text-sm">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ top: 5, right: 20, left: -20, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                angle={-30}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}