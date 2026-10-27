import React from 'react';
const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-slate-100 text-slate-600' },
  in_review: { label: 'In Review', color: 'bg-yellow-100 text-yellow-700' },
  finalized: { label: 'Finalized', color: 'bg-green-100 text-green-700' },
};

function ConfidenceBadge({ score }) {
  if (score === undefined || score === null) return <span className="text-slate-300 text-xs">—</span>;
  const pct = Math.round(score * 100);
  const color = pct >= 95 ? 'text-green-600' : pct >= 70 ? 'text-yellow-600' : 'text-red-600';
  return <span className={`text-xs font-bold ${color}`}>{pct}%</span>;
}

export default function InspectionTable({ entries, onSelect, selectedId }) {
  if (!entries || entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-slate-400 text-sm">No visual inspection entries found.</p>
        <p className="text-slate-300 text-xs mt-1">The AI trigger from the Issues page will automatically create entries here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="text-left py-1.5 px-2 font-semibold text-slate-500 text-xs whitespace-nowrap">Issue</th>
            <th className="text-left py-1.5 px-2 font-semibold text-slate-500 text-xs whitespace-nowrap">Part</th>
            <th className="text-center py-1.5 px-1 font-semibold text-slate-500 text-xs whitespace-nowrap">AI</th>
            <th className="text-center py-1.5 px-1 font-semibold text-slate-500 text-xs whitespace-nowrap">✓</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {entries.map(e => {
            const isSelected = e.id === selectedId;
            return (
              <tr
                key={e.id}
                onClick={() => onSelect(e)}
                className={`cursor-pointer hover:bg-blue-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}
              >
                <td className="py-1.5 px-2 font-mono font-semibold text-slate-700 text-xs whitespace-nowrap">{e.issue_number}</td>
                <td className="py-1.5 px-2 text-slate-600 text-xs whitespace-nowrap">{e.part_number || '—'}</td>
                <td className="py-1.5 px-1 text-center whitespace-nowrap"><ConfidenceBadge score={e.ai_confidence_score} /></td>
                <td className="py-1.5 px-1 text-center whitespace-nowrap">
                  {e.human_validated ? <span className="text-green-600 text-xs">✓</span> : <span className="text-slate-300 text-xs">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}