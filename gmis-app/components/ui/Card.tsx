// ============================================================
// GMIS — Card Component
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import {
  View,
  type ViewProps,
  TouchableOpacity,
  type TouchableOpacityProps,
  StyleSheet,
} from "react-native";
import { useThemeColors } from "@/context/ThemeContext";
import { radius, spacing } from "@/theme/tokens";

type CardVariant = "default" | "elevated" | "brand" | "success" | "warning" | "error" | "info";
type CardPadding = "none" | "xs" | "sm" | "md" | "lg";

interface CardProps extends ViewProps {
  variant?:   CardVariant;
  padding?:   CardPadding;
  pressable?: boolean;
  onPress?:   TouchableOpacityProps["onPress"];
}

// All padding values from spacing tokens
const paddingMap: Record<CardPadding, number> = {
  none: spacing[0],
  xs:   spacing[2],
  sm:   spacing[3],
  md:   spacing[4],
  lg:   spacing[6],
};

export function Card({
  variant   = "default",
  padding   = "md",
  pressable = false,
  onPress,
  style,
  children,
  ...props
}: CardProps) {
  const colors = useThemeColors();

  const variantMap: Record<CardVariant, { bg: string; border: string }> = {
    default:  { bg: colors.bg.card,              border: colors.border.DEFAULT         },
    elevated: { bg: colors.bg.elevated,          border: colors.border.strong          },
    brand:    { bg: colors.bg.card,              border: colors.border.brand           },
    success:  { bg: colors.status.successBg,     border: colors.status.successBorder   },
    warning:  { bg: colors.status.warningBg,     border: colors.status.warningBorder   },
    error:    { bg: colors.status.errorBg,       border: colors.status.errorBorder     },
    info:     { bg: colors.status.infoBg,        border: colors.status.infoBorder      },
  };

  const v = variantMap[variant];

  const cardStyle = [
    styles.base,
    {
      backgroundColor: v.bg,
      borderColor:     v.border,
      padding:         paddingMap[padding],
    },
    style,
  ];

  if (pressable || onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        style={cardStyle as any}
        {...(props as any)}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={cardStyle} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.xl,
    borderWidth:  1,
  },
});