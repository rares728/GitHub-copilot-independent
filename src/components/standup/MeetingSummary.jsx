import React from "react";

export default function MeetingSummary({ t, summary, onDismiss }) {
  const { resolved, added, open, escalated, durationSeconds } = summary;
  const durationMins = Math.floor(durationSeconds / 60);
  const durSecs = durationSeconds % 60;
  const durationStr = `${durationMins}:${String(durSecs).padStart(2, "0")} ${t.minutes}`;

  const stats = [
    { label: t.resolvedToday, value: resolved, bg: "#E8F5EE", color: "#1A7A4A", border: "#A5D6B8", icon: "✅" },
    { label: t.addedToday, value: added, bg: "#FFF3E0", color: "#E65100", border: "#FFB74D", icon: "➕" },
    { label: t.stillOpen, value: open, bg: "#FDECEA", color: "#C0392B", border: "#EF9A9A", icon: "🔴" },
    { label: t.activeEscalations, value: escalated, bg: "#FDECEA", color: "#C0392B", border: "#EF9A9A", icon: "🚨" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(16,28,52,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, fontFamily: "Barlow, sans-serif" }}>
      <div style={{ background: "#FFFFFF", borderRadius: 16, padding: "48px 56px", maxWidth: 1200, width: "95%", boxShadow: "0 20px 60px rgba(16,28,52,0.3)" }}>
         <div className="flex items-center justify-between mb-4">
           <div>
             <h2 style={{ color: "#101C34", fontWeight: 700, fontSize: 36, margin: 0 }}>{t.meetingSummary}</h2>
             <p style={{ color: "#4A6494", fontSize: 16, marginTop: 6 }}>{t.meetingDuration}: {durationStr}</p>
           </div>
           <div style={{ background: "#E8F5EE", color: "#1A7A4A", borderRadius: 8, padding: "8px 16px", fontWeight: 600, fontSize: 14 }}>{t.meetingEnded}</div>
         </div>
         <div style={{ height: 2, background: "#D8E2F0", margin: "28px 0" }} />
         <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 40 }}>
           {stats.map((s) => (
             <div key={s.label} style={{ background: s.bg, border: `2px solid ${s.border}`, borderRadius: 12, padding: "24px 18px", textAlign: "center" }}>
               <div style={{ fontSize: 36, marginBottom: 8 }}>{s.icon}</div>
               <div style={{ fontSize: 48, fontWeight: 700, color: s.color, lineHeight: 1, marginBottom: 8 }}>{s.value}</div>
               <div style={{ fontSize: 14, fontWeight: 600, color: s.color, opacity: 0.8 }}>{s.label}</div>
             </div>
           ))}
         </div>
         <div className="flex justify-center">
           <button onClick={onDismiss} style={{ background: "#F39201", color: "#FFFFFF", border: "none", borderRadius: 8, padding: "14px 48px", fontFamily: "Barlow, sans-serif", fontWeight: 700, fontSize: 16, cursor: "pointer" }}>{t.dismiss}</button>
         </div>
       </div>
    </div>
  );
}