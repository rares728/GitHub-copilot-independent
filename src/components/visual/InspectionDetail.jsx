import React, { useState, useEffect } from 'react';
import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Sparkles, Loader2, Check, X, Upload, AlertCircle, Pencil, Trash2, Lightbulb } from 'lucide-react';
import { fetchAiPrompt } from './AiPromptEditor';
import { buildPhotoHint, fetchLearnedCorrections } from './promptCodeParts';
import AiExplanationDisplay from './AiExplanationDisplay';

const SUMMARY_TITLE = '__client_summary__';

async function fetchTechnicalSummary(client) {
  // General applies to ALL parts; client-specific is additive
  const folders = ['General'];
  if (client && !folders.includes(client)) folders.push(client);
  const parts = [];
  for (const folder of folders) {
    try {
      const list = await apiClient.entities.InspectionStandard.filter(
        { client_folder: folder, title: SUMMARY_TITLE },
        '-updated_date',
        1
      );
      if (list?.length && list[0].technical_summary) {
        parts.push({ folder, text: list[0].technical_summary });
      }
    } catch (e) {
      console.error(`Fetch technical summary for ${folder} error:`, e);
    }
  }
  if (!parts.length) return '';
  return parts.map(p => `[${p.folder}]\n${p.text}`).join('\n\n');
}

const AI_MODELS = [
  { value: 'chain', label: 'Chain (Flash → Claude verificare)' },
  { value: 'gemini_3_flash', label: 'Gemini 3 Flash (rapid)' },
  { value: 'claude_sonnet_4_6', label: 'Claude Sonnet 4.6 (detaliat)' },
  { value: 'gpt_5_4', label: 'GPT-5.4 (echilibrat)' },
];

const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    defect_detected: { type: 'boolean' },
    defect_type: { type: 'string' },
    estimated_size: { type: 'string' },
    confidence_score: { type: 'number' },
    explanation: { type: 'string' },
    recommendation: { type: 'string' },
    improvement_suggestions: { type: 'string' },
  },
  required: ['defect_detected', 'defect_type', 'confidence_score', 'explanation', 'recommendation', 'improvement_suggestions'],
};

// Some models (e.g. Claude) wrap the JSON result inside a 'response' key
function normalizeResult(raw) {
  if (!raw) return {};
  if (raw.response !== undefined) {
    if (typeof raw.response === 'string') {
      try { return JSON.parse(raw.response); } catch { /* fall through */ }
    }
    if (typeof raw.response === 'object') return raw.response;
  }
  return raw;
}

function ConfidenceBar({ score }) {
  if (score === undefined || score === null) return null;
  const pct = Math.round(score * 100);
  const color = pct >= 95 ? '#22C55E' : pct >= 70 ? '#FCD34D' : '#EF4444';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-sm font-bold" style={{ color }}>{pct}%</span>
    </div>
  );
}

export default function InspectionDetail({ entry, onUpdate }) {
  const [model, setModel] = useState('chain');
  const [analyzing, setAnalyzing] = useState(false);
  const [chainStep, setChainStep] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [correctedLabel, setCorrectedLabel] = useState('');
  const [validating, setValidating] = useState(false);
  const [defectDescription, setDefectDescription] = useState('');
  const [partsToAnalyze, setPartsToAnalyze] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [currentUserName, setCurrentUserName] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!entry) return;
    setDeleting(true);
    try {
      await apiClient.entities.VisualInspectionEntry.delete(entry.id);
      onUpdate(null);
    } catch (e) {
      console.error('Delete error:', e);
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (entry?.issue_number) {
      apiClient.entities.ProductionIssue.filter({ issue_number: entry.issue_number }, '-created_date', 1)
        .then(res => {
          if (res?.length) {
            setDefectDescription(res[0].defect_description || '');
            setPartsToAnalyze(res[0].parts_to_analyze ?? null);
          }
        })
        .catch(() => { setDefectDescription(''); setPartsToAnalyze(null); });
    }
    setEditMode(false);
  }, [entry?.id]);

  useEffect(() => {
    apiClient.auth.me().then(u => setCurrentUserName(u?.full_name || u?.email || '')).catch(() => {});
  }, []);

  if (!entry) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Sparkles className="w-8 h-8 text-slate-200 mb-2" />
        <p className="text-slate-400 text-sm">Select an entry from the table to start AI inspection.</p>
      </div>
    );
  }

  const handleUpload = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    const newUrls = [];
    for (const file of Array.from(files)) {
      const { file_url } = await apiClient.integrations.Core.UploadFile({ file });
      newUrls.push(file_url);
    }
    const updated = { ...entry, image_urls: [...(entry.image_urls || []), ...newUrls] };
    await apiClient.entities.VisualInspectionEntry.update(entry.id, { image_urls: updated.image_urls });
    onUpdate(updated);
    setUploading(false);
  };

  const handleAnalyze = async () => {
    if (!entry.image_urls?.length) return;
    setAnalyzing(true);
    setChainStep(0);
    try {
      const promptTemplate = await fetchAiPrompt();
      const techSummary = await fetchTechnicalSummary(entry.client);
      const photoCount = entry.image_urls?.length || 0;
      const photoHint = buildPhotoHint(photoCount, partsToAnalyze);
      const learnedCorrections = await fetchLearnedCorrections(entry.client, entry.part_number);

      const basePrompt = promptTemplate
        .replace(/\{part_number\}/g, entry.part_number || 'unknown')
        .replace(/\{part_alias\}/g, entry.part_alias || 'unknown')
        .replace(/\{batch_number\}/g, entry.batch_number || 'unknown')
        + (techSummary ? `\n\nINSPECTION RULES — DEFECT TYPES, DEFINITIONS AND ACCEPTANCE CRITERIA (General + Client):\n${techSummary}\n\nCRITICAL — DEFECT TYPE NAMING: The "defect_type" field in your response MUST use ONLY the exact defect type names defined above (e.g. "SCRATCH", "CRACK", "BURR", etc.). Do not invent new defect type names. Choose the closest matching type and explain any nuance in the "explanation" field.\n\nFORMAT REQUIREMENT — "explanation" field: Your "explanation" field MUST start with a "Tip defect detectat:" section. List every distinct defect type you found and how many times it appears, using this exact format:\nTip defect detectat:\n<count>x <DEFECT_TYPE_NAME> (<Romanian translation from the rules above>)\n(one line per distinct defect type found; if only one defect, write 1x)\nDimensiuni aproximative: <approximate size(s) of the defects, e.g. "zgarieturi 1-8mm lungime">\n\nAfter this section, leave a blank line, then continue with your detailed analysis as before.` : '')
        + (defectDescription ? `\n\nPRELIMINARY DEFECT DESCRIPTION (from production issue ${entry.issue_number} — use as starting point, may be correct or incorrect):\n${defectDescription}\n\nTreat this as an initial hypothesis. Verify it against the photos and the inspection rules above. If the photos confirm it, develop the analysis further. If the photos contradict it, correct it and explain why.` : '')
        + photoHint
        + learnedCorrections;

      let result;
      let modelUsed;

      if (model === 'chain') {
        // Step 1: Gemini Flash for fast initial analysis
        setChainStep(1);
        const rawStep1 = await apiClient.integrations.Core.InvokeLLM({
          prompt: basePrompt,
          file_urls: entry.image_urls,
          model: 'gemini_3_flash',
          response_json_schema: RESULT_SCHEMA,
        });
        const step1 = normalizeResult(rawStep1);

        // Step 2: Claude Sonnet verifies / refines
        setChainStep(2);
        const verifyPrompt = basePrompt
          + `\n\n--- PRELIMINARY ANALYSIS (Gemini Flash) ---\n`
          + `Defect detected: ${step1.defect_detected}\n`
          + `Defect type: ${step1.defect_type || '—'}\n`
          + `Estimated size: ${step1.estimated_size || '—'}\n`
          + `Confidence score: ${step1.confidence_score}\n`
          + `Explanation: ${step1.explanation || '—'}\n\n`
          + `Review and correct this preliminary analysis. You are the final expert in visual inspection for aviation parts. `
          + `If the Gemini analysis is correct, confirm it. If it is wrong, correct it. Provide your final analysis.`;

        const rawResult = await apiClient.integrations.Core.InvokeLLM({
          prompt: verifyPrompt,
          file_urls: entry.image_urls,
          model: 'claude_sonnet_4_6',
          response_json_schema: RESULT_SCHEMA,
        });
        result = normalizeResult(rawResult);
        modelUsed = 'chain (gemini→claude)';
      } else {
        const rawResult = await apiClient.integrations.Core.InvokeLLM({
          prompt: basePrompt,
          file_urls: entry.image_urls,
          model,
          response_json_schema: RESULT_SCHEMA,
        });
        result = normalizeResult(rawResult);
        modelUsed = model;
      }

      const improvementSuggestions = (typeof result.improvement_suggestions === 'string' && result.improvement_suggestions.trim())
        ? result.improvement_suggestions.trim()
        : '';
      const updated = {
        ...entry,
        ai_model_used: modelUsed,
        ai_confidence_score: result.confidence_score,
        ai_defect_detected: result.defect_detected,
        ai_explanation: [result.explanation, result.recommendation ? `Recommendation: ${result.recommendation}` : ''].filter(Boolean).join('\n\n'),
        ai_improvement_suggestions: improvementSuggestions,
        status: 'in_review',
        human_validated: false,
        human_agrees_with_ai: null,
        human_corrected_label: '',
        human_feedback: '',
        validated_by: '',
        validated_at: null,
      };
      await apiClient.entities.VisualInspectionEntry.update(entry.id, {
        ai_model_used: modelUsed,
        ai_confidence_score: result.confidence_score,
        ai_defect_detected: result.defect_detected,
        ai_explanation: updated.ai_explanation,
        ai_improvement_suggestions: improvementSuggestions,
        status: 'in_review',
        human_validated: false,
        human_agrees_with_ai: null,
        human_corrected_label: '',
        human_feedback: '',
        validated_by: '',
        validated_at: null,
      });
      setFeedback('');
      setCorrectedLabel('');
      setEditMode(false);
      onUpdate(updated);
    } catch (e) {
      console.error('AI analysis error:', e);
    } finally {
      setAnalyzing(false);
      setChainStep(0);
    }
  };

  const handleValidate = async (agrees) => {
    setValidating(true);
    try {
      const me = await apiClient.auth.me();
      const updated = {
        ...entry,
        human_validated: true,
        human_agrees_with_ai: agrees,
        human_corrected_label: agrees ? '' : correctedLabel,
        human_feedback: feedback,
        validated_by: me?.email || '',
        validated_at: new Date().toISOString(),
        status: 'finalized',
      };
      await apiClient.entities.VisualInspectionEntry.update(entry.id, {
        human_validated: true,
        human_agrees_with_ai: agrees,
        human_corrected_label: agrees ? null : correctedLabel,
        human_feedback: feedback,
        validated_by: me?.email || '',
        validated_at: new Date().toISOString(),
        status: 'finalized',
      });
      onUpdate(updated);
      setFeedback('');
      setCorrectedLabel('');
    } catch (e) {
      console.error('Validation error:', e);
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tracability - single row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
        <div><span className="text-slate-400">Issue #:</span> <span className="font-mono font-semibold text-slate-700">{entry.issue_number}</span></div>
        <div><span className="text-slate-400">Batch:</span> <span className="font-mono text-slate-700">{entry.batch_number || '—'}</span></div>
        <div><span className="text-slate-400">Part Number:</span> <span className="font-semibold text-slate-700">{entry.part_number || '—'}</span></div>
        <div><span className="text-slate-400">Alias:</span> <span className="text-slate-700">{entry.part_alias || '—'}</span></div>
        <button onClick={handleDelete} disabled={deleting} className="ml-auto inline-flex items-center gap-1 text-xs h-7 px-2 rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50">
          {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete
        </button>
      </div>

      {/* Photos */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-slate-700">Photos ({entry.image_urls?.length || 0})</span>
            <label className={`inline-flex items-center gap-1 text-xs h-8 px-2 rounded-md border border-input bg-background hover:bg-accent cursor-pointer font-medium transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
              <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleUpload(e.target.files)} />
              <Upload className="w-3 h-3" /> Upload
            </label>
          </div>
          {entry.image_urls?.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {entry.image_urls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block w-24 h-24 rounded-lg overflow-hidden border border-slate-200 hover:border-blue-400 transition-colors">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">No photos uploaded.</p>
          )}
        </CardContent>
      </Card>

      {/* AI Analysis */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-slate-700">AI Inspection</span>
          </div>

          {/* Model + Button + Confidence - single row */}
          <div className="flex gap-2 items-center flex-wrap">
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="h-9 text-xs border border-input rounded-md px-2 bg-background min-w-[140px]"
            >
              {AI_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <Button onClick={handleAnalyze} disabled={analyzing || !entry.image_urls?.length} className="bg-blue-600 hover:bg-blue-700 h-9 text-xs">
              {analyzing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  {model === 'chain' && chainStep === 1 ? 'Flash...' : model === 'chain' && chainStep === 2 ? 'Claude verifying...' : 'Analyzing...'}
                </>
              ) : (
                <><Sparkles className="w-3.5 h-3.5 mr-1" /> Run AI</>
              )}
            </Button>
            {entry.ai_explanation && (
              <div className="flex-1 min-w-[120px]">
                <ConfidenceBar score={entry.ai_confidence_score} />
              </div>
            )}
          </div>

          {entry.ai_explanation && (
            <>
              <div className="space-y-1">
                <Label className="text-xs font-medium">AI Defect Detected</Label>
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${entry.ai_defect_detected ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  {entry.ai_defect_detected ? 'YES' : 'NO'}
                </span>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">AI Explanation</Label>
                <div className="bg-slate-50 rounded-md p-3 border border-slate-100">
                  <AiExplanationDisplay text={entry.ai_explanation} />
                </div>
              </div>
              {entry.ai_improvement_suggestions && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md p-3">
                  <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-amber-700">Improvement suggestions</span>
                    <p className="text-xs text-amber-800 whitespace-pre-wrap">{entry.ai_improvement_suggestions}</p>
                  </div>
                </div>
              )}
              {entry.ai_model_used && <p className="text-[10px] text-slate-400">Model used: {entry.ai_model_used}</p>}
            </>
          )}
        </CardContent>
      </Card>

      {/* Defect Description from Issue */}
      {defectDescription && (
        <Card>
          <CardContent className="p-4">
            <Label className="text-xs font-medium mb-1 block">Defect Description ({entry.issue_number})</Label>
            <div className="text-xs text-slate-600 bg-slate-50 rounded-md p-3 whitespace-pre-wrap border border-slate-100">{defectDescription}</div>
          </CardContent>
        </Card>
      )}

      {/* Human Validation */}
      {entry.ai_explanation && (!entry.human_validated || editMode) && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-semibold text-slate-700">{editMode ? 'Re-validate' : 'Manual Validation'}</span>
              {editMode && <Button onClick={() => setEditMode(false)} variant="ghost" className="h-6 text-xs ml-auto">Cancel</Button>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Correction (if AI was wrong)</Label>
              <Input value={correctedLabel} onChange={e => setCorrectedLabel(e.target.value)} placeholder="e.g. It's a shadow, not a defect" className="text-xs h-8" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Feedback for learning</Label>
              <Textarea value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Explanation for AI: what it missed, what context was missing..." className="text-xs resize-none" rows={2} />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => { handleValidate(true); setEditMode(false); }} disabled={validating} className="bg-green-600 hover:bg-green-700 flex-1 h-9 text-xs">
                <Check className="w-3.5 h-3.5 mr-1" /> Confirm AI
              </Button>
              <Button onClick={() => { handleValidate(false); setEditMode(false); }} disabled={validating} variant="destructive" className="flex-1 h-9 text-xs">
                <X className="w-3.5 h-3.5 mr-1" /> Reject AI
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validation result */}
      {entry.human_validated && !editMode && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-4 h-4 text-green-600" />
              <span className="text-sm font-semibold text-slate-700">Human Validated</span>
              <span className="ml-auto inline-flex items-center gap-1 text-xs bg-slate-100 border border-slate-200 rounded-md px-2 py-0.5 text-slate-600 font-medium">
                {currentUserName || entry.validated_by || '—'}
              </span>
              <Button onClick={() => { setCorrectedLabel(entry.human_corrected_label || ''); setFeedback(entry.human_feedback || ''); setEditMode(true); }} variant="ghost" className="h-7 w-7 p-0">
                <Pencil className="w-3.5 h-3.5 text-slate-500" />
              </Button>
            </div>
            <div className="text-xs text-slate-600 space-y-1">
              <p><span className="text-slate-400">Decision:</span> {entry.human_agrees_with_ai ? '✓ Agree with AI' : '✗ AI was wrong'}</p>
              {entry.human_corrected_label && <p><span className="text-slate-400">Correction:</span> {entry.human_corrected_label}</p>}
              {entry.human_feedback && <p><span className="text-slate-400">Feedback:</span> {entry.human_feedback}</p>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}