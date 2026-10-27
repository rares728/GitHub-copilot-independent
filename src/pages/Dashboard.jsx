import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/api/client';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import { format, isAfter, parseISO } from 'date-fns';
import KpiCards from '../components/dashboard/KpiCards';
import IssueCharts from '../components/dashboard/IssueCharts';
import { StatusBadge, TypeBadge } from '../components/issues/StatusBadge';
import PullToRefresh from '../components/ui/PullToRefresh';

export default function Dashboard() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeKpi, setActiveKpi] = useState('total');
  const navigate = useNavigate();

  const [error, setError] = useState(null);

  const loadIssues = useCallback(async () => {
    try {
      const data = await apiClient.entities.ProductionIssue.list('-created_date', 50000);
      setIssues(data || []);
      setError(null);
    } catch (e) {
      console.error('Failed to load issues:', e);
      setError(e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIssues();
    const unsub = apiClient.entities.ProductionIssue.subscribe((event) => {
      if (event.type === 'create') setIssues(prev => [event.data, ...prev]);
      else if (event.type === 'update') setIssues(prev => prev.map(i => i.id === event.id ? event.data : i));
      else if (event.type === 'delete') setIssues(prev => prev.filter(i => i.id !== event.id));
    });
    return unsub;
  }, [loadIssues]);

  const filteredIssues = issues;


  const kpiTableIssues = (() => {
    switch (activeKpi) {
      case 'total': return filteredIssues;
      case 'open': return filteredIssues.filter(i => i.status !== 'closed');
      case 'critical': return filteredIssues.filter(i => i.severity === 'critical' && i.status !== 'closed');
      case 'closedThisMonth': return filteredIssues.filter(i => {
        if (i.status !== 'closed' || !i.closed_date) return false;
        try {
          const d = new Date(i.closed_date);
          const now = new Date();
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        } catch { return false; }
      });
      default: return filteredIssues;
    }
  })();

  const kpiTableTitle = { total: 'All Issues', open: 'Open Issues', critical: 'Critical Open Issues', closedThisMonth: 'Closed This Month' }[activeKpi];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isDueOverdue = (dateStr) => {
    if (!dateStr) return false;
    return isAfter(today, parseISO(dateStr));
  };

  const isDueSoon = (dateStr) => {
    if (!dateStr) return false;
    const due = parseISO(dateStr);
    const diff = (due - today) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 3;
  };

  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-center p-6">
      <p className="text-red-600 font-semibold">Failed to load dashboard</p>
      <p className="text-slate-500 text-sm">{error}</p>
      <button onClick={loadIssues} className="text-blue-600 underline text-sm">Try again</button>
    </div>
  );

  return (
    <PullToRefresh onRefresh={loadIssues}>
      <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Production Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Overview of all production issues and corrective actions</p>
      </div>


      <KpiCards issues={filteredIssues} loading={loading} activeKpi={activeKpi} onKpiClick={setActiveKpi} />

      <div className="mt-6">
        <IssueCharts issues={filteredIssues} loading={loading} />
      </div>


      <div className="mt-6">
        <h2 className="text-base font-semibold text-slate-800 mb-3">{kpiTableTitle}</h2>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                 <tr className="bg-slate-50 border-b border-slate-100">
                   <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 hidden lg:table-cell">Part Number</th>
                   <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 hidden lg:table-cell">Alias</th>
                   <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 hidden lg:table-cell">Batch #</th>
                   <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Defect</th>
                   <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 hidden md:table-cell">Issue</th>
                   <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Status</th>
                   <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 hidden lg:table-cell">Process Step</th>
                   <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 hidden xl:table-cell">Department</th>
                   <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 hidden xl:table-cell">Action Owner</th>
                   <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 hidden lg:table-cell">Due Date</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                 {loading
                   ? Array(5).fill(0).map((_, i) => (
                     <tr key={i}>
                       <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 bg-slate-100 rounded animate-pulse w-24" /></td>
                       <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 bg-slate-100 rounded animate-pulse w-24" /></td>
                       <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 bg-slate-100 rounded animate-pulse w-20" /></td>
                       <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse w-48" /></td>
                       <td className="px-4 py-3 hidden md:table-cell"><div className="h-5 bg-slate-100 rounded-full animate-pulse w-16" /></td>
                       <td className="px-4 py-3"><div className="h-5 bg-slate-100 rounded-full animate-pulse w-24" /></td>
                       <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 bg-slate-100 rounded animate-pulse w-16" /></td>
                       <td className="px-4 py-3 hidden xl:table-cell"><div className="h-4 bg-slate-100 rounded animate-pulse w-20" /></td>
                       <td className="px-4 py-3 hidden xl:table-cell"><div className="h-4 bg-slate-100 rounded animate-pulse w-20" /></td>
                       <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 bg-slate-100 rounded animate-pulse w-20" /></td>
                     </tr>
                   ))
                   : kpiTableIssues.flatMap(issue => {
                     let actions = [];
                     try { actions = JSON.parse(issue.corrective_actions_json || '[]'); } catch {}
                     if (!Array.isArray(actions) || actions.length === 0) {
                       if (issue.corrective_action || issue.corrective_action_owner) {
                         actions = [{ description: issue.corrective_action || '', owner: issue.corrective_action_owner || '', department: '', due_date: issue.corrective_action_due_date || '' }];
                       } else {
                         actions = [{ description: '', owner: '', department: '', due_date: issue.corrective_action_due_date || '' }];
                       }
                     }
                     return actions.map((action, aIdx) => {
                     const dueDateStr = action.due_date || issue.corrective_action_due_date;
                     const overdue = isDueOverdue(dueDateStr) && issue.status !== 'closed';
                     return (
                     <tr
                       key={issue.id + '-' + aIdx}
                       className="hover:bg-slate-50 cursor-pointer transition-colors"
                       onClick={() => navigate(createPageUrl('IssueDetail') + '?id=' + issue.id)}
                     >
                       <td className="px-4 py-3 text-slate-700 text-xs font-mono hidden lg:table-cell">{issue.part_number || '—'}</td>
                       <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">{issue.operation || '—'}</td>
                       <td className="px-4 py-3 text-slate-500 text-xs font-mono hidden lg:table-cell">{issue.batch_number || '—'}</td>
                       <td className="px-4 py-3">
                         <div className="font-medium text-slate-800 leading-tight">{issue.title}</div>
                         {issue.issue_number && <div className="text-xs text-slate-400 font-mono mt-0.5">{issue.issue_number}</div>}
                       </td>
                       <td className="px-4 py-3 hidden md:table-cell"><TypeBadge type={issue.issue_type} /></td>
                       <td className="px-4 py-3"><StatusBadge status={issue.status} feedbackPending={issue.feedback_pending} /></td>
                       <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">{issue.machine || '—'}</td>
                       <td className="px-4 py-3 text-slate-500 text-xs hidden xl:table-cell">{action.department || '—'}</td>
                       <td className="px-4 py-3 text-slate-500 text-xs hidden xl:table-cell">{action.owner || '—'}</td>
                       <td className="px-4 py-3 hidden lg:table-cell">
                         {dueDateStr ? (
                           <span className={`text-xs font-medium ${
                             overdue ? 'text-red-600 font-bold animate-blink-red' :
                             isDueSoon(dueDateStr) && issue.status !== 'closed' ? 'text-orange-700 font-bold' :
                             'text-slate-500'
                           }`}>
                             {format(parseISO(dueDateStr), 'MMM d, yyyy')}
                             {overdue && ' ⚠'}
                           </span>
                         ) : <span className="text-slate-300 text-xs">—</span>}
                       </td>
                     </tr>
                     );});
                     })
                     }
              </tbody>
            </table>
            {!loading && kpiTableIssues.length === 0 && (
              <div className="text-center py-10 text-slate-400 text-sm">No issues found.</div>
            )}
          </div>
        </div>
      </div>
      </div>
    </PullToRefresh>
  );
}