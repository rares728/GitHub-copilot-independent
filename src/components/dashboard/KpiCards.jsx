import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { isThisMonth, subDays, isAfter } from 'date-fns';

const TOTAL_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'week', label: '7d' },
  { key: 'day', label: '1d' },
];

export default function KpiCards({ issues, loading, activeKpi, onKpiClick }) {
  const [totalFilter, setTotalFilter] = useState('all');

  const now = new Date();
  const filteredTotal = issues.filter(i => {
    if (totalFilter === 'all') return true;
    const date = i.reported_date ? new Date(i.reported_date) : i.created_date ? new Date(i.created_date) : null;
    if (!date) return false;
    if (totalFilter === 'day') return isAfter(date, subDays(now, 1));
    if (totalFilter === 'week') return isAfter(date, subDays(now, 7));
    return true;
  });

  const total = filteredTotal.length;
  const open = issues.filter(i => i.status !== 'closed').length;
  const criticalOpen = issues.filter(i => i.severity === 'critical' && i.status !== 'closed').length;

  // Total downtime across all issues that have downtime_start and downtime_end
  const totalDowntimeMs = issues.reduce((sum, i) => {
    if (!i.downtime_start || !i.downtime_end) return sum;
    const ms = new Date(i.downtime_end) - new Date(i.downtime_start);
    return ms > 0 ? sum + ms : sum;
  }, 0);
  const totalDowntimeHours = totalDowntimeMs / 3600000;
  const downtimeDays = Math.floor(totalDowntimeHours / 24);
  const downtimeRemHours = Math.round(totalDowntimeHours % 24);
  const downtimeLabel = totalDowntimeMs > 0
    ? downtimeDays > 0 ? `${downtimeDays}d ${downtimeRemHours}h` : `${downtimeRemHours}h`
    : '—';
  const closedThisMonth = issues.filter(i => {
    if (i.status !== 'closed' || !i.closed_date) return false;
    try { return isThisMonth(new Date(i.closed_date)); } catch { return false; }
  }).length;

  const cards = [
    { key: 'total',          label: 'Total Issues',       value: total,           icon: AlertTriangle, color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200', activeBorder: 'border-slate-500' },
    { key: 'open',           label: 'Open Issues',        value: open,            icon: Clock,         color: 'text-blue-600',  bg: 'bg-blue-100',  border: 'border-blue-200',  activeBorder: 'border-blue-600' },
    { key: 'critical',       label: 'Critical Open',      value: criticalOpen,    icon: AlertCircle,   color: 'text-red-600',   bg: 'bg-red-100',   border: 'border-red-200',   activeBorder: 'border-red-600' },
    { key: 'closedThisMonth',label: 'Closed This Month',  value: closedThisMonth, icon: CheckCircle2,  color: 'text-green-600', bg: 'bg-green-100', border: 'border-green-200', activeBorder: 'border-green-600' },
  ];

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map(({ key, label, value, icon: Icon, color, bg, border, activeBorder }) => {
        const isActive = activeKpi === key;
        return (
          <Card
            key={key}
            className={`border-2 cursor-pointer transition-all ${isActive ? activeBorder + ' shadow-md' : border + ' hover:shadow-sm'}`}
            onClick={() => onKpiClick && onKpiClick(key)}
          >
            <CardContent className="p-4 flex flex-col h-full min-h-[110px]">
              <div className="flex items-start justify-between">
                <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                {loading ? (
                  <div className="h-8 w-12 bg-slate-100 rounded animate-pulse" />
                ) : (
                  <span className={`text-3xl font-bold ${color}`}>{value}</span>
                )}
              </div>
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs font-semibold text-slate-500">{label}</p>
                {key === 'critical' && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wide">Downtime</span>
                    <span className="text-xs font-bold text-red-600">{downtimeLabel}</span>
                  </div>
                )}
                {key === 'total' && (
                  <div className="flex gap-0.5" onClick={e => e.stopPropagation()}>
                    {TOTAL_FILTERS.map(f => (
                      <button
                        key={f.key}
                        onClick={() => setTotalFilter(f.key)}
                        className={`text-[9px] px-1.5 py-0.5 rounded font-semibold transition-colors ${
                          totalFilter === f.key
                            ? 'bg-slate-700 text-white'
                            : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {isActive && <div className={`h-0.5 ${bg} rounded mt-2`} />}

            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}