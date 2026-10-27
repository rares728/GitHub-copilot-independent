import React, { useState, useRef } from "react";
import { X, Trash2 } from "lucide-react";
import { subDays, format } from "date-fns";
import AddPointForm from "./AddPointForm";
import PointCard from "./PointCard";
import { sortPoints, getCellStatus } from "@/lib/standupUtils";

const STATUS_BUTTONS = [
  { key: "Open", label: "Open", color: "#EF4444" },
  { key: "In Progress", label: "In Progress", color: "#F39201" },
  { key: "Resolved", label: "Resolved", color: "#16A34A" },
  { key: "Vizionat/Analizat", label: "Viewed/Analyzed", color: "#2563EB" },
];

export default function EditPointModal({ t, category, dueDate, initialDescription, points, issues = [], onAddPoint, onUpdatePoint, onStatusChange, onDeleteCell, onDeletePoint, onToggleCritical, isSubmitting, readOnly, onClose }) {
  const categoryPoints = sortPoints(points.filter((p) => p.category === category && p.meeting_date === dueDate && !p.is_archived));
  const tCat = t.categories?.[category] || category;
  const isMateriale = category === "Materiale";
  const isQuality = category === "Quality";
  const isUtilaje = category === "Utilaje";
  const isPersonal = category === "Personal";
  const existingMaterialePoint = isMateriale ? categoryPoints[0] : null;
  const prevDayDate = format(subDays(new Date(dueDate), 1), "yyyy-MM-dd");
  const prevDayMaterialePoint = isMateriale ? points.find((p) => p.category === "Materiale" && p.meeting_date === prevDayDate && !p.is_archived) : null;
  const prevDayPersonalPoint = isPersonal ? points.find((p) => p.category === "Personal" && p.meeting_date === prevDayDate && !p.is_archived) : null;
  const existingQualityPoint = isQuality ? categoryPoints[0] : null;
  const existingUtilajePoint = isUtilaje ? categoryPoints[0] : null;
  const existingPersonalPoint = isPersonal ? categoryPoints[0] : null;
  const [editingPoint, setEditingPoint] = useState(null);
  const cellStatus = getCellStatus(points, category, dueDate);
  const formRef = useRef(null);
  const isCritical = categoryPoints.some((p) => p.is_critical);

  const handleToggleCritical = () => {
    const newCritical = !isCritical;
    formRef.current?.setCritical(newCritical);
    categoryPoints.forEach((p) => onToggleCritical?.(p.id, newCritical));
  };

  const handleSave = () => {
    formRef.current?.submit();
  };

  const handleDelete = () => {
    if (categoryPoints.length === 0) return;
    if (window.confirm(`Delete all ${categoryPoints.length} point(s) in ${tCat}?`)) {
      onDeleteCell(category, dueDate);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(16,28,52,0.55)", display: "flex", alignItems: "stretch", justifyContent: "stretch", padding: 0 }}
      onClick={onClose}
    >
      <div
        style={{ background: "#EEF2F8", borderRadius: 0, width: "100%", height: "100%", maxWidth: "none", padding: 20, fontFamily: "Barlow, sans-serif", boxShadow: "none", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ color: "#101C34", fontWeight: 700, fontSize: 18, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 4, height: 22, background: "#F39201", borderRadius: 2, display: "inline-block" }} />
            {tCat}
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {!readOnly && (
              <button
                onClick={handleDelete}
                disabled={categoryPoints.length === 0}
                style={{ background: categoryPoints.length > 0 ? "#EF4444" : "#F1F5F9", color: "#FFFFFF", border: "none", borderRadius: 8, height: 36, padding: "0 14px", display: "flex", alignItems: "center", gap: 6, cursor: categoryPoints.length > 0 ? "pointer" : "not-allowed", fontFamily: "Barlow, sans-serif", fontWeight: 700, fontSize: 13 }}
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
            <button
              onClick={onClose}
              style={{ background: "#FFFFFF", border: "1.5px solid #D8E2F0", borderRadius: 8, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#4A6494" }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {readOnly ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "10px 14px", background: "#E8EDF5", borderRadius: 8, border: "1px solid #D8E2F0" }}>
            <span style={{ color: "#4A6494", fontWeight: 700, fontSize: 13 }}>🔒 View mode — read only</span>
          </div>
        ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "10px 14px", background: "#FFFFFF", borderRadius: 8, border: "1px solid #D8E2F0" }}>
          <span style={{ color: "#4A6494", fontWeight: 600, fontSize: 13, marginRight: 4 }}>Status:</span>
          {STATUS_BUTTONS.map((btn) => {
            const active = cellStatus === btn.key;
            return (
              <button
                key={btn.key}
                onClick={() => categoryPoints.forEach((p) => onStatusChange(p.id, btn.key))}
                style={{
                  background: active ? btn.color : "#FFFFFF",
                  color: active ? "#FFFFFF" : btn.color,
                  border: `1.5px solid ${btn.color}`,
                  borderRadius: 7,
                  padding: "6px 16px",
                  fontFamily: "Barlow, sans-serif",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {btn.label}
              </button>
            );
          })}
          <button
            onClick={handleToggleCritical}
            style={{
              marginLeft: "auto",
              background: isCritical ? "#EF4444" : "#FFFFFF",
              color: isCritical ? "#FFFFFF" : "#EF4444",
              border: "1.5px solid #EF4444",
              borderRadius: 7,
              padding: "6px 16px",
              fontFamily: "Barlow, sans-serif",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            Critical
          </button>
          <button
            onClick={handleSave}
            disabled={isSubmitting}
            style={{
              background: isSubmitting ? "#D8E2F0" : "#101C34",
              color: "#FFFFFF",
              border: "none",
              borderRadius: 7,
              padding: "6px 20px",
              fontFamily: "Barlow, sans-serif",
              fontWeight: 700,
              fontSize: 13,
              cursor: isSubmitting ? "not-allowed" : "pointer",
              transition: "all 0.15s",
            }}
          >
            {isSubmitting ? "Saving..." : "Save"}
          </button>
        </div>
        )}

        <fieldset disabled={readOnly} style={{ border: "none", padding: 0, margin: 0 }}>
        <AddPointForm ref={formRef} key={editingPoint ? `edit-${editingPoint.id}` : "new"} t={t} onSubmit={onAddPoint} onUpdate={onUpdatePoint} isSubmitting={isSubmitting} initialCategory={category} initialDueDate={dueDate} initialDescription={initialDescription} editingPoint={editingPoint} onSubmitted={onClose} issues={issues} existingPoint={existingMaterialePoint || existingQualityPoint || existingUtilajePoint || existingPersonalPoint} onStatusChange={onStatusChange} onDeletePoint={onDeletePoint} prevDayMaterialePoint={prevDayMaterialePoint} prevDayPersonalPoint={prevDayPersonalPoint} />

        {!isMateriale && !isQuality && !isUtilaje && !isPersonal && (
          <div style={{ marginTop: 20 }}>
            <h4 style={{ color: "#4A6494", fontWeight: 600, fontSize: 13, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
              {t.openPoints}: {categoryPoints.length}
            </h4>
            {categoryPoints.length === 0 ? (
              <p style={{ color: "#9CB3D0", fontSize: 14, textAlign: "center", padding: 20 }}>{t.noOpenPoints}</p>
            ) : (
              categoryPoints.map((p) => <PointCard key={p.id} point={p} t={t} issues={issues} onStatusChange={onStatusChange} onDelete={onDeletePoint} onEdit={() => setEditingPoint(p)} />)
            )}
          </div>
        )}
        </fieldset>
      </div>
    </div>
  );
}