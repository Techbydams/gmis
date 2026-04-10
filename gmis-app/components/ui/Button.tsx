// ============================================================
// GMIS — Button Component
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useCallback } from "react";
import {
  TouchableOpacity,
  type TouchableOpacityProps,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { Text } from "./Text";
import { Icon, type IconName, type IconSize } from "./Icon";
import { useThemeColors } from "@/context/ThemeContext";
import { brand, radius, fontSize, fontWeight, spacing } from "@/theme/tokens";
import { layout } from "@/styles/shared";

// Optional haptic feedback — install with: npx expo install expo-haptics
// Gracefully no-ops if the package is not yet installed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Haptics: any = null;
try { Haptics = require("expo-haptics"); } catch {}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success" | "gold";
type ButtonSize    = "xs" | "sm" | "md" | "lg";

interface ButtonProps extends TouchableOpacityProps {
  label:      string;
  variant?:   ButtonVariant;
  size?:      ButtonSize;
  full?:      boolean;
  loading?:   boolean;
  iconLeft?:  IconName;
  iconRight?: IconName;
}

// All sizes use token scale — no raw numbers
const sizeStyles: Record<ButtonSize, {
  px: number; py: number; r: number; fs: number;
}> = {
  xs: { px: spacing[2], py: spacing[1],  r: radius.sm, fs: fontSize.xs    },
  sm: { px: spacing[3], py: spacing[2],  r: radius.md, fs: fontSize.sm    },
  md: { px: spacing[5], py: spacing[3],  r: radius.md, fs: fontSize.base  },
  lg: { px: spacing[6], py: spacing[4],  r: radius.lg, fs: fontSize.md    },
};

const iconSizeMap: Record<ButtonSize, IconSize> = {
  xs: "xs",
  sm: "sm",
  md: "sm",
  lg: "md",
};

export function Button({
  label,
  variant    = "primary",
  size       = "md",
  full       = false,
  loading    = false,
  iconLeft,
  iconRight,
  disabled,
  style,
  onPress,
  ...props
}: ButtonProps) {
  const colors     = useThemeColors();
  const isDisabled = disabled || loading;

  // Haptic feedback on press
  const handlePress = useCallback<NonNullable<TouchableOpacityProps["onPress"]>>(
    (e) => {
      if (Haptics && Platform.OS !== "web") {
        if (variant === "danger") {
          Haptics.notificationAsync?.(Haptics.NotificationFeedbackType?.Warning);
        } else {
          Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle?.Light);
        }
      }
      onPress?.(e);
    },
    [variant, onPress],
  );
  const sz         = sizeStyles[size];
  const iconSz     = iconSizeMap[size];

  // All colours come from theme — no hardcoded hex
  const variantMap = {
    primary:   { bg: brand.blue,                border: brand.blue,                text: "#ffffff",               icon: "#ffffff"               },
    secondary: { bg: colors.bg.input,           border: colors.border.DEFAULT,     text: colors.text.secondary,   icon: colors.text.secondary   },
    ghost:     { bg: "transparent",             border: colors.border.strong,      text: colors.text.secondary,   icon: colors.text.secondary   },
    danger:    { bg: colors.status.errorBg,     border: colors.status.errorBorder, text: colors.status.error,     icon: colors.status.error     },
    success:   { bg: colors.status.successBg,   border: colors.status.successBorder,text: colors.status.success,  icon: colors.status.success   },
    gold:      { bg: brand.gold,                border: brand.gold,                text: "#ffffff",               icon: "#ffffff"               },
  } as const;

  const v = variantMap[variant];

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      disabled={isDisabled}
      onPress={handlePress}
      style={[
        styles.base,
        layout.row,
        {
          backgroundColor:   v.bg,
          borderColor:       v.border,
          paddingHorizontal: sz.px,
          paddingVertical:   sz.py,
          borderRadius:      sz.r,
          width:             full ? "100%" : undefined,
          opacity:           isDisabled ? 0.5 : 1,
          gap:               spacing[2],
        },
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.icon} />
      ) : (
        <>
          {iconLeft  && <Icon name={iconLeft}  size={iconSz} color={v.icon} />}
          <Text
            style={{
              fontSize:   sz.fs,
              fontWeight: fontWeight.bold,
              color:      v.text,
            }}
          >
            {label}
          </Text>
          {iconRight && <Icon name={iconRight} size={iconSz} color={v.icon} />}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    justifyContent: "center",
    alignSelf:      "flex-start",
    borderWidth:    1,
  },
});