import React from 'react';
import { Badge } from '@/components/ui/badge';

const STATUS_CONFIG = {
  new:                  { label: 'New',                 className: 'animate-blink-orange text-black border-orange-400' },
  on_hold:              { label: 'On Hold',             className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  rcca:                 { label: 'RCCA',                className: 'bg-blue-100 text-blue-700 border-blue-200' },
  closed:               { label: 'Closed',              className: 'bg-green-100 text-green-700 border-green-200' },
  // legacy RCCA sub-stages map to RCCA
  containment:          { label: 'RCCA',                className: 'bg-blue-100 text-blue-700 border-blue-200' },
  root_cause_analysis:  { label: 'RCCA',                className: 'bg-blue-100 text-blue-700 border-blue-200' },
  corrective_action:    { label: 'RCCA',                className: 'bg-blue-100 text-blue-700 border-blue-200' },
  verification:         { label: 'RCCA',                className: 'bg-blue-100 text-blue-700 border-blue-200' },
  reported:             { label: 'New',                 className: 'animate-blink-orange text-black border-orange-400' },
  assigned:             { label: 'New',                 className: 'animate-blink-orange text-black border-orange-400' },
};

const SEVERITY_CONFIG = {
  critical: { label: 'Critical', className: 'bg-red-600 text-white border-red-700' },
  high:     { label: 'High',     className: 'bg-red-100 text-red-700 border-red-200' },
  medium:   { label: 'Medium',   className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  low:      { label: 'Low',      className: 'bg-green-100 text-green-700 border-green-200' },
};

const TYPE_CONFIG = {
  defect:   { label: 'Defect',    className: 'bg-red-50 text-red-600 border-red-100' },
  downtime: { label: 'Downtime',  className: 'bg-orange-50 text-orange-600 border-orange-100' },
  safety:   { label: 'Safety',    className: 'bg-pink-50 text-pink-600 border-pink-100' },
  quality:  { label: 'Quality',   className: 'bg-blue-50 text-blue-600 border-blue-100' },
  process:  { label: 'Process',   className: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
  other:    { label: 'Other',     className: 'bg-gray-50 text-gray-600 border-gray-100' },
};

export function StatusBadge({ status, feedbackPending }) {
  const c = STATUS_CONFIG[status] || { label: status, className: '' };
  const extra = feedbackPending ? 'animate-blink-orange border-orange-400' : c.className;
  return (
    <Badge variant="outline" className={`text-xs font-medium ${feedbackPending ? extra : c.className}`}>
      {c.label}{feedbackPending ? ' 💬' : ''}
    </Badge>
  );
}

export function SeverityBadge({ severity }) {
  const c = SEVERITY_CONFIG[severity] || { label: severity, className: '' };
  return <Badge variant="outline" className={`text-xs font-medium ${c.className}`}>{c.label}</Badge>;
}

export function TypeBadge({ type }) {
  const c = TYPE_CONFIG[type] || { label: type, className: '' };
  return <Badge variant="outline" className={`text-xs font-medium ${c.className}`}>{c.label}</Badge>;
}