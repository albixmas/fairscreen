import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number, decimals: number = 1): string {
  return n.toFixed(decimals);
}

export function getZoneColor(zone: string): string {
  switch (zone) {
    case "STRONG_YES": return "#059669";
    case "YES": return "#10b981";
    case "MAYBE": return "#f59e0b";
    case "NO": return "#ef4444";
    case "PRESCREEN_FAIL": return "#6b7280";
    default: return "#6b7280";
  }
}

export function getZoneLabel(zone: string): string {
  switch (zone) {
    case "STRONG_YES": return "Strong Yes";
    case "YES": return "Yes";
    case "MAYBE": return "Maybe";
    case "NO": return "No";
    case "PRESCREEN_FAIL": return "Pre-screen Fail";
    default: return zone;
  }
}

export function getZoneBgClass(zone: string): string {
  switch (zone) {
    case "STRONG_YES": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "YES": return "bg-green-50 text-green-700 border-green-200";
    case "MAYBE": return "bg-amber-50 text-amber-700 border-amber-200";
    case "NO": return "bg-red-50 text-red-700 border-red-200";
    case "PRESCREEN_FAIL": return "bg-gray-50 text-gray-600 border-gray-200";
    default: return "bg-gray-50 text-gray-600 border-gray-200";
  }
}

export function getSubcategoryLabel(code: string): string {
  const labels: Record<string, string> = {
    E1: "Institution Strength",
    E2: "Degree Performance",
    E3: "Master's Signal",
    E4: "Academic Excellence",
    E5: "University Engagement",
    C1: "Career Quality",
    C2: "Leadership Potential",
    C3: "Entrepreneurial Mindset",
    C4: "Non-Academic Excellence",
    C5: "Distinction Signal",
  };
  return labels[code] ?? code;
}
