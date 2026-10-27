import React, { useState, useEffect } from 'react';
import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2, Save, RotateCcw, Code2, BookOpen, Pencil } from 'lucide-react';
import { CODE_SECTIONS } from './promptCodeParts';

const OWNER_USERNAME = 'Rares728';

const DEFAULT_PROMPT = `You are an expert in visual inspection for aviation parts (machining).
Analyze the attached photos for the part with Part Number: {part_number}, Alias: {part_alias}.
Batch: {batch_number}.

Examine each photo carefully. Look for: scratches, cracks, burrs, oxidation, tool marks, deformations, or other surface defects.

Be objective. If you cannot clearly determine a defect, the confidence score must be below 0.7.

The "explanation" field must contain a detailed description in English of your observations, referencing the position on the part.`;

export async function fetchAiPrompt() {
  try {
    const list = await apiClient.entities.AiPromptConfig.list('-updated_date', 1);
    if (list?.length) return list[0].prompt_text;
  } catch (e) {
    console.error('Fetch AI prompt error:', e);
  }
  return DEFAULT_PROMPT;
}

const SUMMARY_TITLE = '__client_summary__';

async function fetchSummariesPreview() {
  try {
    const list = await apiClient.entities.InspectionStandard.filter(
      { title: SUMMARY_TITLE },
      '-updated_date',
      50
    );
    return (list || []).filter(s => s.technical_summary).map(s => ({ folder: s.client_folder, text: s.technical_summary }));
  } catch (e) {
    console.error('Fetch summaries preview error:', e);
    return [];
  }
}

export default function AiPromptEditor() {
  const [prompt, setPrompt] = useState('');
  const [configId, setConfigId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [summaries, setSummaries] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const me = await apiClient.auth.me();
        setIsOwner((me?.full_name || '').toLowerCase() === OWNER_USERNAME.toLowerCase());
        const list = await apiClient.entities.AiPromptConfig.list('-updated_date', 1);
        if (list?.length) {
          setPrompt(list[0].prompt_text);
          setConfigId(list[0].id);
        } else {
          setPrompt(DEFAULT_PROMPT);
        }
        setSummaries(await fetchSummariesPreview());
      } catch (e) {
        setPrompt(DEFAULT_PROMPT);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const me = await apiClient.auth.me();
      if (configId) {
        await apiClient.entities.AiPromptConfig.update(configId, { prompt_text: prompt, updated_by: me?.email || '' });
      } else {
        const created = await apiClient.entities.AiPromptConfig.create({ prompt_text: prompt, updated_by: me?.email || '' });
        setConfigId(created.id);
      }
    } catch (e) {
      console.error('Save prompt error:', e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-5 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading prompt...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-slate-700">AI Visual Analysis Prompt — Full Structure</span>
          </div>
          <p className="text-xs text-slate-500">
            The final prompt sent to the LLM is composed of 3 parts. See each section below. At runtime, these are concatenated automatically.
          </p>
        </CardContent>
      </Card>

      {/* === SECTION 1: Code (read-only, no editing) === */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700">Part 1 — Code-injected fragment</span>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 bg-slate-100 border border-slate-200 rounded-md px-1.5 py-0.5 ml-auto">
              Read-only (all)
            </span>
          </div>
          <p className="text-xs text-slate-500">
            These fragments are generated from source code ({'{src/components/visual/promptCodeParts.js}'}) and CANNOT be edited from the UI — not even by the owner. They update automatically on every AI run. The display below reflects exactly what the LLM receives.
          </p>
          <div className="space-y-2">
            {CODE_SECTIONS.map((sec) => (
              <div key={sec.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">{sec.title}</span>
                </div>
                <p className="text-[10px] text-slate-500">{sec.description}</p>
                {sec.logic && (
                  <pre className="text-[10px] text-slate-600 whitespace-pre-wrap bg-white border border-slate-200 rounded p-2">{sec.logic}</pre>
                )}
                {sec.content && (
                  <pre className="text-[10px] text-slate-600 whitespace-pre-wrap bg-white border border-slate-200 rounded p-2">{sec.content}</pre>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* === SECTION 2: Technical summaries === */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-semibold text-slate-700">Part 2 — Technical summaries (auto-injected)</span>
            <span className="text-[10px] font-medium text-amber-600 bg-amber-100 border border-amber-200 rounded-md px-1.5 py-0.5 ml-auto">Edit from the "Standards" tab</span>
          </div>
          <p className="text-xs text-slate-500">
            These summaries are automatically added to the prompt when you run AI. General applies to any Part Number; others only if the part belongs to that client. The AI is instructed to use ONLY the defect type names defined here (e.g. "SCRATCH", "CRACK") for the "defect_type" field — do not use generic names.
          </p>
          {summaries.length === 0 ? (
            <p className="text-[10px] text-slate-400 italic">No technical summaries saved.</p>
          ) : (
            <div className="space-y-1.5">
              {summaries.map((s, i) => (
                <div key={i} className="rounded border border-amber-200 bg-white p-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">{s.folder}</span>
                    <span className="text-[10px] text-slate-400">{s.text.length} characters</span>
                  </div>
                  <p className="text-[10px] text-slate-600 whitespace-pre-wrap max-h-80 overflow-y-auto">{s.text}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* === SECTION 3: Editable prompt === */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-slate-700">Part 3 — Editable prompt</span>
            <span className={`text-[10px] font-medium rounded-md px-1.5 py-0.5 ml-auto ${isOwner ? 'text-blue-600 bg-blue-50 border border-blue-200' : 'text-slate-400 bg-slate-100 border border-slate-200'}`}>
              {isOwner ? 'Editable (owner)' : 'Read-only'}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            This prompt is loaded dynamically on every AI analysis. Available variables: <code className="bg-slate-100 px-1 rounded">{'{part_number}'}</code>, <code className="bg-slate-100 px-1 rounded">{'{part_alias}'}</code>, <code className="bg-slate-100 px-1 rounded">{'{batch_number}'}</code>.
          </p>
          <Textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            disabled={!isOwner}
            rows={12}
            className="text-xs font-mono resize-y"
            placeholder={DEFAULT_PROMPT}
          />
          {isOwner ? (
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 h-9 text-xs">
                {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Saving...</> : <><Save className="w-3.5 h-3.5 mr-1" /> Save</>}
              </Button>
              <Button onClick={() => setPrompt(DEFAULT_PROMPT)} variant="outline" className="h-9 text-xs">
                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset default
              </Button>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">Only the owner can edit this prompt.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}