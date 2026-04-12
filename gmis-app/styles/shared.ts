// ============================================================
// GMIS — Shared Style Patterns
// Reusable layout styles and component size constants.
// Import from here instead of repeating inline patterns.
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { StyleSheet, Platform, type ViewStyle } from "react-native";
import { spacing, radius } from "@/theme/tokens";

// ── Cross-platform shadow helper ───────────────────────────
// React Native Web deprecated shadow* props in favour of boxShadow.
// Always use this helper instead of raw shadow* props so both
// native (iOS/Android) and web receive the correct styles.
//
//   color     — hex string e.g. "#000" or "#2d6cff"
//   offsetY   — vertical offset in px (positive = below)
//   blur      — blur radius in px
//   opacity   — alpha channel (0–1) applied to color on native
//   elevation — Android elevation
//   offsetX   — horizontal offset (default 0)
//
export function platformShadow(
  color:     string,
  offsetY:   number,
  blur:      number,
  opacity:   number,
  elevation: number,
  offsetX = 0,
): ViewStyle {
  if (Platform.OS === "web") {
    // Build an rgba string from hex + opacity for web boxShadow
    const hex = color.replace("#", "");
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return { boxShadow: `${offsetX}px ${offsetY}px ${blur}px rgba(${r},${g},${b},${opacity})` } as ViewStyle;
    }
    // Colour is already rgba/named — use as-is
    return { boxShadow: `${offsetX}px ${offsetY}px ${blur}px ${color}` } as ViewStyle;
  }
  return {
    shadowColor:   color,
    shadowOffset:  { width: offsetX, height: offsetY },
    shadowOpacity: opacity,
    shadowRadius:  blur,
    elevation,
  };
}

// ── Layout patterns ────────────────────────────────────────
export const layout = StyleSheet.create({
  // Rows
  row:          { flexDirection: "row",    alignItems: "center"                                   },
  rowBetween:   { flexDirection: "row",    alignItems: "center", justifyContent: "space-between"  },
  rowEnd:       { flexDirection: "row",    alignItems: "center", justifyContent: "flex-end"       },
  rowWrap:      { flexDirection: "row",    alignItems: "center", flexWrap: "wrap"                 },
  rowStart:     { flexDirection: "row",    alignItems: "flex-start"                               },
  // Columns
  col:          { flexDirection: "column"                                                          },
  colCentre:    { flexDirection: "column", alignItems: "center", justifyContent: "center"         },
  colBetween:   { flexDirection: "column", justifyContent: "space-between"                        },
  // Centering
  centred:      { alignItems: "center",    justifyContent: "center"                               },
  centredH:     { alignItems: "center"                                                             },
  centredV:     { justifyContent: "center"                                                         },
  // Fill
  fill:         { flex: 1                                                                          },
  fillRow:      { flex: 1, flexDirection: "row"                                                    },
  fillCol:      { flex: 1, flexDirection: "column"                                                 },
  // Positioning
  absoluteFill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0                      },
  // Self alignment
  selfStart:    { alignSelf: "flex-start"                                                           },
  selfCentre:   { alignSelf: "center"                                                               },
  selfStretch:  { alignSelf: "stretch"                                                              },
  selfEnd:      { alignSelf: "flex-end"                                                             },
  // Misc
  wrap:         { flexWrap: "wrap"                                                                  },
  overHidden:   { overflow: "hidden"                                                                },
  shrink0:      { flexShrink: 0                                                                     },
});

// ── Icon button containers ─────────────────────────────────
// Standard tappable icon button sizes
export const iconBtn = StyleSheet.create({
  xs: { width: 28, height: 28, borderRadius: radius.sm,  alignItems: "center", justifyContent: "center" },
  sm: { width: 32, height: 32, borderRadius: radius.md,  alignItems: "center", justifyContent: "center" },
  md: { width: 36, height: 36, borderRadius: radius.md,  alignItems: "center", justifyContent: "center" },
  lg: { width: 44, height: 44, borderRadius: radius.lg,  alignItems: "center", justifyContent: "center" },
  xl: { width: 52, height: 52, borderRadius: radius.xl,  alignItems: "center", justifyContent: "center" },
});

// ── Page-level patterns ────────────────────────────────────
export const page = StyleSheet.create({
  scrollContent: { flexGrow: 1 },
  section:       { marginBottom: spacing[6] },
  cardRow:       { flexDirection: "row", flexWrap: "wrap", gap: spacing[3] },
});