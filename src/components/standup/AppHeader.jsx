import React from "react";
import { languages, formatDateInLang } from "@/lib/i18n";
import { getCellStatusColor, CATEGORIES } from "@/lib/standupUtils";
import { format } from "date-fns";

function hexPoints(cx, cy, r) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(" ");
}

function HexDecorations() {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden" xmlns="http://www.w3.org/2000/svg">
      {[
        { cx: 60, cy: 30, r: 22 }, { cx: 110, cy: 55, r: 14 }, { cx: 30, cy: 65, r: 10 },
        { cx: 1050, cy: 20, r: 18 }, { cx: 1100, cy: 50, r: 28 }, { cx: 1160, cy: 25, r: 12 },
        { cx: 550, cy: 10, r: 20 }, { cx: 600, cy: 40, r: 10 },
      ].map((h, i) => (
        <polygon key={i} points={hexPoints(h.cx, h.cy, h.r)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

function Timer({ secondsLeft, isActive }) {
  if (!isActive) return null;
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const display = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  const isAmber = secondsLeft <= 300 && secondsLeft > 120;
  const isRed = secondsLeft <= 120;
  const color = isRed ? "#EF4444" : isAmber ? "#F39201" : "#FFFFFF";
  return (
    <div className="flex flex-col items-center">
      <span style={{ color: "#9CB3D0", fontSize: 10, fontWeight: 600, letterSpacing: 1 }}>TIMER</span>
      <span style={{ color, fontFamily: "monospace", fontSize: 28, fontWeight: 700, lineHeight: 1, transition: "color 0.5s", textShadow: isRed ? "0 0 12px rgba(239,68,68,0.5)" : "none" }}>
        {display}
      </span>
    </div>
  );
}

export default function AppHeader({ t, lang, setLang, meetingActive, secondsLeft, onStartMeeting, onEndMeeting }) {
  return (
    <header style={{ background: "#101C34", position: "relative", overflow: "hidden" }} className="w-full">
      <div className="relative z-10 flex items-center justify-between px-6 py-3 gap-4">
        <HexDecorations />
        <div className="flex flex-col min-w-0">
          <span style={{ color: "#FFFFFF", fontFamily: "Barlow, sans-serif", fontWeight: 700, fontSize: 22, letterSpacing: 0.5 }}>{t.appTitle}</span>
          <span style={{ color: "#9CB3D0", fontFamily: "Barlow, sans-serif", fontWeight: 500, fontSize: 13 }}>{t.appSubtitle}</span>
        </div>
        <div className="flex-1 flex justify-center">
          <Timer secondsLeft={secondsLeft} isActive={meetingActive} />
        </div>
        <div className="flex items-center gap-3">
          {!meetingActive ? (
            <button onClick={onStartMeeting} style={{ background: "#F39201", color: "#FFFFFF", fontFamily: "Barlow, sans-serif", fontWeight: 600, fontSize: 14, border: "none", borderRadius: 6, padding: "8px 18px", cursor: "pointer", whiteSpace: "nowrap" }}>
              {t.startMeeting}
            </button>
          ) : (
            <button onClick={onEndMeeting} style={{ background: "transparent", color: "#FFFFFF", fontFamily: "Barlow, sans-serif", fontWeight: 600, fontSize: 14, border: "1.5px solid rgba(255,255,255,0.35)", borderRadius: 6, padding: "8px 18px", cursor: "pointer", whiteSpace: "nowrap" }}>
              {t.endMeeting}
            </button>
          )}
          <div className="flex items-center gap-1">
            {languages.map((l) => (
              <button key={l.code} onClick={() => setLang(l.code)} style={{ background: lang === l.code ? "#F39201" : "transparent", color: lang === l.code ? "#FFFFFF" : "#9CB3D0", border: lang === l.code ? "none" : "1px solid rgba(156,179,208,0.4)", borderRadius: 4, fontFamily: "Barlow, sans-serif", fontWeight: 600, fontSize: 12, padding: "4px 8px", cursor: "pointer", transition: "all 0.15s" }}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

export function DateSubBar({ t, lang, onShowOpenPoints, points = [] }) {
  const dateStr = formatDateInLang(new Date(), lang);
  
  const openPointsCount = (() => {
    const currentMonth = format(new Date(), "yyyy-MM");
    const monthDates = new Set();
    points.forEach((p) => {
      if (p.meeting_date && p.meeting_date.startsWith(currentMonth) && !p.is_archived) monthDates.add(p.meeting_date);
    });
    let count = 0;
    for (const dateStr of monthDates) {
      for (const cat of CATEGORIES) {
        const color = getCellStatusColor(points, cat, dateStr);
        if (color === "red" || color === "yellow") count++;
      }
    }
    return count;
  })();

  let badgeColor = "#22C55E"; // verde
  if (openPointsCount > 6) badgeColor = "#EF4444"; // roșu
  else if (openPointsCount > 3) badgeColor = "#FCD34D"; // galben
  
  return (
    <div style={{ background: "#1B2E50", borderTop: "1px solid rgba(255,255,255,0.06)" }} className="flex items-center gap-5 px-6 py-2">
      <span style={{ color: "#C8D8EC", fontFamily: "Barlow, sans-serif", fontWeight: 500, fontSize: 14, textTransform: "capitalize" }}>{dateStr}</span>
      <div className="flex-1" />
      <button onClick={onShowOpenPoints} style={{ background: "none", border: "none", cursor: "pointer", color: "#C8D8EC", fontFamily: "Barlow, sans-serif", fontWeight: 600, fontSize: 14, padding: 0, display: "flex", alignItems: "center", gap: 8 }}>
        {t.listOpenPoints}
        <div style={{ background: badgeColor, color: "#FFFFFF", borderRadius: "50%", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Barlow, sans-serif", fontWeight: 700, fontSize: 12 }}>
          {openPointsCount}
        </div>
      </button>
    </div>
  );
}