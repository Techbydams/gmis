// ============================================================
// GMIS — Text Component
// Use this everywhere instead of RN's raw Text.
// Variant, color, and weight props prevent raw style repetition.
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { useThemeColors } from "@/context/ThemeContext";
import { fontSize, fontWeight as fw } from "@/theme/tokens";

type TextVariant =
  | "display"   // 36px black  — hero titles
  | "heading"   // 24px bold   — page headings
  | "title"     // 20px bold   — card/section titles
  | "subtitle"  // 18px bold   — subtitles
  | "body"      // 14px normal — main body
  | "label"     // 13px medium — form labels, table cells
  | "caption"   // 12px normal — hints, meta, timestamps
  | "micro"     // 11px normal — badges, tags
  | "mono";     // 13px mono   — matric numbers, codes

type TextColor =
  | "primary" | "secondary" | "muted"   | "link"
  | "inverse" | "brand"     | "gold"    | "white"
  | "success" | "warning"   | "error"   | "info";

type TextWeight =
  | "normal" | "medium" | "semibold"
  | "bold"   | "extrabold" | "black";

interface TextProps extends RNTextProps {
  variant?:   TextVariant;
  color?:     TextColor;
  weight?:    TextWeight;
  align?:     "left" | "center" | "right";
  italic?:    boolean;
  underline?: boolean;
}

// Font size per variant — all from token scale
const variantFontSize: Record<TextVariant, number> = {
  display:  fontSize["5xl"],   // 36
  heading:  fontSize["3xl"],   // 24
  title:    fontSize["2xl"],   // 20
  subtitle: fontSize.xl,       // 18
  body:     fontSize.md,       // 14
  label:    fontSize.base,     // 13
  caption:  fontSize.sm,       // 12
  micro:    fontSize.xs,       // 11
  mono:     fontSize.base,     // 13
};

// Font weight per variant
const variantFontWeight: Record<TextVariant, string> = {
  display:  fw.black,
  heading:  fw.bold,
  title:    fw.bold,
  subtitle: fw.bold,
  body:     fw.normal,
  label:    fw.medium,
  caption:  fw.normal,
  micro:    fw.normal,
  mono:     fw.normal,
};

// Font family per variant
const variantFontFamily: Record<TextVariant, string | undefined> = {
  display:  undefined,  // swap in "YourFont-Black" when loaded
  heading:  undefined,
  title:    undefined,
  subtitle: undefined,
  body:     undefined,
  label:    undefined,
  caption:  undefined,
  micro:    undefined,
  mono:     "monospace",
};

// Override weight map
const weightMap: Record<TextWeight, string> = {
  normal:    fw.normal,
  medium:    fw.medium,
  semibold:  fw.semibold,
  bold:      fw.bold,
  extrabold: fw.extrabold,
  black:     fw.black,
};

export function Text({
  variant   = "body",
  color     = "primary",
  weight,
  align     = "left",
  italic    = false,
  underline = false,
  style,
  ...props
}: TextProps) {
  const colors = useThemeColors();

  // Color map — resolved at render so it responds to theme changes
  const colorMap: Record<TextColor, string> = {
    primary:   colors.text.primary,
    secondary: colors.text.secondary,
    muted:     colors.text.muted,
    link:      colors.text.link,
    inverse:   colors.text.inverse,
    brand:     "#2d6cff",
    gold:      "#f0b429",
    success:   colors.status.success,
    warning:   colors.status.warning,
    error:     colors.status.error,
    info:      colors.status.info,
    white:     "#ffffff",
  };

  return (
    <RNText
      style={[
        {
          fontSize:           variantFontSize[variant],
          fontWeight:         (weight ? weightMap[weight] : variantFontWeight[variant]) as any,
          color:              colorMap[color],
          fontFamily:         variantFontFamily[variant],
          textAlign:          align,
          fontStyle:          italic    ? "italic"    : "normal",
          textDecorationLine: underline ? "underline" : "none",
        },
        style,
      ]}
      {...props}
    />
  );
}