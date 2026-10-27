import React, { useEffect, useRef } from "react";

export default function MonthSelector({ months, selectedKey, onSelect, monthlyAverages = {} }) {
  const selectedRef = useRef(null);

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
    }
  }, [selectedKey]);

  return (
    <div
      className="month-selector-scroll"
      style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        padding: "10px 16px",
        background: "#1B2E50",
        scrollbarWidth: "thin",
      }}
    >
      {months.map((m) => {
        const isActive = m.key === selectedKey;
        const getScoreColor = (score) => {
          if (score >= 95) return "#22C55E";
          if (score > 90) return "#FCD34D";
          return "#EF4444";
        };
        const monthAvg = monthlyAverages[m.key];
        const bgColor = isActive ? "#F39201" : (monthAvg !== undefined && monthAvg !== null ? getScoreColor(monthAvg) : "transparent");
        return (
          <button
            key={m.key}
            ref={isActive ? selectedRef : null}
            onClick={() => onSelect(m)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              borderRadius: 8,
              whiteSpace: "nowrap",
              fontFamily: "Barlow, sans-serif",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              flexShrink: 0,
              background: bgColor,
              color: (isActive || (monthAvg !== undefined && monthAvg !== null)) ? "#FFFFFF" : "#9CB3D0",
              border: isActive || (monthAvg !== undefined && monthAvg !== null) ? "none" : "1px solid #2A4068",
              transition: "all 0.15s",
            }}
          >
            {isActive && (
              <span style={{ width: 3, height: 14, background: "#FFFFFF", borderRadius: 2, display: "inline-block" }} />
            )}
            <span style={{ textTransform: "capitalize" }}>{m.label}</span>
          </button>
        );
      })}
      <style>{`
        .month-selector-scroll::-webkit-scrollbar { height: 6px; }
        .month-selector-scroll::-webkit-scrollbar-track { background: #14213F; }
        .month-selector-scroll::-webkit-scrollbar-thumb { background: #2A4068; border-radius: 3px; }
        .month-selector-scroll::-webkit-scrollbar-thumb:hover { background: #3A5078; }
      `}</style>
    </div>
  );
}