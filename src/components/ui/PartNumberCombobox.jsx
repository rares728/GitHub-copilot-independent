import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { ChevronDown, X } from 'lucide-react';

/**
 * Searchable combobox that:
 * - Shows filtered options as user types
 * - Auto-fills alias when a match is selected
 */
export default function PartNumberCombobox({ value, onChange, partNumberData, placeholder = 'Select or type...', className = '' }) {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const containerRef = useRef();

  // Sync query when value changes externally
  useEffect(() => { setQuery(value || ''); }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query.trim()
    ? partNumberData.filter(r => r.partNumber.toLowerCase().includes(query.toLowerCase()))
    : partNumberData;

  const handleSelect = (item) => {
    setQuery(item.partNumber);
    onChange(item.partNumber, item.alias);
    setOpen(false);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setOpen(true);
  };

  const handleClear = () => {
    setQuery('');
    onChange('', '');
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Input
          value={query}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="text-xs sm:text-sm h-8 sm:h-9 pr-6"
        />
        {query ? (
          <button type="button" onClick={handleClear} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="w-3 h-3" />
          </button>
        ) : (
          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
        )}
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {filtered.slice(0, 80).map((item) => (
            <button
              key={item.partNumber}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(item); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 flex justify-between gap-2"
            >
              <span className="font-mono font-semibold text-slate-800">{item.partNumber}</span>
              {item.alias && <span className="text-slate-400 truncate">{item.alias}</span>}
            </button>
          ))}
          {filtered.length > 80 && (
            <div className="px-3 py-2 text-xs text-slate-400">Type more to narrow results…</div>
          )}
        </div>
      )}
    </div>
  );
}