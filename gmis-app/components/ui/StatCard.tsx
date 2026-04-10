// ============================================================
// GMIS — Stat Card Component
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { View, StyleSheet, type ViewStyle } from "react-native";
import { Text }   from "./Text";
import { Card }   from "./Card";
import { Icon, type IconName } from "./Icon";
import { useThemeColors } from "@/context/ThemeContext";
import { brand, spacing, fontSize, fontWeight, radius } from "@/theme/tokens";
import { layout } from "@/styles/shared";

type StatColor = "primary" | "success" | "warning" | "error" | "brand" | "info" | "gold";

interface StatTrend {
  value:     number;           // e.g. 4.2 (shown as "4.2%")
  direction: "up" | "down" | "flat";
}

interface StatCardProps {
  icon?:  IconName;
  label:  string;
  value:  string | number;
  sub?:   string;
  color?: StatColor;
  trend?: StatTrend;           // optional — shows ▲/▼ + % change below value
  style?: ViewStyle;           // passed to outer Card for layout overrides (e.g. flex: 1)
}

export function StatCard({
  icon,
  label,
  value,
  sub,
  color = "primary",
  trend,
  style,
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
    <Card style={[styles.card, style]}>
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
      {trend && (
        <View style={[layout.row, styles.trendRow]}>
          <View
            style={[
              styles.trendBadge,
              {
                backgroundColor:
                  trend.direction === "up"   ? colors.status.successBg  :
                  trend.direction === "down" ? colors.status.errorBg    :
                  colors.bg.hover,
              },
            ]}
          >
            <Text
              style={{
                fontSize:   fontSize.xs,
                fontWeight: fontWeight.bold,
                color:
                  trend.direction === "up"   ? colors.status.success :
                  trend.direction === "down" ? colors.status.error   :
                  colors.text.muted,
              }}
            >
              {trend.direction === "up"   ? "▲ " :
               trend.direction === "down" ? "▼ " : "— "}
              {trend.value.toFixed(1)}%
            </Text>
          </View>
        </View>
      )}

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
  trendRow: {
    marginTop: spacing[2],
  },
  trendBadge: {
    borderRadius:      radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical:   2,
    alignSelf:         "flex-start",
  },
  sub: {
    marginTop: spacing[1],
  },
});