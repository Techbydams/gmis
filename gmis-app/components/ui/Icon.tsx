// ============================================================
// GMIS — Icon Component
// Single wrapper for all icons. Never import Ionicons directly.
// Add new icons to iconMap — never hardcode icon names elsewhere.
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/context/ThemeContext";
import { fontSize } from "@/theme/tokens";

// ── Semantic icon map ──────────────────────────────────────
const iconMap = {
  // Student navigation
  "nav-home":          "home-outline",
  "nav-results":       "bar-chart-outline",
  "nav-timetable":     "calendar-outline",
  "nav-payments":      "card-outline",
  "nav-courses":       "book-outline",
  "nav-voting":        "megaphone-outline",
  "nav-chat":          "chatbubbles-outline",
  "nav-social":        "people-outline",
  "nav-gpa":           "calculator-outline",
  "nav-clearance":     "document-text-outline",
  "nav-calendar":      "calendar-outline",
  "nav-ai":            "flash-outline",
  "nav-settings":      "settings-outline",
  "nav-attendance":    "qr-code-outline",
  // Admin navigation
  "nav-dashboard":     "grid-outline",
  "nav-approvals":     "time-outline",
  "nav-students":      "school-outline",
  "nav-academic":      "library-outline",
  "nav-idcards":       "id-card-outline",
  "nav-fees":          "cash-outline",
  "nav-elections":     "megaphone-outline",
  "nav-news":          "newspaper-outline",
  "nav-paystack":      "wallet-outline",
  // Lecturer navigation
  "nav-handouts":      "receipt-outline",
  // Actions
  "action-add":        "add-circle-outline",
  "action-edit":       "pencil-outline",
  "action-delete":     "trash-outline",
  "action-save":       "checkmark-circle-outline",
  "action-cancel":     "close-circle-outline",
  "action-send":       "send",
  "action-upload":     "cloud-upload-outline",
  "action-download":   "download-outline",
  "action-refresh":    "refresh-outline",
  "action-filter":     "filter-outline",
  "action-search":     "search-outline",
  "action-copy":       "copy-outline",
  "action-share":      "share-outline",
  // Status
  "status-success":    "checkmark-circle",
  "status-warning":    "warning",
  "status-error":      "close-circle",
  "status-info":       "information-circle",
  "status-pending":    "time",
  "status-locked":     "lock-closed",
  "status-unlocked":   "lock-open-outline",
  // User / auth
  "user-account":      "person-circle-outline",
  "user-student":      "school-outline",
  "user-lecturer":     "people-outline",
  "user-admin":        "shield-outline",
  "user-parent":       "heart-outline",
  "auth-logout":       "log-out-outline",
  "auth-password":     "key-outline",
  "auth-eye":          "eye-outline",
  "auth-eye-off":      "eye-off-outline",
  // Content
  "content-like":      "heart-outline",
  "content-liked":     "heart",
  "content-comment":   "chatbubble-outline",
  "content-image":     "image-outline",
  "content-video":     "videocam-outline",
  "content-file":      "document-outline",
  "content-link":      "link-outline",
  "content-qr":        "qr-code-outline",
  "content-trophy":    "trophy-outline",
  "content-star":      "star-outline",
  // UI helpers
  "ui-menu":           "menu",
  "ui-close":          "close",
  "ui-back":           "arrow-back",
  "ui-forward":        "arrow-forward",
  "ui-up":             "chevron-up",
  "ui-down":           "chevron-down",
  "ui-more":           "ellipsis-vertical",
  "ui-more-h":         "ellipsis-horizontal",
  "ui-external":       "open-outline",
  "ui-bell":           "notifications-outline",
  "ui-bell-active":    "notifications",
  "ui-moon":           "moon-outline",
  "ui-sun":            "sunny-outline",
  "ui-check":          "checkmark",
  "ui-radio-on":       "radio-button-on",
  "ui-radio-off":      "radio-button-off",
  "ui-theme":          "contrast-outline",
  // Academic
  "academic-grade":    "ribbon-outline",
  "academic-exam":     "clipboard-outline",
  "academic-course":   "book-outline",
  "academic-result":   "bar-chart-outline",
  "academic-faculty":  "business-outline",
  "academic-dept":     "business-outline",
  "academic-calendar": "calendar-outline",
  "academic-gpa":      "stats-chart-outline",
} as const;

export type IconName = keyof typeof iconMap;

// ── Size map — always use token scale ─────────────────────
const sizeMap = {
  "2xs": fontSize["2xs"],  // 10
  xs:    fontSize.xs,      // 11
  sm:    fontSize.lg,      // 16
  md:    fontSize.xl,      // 18 — slightly larger than text for visual balance
  lg:    fontSize["2xl"],  // 20
  xl:    fontSize["3xl"],  // 24
  "2xl": fontSize["4xl"],  // 28
  "3xl": fontSize["5xl"],  // 36
} as const;

export type IconSize = keyof typeof sizeMap;

interface IconProps {
  name:    IconName;
  size?:   IconSize | number;
  color?:  string;
  filled?: boolean;
}

export function Icon({ name, size = "md", color, filled = false }: IconProps) {
  const colors = useThemeColors();

  const iconName = (() => {
    let n = iconMap[name] as string;
    if (filled && n.endsWith("-outline")) n = n.replace("-outline", "");
    return n as keyof typeof Ionicons.glyphMap;
  })();

  const resolvedSize  = typeof size === "number" ? size : sizeMap[size];
  const resolvedColor = color ?? colors.text.secondary;

  return <Ionicons name={iconName} size={resolvedSize} color={resolvedColor} />;
}