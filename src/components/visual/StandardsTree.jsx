import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Folder, FolderOpen, ChevronRight, ChevronDown, FileText, Upload, Trash2, Loader2, Save, FileCode2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

const CLIENT_FOLDERS = [
  { key: 'General', label: 'General', description: 'General requirements applicable to all P/Ns, regardless of client' },
  { key: 'HW', label: 'HW — Honeywell', description: 'Honeywell-specific requirements and workmanship standards' },
  { key: 'COL', label: 'COL — Collins', description: 'Collins-specific requirements and workmanship standards' },
  { key: 'PW', label: 'PW — Pratt & Whitney', description: 'Pratt & Whitney-specific requirements and workmanship standards' },
  { key: 'EVK', label: 'EVK — Evonik', description: 'Evonik-specific requirements and workmanship standards' },
  { key: 'PK', label: 'PK — Parker', description: 'Parker-specific requirements and workmanship standards' },
  { key: 'AEC', label: 'AEC', description: 'AEC-specific requirements and workmanship standards' },
];

export default function StandardsTree() {
  const [expanded, setExpanded] = useState({ General: true });
  const [standards, setStandards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingFolder, setUploadingFolder] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [summaries, setSummaries] = useState({});
  const [editingSummary, setEditingSummary] = useState({});
  const [savingSummary, setSavingSummary] = useState(null);
  const fileInputRefs = useRef({});

  const SUMMARY_TITLE = '__client_summary__';

  const loadSummaries = async (list) => {
    const summaryMap = {};
    (list || []).forEach(s => {
      if (s.title === SUMMARY_TITLE && s.client_folder) {
        summaryMap[s.client_folder] = { id: s.id, text: s.technical_summary || '' };
      }
    });
    setSummaries(summaryMap);
  };

  useEffect(() => { loadStandards(); }, []);

  const loadStandards = async () => {
    setLoading(true);
    try {
      const list = await apiClient.entities.InspectionStandard.list('-created_date', 500);
      setStandards(list || []);
      loadSummaries(list);
    } catch (e) {
      console.error('Load standards error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSummary = async (folderKey) => {
    setSavingSummary(folderKey);
    try {
      const text = editingSummary[folderKey] ?? summaries[folderKey]?.text ?? '';
      const existing = summaries[folderKey];
      if (existing?.id) {
        await apiClient.entities.InspectionStandard.update(existing.id, { technical_summary: text });
      } else {
        const created = await apiClient.entities.InspectionStandard.create({
          client_folder: folderKey,
          title: SUMMARY_TITLE,
          technical_summary: text,
        });
        setSummaries(prev => ({ ...prev, [folderKey]: { id: created.id, text } }));
        setStandards(prev => [...prev, created]);
        return;
      }
      setSummaries(prev => ({ ...prev, [folderKey]: { id: existing.id, text } }));
      setEditingSummary(prev => { const next = { ...prev }; delete next[folderKey]; return next; });
    } catch (e) {
      console.error('Save summary error:', e);
      alert('Error saving: ' + (e.message || e));
    } finally {
      setSavingSummary(null);
    }
  };

  const toggle = (key) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleFileSelect = async (folderKey, file) => {
    if (!file) return;
    setUploadingFolder(folderKey);
    try {
      const { file_url } = await apiClient.integrations.Core.UploadFile({ file });
      await apiClient.entities.InspectionStandard.create({
        client_folder: folderKey,
        title: file.name.replace(/\.[^.]+$/, ''),
        file_url,
        file_name: file.name,
      });
      await loadStandards();
    } catch (e) {
      console.error('Upload standard error:', e);
      alert('Error uploading: ' + (e.message || e));
    } finally {
      setUploadingFolder(null);
      if (fileInputRefs.current[folderKey]) {
        fileInputRefs.current[folderKey].value = '';
      }
    }
  };

  const handleDelete = async (std) => {
    setDeletingId(std.id);
    try {
      await apiClient.entities.InspectionStandard.delete(std.id);
      setStandards(prev => prev.filter(s => s.id !== std.id));
    } catch (e) {
      console.error('Delete standard error:', e);
    } finally {
      setDeletingId(null);
    }
  };

  const getFolderStandards = (folderKey) => standards.filter(s => s.client_folder === folderKey && s.title !== SUMMARY_TITLE);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">Inspection Standards</span>
        </div>

        <div className="space-y-1">
          {CLIENT_FOLDERS.map(({ key, label, description }) => {
            const isOpen = !!expanded[key];
            const folderStandards = getFolderStandards(key);
            const isUploading = uploadingFolder === key;
            return (
              <div key={key}>
                <button
                  onClick={() => toggle(key)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors text-left"
                >
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  )}
                  {isOpen ? (
                    <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  ) : (
                    <Folder className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-slate-800">{label}</span>
                  </div>
                  {folderStandards.length > 0 && (
                    <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                      {folderStandards.length}
                    </span>
                  )}
                </button>
                {isOpen && (
                  <div className="ml-10 mt-1 mb-2 space-y-2">
                    <p className="text-xs text-slate-500">{description}</p>

                    {/* Technical Summary Editor */}
                    <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-3 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <FileCode2 className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-xs font-semibold text-slate-700">Technical summary (for AI)</span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Key inspection rules for this client. Automatically injected into the AI prompt on every analysis.
                      </p>
                      <Textarea
                        value={editingSummary[key] ?? summaries[key]?.text ?? ''}
                        onChange={e => setEditingSummary(prev => ({ ...prev, [key]: e.target.value }))}
                        rows={5}
                        className="text-xs resize-y bg-white"
                        placeholder="e.g. Scratches &gt; 0.05mm on surface A are not acceptable. Oxidation in zone B is critical. Check burrs at through-holes..."
                      />
                      <Button
                        size="sm"
                        disabled={savingSummary === key}
                        onClick={() => handleSaveSummary(key)}
                        className="bg-blue-600 hover:bg-blue-700 h-7 text-xs"
                      >
                        {savingSummary === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Save summary
                      </Button>
                    </div>

                    {/* Upload button */}
                    <div>
                      <input
                        ref={el => fileInputRefs.current[key] = el}
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelect(key, file);
                        }}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isUploading}
                        onClick={() => fileInputRefs.current[key]?.click()}
                        className="gap-1.5 text-xs h-7"
                      >
                        {isUploading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        {isUploading ? 'Uploading...' : 'Upload standard'}
                      </Button>
                    </div>

                    {/* Uploaded standards list */}
                    {loading ? (
                      <p className="text-xs text-slate-400">Loading...</p>
                    ) : folderStandards.length === 0 ? (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/50">
                        <FileText className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                        <span className="text-xs text-slate-400 italic">
                          No standards added.
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {folderStandards.map(std => (
                          <div key={std.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white">
                            <FileText className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                            <a
                              href={std.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 min-w-0 text-xs font-medium text-slate-700 hover:text-blue-600 hover:underline truncate"
                            >
                              {std.title}
                            </a>
                            <span className="text-xs text-slate-300 flex-shrink-0">{std.file_name?.split('.').pop()?.toUpperCase()}</span>
                            {deletingId === std.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 flex-shrink-0" />
                            ) : (
                              <button
                                onClick={() => handleDelete(std)}
                                className="text-slate-300 hover:text-red-500 flex-shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-400">
            Structure: Client → Part Number → Standard → Rules (defect type, acceptance limit, context).
            Client abbreviations (HW, COL, PW, EVK, PK, AEC) are added manually in Picklist Manager → Part Number vs Alias.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}