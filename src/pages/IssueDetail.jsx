import React, { useState, useEffect } from 'react';
import { apiClient } from '@/api/client';
import { createPageUrl } from '@/utils';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import WorkflowStepper from '../components/issues/WorkflowStepper';
import IssueStages from '../components/issues/IssueStages';
import IssueForm from '../components/issues/IssueForm';
import IssuePhotos from '../components/issues/IssuePhotos';

export default function IssueDetail() {
  const [issue, setIssue] = useState(null);
  const [linkedBatches, setLinkedBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { loadIssue(); }, []);

  const loadIssue = async () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id || id.startsWith('temp-')) { setLoading(false); return; }
    const [issueList, batches] = await Promise.all([
      apiClient.entities.ProductionIssue.filter({ id }),
      apiClient.entities.ProductionBatch.filter({ rcca_issue_id: id }),
    ]);
    setIssue(issueList?.[0] || null);
    setLinkedBatches(batches || []);
    setLoading(false);
  };

  const handleUpdate = async (data) => {
    await apiClient.entities.ProductionIssue.update(issue.id, data);
    const refreshed = await apiClient.entities.ProductionIssue.filter({ id: issue.id });
    if (refreshed?.[0]) setIssue(refreshed[0]);
  };

  // Clear feedback_pending flag when an admin opens the issue
  useEffect(() => {
    if (issue && issue.feedback_pending) {
      apiClient.auth.me().then(me => {
        if (me?.role === 'admin') {
          apiClient.entities.ProductionIssue.update(issue.id, { feedback_pending: false });
          setIssue(prev => ({ ...prev, feedback_pending: false }));
        }
      }).catch(() => {});
    }
  }, [issue?.id, issue?.feedback_pending]);

  const handleDelete = async () => {
    navigate(createPageUrl('Issues'));
    try { await apiClient.entities.ProductionIssue.delete(issue.id); } catch (_) {}
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="w-10 h-10 text-slate-300" />
        <p className="text-slate-500 text-sm">Issue not found.</p>
        <Link to={createPageUrl('Issues')}>
          <Button variant="outline" size="sm">Back to Issues</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-5">
      {/* Edit Issue form — inline at top */}
      <IssueForm
        open={true}
        issue={issue}
        onClose={() => navigate(createPageUrl('Issues'))}
        onSaved={async () => {
          const refreshed = await apiClient.entities.ProductionIssue.filter({ id: issue.id });
          if (refreshed?.[0]) setIssue(refreshed[0]);
        }}
        existingBatchNumbers={[]}
        inline
      />

      {/* Workflow stepper */}
      <Card>
        <CardContent className="p-4 py-5">
          <WorkflowStepper status={issue.status} onStatusChange={(newStatus) => handleUpdate({ status: newStatus })} />
        </CardContent>
      </Card>

      {/* Linked Batches */}
      {linkedBatches.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-700">Linked Production Batches</span>
              <Badge variant="outline" className="text-xs ml-auto">{linkedBatches.length}</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-1.5 pr-4 font-semibold text-slate-400">Batch</th>
                    <th className="text-left py-1.5 pr-4 font-semibold text-slate-400">Part</th>
                    <th className="text-right py-1.5 pr-4 font-semibold text-slate-400">Total</th>
                    <th className="text-right py-1.5 pr-4 font-semibold text-green-600">OK</th>
                    <th className="text-right py-1.5 pr-4 font-semibold text-red-500">NOK</th>
                    <th className="text-left py-1.5 font-semibold text-slate-400">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {linkedBatches.map(b => (
                    <tr key={b.id}>
                      <td className="py-1.5 pr-4 font-mono font-semibold text-slate-700">
                        <Link to={createPageUrl('BatchMonitor')} className="text-blue-600 hover:underline">{b.batch_number}</Link>
                      </td>
                      <td className="py-1.5 pr-4 text-slate-600">{b.part_number}</td>
                      <td className="py-1.5 pr-4 text-right text-slate-600">{b.total_parts ?? '—'}</td>
                      <td className="py-1.5 pr-4 text-right font-semibold text-green-600">{b.parts_ok ?? '—'}</td>
                      <td className="py-1.5 pr-4 text-right font-semibold text-red-500">{b.parts_nok ?? '—'}</td>
                      <td className="py-1.5 text-slate-400">{b.production_date || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Photos */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold text-slate-700">Photos</span>
            {(issue.image_urls?.length || 0) > 0 && (
              <Badge variant="outline" className="text-xs ml-auto">{issue.image_urls.length}</Badge>
            )}
          </div>
          <IssuePhotos issue={issue} onUpdate={handleUpdate} />
        </CardContent>
      </Card>

      {/* RCCA Stage sections */}
      <IssueStages issue={issue} onUpdate={handleUpdate} />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Issue?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone. The issue will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}