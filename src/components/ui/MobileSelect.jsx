import React from 'react';

export function MobileSelectItem({ value, label }) {
  return null;
}

export default function MobileSelect({ value, onValueChange, placeholder, items, triggerClassName }) {
  const safeItems = (items || []).filter((i) => i.value != null);

  // Use native <select> only - no Radix, no drawer
  return (
    <select
      value={value || ''}
      onChange={(e) => onValueChange(e.target.value)} className="bg-background text-foreground mt-1 pt-1 pr-3 pb-1 pl-3 text-sm rounded-md border border-input shadow-sm cursor-pointer h-8">

      
      {placeholder && <option value="">{placeholder}</option>}
      {safeItems.map((i) =>
      <option key={String(i.value)} value={String(i.value)}>
          {i.label}
        </option>
      )}
    </select>);

}