import React, { useState } from "react";
import PointCard from "./PointCard";
import { CATEGORIES, sortPoints } from "@/lib/standupUtils";

const FILTERS = ["All", "Open", "In Progress", "Vizionat/Analizat", "Resolved"];

export default function PointsList({ points, archivedPoints, t, onStatusChange }) {
  const [filter, setFilter] = useState("Open");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showArchive, setShowArchive] = useState(false);

  const active = points.filter((p) => !p.is_archived);
  const statusFiltered = filter === "All" ? active : active.filter((p) => p.status === filter);
  const catFiltered = categoryFilter ? statusFiltered.filter((p) => p.category === categoryFilter) : statusFiltered;
  const sorted = sortPoints(catFiltered);

  const filterLabels = { All: t.filterAll, Open: t.filterOpen, "In Progress": t.filterInProgress, "Vizionat/Analizat": t.statuses?.["Vizionat/Analizat"] || "Vizionat/Analizat", Resolved: t.filterResolved };
  const counts = {
    All: active.length,
    Open: active.filter((p) => p.status === "Open").length,
    "In Progress": active.filter((p) => p.status === "In Progress").length,
    "Vizionat/Analizat": active.filter((p) => p.status === "Vizionat/Analizat").length,
    Resolved: active.filter((p) => p.status === "Resolved").length,
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-1">
          {FILTERS.map((f) => {
            const isActive = filter === f;
            return (
              <button key={f} onClick={() => setFilter(f)} style={{ background: isActive ? "#101C34" : "#FFFFFF", color: isActive ? "#FFFFFF" : "#4A6494", border: isActive ? "1.5px solid #101C34" : "1.5px solid #D8E2F0", borderRadius: 6, fontFamily: "Barlow, sans-serif", fontWeight: 600, fontSize: 13, padding: "5px 12px", cursor: "pointer" }}>
                {filterLabels[f]}{counts[f] > 0 && <span style={{ marginLeft: 5, background: isActive ? "rgba(255,255,255,0.2)" : "#EEF2F8", color: isActive ? "#FFFFFF" : "#4A6494", borderRadius: 10, padding: "1px 6px", fontSize: 11 }}>{counts[f]}</span>}
              </button>
            );
          })}
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ border: "1.5px solid #D8E2F0", borderRadius: 6, padding: "5px 10px", fontFamily: "Barlow, sans-serif", fontWeight: 500, fontSize: 13, color: "#101C34", background: "#FFFFFF", cursor: "pointer" }}>
          <option value="">{t.allCategories}</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{t.categories?.[c] || c}</option>)}
        </select>
      </div>

      {sorted.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px", color: "#4A6494", fontFamily: "Barlow, sans-serif", fontSize: 16, fontWeight: 500, background: "#FFFFFF", border: "1.5px solid #D8E2F0", borderRadius: 10 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
          {t.noOpenPoints}
        </div>
      ) : (
        sorted.map((point) => <PointCard key={point.id} point={point} t={t} onStatusChange={onStatusChange} />)
      )}

      <div style={{ marginTop: 20 }}>
        <button onClick={() => setShowArchive((v) => !v)} style={{ background: "transparent", color: "#4A6494", border: "1.5px solid #D8E2F0", borderRadius: 6, fontFamily: "Barlow, sans-serif", fontWeight: 600, fontSize: 13, padding: "6px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <span>{showArchive ? "▲" : "▼"}</span>
          {t.archiveToggle}
          {archivedPoints.length > 0 && <span style={{ background: "#EEF2F8", color: "#4A6494", borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>{archivedPoints.length}</span>}
        </button>
        {showArchive && (
          <div style={{ marginTop: 10, background: "#FFFFFF", border: "1.5px solid #D8E2F0", borderRadius: 10, overflow: "hidden" }}>
            {archivedPoints.length === 0 ? (
              <p style={{ padding: "20px 16px", color: "#4A6494", fontFamily: "Barlow, sans-serif", fontSize: 14, textAlign: "center" }}>{t.noArchived}</p>
            ) : (
              archivedPoints.map((point) => (
                <div key={point.id} style={{ padding: "10px 16px", borderBottom: "1px solid #EEF2F8", fontFamily: "Barlow, sans-serif", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: "#1A7A4A", fontSize: 12 }}>✓</span>
                  <span style={{ fontSize: 13, color: "#4A6494", flex: 1, fontStyle: "italic" }}>{point.description}</span>
                  <span style={{ fontSize: 11, color: "#9CB3D0", fontWeight: 600 }}>{t.roles?.[point.owner_role] || point.owner_role}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}