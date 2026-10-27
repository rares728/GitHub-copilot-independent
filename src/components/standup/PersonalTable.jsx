import React, { useState, useEffect, useRef, useCallback } from "react";

export const GROUPS = [
  { key: "production", label: "Production", bg: "#FFFFFF" },
  { key: "procese_speciale", label: "Special Processes", bg: "#FCE4D6" },
  { key: "qa", label: "QA", bg: "#DEEBF7" },
  { key: "log", label: "Logistics", bg: "#E2F0D9" },
  { key: "office", label: "Office", bg: "#E4DFEC" },
];

export const ROWS = [
  { key: "prod_total", group: "production", label: "Total Staff" },
  { key: "prod_co", group: "production", label: "Staff CO" },
  { key: "prod_cm", group: "production", label: "Staff CM" },
  { key: "prod_eficienta", group: "production", label: "Efficiency" },
  { key: "ps_total", group: "procese_speciale", label: "Total Staff" },
  { key: "ps_co", group: "procese_speciale", label: "Staff CO" },
  { key: "ps_cm", group: "procese_speciale", label: "Staff CM" },
  { key: "ps_eficienta", group: "procese_speciale", label: "Efficiency" },
  { key: "qa_total", group: "qa", label: "Total Staff" },
  { key: "qa_co", group: "qa", label: "Staff CO" },
  { key: "qa_cm", group: "qa", label: "Staff CM" },
  { key: "qa_eficienta", group: "qa", label: "Efficiency" },
  { key: "log_total", group: "log", label: "Total Staff" },
  { key: "log_co", group: "log", label: "Staff CO" },
  { key: "log_cm", group: "log", label: "Staff CM" },
  { key: "log_eficienta", group: "log", label: "Efficiency" },
  { key: "office_total", group: "office", label: "Total Staff" },
  { key: "office_co", group: "office", label: "Staff CO" },
  { key: "office_cm", group: "office", label: "Staff CM" },
  { key: "office_eficienta", group: "office", label: "Efficiency" },
];

// Rows that are editable (exclude Eficienta — read-only calculated)
const EDITABLE_ROWS = ROWS.filter((r) => r.label !== "Efficiency");

export const defaultPersonalDataJSON = () => JSON.stringify({});

export const countPersonalFilled = (jsonStr) => {
  if (!jsonStr) return 0;
  try {
    const parsed = JSON.parse(jsonStr);
    if (typeof parsed !== "object" || Array.isArray(parsed)) return 0;
    let sum = 0;
    for (const row of ROWS) {
      if (row.label === "Staff CO" || row.label === "Staff CM") {
        const val = parseFloat(parsed[row.key]?.value);
        if (!isNaN(val)) sum += val;
      }
    }
    return sum;
  } catch { return 0; }
};

function parseData(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    return {};
  } catch { return {}; }
}

const headerStyle = { border: "1px solid #000000", padding: "6px 8px", fontFamily: "Barlow, sans-serif", fontWeight: 700, fontSize: 18, color: "#101C34", background: "#EEF2F8", textAlign: "center" };
const labelCellStyle = { border: "1px solid #000000", padding: "4px 10px", fontFamily: "Barlow, sans-serif", fontWeight: 600, fontSize: 18, color: "#101C34", textAlign: "left", whiteSpace: "nowrap" };
const cellStyle = { border: "1px solid #000000", padding: 0 };
const inputStyle = { width: "100%", border: "none", outline: "none", padding: "5px 8px", fontFamily: "Barlow, sans-serif", fontWeight: 500, fontSize: 18, color: "#101C34", background: "transparent", boxSizing: "border-box" };

export default function PersonalTable({ value, onChange }) {
  const [data, setData] = useState(() => parseData(value));
  const inputRefs = useRef({});

  useEffect(() => {
    const parsed = parseData(value);
    if (JSON.stringify(parsed) !== JSON.stringify(data)) setData(parsed);
  }, [value]);

  const focusCell = useCallback((rowKey, field) => {
    const el = inputRefs.current[`${rowKey}-${field}`];
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  const handleKeyDown = useCallback((e, rowKey, field) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      const idx = EDITABLE_ROWS.findIndex((r) => r.key === rowKey);
      if (idx >= 0 && idx < EDITABLE_ROWS.length - 1) {
        focusCell(EDITABLE_ROWS[idx + 1].key, field);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const idx = EDITABLE_ROWS.findIndex((r) => r.key === rowKey);
      if (idx > 0) focusCell(EDITABLE_ROWS[idx - 1].key, field);
    } else if (e.key === "ArrowRight" && e.target.selectionStart === e.target.value.length) {
      e.preventDefault();
      const nextField = field === "value" ? "comentariu" : null;
      if (nextField) focusCell(rowKey, nextField);
    } else if (e.key === "ArrowLeft" && e.target.selectionStart === 0 && e.target.selectionEnd === 0) {
      e.preventDefault();
      const prevField = field === "comentariu" ? "value" : null;
      if (prevField) focusCell(rowKey, prevField);
    }
  }, [focusCell]);

  const updateData = (newData) => {
    setData(newData);
    onChange(JSON.stringify(newData));
  };

  const handleCellChange = (rowKey, field, val) => {
    const existing = data[rowKey] || {};
    updateData({ ...data, [rowKey]: { ...existing, [field]: val } });
  };

  // Build grouped rows for rendering
  const grouped = GROUPS.map((g) => ({
    ...g,
    rows: ROWS.filter((r) => r.group === g.key),
  }));

  const calcEficienta = (rowsInGroup, rowIndex) => {
    let totalIdx = -1;
    for (let i = rowIndex - 1; i >= 0; i--) {
      if (rowsInGroup[i].label.startsWith("Total")) { totalIdx = i; break; }
    }
    if (totalIdx === -1) return "";
    const totalValue = parseFloat((data[rowsInGroup[totalIdx].key] || {}).value) || 0;
    if (totalValue === 0) return "";
    let sum = 0;
    for (let i = totalIdx + 1; i < rowIndex; i++) {
      sum += parseFloat((data[rowsInGroup[i].key] || {}).value) || 0;
    }
    return Math.round((totalValue - sum) / totalValue * 100) + "%";
  };

  const eficientaColor = (pctStr) => {
    const val = parseInt(pctStr, 10);
    if (isNaN(val)) return "transparent";
    if (val <= 50) return "#EF4444";
    if (val < 80) return "#FBBF24";
    return "#22C55E";
  };

  return (
    <div style={{ border: "1.5px solid #000000", borderRadius: 4, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 520 }}>
          <colgroup>
            <col style={{ width: "8%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "60%" }} />
          </colgroup>
          <thead>
            <tr>
              <th colSpan={4} style={{ ...headerStyle, background: "#101C34", color: "#FFFFFF", fontSize: 18, padding: "8px" }}>
                Staff shortage and assessed impact
              </th>
            </tr>
            <tr>
              <th style={headerStyle}>Group</th>
              <th style={headerStyle}>Category</th>
              <th style={headerStyle}>Staff</th>
              <th style={headerStyle}>Comments</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((g) =>
              g.rows.map((row, idx) => {
                const cellData = data[row.key] || {};
                const isFirstInGroup = idx === 0;
                const isEficienta = row.label === "Efficiency";
                const eficientaBorder = isEficienta ? { borderBottom: "7px double #101C34" } : {};
                return (
                  <tr key={row.key}>
                    {isFirstInGroup ? (
                      <td
                        rowSpan={g.rows.length}
                        style={{
                          ...labelCellStyle,
                          ...eficientaBorder,
                          background: g.bg,
                          textAlign: "center",
                          verticalAlign: "middle",
                          writingMode: "vertical-rl",
                          transform: "rotate(180deg)",
                          fontWeight: 700,
                          fontSize: 18,
                          letterSpacing: 0.5,
                        }}
                      >
                        {g.label}
                      </td>
                    ) : null}
                    <td style={{ ...labelCellStyle, ...eficientaBorder, background: g.bg }}>{row.label}</td>
                    <td style={{ ...cellStyle, ...eficientaBorder, background: g.bg }}>
                      {isEficienta ? (
                        (() => {
                          const pctStr = calcEficienta(g.rows, idx);
                          const bgColor = eficientaColor(pctStr);
                          return (
                            <span style={{ display: "block", padding: "5px 8px", fontFamily: "Barlow, sans-serif", fontWeight: 700, fontSize: 18, color: bgColor !== "transparent" ? "#FFFFFF" : "#101C34", textAlign: "center", background: bgColor, borderRadius: 0 }}>
                              {pctStr}
                            </span>
                          );
                        })()
                      ) : (
                        <input
                          ref={(el) => { inputRefs.current[`${row.key}-value`] = el; }}
                          type="text"
                          value={cellData.value || ""}
                          onChange={(e) => handleCellChange(row.key, "value", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, row.key, "value")}
                          style={inputStyle}
                        />
                      )}
                    </td>
                    <td style={{ ...cellStyle, ...eficientaBorder, background: g.bg }}>
                      <input
                        ref={(el) => { inputRefs.current[`${row.key}-comentariu`] = el; }}
                        type="text"
                        value={cellData.comentariu || ""}
                        onChange={(e) => handleCellChange(row.key, "comentariu", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, row.key, "comentariu")}
                        style={inputStyle}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}