// ============================================================
// GMIS — Helper Functions
// Complete set — all functions used across student pages.
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { Platform } from "react-native";

// ── Validation ─────────────────────────────────────────────
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidMatric(value: string): boolean {
  return value.trim().length >= 4;
}

export function isValidPassword(value: string): boolean {
  return value.length >= 8;
}

// ── Tenant slug detection ──────────────────────────────────
export function getTenantSlug(): string | null {
  if (Platform.OS !== "web") return null;
  try {
    const hostname = window.location.hostname;
    const parts    = hostname.split(".");
    if (parts.length >= 3 && parts[0] !== "www" && parts[0] !== "localhost" && parts[0] !== "") {
      return parts[0].toLowerCase();
    }
  } catch { /* SSR */ }
  return null;
}

// ── Tenant redirect ────────────────────────────────────────
export function redirectToTenant(slug: string, path = "/login"): void {
  if (Platform.OS !== "web") return;
  try {
    const { protocol, hostname, port } = window.location;
    const parts      = hostname.split(".");
    const baseDomain = parts.length >= 2 ? parts.slice(-2).join(".") : hostname;
    const portStr    = port ? `:${port}` : "";
    window.location.href = `${protocol}//${slug}.${baseDomain}${portStr}${path}`;
  } catch { window.location.reload(); }
}

// ── Formatting ─────────────────────────────────────────────
export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function formatNaira(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style:                 "currency",
    currency:              "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    return new Intl.DateTimeFormat("en-NG", {
      day:   "numeric",
      month: "short",
      year:  "numeric",
    }).format(new Date(dateStr));
  } catch { return dateStr; }
}

export function formatGPA(gpa: number): string {
  if (!gpa || gpa < 0) return "0.00";
  return Math.min(gpa, 5).toFixed(2);
}

// ── Time ago ───────────────────────────────────────────────
export function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins  = Math.floor(diff / 60_000);
    const hrs   = Math.floor(mins  / 60);
    const days  = Math.floor(hrs   / 24);
    const weeks = Math.floor(days  / 7);
    const months= Math.floor(days  / 30);

    if (mins  < 1)  return "just now";
    if (mins  < 60) return `${mins}m ago`;
    if (hrs   < 24) return `${hrs}h ago`;
    if (days  < 7)  return `${days}d ago`;
    if (weeks < 4)  return `${weeks}w ago`;
    if (months < 12)return `${months}mo ago`;
    return formatDate(dateStr);
  } catch { return ""; }
}

// ── Honour class ───────────────────────────────────────────
export function getHonourClass(gpa: number): string {
  if (gpa >= 4.5) return "First Class Honours";
  if (gpa >= 3.5) return "Second Class (Upper)";
  if (gpa >= 2.5) return "Second Class (Lower)";
  if (gpa >= 1.5) return "Third Class";
  if (gpa >= 1.0) return "Pass";
  return "Fail";
}

// ── Initials ───────────────────────────────────────────────
export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => (w[0] ?? "").toUpperCase())
    .join("");
}

// ── Greeting ───────────────────────────────────────────────
export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
