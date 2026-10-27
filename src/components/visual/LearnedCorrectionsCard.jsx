import React, { useState, useEffect } from 'react';
import { apiClient } from '@/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain, Loader2, RefreshCw, FileText } from 'lucide-react';

export default function LearnedCorrectionsCard() {
  const [corrections, setCorrections] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [correctionData, summaryData] = await Promise.all([
        apiClient.entities.VisualInspectionEntry.filter(
          { human_validated: true, human_agrees_with_ai: false },
          '-validated_at',
          50
        ),
        apiClient.entities.AiLearnedLessons.list('-generated_at', 1),
      ]);
      const filtered = (correctionData || []).filter(e =>
        (e.human_corrected_label && e.human_corrected_label.trim()) ||
        (e.human_feedback && e.human_feedback.trim())
      );
      setCorrections(filtered);
      setSummary(summaryData?.length ? summaryData[0] : null);
    } catch (e) {
      console.error('Load corrections error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await apiClient.functions.invoke('regenerateLearnedLessons', {});
      await loadAll();
    } catch (e) {
      console.error('Regenerate error:', e);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <>
      {/* Layer 1: Lessons Learned Summary */}
      <Card className="md:col-span-3">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-semibold text-slate-700">Lessons Learned Summary</span>
            {summary?.corrections_count > 0 && (
              <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-md px-1.5 py-0.5">
                {summary.corrections_count} corrections compiled
              </span>
            )}
            <Button
              onClick={handleRegenerate}
              disabled={regenerating}
              variant="outline"
              className="h-7 text-xs ml-auto gap-1"
            >
              {regenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              {regenerating ? 'Generating...' : 'Regenerate'}
            </Button>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            A compact LLM-generated summary of patterns from ALL past human corrections. Scales to thousands of corrections
            without growing the prompt — this is always injected into every AI analysis.
          </p>
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading...
            </div>
          ) : summary?.summary_text ? (
            <div className="text-xs text-slate-700 bg-indigo-50/50 border border-indigo-100 rounded-lg p-3 whitespace-pre-wrap max-h-64 overflow-y-auto">
              {summary.summary_text}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">
              No summary yet. Click "Regenerate" to compile all human corrections into a compact lessons summary.
              {!corrections.length && ' No corrections exist yet — validate some AI results first.'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Layer 2: Raw corrections list */}
      <Card className="md:col-span-3">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-semibold text-slate-700">Raw Corrections ({corrections.length})</span>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Top 5 most relevant corrections (by Part Number + client match) are injected into each AI analysis alongside
            the summary. All corrections feed into the summary regeneration.
          </p>
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading corrections...
            </div>
          ) : corrections.length === 0 ? (
            <p className="text-xs text-slate-400 italic">
              No corrections yet. When you reject an AI result and provide feedback, it will appear here.
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {corrections.map((c, i) => (
                <div key={c.id || i} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded">#{i + 1}</span>
                    <span className="text-xs font-mono font-semibold text-slate-700">{c.part_number || '—'}</span>
                    {c.client && <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{c.client}</span>}
                    <span className="text-[10px] text-slate-400 ml-auto">{c.issue_number || ''}</span>
                  </div>
                  {c.human_corrected_label && (
                    <p className="text-[11px] text-slate-700">
                      <span className="font-semibold text-red-600">Correction:</span> {c.human_corrected_label}
                    </p>
                  )}
                  {c.human_feedback && (
                    <p className="text-[11px] text-slate-600">
                      <span className="font-semibold text-amber-600">Feedback:</span> {c.human_feedback}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}