// ============================================================
// GMIS — Responsive Utilities
// Use useResponsive() in any component to get the current
// breakpoint and apply different styles per screen size.
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useWindowDimensions } from "react-native";

export type Breakpoint = "xs" | "sm" | "md" | "lg" | "xl";

// Breakpoint widths in pixels
export const breakpoints = {
  xs:  0,    // 0–479    — phone portrait
  sm:  480,  // 480–767  — phone landscape
  md:  768,  // 768–1023 — tablet portrait
  lg:  1024, // 1024–1279 — tablet landscape / small laptop
  xl:  1280, // 1280+    — desktop
} as const;

export interface ResponsiveInfo {
  width:       number;
  height:      number;
  breakpoint:  Breakpoint;
  isXs:        boolean; // phone portrait
  isSm:        boolean; // phone landscape
  isMobile:    boolean; // xs or sm
  isMd:        boolean; // tablet portrait
  isLg:        boolean; // tablet landscape
  isDesktop:   boolean; // lg or xl
  isXl:        boolean; // large desktop
  isTabletOrUp: boolean;
  // Sidebar should be visible on desktop
  showSidebar: boolean;
  // Bottom nav should show on mobile
  showBottomNav: boolean;
  // Columns for grid layouts
  gridCols: number;
  // Padding scale
  pagePadding: number;
}

export function useResponsive(): ResponsiveInfo {
  const { width, height } = useWindowDimensions();

  const breakpoint: Breakpoint =
    width >= breakpoints.xl ? "xl" :
    width >= breakpoints.lg ? "lg" :
    width >= breakpoints.md ? "md" :
    width >= breakpoints.sm ? "sm" :
    "xs";

  const isXs      = breakpoint === "xs";
  const isSm      = breakpoint === "sm";
  const isMobile  = isXs || isSm;
  const isMd      = breakpoint === "md";
  const isLg      = breakpoint === "lg";
  const isXl      = breakpoint === "xl";
  const isDesktop = isLg || isXl;

  return {
    width,
    height,
    breakpoint,
    isXs,
    isSm,
    isMobile,
    isMd,
    isLg,
    isDesktop,
    isXl,
    isTabletOrUp:  !isMobile,
    showSidebar:   isDesktop,
    showBottomNav: isMobile,
    gridCols:      isXl ? 4 : isLg ? 3 : isMd ? 2 : 1,
    pagePadding:   isDesktop ? 28 : isMd ? 20 : 16,
  };
}

/**
 * Pick a value based on current breakpoint.
 * responsive({ xs: 12, md: 16, lg: 20 }, breakpoint)
 * Falls back to smaller breakpoint if current not defined.
 */
export function responsive<T>(
  values: Partial<Record<Breakpoint, T>>,
  breakpoint: Breakpoint
): T | undefined {
  const order: Breakpoint[] = ["xl", "lg", "md", "sm", "xs"];
  const idx = order.indexOf(breakpoint);
  for (let i = idx; i < order.length; i++) {
    const val = values[order[i]];
    if (val !== undefined) return val;
  }
  return undefined;
}