import React, { useState, useEffect } from 'react';
import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

import { Plus, Search, Paperclip, ExternalLink, Pencil, Trash2, FileText } from 'lucide-react';
import DocumentForm from '../components/documents/DocumentForm';
import IssuePhotosFolder from '../components/documents/IssuePhotosFolder';
import PullToRefresh from '../components/ui/PullToRefresh';
import MobileSelect from '@/components/ui/MobileSelect';

const STATUS_COLORS = {
  draft: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  obsolete: 'bg-slate-100 text-slate-500',
};

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [docTypes, setDocTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('__all__');
  const [filterStatus, setFilterStatus] = useState('__all__');
  const [formOpen, setFormOpen] = useState(false);
  const [editDoc, setEditDoc] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [docs, opts] = await Promise.all([
      apiClient.entities.Document.list('-created_date', 200),
      apiClient.entities.PicklistOption.filter({ category: 'document_type', is_active: true }, 'sort_order', 100),
    ]);
    setDocuments(docs);
    setDocTypes(opts);
    setLoading(false);
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Delete "${doc.title}"?`)) return;
    await apiClient.entities.Document.delete(doc.id);
    setDocuments(prev => prev.filter(d => d.id !== doc.id));
  };

  const handleSaved = () => {
    setFormOpen(false);
    setEditDoc(null);
    load();
  };

  const filtered = documents.filter(d => {
    // Hide PickList_Def type documents for all users
    if (d.document_type === 'PickList_Def' || d.document_type === 'picklist_def') return false;
    const matchSearch = !search || d.title?.toLowerCase().includes(search.toLowerCase()) || d.description?.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === '__all__' || d.document_type === filterType;
    const matchStatus = filterStatus === '__all__' || d.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  return (
    <PullToRefresh onRefresh={load}>
    <div className="p-4 lg:p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Documents</h1>
        <Button onClick={() => { setEditDoc(null); setFormOpen(true); }} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4" /> New Document
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents..." className="pl-8 text-sm h-9" />
        </div>
        <MobileSelect
          value={filterType}
          onValueChange={setFilterType}
          placeholder="All Types"
          triggerClassName="w-44 h-9 text-sm"
          items={[{ value: '__all__', label: 'All Types' }, ...docTypes.map(t => ({ value: t.value, label: t.label }))]}
        />
        <MobileSelect
          value={filterStatus}
          onValueChange={setFilterStatus}
          placeholder="All Statuses"
          triggerClassName="w-36 h-9 text-sm"
          items={[
            { value: '__all__', label: 'All Statuses' },
            { value: 'draft', label: 'Draft' },
            { value: 'active', label: 'Active' },
            { value: 'obsolete', label: 'Obsolete' },
          ]}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <FileText className="w-10 h-10 opacity-30" />
          <p className="text-sm">No documents found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(doc => (
            <div key={doc.id} className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700 hover:shadow-sm transition-shadow">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                  <span className="font-medium text-slate-800 dark:text-slate-100 text-sm">{doc.title}</span>
                  {doc.version && <span className="text-xs text-slate-400">{doc.version}</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[doc.status] || ''}`}>{doc.status}</span>
                  {doc.document_type && (
                    <Badge variant="outline" className="text-xs">{docTypes.find(t => t.value === doc.document_type)?.label || doc.document_type}</Badge>
                  )}
                  {doc.department && <Badge variant="outline" className="text-xs">{doc.department}</Badge>}
                </div>
                {doc.description && <p className="text-xs text-slate-500 truncate">{doc.description}</p>}
                <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-400">
                  {doc.linked_issue_number && <span>Issue: {doc.linked_issue_number}</span>}
                  {doc.linked_batch_number && <span>Batch: {doc.linked_batch_number}</span>}
                  {doc.file_name && (
                    <a href={doc.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-500 hover:underline">
                      <Paperclip className="w-3 h-3" />{doc.file_name}
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => { setEditDoc(doc); setFormOpen(true); }} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(doc)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Issue Photos Folder */}
      <div className="mt-4 p-4 rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700">
        <IssuePhotosFolder />
      </div>

      <DocumentForm open={formOpen} onClose={() => { setFormOpen(false); setEditDoc(null); }} onSaved={handleSaved} document={editDoc} />
    </div>
  </PullToRefresh>
  );
}