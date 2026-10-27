import { differenceInCalendarDays, parseISO, isValid } from "date-fns";

export const CATEGORIES = [
  "Personal",
  "Materiale",
  "Utilaje",
  "Quality",
  "Client",
  "Mentenanta",
  "Diverse",
];

export const OWNER_ROLES = [
  "Production",
  "Quality",
  "Purchasing",
  "Planning",
  "Maintenance",
  "Finance/Controlling",
  "CAD/CAM",
  "Lead Engineering",
  "Special Process",
  "General Manager",
];

export const STATUSES = ["Open", "In Progress", "Resolved", "Vizionat/Analizat"];

export const CATEGORY_ICONS = {
  "Personal": "👤",
  "Materiale": "📦",
  "Utilaje": "⚙️",
  "Quality": "🔍",
  "Client": "⭐",
  "Mentenanta": "🔧",
  "Diverse": "📋",
};

export const CATEGORY_COLORS = {
  "Personal": { bg: "#FFF3E0", text: "#E65100", border: "#FFB74D" },
  "Materiale": { bg: "#E0F2F1", text: "#00695C", border: "#80CBC4" },
  "Utilaje": { bg: "#F3E5F5", text: "#6A1B9A", border: "#CE93D8" },
  "Quality": { bg: "#E8EAF6", text: "#283593", border: "#9FA8DA" },
  "Client": { bg: "#E8F5E9", text: "#1B5E20", border: "#A5D6A7" },
  "Mentenanta": { bg: "#FCE4EC", text: "#880E4F", border: "#F48FB1" },
  "Diverse": { bg: "#ECEFF1", text: "#455A64", border: "#B0BEC5" },
};

export function getDaysOpen(point) {
  if (!point.created_at) return 0;
  const created = parseISO(point.created_at);
  if (!isValid(created)) return 0;
  return differenceInCalendarDays(new Date(), created);
}

export function isEscalated(point) {
  return point.status !== "Resolved" && point.status !== "Vizionat/Analizat" && getDaysOpen(point) >= 3;
}

export function isOverdue(point) {
  if (!point.due_date || point.status === "Resolved" || point.status === "Vizionat/Analizat") return false;
  const due = parseISO(point.due_date);
  if (!isValid(due)) return false;
  return differenceInCalendarDays(new Date(), due) > 0;
}

// Returns cell color based on point statuses: "gray" | "red" | "yellow" | "green"
export function getCellStatusColor(points, category, dateStr) {
  const cellPoints = points.filter((p) => p.category === category && p.meeting_date === dateStr && !p.is_archived && p.description && p.description.trim());
  if (cellPoints.length === 0) return "gray";
  if (cellPoints.some((p) => p.is_critical)) return "red";
  if (cellPoints.some((p) => p.status === "Open" || p.status === "In Progress")) return "yellow";
  return "green";
}

// Returns the cell's current status: "Open" | "In Progress" | "Resolved" | "Vizionat/Analizat" | null
export function getCellStatus(points, category, dateStr) {
  const cellPoints = points.filter((p) => p.category === category && p.meeting_date === dateStr && !p.is_archived);
  if (cellPoints.length === 0) return null;
  if (cellPoints.some((p) => p.status === "Open")) return "Open";
  if (cellPoints.some((p) => p.status === "In Progress")) return "In Progress";
  if (cellPoints.some((p) => p.status === "Vizionat/Analizat")) return "Vizionat/Analizat";
  return "Resolved";
}

export function sortPoints(points) {
  return [...points].sort((a, b) => {
    const aEsc = isEscalated(a) ? 0 : 1;
    const bEsc = isEscalated(b) ? 0 : 1;
    if (aEsc !== bEsc) return aEsc - bEsc;
    const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
    return aDate - bDate;
  });
}