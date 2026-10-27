import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { fetchPartNumberAlias } from "@/components/issues/picklists";

const COLUMNS = [
  { key: "pn_blocat", label: "Blocked P/N" },
  { key: "alias", label: "Alias" },
  { key: "mat_lipsa", label: "Missing Mat." },
  { key: "actiune", label: "Action" },
  { key: "ref_solutie", label: "Ref Solution" },
  { key: "decizie", label: "Decision" },
  { key: "responsabil", label: "Responsible" },
  { key: "termen", label: "Due Date" },
];

const COL_WIDTHS = ["5%", "3.5%", "13%", "26%", "13%", "13%", "6.5%", "6.5%", "4%"];

export const createEmptyRow = () => {
  const row = COLUMNS.reduce((acc, col) => { acc[col.key] = ""; return acc; }, {});
  row.responsabil_name = "";
  return row;
};
export const defaultMaterialeRowsJSON = () => JSON.stringify([]);

const DECIZIE_OPTIONS = ["Required", "Improvement", "Postponed"];

// Count rows in a Materiale JSON string where decizie === "Necesar"
export const countNecesarRows = (jsonStr) => {
  if (!jsonStr) return 0;
  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return 0;
    return parsed.filter((r) => r && (r.decizie === "Required" || r.decizie === "Necesar")).length;
  } catch { return 0; }
};

function parseRows(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map((r) => {
      const row = { ...createEmptyRow(), ...r };
      // Backward compat: migrate solutie → actiune
      if (r.solutie !== undefined && !row.actiune) row.actiune = r.solutie;
      return row;
    });
    return [];
  } catch {
    return [];
  }
}

const headerStyle = { border: "1px solid #C7D5EA", padding: "6px 8px", fontFamily: "Barlow, sans-serif", fontWeight: 700, fontSize: 18, color: "#4A6494", background: "#EEF2F8", textTransform: "uppercase", letterSpacing: 0.3, textAlign: "left", whiteSpace: "nowrap" };
const cellStyle = { border: "1px solid #D8E2F0", padding: 0 };
const inputStyle = { width: "100%", border: "none", outline: "none", padding: "5px 8px", fontFamily: "Barlow, sans-serif", fontWeight: 500, fontSize: 18, color: "#101C34", background: "transparent", boxSizing: "border-box" };

function PnSelector({ value, partNumberData, onSelect }) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  useEffect(() => { setQuery(value || ""); }, [value]);

  const updateCoords = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 2, left: rect.left });
    }
  };

  useEffect(() => {
    updateCoords();
    window.addEventListener("scroll", updateCoords, true);
    window.addEventListener("resize", updateCoords);
    return () => {
      window.removeEventListener("scroll", updateCoords, true);
      window.removeEventListener("resize", updateCoords);
    };
  }, []);

  const filtered = query.trim()
    ? partNumberData.filter((r) => r.partNumber.toLowerCase().includes(query.toLowerCase()))
    : partNumberData;

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); onSelect(e.target.value, null); updateCoords(); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onScroll={updateCoords}
        placeholder="Select..."
        style={inputStyle}
      />
      {open && filtered.length > 0 && createPortal(
        <div style={{ position: "fixed", zIndex: 9999, top: coords.top, left: coords.left, minWidth: 140, background: "#FFFFFF", border: "1px solid #D8E2F0", borderRadius: 6, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", maxHeight: 180, overflowY: "auto" }}>
          {filtered.slice(0, 80).map((item) => (
            <button
              key={item.partNumber}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onSelect(item.partNumber, item.alias); setOpen(false); }}
              style={{ width: "100%", textAlign: "left", padding: "5px 8px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "Barlow, sans-serif", fontSize: 11, display: "flex", justifyContent: "space-between", gap: 6 }}
            >
              <span style={{ fontWeight: 600, color: "#101C34" }}>{item.partNumber}</span>
              {item.alias && <span style={{ color: "#9CB3D0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.alias}</span>}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

export default function MaterialeTable({ value, onChange, userOptions = [] }) {
  const [rows, setRows] = useState(() => parseRows(value));
  const [partNumberData, setPartNumberData] = useState([]);

  // Sync internal state when value changes externally (e.g. "Copy last day")
  useEffect(() => {
    const parsed = parseRows(value);
    const currentJSON = JSON.stringify(rows);
    const newJSON = JSON.stringify(parsed);
    if (currentJSON !== newJSON) setRows(parsed);
  }, [value]);

  useEffect(() => { fetchPartNumberAlias().then(setPartNumberData); }, []);

  const updateRows = (newRows) => {
    setRows(newRows);
    onChange(JSON.stringify(newRows));
  };

  const handleCellChange = (rowIdx, colKey, cellValue) => {
    updateRows(rows.map((r, i) => (i === rowIdx ? { ...r, [colKey]: cellValue } : r)));
  };

  const handlePnSelect = (rowIdx, pn, alias) => {
    updateRows(rows.map((r, i) => (i === rowIdx ? { ...r, pn_blocat: pn, alias: alias !== null ? alias : r.alias } : r)));
  };

  const handleResponsabilChange = (rowIdx, email) => {
    const opt = userOptions.find((o) => o.email === email);
    updateRows(rows.map((r, i) => (i === rowIdx ? { ...r, responsabil: email, responsabil_name: opt ? opt.label : "" } : r)));
  };

  const addRow = () => updateRows([...rows, createEmptyRow()]);

  const deleteRow = (rowIdx) => {
    updateRows(rows.filter((_, i) => i !== rowIdx));
  };

  return (
    <div style={{ border: "1.5px solid #D8E2F0", borderRadius: 7, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 760 }}>
          <colgroup>
            {COL_WIDTHS.map((w, i) => <col key={i} style={{ width: w }} />)}
          </colgroup>
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.key} style={headerStyle}>{col.label}</th>
              ))}
              <th style={{ ...headerStyle, textAlign: "center", width: "4%" }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {COLUMNS.map((col) => (
                  <td key={col.key} style={cellStyle}>
                    {col.key === "pn_blocat" ? (
                      <PnSelector
                        value={row.pn_blocat || ""}
                        partNumberData={partNumberData}
                        onSelect={(pn, alias) => handlePnSelect(rowIdx, pn, alias)}
                      />
                    ) : col.key === "alias" ? (
                      <input
                        type="text"
                        value={row.alias || ""}
                        readOnly
                        placeholder="Auto"
                        style={{ ...inputStyle, color: "#64748B", background: "#F1F5F9" }}
                      />
                    ) : col.key === "decizie" ? (
                      <select
                        value={row.decizie || ""}
                        onChange={(e) => handleCellChange(rowIdx, "decizie", e.target.value)}
                        style={{ ...inputStyle, cursor: "pointer", color: row.decizie ? "#101C34" : "#9CB3D0" }}
                      >
                        <option value="">Select...</option>
                        {DECIZIE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : col.key === "responsabil" ? (
                      <select
                        value={row.responsabil || ""}
                        onChange={(e) => handleResponsabilChange(rowIdx, e.target.value)}
                        style={{ ...inputStyle, cursor: "pointer", color: row.responsabil ? "#101C34" : "#9CB3D0" }}
                      >
                        <option value="">Select...</option>
                        {userOptions.map((u) => <option key={u.email} value={u.email}>{u.label}</option>)}
                      </select>
                    ) : col.key === "termen" ? (
                      <input
                        type="date"
                        value={row.termen || ""}
                        onChange={(e) => handleCellChange(rowIdx, "termen", e.target.value)}
                        style={{ ...inputStyle, cursor: "pointer", color: row.termen ? "#101C34" : "#9CB3D0" }}
                      />
                    ) : (
                      <input
                        type="text"
                        value={row[col.key] || ""}
                        onChange={(e) => handleCellChange(rowIdx, col.key, e.target.value)}
                        style={inputStyle}
                      />
                    )}
                  </td>
                ))}
                <td style={{ ...cellStyle, textAlign: "center" }}>
                  <button
                    type="button"
                    onClick={() => deleteRow(rowIdx)}
                    style={{ border: "none", background: "transparent", cursor: "pointer", color: "#EF4444", fontWeight: 700, fontSize: 16, width: "100%", height: 28, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                    title="Delete row"
                  >
                    −
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: "6px 8px", background: "#F8FAFC", borderTop: "1px solid #D8E2F0", display: "flex", justifyContent: "flex-start" }}>
        <button
          type="button"
          onClick={addRow}
          style={{ background: "#F39201", color: "#FFFFFF", border: "none", borderRadius: 6, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}