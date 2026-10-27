import React, { useMemo, useRef, useEffect, useState } from "react";
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, subDays, addDays } from "date-fns";
import { CATEGORIES, getCellStatusColor } from "@/lib/standupUtils";
import { countPersonalFilled } from "./PersonalTable";

import MonthSelector from "./MonthSelector";
import { ComposedChart, Bar, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip } from "recharts";

// Custom bar component to render colored bars based on score
const CustomBar = (props) => {
  const { fill, x, y, width, height, payload } = props;
  if (!payload || width === undefined || height === undefined) return null;
  const barColor = payload.scoreColor || "#3B82F6";
  return (
    <rect x={x} y={y} width={width} height={height} fill={barColor} />
  );
};

// Custom line component to render colored line segments based on cumulative average
const CustomLine = (props) => {
  const { points, stroke, strokeWidth } = props;
  if (!points || points.length < 2) return null;
  return (
    <g>
      {points.map((point, i) => {
        if (i === points.length - 1 || !points[i + 1]) return null;
        const x1 = point.x;
        const y1 = point.y;
        const x2 = points[i + 1].x;
        const y2 = points[i + 1].y;
        const lineColor = point.payload?.cumulativeColor || "#EF4444";
        return (
          <line
            key={`line-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={lineColor}
            strokeWidth={6}
          />
        );
      })}
    </g>
  );
};



const LOCALE_MAP = { ro: "ro-RO", en: "en-GB", de: "de-DE", nl: "nl-NL" };

// Start date of the Daily Standup: 1 June 2026
const MIN_MONTH = new Date(2026, 5, 1);

export default function StandupGrid({ points, issues = [], t, lang, onCellClick, isAdmin = true }) {
  const locale = LOCALE_MAP[lang] || "en-GB";
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const tomorrow = format(addDays(today, 1), "yyyy-MM-dd");

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const cur = new Date(today.getFullYear(), today.getMonth(), 1);
    return cur < MIN_MONTH ? new Date(MIN_MONTH) : cur;
  });

  // Build the list of selectable months from June 2026 up to ~2 years ahead of today.
  const months = useMemo(() => {
    const list = [];
    const end = new Date(today.getFullYear() + 2, today.getMonth(), 1);
    let cur = new Date(MIN_MONTH);
    while (cur <= end) {
      list.push({
        key: `${cur.getFullYear()}-${cur.getMonth()}`,
        date: new Date(cur),
        label: cur.toLocaleDateString(locale, { month: "long", year: "numeric" }),
      });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
    return list;
  }, [locale]);

  const selectedKey = `${selectedMonth.getFullYear()}-${selectedMonth.getMonth()}`;

  const days = useMemo(() => {
    return eachDayOfInterval({ start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) });
  }, [selectedMonth]);

  const todayRef = useRef(null);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    if (todayRef.current) {
      todayRef.current.scrollIntoView({ behavior: "auto", inline: "end", block: "nearest" });
    }
  }, [selectedMonth]);

  const handleSelectMonth = (m) => {
    setSelectedMonth(m.date);
    setSelectedDate(null);
  };

  const toggleSelect = (dateStr) => {
    setSelectedDate((prev) => (prev === dateStr ? null : dateStr));
  };

  const countForCell = (category, date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const cellPoints = points.filter((p) => p.category === category && p.meeting_date === dateStr && !p.is_archived && p.description && p.description.trim());
    if (category === "Materiale") {
      return cellPoints.reduce((sum, p) => {
        if (!p.description) return sum;
        try {
          const rows = JSON.parse(p.description);
          return sum + (Array.isArray(rows) ? rows.filter((r) => r && Object.values(r).some((v) => v && String(v).trim())).length : 0);
        } catch { return sum; }
      }, 0);
    }
    if (category === "Personal") {
      return cellPoints.reduce((sum, p) => sum + countPersonalFilled(p.description), 0);
    }
    return cellPoints.length;
  };

  const hasCritical = (category, date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return points.some((p) => p.category === category && p.meeting_date === dateStr && !p.is_archived && p.is_critical);
  };

  // A cell blinks when it has an unresolved point whose Termen Limita (due_date) has passed today
  const hasOverdueAction = (category, date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return points.some((p) => p.category === category && p.meeting_date === dateStr && !p.is_archived && p.description && p.description.trim() && p.status !== "Resolved" && p.status !== "Vizionat/Analizat" && p.due_date && p.due_date < todayStr);
  };

  // Quality row: X = issues created on the previous day, Y = total NOK parts from those issues
  const qualityStats = (date) => {
    const prevDateStr = format(subDays(date, 1), "yyyy-MM-dd");
    const dayIssues = issues.filter((i) => i.reported_date === prevDateStr);
    const x = dayIssues.length;
    const y = dayIssues.reduce((s, i) => s + (Number(i.parts_nok) || 0), 0);
    return { x, y };
  };

  // Determine the color of a cell's button: "green" | "yellow" | "red" | "gray"
  const getCellColor = (cat, date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    // Only calculate color for today and past dates
    if (dateStr > todayStr) return null;
    return getCellStatusColor(points, cat, dateStr);
  };

  // Daily score per column: (100/7) × green + 10 × yellow + 5 × red
  const dailyScore = (date) => {
    let green = 0, yellow = 0, red = 0;
    for (const cat of CATEGORIES) {
      const c = getCellColor(cat, date);
      if (c === "green" || c === "gray") green++;
      else if (c === "yellow") yellow++;
      else if (c === "red") red++;
    }
    return (100 / 7) * green + 10 * yellow + 5 * red;
  };

  // Get score color: green >= 95, yellow > 90 and < 95, red < 90
  const getScoreColor = (score) => {
    if (score >= 95) return "#22C55E"; // green
    if (score > 90) return "#FCD34D"; // yellow
    return "#EF4444"; // red
  };

  // Chart data: bars = daily score, line = cumulative average from month start to today
  const chartData = useMemo(() => {
    let cumSum = 0;
    let cumCount = 0;
    return days.map((d) => {
      const score = dailyScore(d);
      const isPastOrToday = format(d, "yyyy-MM-dd") <= todayStr;
      if (isPastOrToday) {
        cumSum += score;
        cumCount += 1;
      }
      const cumulativeAvg = isPastOrToday ? Math.round((cumSum / cumCount) * 10) / 10 : null;
      return {
        day: format(d, "d"),
        score: Math.round(score * 10) / 10,
        scoreColor: getScoreColor(Math.round(score * 10) / 10),
        cumulativeAvg,
        cumulativeColor: cumulativeAvg !== null ? getScoreColor(cumulativeAvg) : null,
      };
    });
  }, [days, points, issues, todayStr]);

  const monthlyAverage = useMemo(() => {
    let sum = 0;
    let count = 0;
    for (const d of days) {
      const dateStr = format(d, "yyyy-MM-dd");
      if (dateStr <= todayStr) {
        sum += dailyScore(d);
        count++;
      }
    }
    return count > 0 ? Math.round((sum / count) * 10) / 10 : null;
  }, [days, todayStr]);

  const monthlyAverages = useMemo(() => {
    const result = {};
    for (const m of months) {
      const start = startOfMonth(m.date);
      const end = endOfMonth(m.date);
      const monthDays = eachDayOfInterval({ start, end });
      let sum = 0;
      let count = 0;
      for (const d of monthDays) {
        const dateStr = format(d, "yyyy-MM-dd");
        if (dateStr <= todayStr) {
          sum += dailyScore(d);
          count++;
        }
      }
      result[m.key] = count > 0 ? Math.round((sum / count) * 10) / 10 : null;
    }
    return result;
  }, [months, todayStr]);

  const labelCellStyle = {
    background: "#101C34", color: "#FFFFFF", fontFamily: "Barlow, sans-serif",
    fontWeight: 700, fontSize: 13, padding: "0 14px", position: "sticky", left: 0,
    zIndex: 2, borderRight: "2px solid #1B2E50", whiteSpace: "nowrap", minWidth: 96, textAlign: "left",
  };
  const headerCellStyle = {
    minWidth: 60, textAlign: "center", padding: "6px 2px",
    fontFamily: "Barlow, sans-serif", borderRight: "1px solid #E5EBF4",
  };
  const cellStyle = {
    minWidth: 60, textAlign: "center", padding: "6px",
    borderRight: "1px solid #E5EBF4", borderBottom: "1px solid #E5EBF4",
  };

  return (
    <div style={{ background: "#FFFFFF", border: "1.5px solid #D8E2F0", borderRadius: 12, overflow: "hidden", fontFamily: "Barlow, sans-serif" }}>
      <MonthSelector months={months} selectedKey={selectedKey} onSelect={handleSelectMonth} monthlyAverages={monthlyAverages} />
      <div style={{ overflowX: "auto", overflowY: "hidden" }}>
        <table style={{ borderCollapse: "collapse", width: "max-content" }}>
          <tbody>
            <tr>
              <td style={labelCellStyle}>{t.dateLabel}</td>
              {days.map((d) => {
                const isToday = isSameDay(d, today);
                const dateStr = format(d, "yyyy-MM-dd");
                const isSelected = selectedDate === dateStr;
                const isHighlighted = isToday || isSelected;
                return (
                  <td
                    key={d.toISOString()}
                    ref={isToday ? todayRef : null}
                    onClick={() => toggleSelect(dateStr)}
                    style={{ ...headerCellStyle, minWidth: isHighlighted ? 75 : 60, background: isHighlighted ? "#FFF3E0" : "transparent", cursor: "pointer" }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 14, color: isHighlighted ? "#E65100" : "#101C34" }}>{format(d, "d")}</div>
                    <div style={{ fontSize: 9, color: "#9CB3D0", fontWeight: 600, textTransform: "uppercase" }}>
                      {d.toLocaleDateString(locale, { weekday: "short" })}
                    </div>
                  </td>
                );
              })}
            </tr>
            {CATEGORIES.map((cat) => (
              <tr key={cat}>
                <td style={labelCellStyle}>{t.categories[cat]}</td>
                {days.map((d) => {
                  const count = countForCell(cat, d);
                  const dateStr = format(d, "yyyy-MM-dd");
                  const isToday = isSameDay(d, today);
                  const isSelected = selectedDate === dateStr;
                  const isHighlighted = isToday || isSelected;
                  const isFuture = dateStr > todayStr;
                  const isQuality = cat === "Quality";
                  const qStats = isQuality ? qualityStats(d) : null;
                  const isEditableFuture = dateStr === tomorrow;
                  const isDisabledFuture = dateStr > tomorrow;
                  const cellColor = getCellColor(cat, d);
                  const shouldBlink = hasOverdueAction(cat, d) && cellColor !== "green";
                  const btnBg = (isDisabledFuture || isEditableFuture) ? "#E5E7EB" : (cellColor === "red" ? "#EF4444" : cellColor === "yellow" ? "#FCD34D" : cellColor === "green" ? "#4ADE80" : "#D1D5DB");
                  const display = isDisabledFuture ? "-" : (isQuality ? (qStats.x > 0 ? `${qStats.x} / ${qStats.y}` : "+") : (count > 0 ? count : "+"));
                  return (
                    <td key={d.toISOString()} style={{ ...cellStyle, minWidth: isHighlighted ? 75 : 60, background: isHighlighted ? "#FFF8EE" : "transparent" }}>
                      <button
                        className={shouldBlink ? "animate-blink-red" : ""}
                        onClick={() => !isDisabledFuture && onCellClick(cat, dateStr)}
                        disabled={isDisabledFuture}
                        style={{
                          width: "100%", minWidth: 48, minHeight: 32,
                          background: "#F3F4F6", color: "#1F2937", border: `6px solid ${btnBg}`, borderRadius: 6,
                          fontFamily: "Barlow, sans-serif", fontWeight: 700, fontSize: 13,
                          cursor: isDisabledFuture ? "default" : "pointer", transition: "border-color 0.15s", opacity: isDisabledFuture ? 0.6 : 1,
                        }}
                      >
                        {display}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* Gray separator between Diverse and Scor zilnic */}
            <tr>
              <td colSpan={days.length + 1} style={{ background: "#D8E2F0", height: 6, padding: 0, border: "none" }} />
            </tr>
            {/* Daily score row */}
            <tr>
              <td style={labelCellStyle}>{t.dailyScoreLabel}</td>
              {days.map((d) => {
                const dateStr = format(d, "yyyy-MM-dd");
                const isToday = isSameDay(d, today);
                const isSelected = selectedDate === dateStr;
                const isHighlighted = isToday || isSelected;
                const isFuture = dateStr > todayStr;
                const score = isFuture ? null : dailyScore(d);
                const scoreBg = score !== null ? getScoreColor(score) : "transparent";
                return (
                  <td key={dateStr} style={{ ...cellStyle, minWidth: isHighlighted ? 75 : 60, background: isHighlighted ? "#FFF8EE" : "transparent" }}>
                    <div style={{
                      width: "100%", minWidth: 48, minHeight: 32,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: scoreBg, color: "#9CB3D0", borderRadius: 6,
                      fontFamily: "Barlow, sans-serif", fontWeight: 700, fontSize: 13,
                    }}>
                      {score !== null ? Math.round(score) : "–"}
                    </div>
                  </td>
                );
              })}
            </tr>
            {/* Target 95% row */}
            <tr>
              <td style={labelCellStyle}>
                <div>{t.target95Label}</div>
                {monthlyAverage !== null && (
                  <div style={{ fontSize: 12, marginTop: 4, padding: "4px 8px", borderRadius: 4, background: getScoreColor(monthlyAverage), color: "#FFFFFF", textAlign: "center" }}>
                    {monthlyAverage}
                  </div>
                )}
              </td>
              <td colSpan={days.length} style={{ padding: 0, height: 140, borderBottom: "1px solid #E5EBF4" }}>
                <div style={{ width: "100%", height: 140 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 5, bottom: 0, left: 0 }}>
                      <XAxis dataKey="day" tick={{ fontSize: 9 }} interval={0} />
                      <YAxis domain={[0, 105]} tick={{ fontSize: 9 }} width={28} />
                      <Bar dataKey="score" shape={<CustomBar />} barSize={20} isAnimationActive={false} />
                      <Line dataKey="cumulativeAvg" shape={<CustomLine />} strokeWidth={2} dot={false} isAnimationActive={false} />
                      <ReferenceLine y={95} stroke="#000000" strokeDasharray="3 3" />
                      <Tooltip />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}