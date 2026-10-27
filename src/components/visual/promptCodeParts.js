import { apiClient } from '@/api/client';

/**
 * Prompt fragments injected from CODE (not editable from UI).
 * Both InspectionDetail.jsx (runtime) and AiPromptEditor.jsx (display) use this module,
 * so what you see in the Learning Module reflects exactly what the LLM receives at runtime.
 */

// --- 1. Photo interpretation hint (dynamic, based on parts_to_analyze vs photo count) ---
export function buildPhotoHint(photoCount, partsCount) {
  if (partsCount == null || photoCount <= 0) return '';
  if (partsCount === 1) {
    return `\n\nIMPORTANT — Photo interpretation: There is a single part in "Parts to Analyze". All ${photoCount} photos show the SAME issue from different angles. Analyze them as a single part with a single defect seen from multiple perspectives.`;
  } else if (photoCount === partsCount) {
    return `\n\nIMPORTANT — Photo interpretation: The number of photos (${photoCount}) equals the number of parts in "Parts to Analyze" (${partsCount}). Each photo shows an INDIVIDUAL defect, possibly from different categories. Analyze each photo as a separate defect and describe them all.`;
  } else {
    return `\n\nIMPORTANT — Photo interpretation: There are ${photoCount} photos for ${partsCount} parts in "Parts to Analyze". Each photo may show an individual defect or the same defect from different angles — carefully evaluate the context of each image.`;
  }
}

// --- 2. Chain verification instructions (added only in 'chain' mode, step 2 Claude) ---
export const CHAIN_VERIFY_INSTRUCTIONS = `--- PRELIMINARY ANALYSIS (Gemini Flash) ---
[Gemini analysis summary auto-injected]

Review and correct this preliminary analysis. You are the final expert in visual inspection for aviation parts. If the Gemini analysis is correct, confirm it. If it is wrong, correct it. Provide your final analysis.`;

// --- 3. Mandatory JSON schema (response_json_schema sent to LLM) ---
export const RESULT_SCHEMA_TEXT = `The response MUST be valid JSON with the following fields:
  • defect_detected (boolean) — true if a defect exists, false if the part is conforming
  • defect_type (string) — the type of defect identified
  • estimated_size (string) — estimated size of the defect
  • confidence_score (number 0.0–1.0) — confidence score; below 0.7 if unclear
  • explanation (string, English) — detailed description referencing the position on the part
  • recommendation (string) — recommended action
  • improvement_suggestions (string, English) — ONLY when confidence_score < 0.85: specific, actionable instructions for the human inspector on how to improve the input (photo quality, angle, lighting, additional views, missing context) so the next analysis can reach a higher confidence score. Be concrete (e.g. "Re-take photo with diffused lighting to remove glare", "Add a side-view photo showing the hole pattern"). Leave empty string when confidence_score >= 0.85.

Required fields: defect_detected, defect_type, confidence_score, explanation, recommendation, improvement_suggestions.`;

// --- 4. Learned corrections — 2-layer approach (scalable to thousands of corrections) ---
// Layer 1: Compact LLM-generated "Lessons Learned" summary (always present, ~500 tokens regardless of correction count)
// Layer 2: Top 3-5 most relevant raw corrections (smart-filtered by Part Number + client match)
export async function fetchLearnedCorrections(client, partNumber) {
  try {
    // --- Layer 1: Fetch the compact lessons summary ---
    let summaryText = '';
    try {
      const summaries = await apiClient.entities.AiLearnedLessons.list('-generated_at', 1);
      if (summaries?.length && summaries[0].summary_text) {
        summaryText = `\n\nLESSONS LEARNED (compiled from ${summaries[0].corrections_count} past human corrections):\n${summaries[0].summary_text}`;
      }
    } catch (e) {
      console.error('Fetch lessons summary error:', e);
    }

    // --- Layer 2: Fetch top 3-5 most relevant raw corrections (smart filtering) ---
    const all = await apiClient.entities.VisualInspectionEntry.filter(
      { human_validated: true, human_agrees_with_ai: false },
      '-validated_at',
      50
    );
    const corrections = (all || []).filter(e =>
      (e.human_corrected_label && e.human_corrected_label.trim()) ||
      (e.human_feedback && e.human_feedback.trim())
    );

    let rawText = '';
    if (corrections.length > 0) {
      // Relevance scoring: same Part Number = highest priority, same client = medium, else low
      const scored = corrections.map(e => {
        let score = 0;
        if (partNumber && e.part_number && e.part_number === partNumber) score += 100;
        if (client && e.client && e.client === client) score += 10;
        return { entry: e, score };
      });
      scored.sort((a, b) => b.score - a.score);

      const top = scored.slice(0, 5).map(s => s.entry);

      const lines = top.map((e, i) => {
        const parts = [`${i + 1}. Part: ${e.part_number || '—'}, Client: ${e.client || '—'}`];
        if (e.human_corrected_label) parts.push(`   Human correction: ${e.human_corrected_label}`);
        if (e.human_feedback) parts.push(`   Feedback: ${e.human_feedback}`);
        return parts.join('\n');
      });

      rawText = `\n\nRECENT RELEVANT CORRECTIONS — Specific examples the AI got wrong (prioritized by same part/client):\n${lines.join('\n')}`;
    }

    return summaryText + rawText;
  } catch (e) {
    console.error('Fetch learned corrections error:', e);
    return '';
  }
}

// --- Sections for display in Learning Module ---
export const CODE_SECTIONS = [
  {
    id: 'photo_hint',
    title: 'Photo interpretation hint',
    description: 'Injected dynamically based on the number of photos vs. Parts to Analyze from the Issue. Added automatically at the end of the prompt on every AI run.',
    logic: 'If Parts to Analyze = 1 → all photos = same issue from different angles.\nIf photo count = Parts to Analyze → each photo = individual defect, possibly from different categories.\nOtherwise → evaluate the context of each image.',
  },
  {
    id: 'chain_verify',
    title: 'Chain verification (Chain mode only)',
    description: 'Added only in step 2 of Chain mode (Flash → Claude). Claude receives the Gemini analysis summary and must confirm or correct it.',
    content: CHAIN_VERIFY_INSTRUCTIONS,
  },
  {
    id: 'result_schema',
    title: 'Mandatory JSON schema',
    description: 'Sent as response_json_schema to the LLM. All models must return exactly these fields.',
    content: RESULT_SCHEMA_TEXT,
  },
  {
    id: 'learned_corrections',
    title: 'Learned corrections — 2-layer (scalable)',
    description: 'Layer 1: A compact LLM-generated "Lessons Learned" summary (~500 tokens) compiled from ALL past corrections — scales to thousands without growing the prompt. Layer 2: Top 3-5 most relevant raw corrections, smart-filtered by Part Number and client match. Both are injected automatically on every AI run.',
    logic: 'Layer 1: Fetches the latest AiLearnedLessons summary (regenerated periodically by the backend function "regenerateLearnedLessons"). Always present if corrections exist.\nLayer 2: Fetches up to 50 recent corrections, scores by relevance (same Part Number = +100, same client = +10), takes top 5. Added after the summary.',
  },
];