// ============================================================
// GMIS — Stat Card Component
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { View, StyleSheet } from "react-native";
import { Text }   from "./Text";
import { Card }   from "./Card";
import { Icon, type IconName } from "./Icon";
import { useThemeColors } from "@/context/ThemeContext";
import { brand, spacing, fontSize, fontWeight } from "@/theme/tokens";

type StatColor = "primary" | "success" | "warning" | "error" | "brand" | "info" | "gold";

interface StatCardProps {
  icon?:  IconName;
  label:  string;
  value:  string | number;
  sub?:   string;
  color?: StatColor;
}

export function StatCard({
  icon,
  label,
  value,
  sub,
  color = "primary",
}: StatCardProps) {
  const colors = useThemeColors();

  const colorMap: Record<StatColor, string> = {
    primary: colors.text.primary,
    success: colors.status.success,
    warning: colors.status.warning,
    error:   colors.status.error,
    brand:   brand.blue,
    info:    colors.status.info,
    gold:    brand.gold,
  };

  const accent = colorMap[color];

  return (
    <Card style={styles.card}>
      {icon && (
        <View style={styles.iconWrap}>
          <Icon name={icon} size="lg" color={accent} />
        </View>
      )}
      <Text
        style={{
          fontSize:      fontSize["2xs"],    // 10
          fontWeight:    fontWeight.bold,
          color:         colors.text.muted,
          textTransform: "uppercase",
          letterSpacing: 0.8,
          marginBottom:  spacing[1],
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize:   fontSize["4xl"],       // 28
          fontWeight: fontWeight.black,
          color:      accent,
          lineHeight: fontSize["4xl"] + spacing[1],
        }}
      >
        {String(value)}
      </Text>
      {sub && (
        <Text variant="caption" color="muted" style={styles.sub}>{sub}</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex:     1,
    minWidth: 140,
  },
  iconWrap: {
    marginBottom: spacing[2],
  },
  sub: {
    marginTop: spacing[1],
  },
});