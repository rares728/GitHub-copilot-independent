import React, { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/api/client";
import { getT } from "@/lib/i18n";
import { getCellStatusColor, CATEGORIES } from "@/lib/standupUtils";
import AppHeader, { DateSubBar } from "@/components/standup/AppHeader";
import StandupGrid from "@/components/standup/StandupGrid";
import EditPointModal from "@/components/standup/EditPointModal";
import MeetingSummary from "@/components/standup/MeetingSummary";
import IssueLinkText from "@/components/standup/IssueLinkText";
import { useMeetingTimer } from "@/hooks/useMeetingTimer";
import { fetchUtilajSerial } from "@/components/issues/picklists";
import { format, subDays, addDays } from "date-fns";
import { enUS } from "date-fns/locale";
import { useAuth } from "@/lib/AuthContext";

export default function ProductionMeeting() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [lang, setLang] = useState("en");
  const [points, setPoints] = useState([]);
  const [issues, setIssues] = useState([]);
  const [archivedPoints, setArchivedPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [meetingStartSnapshot, setMeetingStartSnapshot] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [showOpenPoints, setShowOpenPoints] = useState(false);
  const [utilajSerials, setUtilajSerials] = useState([]);
  const { secondsLeft, meetingActive, expired, start: startTimer, stop: stopTimer, clearExpired, duration } = useMeetingTimer();
  const t = getT(lang);

  const loadPoints = useCallback(async () => {
    try {
      const [all, allIssues] = await Promise.all([
        apiClient.entities.StandupPoint.list("-created_date", 200),
        apiClient.entities.ProductionIssue.list("-created_date", 500),
      ]);
      setIssues(allIssues);
      const thirtyDaysAgo = subDays(new Date(), 30);
      const toArchive = all.filter((p) => !p.is_archived && p.status === "Resolved" && p.resolved_at && new Date(p.resolved_at) < subDays(new Date(), 1));
      for (const p of toArchive) {
        await apiClient.entities.StandupPoint.update(p.id, { is_archived: true });
      }
      // Clean up stale auto-populated Utilaje points (issue date no longer matches meeting_date - 1)
      const issueMap = new Map(allIssues.map((i) => [i.issue_number, i]));
      const staleUtilajIds = [];
      for (const p of all) {
        if (p.category !== "Utilaje" || p.is_archived || !p.description) continue;
        if (p.action || p.owner_name) continue;
        const lines = p.description.split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines.length === 0) continue;
        const allStale = lines.every((line) => {
          const match = line.match(/^(AEE-\d+)\s*\//);
          if (!match) return false;
          const issue = issueMap.get(match[1]);
          if (!issue) return true;
          const expectedDate = format(subDays(new Date(p.meeting_date), 1), "yyyy-MM-dd");
          return issue.reported_date !== expectedDate;
        });
        if (allStale) staleUtilajIds.push(p.id);
      }
      for (const id of staleUtilajIds) {
        await apiClient.entities.StandupPoint.delete(id);
      }
      // Auto-populate Utilaje points for eligible issues (reported_date + 1 = meeting_date)
      let serials = utilajSerials;
      if (serials.length === 0) {
        try { serials = await fetchUtilajSerial(); setUtilajSerials(serials); } catch {}
      }
      const utilajSerialValues = new Set(serials.map((s) => s.partNumber));
      const thirtyDaysAgoDate = subDays(new Date(), 30);
      const eligibleIssues = allIssues.filter((i) =>
        i.reported_date &&
        i.part_number &&
        utilajSerialValues.has(i.part_number) &&
        new Date(i.reported_date) >= thirtyDaysAgoDate
      );
      // Group eligible issues by expected meeting date (reported_date + 1)
      const issuesByMeetingDate = new Map();
      for (const issue of eligibleIssues) {
        const meetingDate = format(addDays(new Date(issue.reported_date), 1), "yyyy-MM-dd");
        if (!issuesByMeetingDate.has(meetingDate)) issuesByMeetingDate.set(meetingDate, []);
        issuesByMeetingDate.get(meetingDate).push(issue);
      }
      // Check existing Utilaje points and create missing ones
      const toCreate = [];
      for (const [dateStr, dayIssues] of issuesByMeetingDate) {
        const existingPoints = all.filter((p) => p.category === "Utilaje" && p.meeting_date === dateStr && !p.is_archived);
        const expectedDesc = dayIssues.map((i) => `${i.issue_number || ""} / ${i.part_number || ""} / ${i.defect_description || ""}`).join("\n");
        // Skip if a tombstone exists (user cleared the description) or all issues are already present
        const hasTombstone = existingPoints.some((p) => !p.description || !p.description.trim());
        const hasAllIssues = existingPoints.some((p) =>
          p.description && dayIssues.every((issue) => p.description.includes(issue.issue_number))
        );
        if (!hasTombstone && !hasAllIssues) {
          toCreate.push({
            category: "Utilaje",
            description: expectedDesc,
            meeting_date: dateStr,
            status: "Open",
            is_archived: false,
          });
        }
      }
      let fresh = (toArchive.length > 0 || staleUtilajIds.length > 0) ? await apiClient.entities.StandupPoint.list("-created_date", 200) : all;
      if (toCreate.length > 0) {
        await apiClient.entities.StandupPoint.bulkCreate(toCreate);
        fresh = await apiClient.entities.StandupPoint.list("-created_date", 200);
      }
      setPoints(fresh.filter((p) => !p.is_archived));
      setArchivedPoints(fresh.filter((p) => p.is_archived && new Date(p.created_at) > thirtyDaysAgo));
    } catch (err) {
      console.error("Failed to load points:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPoints(); }, [loadPoints]);
  useEffect(() => { fetchUtilajSerial().then(setUtilajSerials).catch(() => {}); }, []);

  const handleStartMeeting = async () => {
    await loadPoints();
    setMeetingStartSnapshot({ resolvedIds: new Set(points.filter((p) => p.status === "Resolved").map((p) => p.id)), totalIds: new Set(points.map((p) => p.id)) });
    startTimer();
  };

  const handleEndMeeting = useCallback(async () => {
    stopTimer();
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - duration * 1000);
    const durationSecs = duration;
    const todayStr = format(endTime, "yyyy-MM-dd");
    let currentPoints = [];
    try { currentPoints = await apiClient.entities.StandupPoint.list("-created_date", 200); }
    catch (e) { currentPoints = points; }
    const active = currentPoints.filter((p) => !p.is_archived);
    const currentMonth = format(endTime, "yyyy-MM");
    // All 7 categories — max 7 buttons per day
    // Rezolvate Astazi: green buttons today (max once per button)
    // Adaugate Astazi: edited (non-gray) buttons today (max 7)
    let resolvedCount = 0, addedCount = 0;
    for (const cat of CATEGORIES) {
      const color = getCellStatusColor(active, cat, todayStr);
      if (color === "green") resolvedCount++;
      if (color !== "gray") addedCount++;
    }
    // Inca deschise: all edited buttons in current month (max once per button, regardless of status)
    // Critic: red buttons in current month (max once per button)
    const monthDates = new Set();
    active.forEach((p) => {
      if (p.meeting_date && p.meeting_date.startsWith(currentMonth)) monthDates.add(p.meeting_date);
    });
    let openCount = 0, criticalCount = 0;
    for (const dateStr of monthDates) {
      for (const cat of CATEGORIES) {
        const color = getCellStatusColor(active, cat, dateStr);
        if (color === "red" || color === "yellow") openCount++;
        if (color === "red") criticalCount++;
      }
    }
    const summaryData = {
      resolved: resolvedCount,
      added: addedCount,
      open: openCount,
      escalated: criticalCount,
      durationSeconds: durationSecs,
    };
    setSummary(summaryData);
    setShowSummary(true);
    try {
      await apiClient.entities.StandupMeeting.create({ meeting_date: todayStr, started_at: startTime.toISOString(), ended_at: endTime.toISOString(), duration_seconds: durationSecs, resolved_count: summaryData.resolved, new_count: summaryData.added, open_count: summaryData.open, escalated_count: summaryData.escalated });
    } catch (e) { console.error("Failed to save meeting summary:", e); }
    loadPoints();
  }, [points, loadPoints, stopTimer, duration]);

  // When the global timer expires (even if user was on another page), show summary
  useEffect(() => {
    if (expired) {
      handleEndMeeting();
    }
  }, [expired, handleEndMeeting]);

  const handleAddPoint = async (form) => {
    setIsSubmitting(true);
    try {
      const created = await apiClient.entities.StandupPoint.create({ ...form, status: "Open", is_archived: false });
      await loadPoints();
      return created;
    } catch (err) { console.error(err); }
    finally { setIsSubmitting(false); }
  };

  const handleDeleteCell = async (category, dateStr) => {
    const cellPoints = points.filter((p) => p.category === category && p.meeting_date === dateStr && !p.is_archived);
    for (const p of cellPoints) {
      await apiClient.entities.StandupPoint.delete(p.id);
    }
    await loadPoints();
    setEditingCell(null);
  };

  const handleStatusChange = async (id, newStatus) => {
    const updates = { status: newStatus, resolved_at: newStatus === "Resolved" ? new Date().toISOString() : null };
    try {
      await apiClient.entities.StandupPoint.update(id, updates);
      const resolvedIds = new Set([id]);
      // When resolving, also auto-resolve all previous points with the same subject (same category + description)
      if (newStatus === "Resolved") {
        const point = points.find((p) => p.id === id);
        if (point && point.description && point.description.trim()) {
          const desc = point.description.trim();
          const toResolve = points.filter((p) =>
            p.id !== id &&
            !p.is_archived &&
            p.category === point.category &&
            p.meeting_date < point.meeting_date &&
            p.description && p.description.trim() === desc &&
            p.status !== "Resolved"
          );
          if (toResolve.length > 0) {
            const nowISO = new Date().toISOString();
            await apiClient.entities.StandupPoint.bulkUpdate(
              toResolve.map((p) => ({ id: p.id, status: "Resolved", resolved_at: nowISO }))
            );
            toResolve.forEach((p) => resolvedIds.add(p.id));
          }
        }
      }
      setPoints((prev) => prev.map((p) => (resolvedIds.has(p.id) ? { ...p, status: newStatus, resolved_at: updates.resolved_at } : p)));
    } catch (err) { console.error(err); }
  };

  const handleToggleCritical = async (id, newCritical) => {
    try {
      await apiClient.entities.StandupPoint.update(id, { is_critical: newCritical });
      setPoints((prev) => prev.map((p) => (p.id === id ? { ...p, is_critical: newCritical } : p)));
    } catch (err) { console.error(err); }
  };

  const handleDeletePoint = async (id) => {
    try {
      await apiClient.entities.StandupPoint.delete(id);
      setPoints((prev) => prev.filter((p) => p.id !== id));
    } catch (err) { console.error(err); }
  };

  const handleUpdatePoint = async (data) => {
    setIsSubmitting(true);
    try {
      const { id, ...updates } = data;
      await apiClient.entities.StandupPoint.update(id, updates);
      await loadPoints();
    } catch (err) { console.error(err); }
    finally { setIsSubmitting(false); }
  };

  const handleDismissSummary = () => {
    setShowSummary(false); setSummary(null); setMeetingStartSnapshot(null);
    clearExpired();
    loadPoints();
  };

  const handleCellClick = (cat, date) => {
    let initialDescription = "";
    if (isAdmin && cat === "Quality") {
      const prevDateStr = format(subDays(new Date(date), 1), "yyyy-MM-dd");
      const dayIssues = issues.filter((i) => i.reported_date === prevDateStr && Number(i.parts_nok) > 0);
      initialDescription = dayIssues
        .map((i) => `${i.issue_number || ""} / ${i.operation || ""} / ${i.title || ""} / ${i.parts_nok}`)
        .join("\n");
    }
    if (isAdmin && cat === "Utilaje") {
      const prevDateStr = format(subDays(new Date(date), 1), "yyyy-MM-dd");
      const utilajSerialValues = new Set(utilajSerials.map((s) => s.partNumber));
      const dayIssues = issues.filter((i) => i.reported_date === prevDateStr && i.part_number && utilajSerialValues.has(i.part_number));
      initialDescription = dayIssues
        .map((i) => `${i.issue_number || ""} / ${i.part_number || ""} / ${i.defect_description || ""}`)
        .join("\n");
    }
    // Auto-transition: when a cell is opened, existing "Open" points become "Vizionat/Analizat"
    if (isAdmin) {
      const openPoints = points.filter((p) => p.category === cat && p.meeting_date === date && !p.is_archived && p.status === "Open");
      if (openPoints.length > 0) {
        openPoints.forEach((p) => handleStatusChange(p.id, "Vizionat/Analizat"));
      }
    }
    setEditingCell({ category: cat, date, initialDescription, showOpenPointsFor: { category: cat, date } });
  };

  // Compute open cells list (same logic as "Inca deschise" card: red/yellow cells in current month)
  const openListCells = (() => {
    const currentMonth = format(new Date(), "yyyy-MM");
    const monthDates = new Set();
    points.forEach((p) => {
      if (p.meeting_date && p.meeting_date.startsWith(currentMonth) && !p.is_archived) monthDates.add(p.meeting_date);
    });
    const cells = [];
    for (const dateStr of monthDates) {
      for (const cat of CATEGORIES) {
        const color = getCellStatusColor(points, cat, dateStr);
        if (color === "red" || color === "yellow") {
          const cellPoints = points.filter((p) => p.category === cat && p.meeting_date === dateStr && !p.is_archived);
          cells.push({ category: cat, date: dateStr, points: cellPoints, color });
        }
      }
    }
    return cells;
  })();

  return (
    <div style={{ minHeight: "100vh", background: "#EEF2F8", fontFamily: "Barlow, sans-serif" }}>
      <AppHeader t={t} lang={lang} setLang={setLang} meetingActive={meetingActive} secondsLeft={secondsLeft} onStartMeeting={handleStartMeeting} onEndMeeting={handleEndMeeting} />
      <DateSubBar t={t} lang={lang} onShowOpenPoints={() => setShowOpenPoints(true)} points={points} />
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 20px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <div style={{ width: 32, height: 32, border: "3px solid #D8E2F0", borderTop: "3px solid #101C34", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
          </div>
        ) : (
          <StandupGrid points={points} issues={issues} t={t} lang={lang} onCellClick={handleCellClick} isAdmin={isAdmin} />
        )}
      </div>
      {editingCell && (
        <EditPointModal
          key={`${editingCell.category}-${editingCell.date}`}
          t={t}
          category={editingCell.category}
          dueDate={editingCell.date}
          initialDescription={editingCell.initialDescription}
          points={points}
          issues={issues}
          onAddPoint={handleAddPoint}
          onUpdatePoint={handleUpdatePoint}
          onStatusChange={handleStatusChange}
          onDeletePoint={handleDeletePoint}
          onDeleteCell={handleDeleteCell}
          onToggleCritical={handleToggleCritical}
          isSubmitting={isSubmitting}
          readOnly={!isAdmin}
          onClose={() => setEditingCell(null)}
        />
      )}
      {showSummary && summary && <MeetingSummary t={t} summary={summary} onDismiss={handleDismissSummary} />}
      {showOpenPoints && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: "#FFFFFF", borderRadius: 12, width: "90vw", maxWidth: 1200, height: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 24, paddingBottom: 16, background: "#FFFFFF", position: "sticky", top: 0, zIndex: 10, borderBottom: "1px solid #E5EBF4", flexShrink: 0 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#101C34", margin: 0 }}>{t.listOpenPoints}</h2>
              <button onClick={() => setShowOpenPoints(false)} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#9CB3D0", flexShrink: 0 }}>×</button>
            </div>
            <div style={{ padding: "0 24px 24px 24px", overflowY: "auto", flex: 1 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {openListCells.map((cell) => (
                  <div key={`${cell.category}|${cell.date}`} style={{ border: "1.5px solid #D8E2F0", borderRadius: 8, padding: 16, background: "#F8FAFC" }}>
                    <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                      <h3 style={{ fontSize: 13, fontWeight: 700, color: "#101C34", margin: 0 }}>
                        {cell.category} • {format(new Date(cell.date), "dd MMM yyyy", { locale: enUS })}
                      </h3>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: cell.color === "red" ? "#FEE2E2" : "#FEF3C7", color: cell.color === "red" ? "#991B1B" : "#92400E" }}>
                        {cell.color === "red" ? "Critical" : "Open"}
                      </span>
                    </div>
                    {cell.points.map((p) => (
                      <div key={p.id} style={{ borderTop: "1px solid #E5EBF4", paddingTop: 10, marginTop: 8 }}>
                        <div style={{ marginBottom: 8 }}>
                          <p style={{ fontSize: 14, fontWeight: 500, color: "#101C34", margin: 0, lineHeight: 1.5, whiteSpace: "pre-line" }}><IssueLinkText text={p.description} issues={issues} /></p>
                        </div>
                        {p.action && (
                          <div style={{ fontSize: 13, marginBottom: 6 }}>
                            <span style={{ fontWeight: 600, color: "#64748B" }}>{t.actionLabel}:</span>{" "}
                            <span style={{ color: "#475569" }}>{p.action}</span>
                          </div>
                        )}
                        <div style={{ fontSize: 13, display: "flex", gap: 16, flexWrap: "wrap" }}>
                          <div>
                            <span style={{ fontWeight: 600, color: "#64748B" }}>{t.responsibleLabel}:</span>{" "}
                            <span style={{ color: "#475569", fontWeight: 500 }}>{p.owner_name || "-"}</span>
                          </div>
                          <div>
                            <span style={{ fontWeight: 600, color: "#64748B" }}>{t.dueDateLabel}:</span>{" "}
                            <span style={{ color: "#475569", fontWeight: 500 }}>{p.due_date ? format(new Date(p.due_date), "dd MMM yyyy", { locale: enUS }) : "-"}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}