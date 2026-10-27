import React from "react";
import { getDaysOpen, isEscalated, isOverdue, CATEGORY_ICONS, CATEGORY_COLORS } from "@/lib/standupUtils";
import { format, parseISO } from "date-fns";
import IssueLinkText from "./IssueLinkText";

const STATUS_STYLES = {
  Open: { bg: "#FDECEA", color: "#C0392B", border: "#C0392B" },
  "In Progress": { bg: "#FFFBEA", color: "#B8860B", border: "#B8860B" },
  Resolved: { bg: "#E8F5EE", color: "#1A7A4A", border: "#1A7A4A" },
  "Vizionat/Analizat": { bg: "#E8F0FE", color: "#1E40AF", border: "#1E40AF" },
};

export default function PointCard({ point, t, onStatusChange, onDelete, onEdit, issues = [] }) {
  const escalated = isEscalated(point);
  const overdue = isOverdue(point);
  const daysOpen = getDaysOpen(point);
  const catStyle = CATEGORY_COLORS[point.category] || { bg: "#F5F5F5", text: "#555", border: "#CCC" };
  const statusStyle = STATUS_STYLES[point.status] || STATUS_STYLES["Open"];
  const tCat = t.categories?.[point.category] || point.category;
  const tStatus = t.statuses?.[point.status] || point.status;
  const tRole = t.roles?.[point.owner_role] || point.owner_role;
  const cardBorder = escalated ? "#C0392B" : "#D8E2F0";
  const cardBorderWidth = escalated ? 2 : 1;

  let dueDateStr = "";
  if (point.due_date) {
    try { dueDateStr = format(parseISO(point.due_date), "dd MMM yyyy"); }
    catch { dueDateStr = point.due_date; }
  }

  return (
    <div style={{ background: "#FFFFFF", border: `${cardBorderWidth}px solid ${cardBorder}`, borderRadius: 10, padding: "14px 16px", marginBottom: 10, fontFamily: "Barlow, sans-serif", boxShadow: escalated ? "0 2px 12px rgba(192,57,43,0.10)" : "0 1px 4px rgba(16,28,52,0.06)" }}>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span style={{ background: catStyle.bg, color: catStyle.text, border: `1px solid ${catStyle.border}`, borderRadius: 5, fontSize: 12, fontWeight: 600, padding: "2px 8px", display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 13 }}>{CATEGORY_ICONS[point.category]}</span>{tCat}
        </span>
        {escalated && <span style={{ background: "#C0392B", color: "#FFFFFF", borderRadius: 4, fontSize: 10, fontWeight: 700, padding: "2px 7px", letterSpacing: 0.8 }}>{t.escalated}</span>}
        {overdue && <span style={{ background: "#FFF3E0", color: "#E65100", border: "1px solid #FFB74D", borderRadius: 4, fontSize: 10, fontWeight: 700, padding: "2px 7px", letterSpacing: 0.8 }}>{t.overdue}</span>}
        <div style={{ flex: 1 }} />
        <span style={{ background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}`, borderRadius: 5, fontSize: 12, fontWeight: 600, padding: "2px 8px" }}>{tStatus}</span>
        {point.status !== "Resolved" && point.status !== "Vizionat/Analizat" && <span style={{ color: "#4A6494", fontSize: 12, fontWeight: 500 }}>{daysOpen} {daysOpen === 1 ? t.dayOpen : t.daysOpen}</span>}
      </div>
      <p style={{ color: "#101C34", fontSize: 15, fontWeight: 500, lineHeight: 1.5, margin: "6px 0", whiteSpace: "pre-line" }}><IssueLinkText text={point.description} issues={issues} /></p>
      <div className="flex flex-wrap items-center gap-3 mt-2">
        <span style={{ color: "#101C34", fontWeight: 700, fontSize: 13 }}>
          {tRole}{point.owner_name && <span style={{ color: "#4A6494", fontWeight: 500 }}> — {point.owner_name}</span>}
        </span>
        {dueDateStr && <span style={{ color: "#4A6494", fontSize: 12, fontWeight: 500 }}>📅 {dueDateStr}</span>}
        <div style={{ flex: 1 }} />
        <div className="flex gap-1">
          {["Open", "In Progress", "Resolved", "Vizionat/Analizat"].map((s) => {
            const st = STATUS_STYLES[s];
            const active = point.status === s;
            return (
              <button key={s} onClick={() => onStatusChange(point.id, s)} style={{ background: active ? st.bg : "transparent", color: active ? st.color : "#9CB3D0", border: active ? `1.5px solid ${st.border}` : "1.5px solid #D8E2F0", borderRadius: 5, fontSize: 11, fontWeight: 600, padding: "3px 9px", cursor: "pointer", transition: "all 0.15s", fontFamily: "Barlow, sans-serif" }}>
                {t.statuses?.[s] || s}
              </button>
            );
          })}
          {onEdit && (
            <button onClick={() => onEdit(point)} style={{ background: "transparent", color: "#2563EB", border: "1.5px solid #2563EB", borderRadius: 5, fontSize: 11, fontWeight: 600, padding: "3px 9px", cursor: "pointer", transition: "all 0.15s", fontFamily: "Barlow, sans-serif" }}>
              {t.modify || "Edit"}
            </button>
          )}
          {onDelete && (
            <button onClick={() => { if (window.confirm(t.deletePointConfirm || "Delete this point?")) onDelete(point.id); }} style={{ background: "transparent", color: "#EF4444", border: "1.5px solid #EF4444", borderRadius: 5, fontSize: 11, fontWeight: 600, padding: "3px 9px", cursor: "pointer", transition: "all 0.15s", fontFamily: "Barlow, sans-serif" }}>
              {t.delete || "Delete"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}