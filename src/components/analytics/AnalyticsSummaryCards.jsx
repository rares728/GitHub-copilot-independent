import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

function StatCard({ label, value, sub, trend }) {
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor = trend > 0 ? 'text-red-500' : trend < 0 ? 'text-green-500' : 'text-slate-400';
  const trendLabel = trend > 0 ? `+${trend}` : trend < 0 ? `${trend}` : '—';

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1">{label}</p>
            <p className="text-3xl font-bold text-slate-800">{value}</p>
            {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
          </div>
          {trend !== undefined && (
            <div className={`flex items-center gap-0.5 text-xs font-semibold mt-1 ${trendColor}`}>
              <TrendIcon className="w-3.5 h-3.5" />
              <span>{trendLabel}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsSummaryCards({ issues, allIssues }) {
  const total = issues.length;
  const open = issues.filter(i => i.status !== 'closed').length;
  const closed = issues.filter(i => i.status === 'closed').length;
  const critical = issues.filter(i => i.severity === 'critical').length;
  const closureRate = total > 0 ? Math.round((closed / total) * 100) : 0;
  const avgResolutionDays = (() => {
    const resolved = issues.filter(i => i.status === 'closed' && i.reported_date && i.closed_date);
    if (!resolved.length) return null;
    const avg = resolved.reduce((s, i) => {
      const days = Math.round((new Date(i.closed_date) - new Date(i.reported_date)) / 86400000);
      return s + days;
    }, 0) / resolved.length;
    return Math.round(avg);
  })();

  return (
    <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
      <StatCard label="Total Issues" value={total} sub="in selected period" />
      <StatCard label="Open Issues" value={open} sub="awaiting resolution" />
      <StatCard label="Closed Issues" value={closed} />
      <StatCard label="Critical Issues" value={critical} sub="critical severity" />
      <StatCard label="Closure Rate" value={`${closureRate}%`} sub={avgResolutionDays != null ? `Avg ${avgResolutionDays}d to close` : 'No closed issues'} />
    </div>
  );
}