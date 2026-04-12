// ============================================================
// GMIS — Badge Component
//
// FIX: Uses static color constants instead of useThemeColors().
// useThemeColors() crashes inside React Native <Modal> because
// Modal renders in a separate React portal tree that doesn't
// inherit context from the parent tree.
// Static constants = zero context dependency = never crashes.
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { View, StyleSheet, type ViewStyle } from "react-native";
import { Text } from "./Text";
import { spacing, radius, fontSize, fontWeight } from "@/theme/tokens";

export type BadgeVariant =
  | "brand" | "green" | "red" | "amber" | "blue"
  | "indigo" | "gold" | "gray" | "outline";

export type BadgeSize = "xs" | "sm" | "md";

interface BadgeProps {
  label:    string;
  variant?: BadgeVariant;
  size?:    BadgeSize;
  dot?:     boolean;
  style?:   ViewStyle;
}

// Static colour map — no context, no crashes
const C: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
  brand:   { bg: "rgba(45,108,255,0.15)",  text: "#60a5fa", border: "rgba(45,108,255,0.3)"  },
  green:   { bg: "rgba(74,222,128,0.15)",  text: "#4ade80", border: "rgba(74,222,128,0.3)"  },
  red:     { bg: "rgba(248,113,113,0.15)", text: "#f87171", border: "rgba(248,113,113,0.3)" },
  amber:   { bg: "rgba(251,191,36,0.15)",  text: "#fbbf24", border: "rgba(251,191,36,0.3)"  },
  blue:    { bg: "rgba(96,165,250,0.15)",  text: "#60a5fa", border: "rgba(96,165,250,0.3)"  },
  indigo:  { bg: "rgba(168,85,247,0.15)",  text: "#a855f7", border: "rgba(168,85,247,0.3)"  },
  gold:    { bg: "rgba(251,191,36,0.15)",  text: "#fbbf24", border: "rgba(251,191,36,0.3)"  },
  gray:    { bg: "rgba(148,163,184,0.15)", text: "#94a3b8", border: "rgba(148,163,184,0.3)" },
  outline: { bg: "transparent",            text: "#94a3b8", border: "rgba(148,163,184,0.4)" },
};

const SZ: Record<BadgeSize, { px: number; py: number; fs: number }> = {
  xs: { px: spacing[2],     py: 2,           fs: fontSize["2xs"] },
  sm: { px: spacing[2] + 2, py: spacing[1],  fs: fontSize["2xs"] },
  md: { px: spacing[3],     py: spacing[1],  fs: fontSize.xs     },
};

export function Badge({
  label,
  variant = "brand",
  size    = "sm",
  dot     = false,
  style,
}: BadgeProps) {
  const c  = C[variant] ?? C.brand;
  const sz = SZ[size]   ?? SZ.sm;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor:   c.bg,
          borderColor:       c.border,
          paddingHorizontal: sz.px,
          paddingVertical:   sz.py,
        },
        style,
      ]}
    >
      {dot && <View style={[styles.dot, { backgroundColor: c.text }]} />}
      <Text
        style={{
          fontSize:   sz.fs,
          fontWeight: fontWeight.bold,
          color:      c.text,
          lineHeight: sz.fs * 1.4,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems:    "center",
    borderRadius:  radius.full,
    borderWidth:   1,
    gap:           spacing[1],
    alignSelf:     "flex-start",
  },
  dot: {
    width:        spacing[1] + 2,
    height:       spacing[1] + 2,
    borderRadius: radius.full,
  },
});
