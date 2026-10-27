import React, { useState, useEffect } from 'react';
import { apiClient } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import IssueForm from '@/components/issues/IssueForm';
import { StatusBadge } from '@/components/issues/StatusBadge';
import { fetchPartNumberAlias, fetchDefectTypes } from '@/components/issues/picklists';
import MobileSelect from '@/components/ui/MobileSelect';

const ITEMS_PER_PAGE = 20;
const STATUS_OPTIONS = [
  { label: 'All Status', value: '' },
  { label: 'New', value: 'new' },
  { label: 'On Hold', value: 'on_hold' },
  { label: 'RCCA', value: 'rcca' },
  { label: 'Closed', value: 'closed' },
];



const FILTERS_KEY = 'issues_filters_v1';

function loadFilters() {
  try {
    const raw = sessionStorage.getItem(FILTERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveFilters(obj) {
  try { sessionStorage.setItem(FILTERS_KEY, JSON.stringify(obj)); } catch {}
}

export default function Issues() {
  const saved = loadFilters();
  const [issueNumberFilter, setIssueNumberFilter] = useState(saved.issueNumberFilter ?? '');
  const [statusFilter, setStatusFilter] = useState(saved.statusFilter ?? '');
  const [ownerFilter, setOwnerFilter] = useState(saved.ownerFilter ?? '');
  const [partNumberFilter, setPartNumberFilter] = useState(saved.partNumberFilter ?? '');
  const [aliasFilter, setAliasFilter] = useState(saved.aliasFilter ?? '');
  const [defectFilter, setDefectFilter] = useState(saved.defectFilter ?? '');
  const [batchFilter, setBatchFilter] = useState(saved.batchFilter ?? '');

  const [page, setPage] = useState(saved.page ?? 1);
  const [showForm, setShowForm] = useState(false);
  const [editingIssue, setEditingIssue] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [partAliases, setPartAliases] = useState({});
  const [partNumberOptions, setPartNumberOptions] = useState([]);
  const [aliasOptions, setAliasOptions] = useState([]);
  const [defectOptions, setDefectOptions] = useState([]);
  const [ownerOptions, setOwnerOptions] = useState([]);
  const queryClient = useQueryClient();

  // Persist filters across remounts (same tab session)
  useEffect(() => {
    saveFilters({ issueNumberFilter, statusFilter, ownerFilter, partNumberFilter, aliasFilter, defectFilter, batchFilter, page });
  }, [issueNumberFilter, statusFilter, ownerFilter, partNumberFilter, aliasFilter, defectFilter, batchFilter, page]);

  useEffect(() => {
    fetchPartNumberAlias().then(aliases => {
      const map = {};
      aliases.forEach(a => { map[a.partNumber] = a.alias; });
      setPartAliases(map);

      const sortedAliases = [...aliases].sort((a, b) => a.partNumber.localeCompare(b.partNumber));
      const pnOpts = [{ label: 'All Parts', value: '' }, ...sortedAliases.map(a => ({ value: a.partNumber, label: a.partNumber }))];
      setPartNumberOptions(pnOpts);

      const seen = new Set();
      const aliasOpts = [{ label: 'All Aliases', value: '' }];
      [...aliases].sort((a, b) => (a.alias || '').localeCompare(b.alias || '')).forEach(a => {
        if (a.alias && !seen.has(a.alias)) {
          seen.add(a.alias);
          aliasOpts.push({ value: a.alias, label: a.alias });
        }
      });
      setAliasOptions(aliasOpts);
    }).catch(() => {});

    fetchDefectTypes().then(defects => {
      setDefectOptions([{ label: 'All Defects', value: '' }, ...defects]);
    }).catch(() => {});

    apiClient.functions.invoke('getUsers', {}).then(res => {
      const users = res.data?.users || [];
      setOwnerOptions([{ label: 'All Owners', value: '' }, ...users.map(u => ({ value: u.value, label: u.value })).sort((a, b) => a.label.localeCompare(b.label))]);
    }).catch(() => {});
  }, []);

  const { data: issuesData = {}, isLoading } = useQuery({
    queryKey: ['issues', issueNumberFilter, statusFilter, ownerFilter, partNumberFilter, aliasFilter, defectFilter, batchFilter, page, Object.keys(partAliases).length],
    queryFn: async () => {
      // Fetch all issues client-side and filter (API only supports simple equality)
      const allIssues = await apiClient.entities.ProductionIssue.list('-created_date', 50000);

      const RCCA_STATUSES = new Set(['rcca', 'containment', 'root_cause_analysis', 'corrective_action', 'verification']);

      let filtered = allIssues.filter(issue => {
        if (issueNumberFilter && !(issue.issue_number || '').toLowerCase().includes(issueNumberFilter.toLowerCase())) return false;
        if (statusFilter) {
          if (statusFilter === 'rcca') {
            if (!RCCA_STATUSES.has(issue.status)) return false;
          } else {
            if (issue.status !== statusFilter) return false;
          }
        }
        if (ownerFilter && issue.assigned_to !== ownerFilter && issue.corrective_action_owner !== ownerFilter) return false;
        if (partNumberFilter && issue.part_number !== partNumberFilter) return false;
        if (aliasFilter && partAliases[issue.part_number] !== aliasFilter) return false;
        if (defectFilter && issue.title !== defectFilter) return false;
        if (batchFilter && !(issue.batch_number || '').toLowerCase().includes(batchFilter.toLowerCase())) return false;
        return true;
      });

      const total = filtered.length;
      const offset = (page - 1) * ITEMS_PER_PAGE;
      const issues = filtered.slice(offset, offset + ITEMS_PER_PAGE);
      return { issues, total };
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (issueId) => apiClient.entities.ProductionIssue.delete(issueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      setDeleteConfirm(null);
    }
  });

  const handleEdit = (issue) => {
    setEditingIssue(issue);
    setShowForm(true);
  };

  const handleDelete = async (issueId) => {
    if (deleteConfirm === issueId) {
      deleteMutation.mutate(issueId);
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingIssue(null);
  };

  const handleFormSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['issues'] });
    handleCloseForm();
  };

  const issues = issuesData.issues || [];
  const totalIssues = issuesData.total || 0;
  const totalPages = Math.ceil(totalIssues / ITEMS_PER_PAGE);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 sticky top-0 z-20">
        <div className="p-4 lg:p-6 lg:space-y-3 space-y-2">
          <div className="flex items-center justify-between mb-2 lg:mb-4 gap-3">
            <h1 className="text-lg lg:text-2xl font-bold text-slate-900 dark:text-white">Issues</h1>
            <Button 
              onClick={() => {
                setEditingIssue(null);
                setShowForm(true);
              }}
              className="gap-2 flex-shrink-0 h-8 lg:h-auto text-xs lg:text-sm"
            >
              <Plus className="w-3 h-3 lg:w-4 lg:h-4" /> New
            </Button>
          </div>

          {/* Filters */}
           <div className="flex flex-nowrap gap-1 items-center overflow-x-auto">
             <Input
               placeholder="Issue #"
               value={issueNumberFilter}
               onChange={(e) => { setIssueNumberFilter(e.target.value); setPage(1); }}
               className="text-xs h-7 w-20 flex-shrink-0 px-2"
             />
             <MobileSelect items={STATUS_OPTIONS} value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }} placeholder="Status" triggerClassName="text-xs h-7 py-0 flex-shrink-0 w-24" />
             <MobileSelect items={ownerOptions} value={ownerFilter} onValueChange={(value) => { setOwnerFilter(value); setPage(1); }} placeholder="Owner" triggerClassName="text-xs h-7 py-0 flex-shrink-0 w-24" />
             <MobileSelect items={partNumberOptions} value={partNumberFilter} onValueChange={(value) => { setPartNumberFilter(value); setPage(1); }} placeholder="Part №" triggerClassName="text-xs h-7 py-0 flex-shrink-0 w-24" />
             <MobileSelect items={aliasOptions} value={aliasFilter} onValueChange={(value) => { setAliasFilter(value); setPage(1); }} placeholder="Alias" triggerClassName="text-xs h-7 py-0 flex-shrink-0 w-24" />
             <MobileSelect items={defectOptions} value={defectFilter} onValueChange={(value) => { setDefectFilter(value); setPage(1); }} placeholder="Defect" triggerClassName="text-xs h-7 py-0 flex-shrink-0 w-28" />
             <Input
               placeholder="Batch"
               value={batchFilter}
               onChange={(e) => { setBatchFilter(e.target.value); setPage(1); }}
               className="text-xs h-7 w-20 flex-shrink-0 px-2"
             />
             <span className="text-xs text-slate-500 dark:text-slate-400 ml-auto flex-shrink-0">{totalIssues}</span>
           </div>
        </div>
      </div>

      {/* Form Dialog */}
      <IssueForm
        open={showForm}
        issue={editingIssue}
        onClose={handleCloseForm}
        onSaved={handleFormSaved}
      />

      {/* Issues Table/List */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-slate-500">Loading issues...</div>
          </div>
        ) : issues.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <p className="text-slate-600 dark:text-slate-400">No issues found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left px-4 py-3 font-semibold text-slate-900 dark:text-white">Issue #</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-900 dark:text-white hidden lg:table-cell">Part Number</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-900 dark:text-white hidden lg:table-cell">Alias</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-900 dark:text-white hidden lg:table-cell">Batch</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-900 dark:text-white">Defect</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-900 dark:text-white hidden lg:table-cell">NOK</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-900 dark:text-white hidden md:table-cell">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-900 dark:text-white hidden lg:table-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((issue) => (
                  <tr key={issue.id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <td className="px-4 py-3">
                      <Link to={`/IssueDetail?id=${issue.id}`} className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                        {issue.issue_number || 'N/A'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-slate-600 dark:text-slate-400">{issue.part_number || '-'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-slate-600 dark:text-slate-400 text-xs">
                      {issue.part_number && partAliases[issue.part_number] ? partAliases[issue.part_number] : '-'}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-slate-600 dark:text-slate-400 text-xs">{issue.batch_number || '-'}</td>
                    <td className="px-4 py-3 max-w-xs truncate">{issue.title}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-center font-semibold text-slate-900 dark:text-white">
                      {issue.parts_nok || 0}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                     <StatusBadge status={issue.status} feedbackPending={issue.feedback_pending} />
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-slate-600 dark:text-slate-400 text-xs">{issue.reported_date ? new Date(issue.reported_date).toLocaleDateString('en-GB') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 flex items-center justify-between">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}