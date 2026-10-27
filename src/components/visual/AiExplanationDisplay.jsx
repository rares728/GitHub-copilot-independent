import React from 'react';

/**
 * Renders the AI explanation with the "Tip defect detectat:" section
 * displayed in bold and 10% larger font, while the rest remains normal size.
 */
export default function AiExplanationDisplay({ text }) {
  if (!text) return null;

  const hasSummary = text.trim().startsWith('Tip defect detectat:');
  if (!hasSummary) {
    return <div className="text-xs text-slate-600 whitespace-pre-wrap">{text}</div>;
  }

  const lines = text.split('\n');
  const summaryLines = [];
  const restLines = [];
  let inSummary = true;

  for (const line of lines) {
    if (inSummary) {
      summaryLines.push(line);
      if (line.trim().startsWith('Dimensiuni')) {
        inSummary = false;
      }
    } else {
      restLines.push(line);
    }
  }

  // Trim leading blank lines from the rest
  while (restLines.length > 0 && restLines[0].trim() === '') {
    restLines.shift();
  }

  const summaryText = summaryLines.join('\n');
  const restText = restLines.join('\n');

  return (
    <div className="space-y-2">
      {summaryText && (
        <div className="font-bold text-slate-800 whitespace-pre-wrap" style={{ fontSize: '13px' }}>
          {summaryText}
        </div>
      )}
      {restText && (
        <div className="text-xs text-slate-600 whitespace-pre-wrap">{restText}</div>
      )}
    </div>
  );
}