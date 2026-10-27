import React, { useState, useEffect } from 'react';
import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { FolderOpen, Download, Loader2, ChevronDown, ChevronRight } from 'lucide-react';

export default function IssuePhotosFolder() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    apiClient.entities.ProductionIssue.list('-created_date', 500).then(data => {
      setIssues((data || []).filter(i => i.image_urls && i.image_urls.length > 0));
      setLoading(false);
    });
  }, []);

  const toggleFolder = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const downloadImage = async (url, filename) => {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const downloadAll = async () => {
    setDownloading(true);
    for (const issue of issues) {
      for (let i = 0; i < (issue.image_urls || []).length; i++) {
        const url = issue.image_urls[i];
        const filename = `${issue.issue_number || issue.id}_photo_${i + 1}.jpg`;
        await downloadImage(url, filename);
        await new Promise(r => setTimeout(r, 300));
      }
    }
    setDownloading(false);
  };

  const totalPhotos = issues.reduce((s, i) => s + (i.image_urls?.length || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-yellow-500" />
          <span className="font-semibold text-slate-800 text-sm">Issue Photos</span>
          <span className="text-xs text-slate-400">({totalPhotos} photos across {issues.length} issues)</span>
        </div>
        {totalPhotos > 0 && (
          <Button size="sm" variant="outline" onClick={downloadAll} disabled={downloading} className="gap-1.5 text-xs h-8">
            {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Export All
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-xs text-slate-400 py-4 text-center">Loading...</div>
      ) : issues.length === 0 ? (
        <div className="text-xs text-slate-400 py-4 text-center">No issue photos found.</div>
      ) : (
        <div className="space-y-1">
          {issues.map(issue => (
            <div key={issue.id} className="border border-slate-200 rounded-lg overflow-hidden">
              {/* Folder row */}
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors">
                <button
                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  onClick={() => toggleFolder(issue.id)}
                >
                  {expanded[issue.id] ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                  <FolderOpen className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-slate-700 flex-1 truncate">
                    {issue.issue_number || issue.id} — {issue.title}
                  </span>
                  <span className="text-xs text-slate-400 flex-shrink-0 mr-2">{issue.image_urls.length} photo{issue.image_urls.length > 1 ? 's' : ''}</span>
                </button>
                <button
                  className="h-7 px-2 text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1 flex-shrink-0 rounded hover:bg-slate-200 transition-colors min-h-[44px]"
                  onClick={async (e) => {
                    e.stopPropagation();
                    for (let i = 0; i < issue.image_urls.length; i++) {
                      await downloadImage(issue.image_urls[i], `${issue.issue_number || issue.id}_photo_${i + 1}.jpg`);
                      await new Promise(r => setTimeout(r, 200));
                    }
                  }}
                >
                  <Download className="w-3 h-3 mr-1" /> Save
                </button>
              </div>

              {/* Photos grid */}
              {expanded[issue.id] && (
                <div className="p-3 flex flex-wrap gap-2 bg-white">
                  {issue.image_urls.map((url, idx) => (
                    <div key={idx} className="relative group w-24 h-24 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex-shrink-0">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                        onClick={() => downloadImage(url, `${issue.issue_number || issue.id}_photo_${idx + 1}.jpg`)}
                      >
                        <Download className="w-5 h-5 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}