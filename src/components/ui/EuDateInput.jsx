import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { CalendarIcon } from 'lucide-react';

/**
 * A date input that displays in DD/MM/YYYY format (European).
 * Stores/emits value as YYYY-MM-DD (ISO).
 * Includes a calendar icon that opens a native date picker.
 */
export default function EuDateInput({ value, onChange, className, placeholder = 'DD/MM/YYYY', ...rest }) {
  const [display, setDisplay] = useState('');
  const hiddenRef = useRef();

  const isoToDisplay = (iso) => {
    if (!iso) return '';
    const parts = iso.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return iso;
  };

  const displayToIso = (disp) => {
    const parts = disp.split('/');
    if (parts.length === 3 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
    }
    return '';
  };

  useEffect(() => {
    setDisplay(isoToDisplay(value));
  }, [value]);

  const handleTextChange = (e) => {
    let raw = e.target.value;
    raw = raw.replace(/[^0-9/]/g, '');
    if (raw.length === 2 && display.length === 1) raw = raw + '/';
    if (raw.length === 5 && display.length === 4) raw = raw + '/';
    if (raw.length > 10) raw = raw.slice(0, 10);
    setDisplay(raw);
    const iso = displayToIso(raw);
    if (iso && onChange) onChange({ target: { value: iso } });
    else if (!raw && onChange) onChange({ target: { value: '' } });
  };

  const handleBlur = () => {
    const iso = displayToIso(display);
    if (iso) setDisplay(isoToDisplay(iso));
    else if (display && display.length < 10) setDisplay('');
  };

  const handleCalendarChange = (e) => {
    const iso = e.target.value;
    if (iso && onChange) onChange({ target: { value: iso } });
    else if (!iso && onChange) onChange({ target: { value: '' } });
  };

  return (
    <div className={cn('relative flex items-center', className)}>
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleTextChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={cn(
          'flex h-full w-full rounded-md border border-input bg-transparent pl-3 pr-8 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'
        )}
        {...rest}
      />
      {/* Hidden native date input triggered by calendar icon */}
      <input
        ref={hiddenRef}
        type="date"
        value={value || ''}
        onChange={handleCalendarChange}
        className="absolute right-2 top-0 bottom-0 w-5 opacity-0 cursor-pointer"
        tabIndex={-1}
      />
      <CalendarIcon
        className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
      />
    </div>
  );
}