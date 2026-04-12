// ============================================================
// GMIS — Spinner Component
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Text }  from "./Text";
import { brand, spacing } from "@/theme/tokens";
import { useThemeColors } from "@/context/ThemeContext";
import { layout } from "@/styles/shared";

type SpinnerSize = "sm" | "md" | "lg";

interface SpinnerProps {
  size?:       SpinnerSize;
  label?:      string;
  color?:      string;
  fullScreen?: boolean;
}

export function Spinner({
  size       = "md",
  label,
  color,
  fullScreen = false,
}: SpinnerProps) {
  const colors       = useThemeColors();
  const spinnerColor = color ?? brand.blue;
  const rnSize       = size === "lg" ? "large" : "small";

  const content = (
    <View style={[layout.colCentre, { gap: spacing[3] }]}>
      <ActivityIndicator size={rnSize} color={spinnerColor} />
      {label && (
        <Text variant="caption" color="secondary">{label}</Text>
      )}
    </View>
  );

  if (fullScreen) {
    return (
      <View
        style={[
          layout.centred,
          styles.fullScreen,
          { backgroundColor: colors.bg.primary },
        ]}
      >
        {content}
      </View>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  fullScreen: {
    flex:      1,
    minHeight: "100%" as any,
  },
});