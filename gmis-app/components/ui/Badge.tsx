// ============================================================
// GMIS — Badge Component
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { View, StyleSheet } from "react-native";
import { Text } from "./Text";
import { useThemeColors } from "@/context/ThemeContext";
import { brand, radius, spacing, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

type BadgeVariant =
  | "blue" | "green" | "amber" | "red"
  | "gray" | "indigo" | "gold" | "purple";

type BadgeSize = "sm" | "md";

interface BadgeProps {
  label:    string;
  variant?: BadgeVariant;
  size?:    BadgeSize;
  dot?:     boolean;
}

export function Badge({
  label,
  variant = "gray",
  size    = "md",
  dot     = false,
}: BadgeProps) {
  const colors = useThemeColors();

  // All colours from theme tokens — no hardcoded hex
  const variantMap: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
    blue:   { bg: colors.status.infoBg,         text: colors.status.info,    dot: colors.status.info    },
    green:  { bg: colors.status.successBg,      text: colors.status.success, dot: colors.status.success },
    amber:  { bg: colors.status.warningBg,      text: colors.status.warning, dot: colors.status.warning },
    red:    { bg: colors.status.errorBg,        text: colors.status.error,   dot: colors.status.error   },
    gray:   { bg: colors.bg.hover,              text: colors.text.secondary, dot: colors.text.muted     },
    indigo: { bg: brand.indigoAlpha10,          text: brand.indigo,          dot: brand.indigo          },
    gold:   { bg: brand.goldAlpha10,            text: brand.gold,            dot: brand.gold            },
    purple: { bg: "rgba(168,85,247,0.12)",      text: "#a855f7",             dot: "#a855f7"             },
  };

  const v = variantMap[variant];

  // Padding from spacing tokens
  const px = size === "sm" ? spacing[2]  : 10;
  const py = size === "sm" ? spacing[0] + 2 : spacing[1];

  return (
    <View
      style={[
        styles.base,
        layout.row,
        {
          backgroundColor:   v.bg,
          paddingHorizontal: px,
          paddingVertical:   py,
        },
      ]}
    >
      {dot && <View style={[styles.dot, { backgroundColor: v.dot }]} />}
      <Text
        style={{
          fontSize:      size === "sm" ? fontSize["2xs"] : fontSize.xs,
          fontWeight:    fontWeight.bold,
          color:         v.text,
          textTransform: "uppercase",
          letterSpacing: 0.6,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.full,
    alignSelf:    "flex-start",
    gap:          spacing[1] + 1,  // 5 — between dot and text
  },
  dot: {
    width:        spacing[1] + 2,  // 6
    height:       spacing[1] + 2,  // 6
    borderRadius: radius.full,
  },
});