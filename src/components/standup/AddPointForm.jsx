import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { Copy } from "lucide-react";
import { OWNER_ROLES } from "@/lib/standupUtils";
import { useUserOptions } from "@/hooks/useUserOptions";
import IssueLinkText from "./IssueLinkText";
import UtilajeLinkText from "./UtilajeLinkText";
import MaterialeTable, { defaultMaterialeRowsJSON } from "./MaterialeTable";
import PersonalTable, { defaultPersonalDataJSON } from "./PersonalTable";

const HAS_ISSUE_REF = /AEE-\d{4}/i;
const isMaterialeJSON = (val) => { try { return Array.isArray(JSON.parse(val)); } catch { return false; } };

const STATUS_BUTTONS = [
  { key: "Open", label: "Open", color: "#EF4444" },
  { key: "In Progress", label: "In Progress", color: "#F39201" },
  { key: "Resolved", label: "Resolved", color: "#16A34A" },
];

const AddPointForm = forwardRef(function AddPointForm({ t, onSubmit, onUpdate, isSubmitting, initialCategory, initialDueDate, initialDescription, editingPoint, onSubmitted, issues = [], existingPoint, onStatusChange, onDeletePoint, prevDayMaterialePoint, prevDayPersonalPoint }, ref) {
  const userOptions = useUserOptions();
  const initialCat = editingPoint?.category || initialCategory || "";
  const initialDesc = editingPoint?.description || initialDescription || existingPoint?.description || "";
  const isMateriale = initialCat === "Materiale";
  const isQuality = initialCat === "Quality";
  const isUtilaje = initialCat === "Utilaje";
  const isPersonal = initialCat === "Personal";
  const [form, setForm] = useState({
    category: initialCat,
    description: initialCat === "Materiale" && !initialDesc ? defaultMaterialeRowsJSON() : (initialCat === "Personal" && !initialDesc ? defaultPersonalDataJSON() : initialDesc),
    action: editingPoint?.action || "",
    client_complaint: editingPoint?.client_complaint || "",
    owner_role: editingPoint?.owner_role || "",
    owner_name: editingPoint?.owner_name || "",
    owner_email: editingPoint?.owner_email || "",
    meeting_date: editingPoint?.meeting_date || initialDueDate || "",
    due_date: editingPoint?.due_date || "",
    is_critical: editingPoint?.is_critical || false,
  });

  // Track the Materiale point (existing or newly auto-created) for status/delete
  const [materialePoint, setMaterialePoint] = useState(existingPoint || editingPoint || null);
  const [qualityPoint, setQualityPoint] = useState(existingPoint || editingPoint || null);
  const [utilajePoint, setUtilajePoint] = useState(existingPoint || editingPoint || null);
  const [personalPoint, setPersonalPoint] = useState(existingPoint || editingPoint || null);
  const saveTimerRef = useRef(null);
  const lastSavedDescRef = useRef(materialePoint?.description || qualityPoint?.description || utilajePoint?.description || personalPoint?.description || form.description);
  const [savingComplaint, setSavingComplaint] = useState(false);

  const isValid = form.category && form.description.trim();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid) return;
    const payload = {
      ...form,
      owner_role: form.owner_role || null,
      owner_name: form.owner_name || "",
      owner_email: form.owner_email || "",
      action: form.action || "",
      client_complaint: form.client_complaint || "",
      is_critical: form.is_critical,
    };
    if (editingPoint) {
      await onUpdate({ ...payload, id: editingPoint.id });
    } else {
      await onSubmit(payload);
    }
    setForm({
      category: initialCategory || "",
      description: "",
      action: "",
      client_complaint: "",
      owner_role: "",
      owner_name: "",
      owner_email: "",
      meeting_date: initialDueDate || "",
      due_date: "",
      is_critical: false,
    });
    if (onSubmitted) onSubmitted();
  };

  // Auto-save for Materiale: debounce on description (table JSON) change
  const autoSaveMateriale = useCallback(async (descValue) => {
    if (!isMateriale) return;
    if (descValue === lastSavedDescRef.current) return;
    lastSavedDescRef.current = descValue;
    try {
      let savedPoint = materialePoint;
      if (materialePoint?.id) {
        await onUpdate({ id: materialePoint.id, description: descValue, category: "Materiale", meeting_date: initialDueDate || materialePoint.meeting_date });
      } else {
        const created = await onSubmit({
          category: "Materiale",
          description: descValue,
          action: "",
          owner_role: null,
          owner_name: "",
          owner_email: "",
          meeting_date: initialDueDate || "",
          due_date: "",
          is_critical: false,
        });
        if (created?.id) { setMaterialePoint(created); savedPoint = created; }
      }
    } catch (err) { console.error("Materiale autosave failed:", err); }
  }, [isMateriale, materialePoint, initialDueDate, onSubmit, onUpdate]);

  const autoSaveQuality = useCallback(async (descValue) => {
    if (!isQuality) return;
    if (descValue === lastSavedDescRef.current) return;
    lastSavedDescRef.current = descValue;
    try {
      if (qualityPoint?.id) {
        await onUpdate({ id: qualityPoint.id, description: descValue, is_critical: form.is_critical, client_complaint: form.client_complaint, category: "Quality", meeting_date: initialDueDate || qualityPoint.meeting_date });
      } else {
        const created = await onSubmit({
          category: "Quality",
          description: descValue,
          client_complaint: form.client_complaint,
          action: "",
          owner_role: null,
          owner_name: "",
          owner_email: "",
          meeting_date: initialDueDate || "",
          due_date: "",
          is_critical: form.is_critical,
        });
        if (created?.id) setQualityPoint(created);
      }
    } catch (err) { console.error("Quality autosave failed:", err); }
  }, [isQuality, qualityPoint, initialDueDate, onSubmit, onUpdate, form.is_critical, form.client_complaint]);

  const autoSaveUtilaje = useCallback(async (descValue) => {
    if (!isUtilaje) return;
    if (descValue === lastSavedDescRef.current) return;
    lastSavedDescRef.current = descValue;
    try {
      if (utilajePoint?.id) {
        await onUpdate({ id: utilajePoint.id, description: descValue, is_critical: form.is_critical, category: "Utilaje", meeting_date: initialDueDate || utilajePoint.meeting_date });
      } else {
        const created = await onSubmit({
          category: "Utilaje",
          description: descValue,
          action: "",
          owner_role: null,
          owner_name: "",
          owner_email: "",
          meeting_date: initialDueDate || "",
          due_date: "",
          is_critical: form.is_critical,
        });
        if (created?.id) setUtilajePoint(created);
      }
    } catch (err) { console.error("Utilaje autosave failed:", err); }
  }, [isUtilaje, utilajePoint, initialDueDate, onSubmit, onUpdate, form.is_critical]);

  const autoSavePersonal = useCallback(async (descValue) => {
    if (!isPersonal) return;
    if (descValue === lastSavedDescRef.current) return;
    lastSavedDescRef.current = descValue;
    try {
      if (personalPoint?.id) {
        await onUpdate({ id: personalPoint.id, description: descValue, category: "Personal", meeting_date: initialDueDate || personalPoint.meeting_date });
      } else {
        const created = await onSubmit({
          category: "Personal",
          description: descValue,
          action: "",
          owner_role: null,
          owner_name: "",
          owner_email: "",
          meeting_date: initialDueDate || "",
          due_date: "",
          is_critical: false,
        });
        if (created?.id) setPersonalPoint(created);
      }
    } catch (err) { console.error("Personal autosave failed:", err); }
  }, [isPersonal, personalPoint, initialDueDate, onSubmit, onUpdate]);

  useEffect(() => {
    if (!isMateriale && !isQuality && !isUtilaje && !isPersonal) return;
    if (form.description === lastSavedDescRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (isMateriale) autoSaveMateriale(form.description);
      else if (isQuality) autoSaveQuality(form.description);
      else if (isUtilaje) autoSaveUtilaje(form.description);
      else autoSavePersonal(form.description);
    }, 1200);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [form.description, isMateriale, isQuality, isUtilaje, isPersonal, autoSaveMateriale, autoSaveQuality, autoSaveUtilaje, autoSavePersonal]);

  const submitRef = useRef(() => {});
  submitRef.current = () => {
    if (isMateriale) {
      autoSaveMateriale(form.description);
    } else if (isQuality) {
      lastSavedDescRef.current = null;
      autoSaveQuality(form.description);
    } else if (isUtilaje) {
      lastSavedDescRef.current = null;
      autoSaveUtilaje(form.description);
    } else if (isPersonal) {
      autoSavePersonal(form.description);
    } else if (isValid) {
      handleSubmit({ preventDefault: () => {} });
    }
  };
  useImperativeHandle(ref, () => ({
    submit: () => submitRef.current(),
    setCritical: (val) => setForm((f) => ({ ...f, is_critical: val })),
  }), []);

  const labelStyle = { fontFamily: "Barlow, sans-serif", fontWeight: 600, fontSize: 12, color: "#4A6494", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4, display: "block" };
  const inputStyle = { width: "100%", border: "1.5px solid #D8E2F0", borderRadius: 7, padding: "9px 12px", fontFamily: "Barlow, sans-serif", fontWeight: 500, fontSize: 14, color: "#101C34", background: "#FFFFFF", outline: "none", boxSizing: "border-box" };

  // Personal layout: interactive table + status/delete buttons
  if (isPersonal) {
    const currentStatus = personalPoint?.status || "Open";
    return (
      <div style={{ background: "#FFFFFF", border: "1.5px solid #D8E2F0", borderRadius: 12, padding: 20, fontFamily: "Barlow, sans-serif" }}>
        <PersonalTable value={form.description} onChange={(val) => setForm((f) => ({ ...f, description: val }))} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          {personalPoint?.id && STATUS_BUTTONS.map((btn) => (
            <button
              key={btn.key}
              type="button"
              onClick={() => { onStatusChange?.(personalPoint.id, btn.key); setPersonalPoint((p) => p ? { ...p, status: btn.key } : p); }}
              style={{
                background: currentStatus === btn.key ? btn.color : "#FFFFFF",
                color: currentStatus === btn.key ? "#FFFFFF" : btn.color,
                border: `1.5px solid ${btn.color}`,
                borderRadius: 7,
                padding: "8px 18px",
                fontFamily: "Barlow, sans-serif",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {btn.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              if (!prevDayPersonalPoint?.description) return;
              const copiedDesc = prevDayPersonalPoint.description;
              lastSavedDescRef.current = null;
              setForm((f) => ({ ...f, description: copiedDesc }));
              setTimeout(() => autoSavePersonal(copiedDesc), 0);
            }}
            disabled={!prevDayPersonalPoint?.description}
            style={{
              marginLeft: "auto",
              background: prevDayPersonalPoint?.description ? "#3B82F6" : "#D8E2F0",
              color: "#FFFFFF",
              border: "none",
              borderRadius: 7,
              padding: "8px 18px",
              fontFamily: "Barlow, sans-serif",
              fontWeight: 700,
              fontSize: 13,
              cursor: prevDayPersonalPoint?.description ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.15s",
            }}
          >
            <Copy className="w-4 h-4" />
            Copy last day
          </button>
          {personalPoint?.id && (
            <button
              type="button"
              onClick={() => { if (window.confirm("Delete this point?")) { onDeletePoint?.(personalPoint.id); setPersonalPoint(null); if (onSubmitted) onSubmitted(); } }}
              style={{
                background: "#EF4444",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 7,
                padding: "8px 18px",
                fontFamily: "Barlow, sans-serif",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    );
  }

  // Materiale layout: table + status/delete buttons only
  if (isMateriale) {
    const currentStatus = materialePoint?.status || "Open";
    return (
      <div style={{ background: "#FFFFFF", border: "1.5px solid #D8E2F0", borderRadius: 12, padding: 20, fontFamily: "Barlow, sans-serif" }}>
        <MaterialeTable value={form.description} onChange={(val) => setForm((f) => ({ ...f, description: val }))} userOptions={userOptions} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          {materialePoint?.id && STATUS_BUTTONS.map((btn) => (
            <button
              key={btn.key}
              type="button"
              onClick={() => { onStatusChange?.(materialePoint.id, btn.key); setMaterialePoint((p) => p ? { ...p, status: btn.key } : p); }}
              style={{
                background: currentStatus === btn.key ? btn.color : "#FFFFFF",
                color: currentStatus === btn.key ? "#FFFFFF" : btn.color,
                border: `1.5px solid ${btn.color}`,
                borderRadius: 7,
                padding: "8px 18px",
                fontFamily: "Barlow, sans-serif",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {btn.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              if (!prevDayMaterialePoint?.description) return;
              const copiedDesc = prevDayMaterialePoint.description;
              lastSavedDescRef.current = null; // force autosave to fire
              setForm((f) => ({ ...f, description: copiedDesc }));
              // Trigger immediate autosave
              setTimeout(() => autoSaveMateriale(copiedDesc), 0);
            }}
            disabled={!prevDayMaterialePoint?.description}
            style={{
              marginLeft: "auto",
              background: prevDayMaterialePoint?.description ? "#3B82F6" : "#D8E2F0",
              color: "#FFFFFF",
              border: "none",
              borderRadius: 7,
              padding: "8px 18px",
              fontFamily: "Barlow, sans-serif",
              fontWeight: 700,
              fontSize: 13,
              cursor: prevDayMaterialePoint?.description ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.15s",
            }}
          >
            <Copy className="w-4 h-4" />
            Copy last day
          </button>
          {materialePoint?.id && (
            <button
              type="button"
              onClick={() => { if (window.confirm("Delete this point?")) { onDeletePoint?.(materialePoint.id); setMaterialePoint(null); if (onSubmitted) onSubmitted(); } }}
              style={{
                background: "#EF4444",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 7,
                padding: "8px 18px",
                fontFamily: "Barlow, sans-serif",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Delete
              </button>
              )}
              </div>
              </div>
              );
              }

              if (isQuality) {
    return (
      <div style={{ background: "#FFFFFF", border: "1.5px solid #D8E2F0", borderRadius: 12, padding: 20, fontFamily: "Barlow, sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>{t.description} *</label>
            {initialDescription && HAS_ISSUE_REF.test(initialDescription) && !editingPoint ? (
              <div style={{ border: "1.5px solid #D8E2F0", borderRadius: 7, padding: "9px 12px", background: "#F8FAFC", minHeight: 80, fontSize: 14, fontWeight: 500, color: "#101C34", lineHeight: 1.6, whiteSpace: "pre-line", boxSizing: "border-box" }}>
                <IssueLinkText text={initialDescription} issues={issues} />
              </div>
            ) : (
              <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder={t.descriptionPlaceholder} rows={3} style={{ ...inputStyle, resize: "vertical", minHeight: 80 }} />
            )}
          </div>
          <div>
            <label style={labelStyle}>Client Complaint</label>
            <textarea value={form.client_complaint} onChange={(e) => setForm((f) => ({ ...f, client_complaint: e.target.value }))} placeholder="Describe the client complaint..." rows={3} style={{ ...inputStyle, resize: "vertical", minHeight: 80 }} />
            <button
              type="button"
              onClick={async () => {
                setSavingComplaint(true);
                try {
                  if (qualityPoint?.id) {
                    await onUpdate({ id: qualityPoint.id, client_complaint: form.client_complaint });
                  } else if (form.description.trim()) {
                    const created = await onSubmit({
                      category: "Quality",
                      description: form.description,
                      client_complaint: form.client_complaint,
                      action: "",
                      owner_role: null,
                      owner_name: "",
                      owner_email: "",
                      meeting_date: initialDueDate || "",
                      due_date: "",
                      is_critical: form.is_critical,
                    });
                    if (created?.id) setQualityPoint(created);
                  }
                } catch (err) { console.error(err); }
                finally { setSavingComplaint(false); }
              }}
              disabled={savingComplaint}
              style={{ marginTop: 8, background: savingComplaint ? "#D8E2F0" : "#F39201", color: "#FFFFFF", border: "none", borderRadius: 7, padding: "8px 20px", fontFamily: "Barlow, sans-serif", fontWeight: 700, fontSize: 13, cursor: savingComplaint ? "not-allowed" : "pointer", transition: "all 0.15s" }}
            >
              {savingComplaint ? "Saving..." : "Save Client Complaint"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isUtilaje) {
    return (
      <div style={{ background: "#FFFFFF", border: "1.5px solid #D8E2F0", borderRadius: 12, padding: 20, fontFamily: "Barlow, sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>{t.description} *</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder={t.descriptionPlaceholder} rows={3} style={{ ...inputStyle, resize: "vertical", minHeight: 80 }} />
            {form.description && HAS_ISSUE_REF.test(form.description) && (
              <div style={{ marginTop: 8, border: "1.5px solid #D8E2F0", borderRadius: 7, padding: "9px 12px", background: "#F8FAFC", fontSize: 14, fontWeight: 500, color: "#101C34", lineHeight: 1.6, whiteSpace: "pre-line", boxSizing: "border-box" }}>
                <UtilajeLinkText text={form.description} issues={issues} />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#FFFFFF", border: "1.5px solid #D8E2F0", borderRadius: 12, padding: 20, fontFamily: "Barlow, sans-serif" }}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={labelStyle}>{t.description} *</label>
          {initialDescription && HAS_ISSUE_REF.test(initialDescription) && !editingPoint ? (
            <div style={{ border: "1.5px solid #D8E2F0", borderRadius: 7, padding: "9px 12px", background: "#F8FAFC", minHeight: 80, fontSize: 14, fontWeight: 500, color: "#101C34", lineHeight: 1.6, whiteSpace: "pre-line", boxSizing: "border-box" }}>
              <IssueLinkText text={initialDescription} issues={issues} />
            </div>
          ) : (
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder={t.descriptionPlaceholder} rows={3} style={{ ...inputStyle, resize: "vertical", minHeight: 80 }} />
          )}
        </div>
        {form.category === "Quality" && (
          <div>
            <label style={labelStyle}>Client Complaint</label>
            <textarea value={form.client_complaint} onChange={(e) => setForm((f) => ({ ...f, client_complaint: e.target.value }))} placeholder="Describe the client complaint..." rows={3} style={{ ...inputStyle, resize: "vertical", minHeight: 80 }} />
            {editingPoint && (
              <button
                type="button"
                onClick={async () => {
                  setSavingComplaint(true);
                  try { await onUpdate({ id: editingPoint.id, client_complaint: form.client_complaint }); }
                  catch (err) { console.error(err); }
                  finally { setSavingComplaint(false); }
                }}
                disabled={savingComplaint}
                style={{ marginTop: 8, background: savingComplaint ? "#D8E2F0" : "#F39201", color: "#FFFFFF", border: "none", borderRadius: 7, padding: "8px 20px", fontFamily: "Barlow, sans-serif", fontWeight: 700, fontSize: 13, cursor: savingComplaint ? "not-allowed" : "pointer", transition: "all 0.15s" }}
              >
                {savingComplaint ? "Saving..." : "Save Client Complaint"}
              </button>
            )}
          </div>
        )}
        <div>
          <label style={labelStyle}>{t.action}</label>
          <textarea value={form.action} onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))} placeholder={t.actionPlaceholder} rows={3} style={{ ...inputStyle, resize: "vertical", minHeight: 80 }} />
        </div>
        <div>
          <label style={labelStyle}>{t.ownerRole}</label>
          <select value={form.owner_role} onChange={(e) => setForm((f) => ({ ...f, owner_role: e.target.value }))} style={{ ...inputStyle, cursor: "pointer" }}>
            <option value="">{t.selectRole}</option>
            {OWNER_ROLES.map((r) => <option key={r} value={r}>{t.roles?.[r] || r}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>{t.ownerName}</label>
          <select
            value={form.owner_email || ""}
            onChange={(e) => {
              const u = userOptions.find((o) => o.email === e.target.value);
              setForm((f) => ({ ...f, owner_email: u ? u.email : "", owner_name: u ? u.label : "" }));
            }}
            style={{ ...inputStyle, cursor: "pointer" }}
          >
            <option value="">{t.selectUser}</option>
            {userOptions.map((u) => <option key={u.email} value={u.email}>{u.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>{t.dueDate}</label>
          <input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} style={inputStyle} />
        </div>
        <button type="submit" disabled={!isValid || isSubmitting} style={{ background: isValid && !isSubmitting ? "#F39201" : "#D8E2F0", color: isValid && !isSubmitting ? "#FFFFFF" : "#9CB3D0", border: "none", borderRadius: 7, padding: "11px 0", fontFamily: "Barlow, sans-serif", fontWeight: 700, fontSize: 15, cursor: isValid && !isSubmitting ? "pointer" : "not-allowed", transition: "all 0.15s", width: "100%" }}>
          {isSubmitting ? "..." : (editingPoint ? (t.modifyPoint || "Modify Point") : t.addPoint)}
        </button>
      </form>
    </div>
  );
});

export default AddPointForm;