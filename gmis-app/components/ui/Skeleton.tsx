// ============================================================
// GMIS — Skeleton Loading Component
// Pulsing placeholder shown while data is fetching.
// Uses RN's built-in Animated API (works in Expo Go — no
// custom native build required).
//
// Usage:
//   <Skeleton width="100%" height={20} />
//   <SkeletonCard />
//   <SkeletonStatCard />
//   <SkeletonListRow />
//   <SkeletonDashboard />
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useEffect, useRef } from "react";
import {
  Animated,
  View,
  StyleSheet,
  type ViewStyle,
  type DimensionValue,
} from "react-native";
import { useThemeColors } from "@/context/ThemeContext";
import { radius as r, spacing } from "@/theme/tokens";
import { layout } from "@/styles/shared";

// ── Base skeleton block ────────────────────────────────────

interface SkeletonProps {
  width?:  DimensionValue;
  height?: number;
  radius?: number;
  style?:  ViewStyle;
}

export function Skeleton({
  width  = "100%",
  height = 16,
  radius = r.md,
  style,
}: SkeletonProps) {
  const colors  = useThemeColors();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue:        0.9,
          duration:       900,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue:        0.4,
          duration:       900,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius:    radius,
          backgroundColor: colors.bg.hover,
          opacity,
        },
        style,
      ]}
    />
  );
}

// ── Card skeleton ──────────────────────────────────────────

interface SkeletonCardProps { style?: ViewStyle }

export function SkeletonCard({ style }: SkeletonCardProps) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.bg.card, borderColor: colors.border.DEFAULT },
        style,
      ]}
    >
      <Skeleton width="55%" height={14} radius={r.sm} />
      <View style={{ height: spacing[3] }} />
      <Skeleton width="100%" height={11} radius={r.xs} />
      <View style={{ height: spacing[2] }} />
      <Skeleton width="75%" height={11} radius={r.xs} />
    </View>
  );
}

// ── StatCard skeleton ──────────────────────────────────────

interface SkeletonStatCardProps { style?: ViewStyle }

export function SkeletonStatCard({ style }: SkeletonStatCardProps) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.bg.card,
          borderColor:     colors.border.DEFAULT,
          flex:            1,
          minWidth:        140,
        },
        style,
      ]}
    >
      <Skeleton width={28} height={28} radius={r.lg} style={{ marginBottom: spacing[3] }} />
      <Skeleton width="60%" height={10} radius={r.xs} style={{ marginBottom: spacing[2] }} />
      <Skeleton width="45%" height={28} radius={r.sm} />
    </View>
  );
}

// ── List row skeleton ──────────────────────────────────────

interface SkeletonListRowProps { style?: ViewStyle }

export function SkeletonListRow({ style }: SkeletonListRowProps) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        styles.row,
        { borderBottomColor: colors.border.subtle },
        style,
      ]}
    >
      <Skeleton width={40} height={40} radius={r.full} style={{ flexShrink: 0 }} />
      <View style={[layout.fillCol, { gap: spacing[2] }]}>
        <Skeleton width="55%" height={13} radius={r.sm} />
        <Skeleton width="35%" height={11} radius={r.xs} />
      </View>
    </View>
  );
}

// ── Dashboard skeleton ─────────────────────────────────────

export function SkeletonDashboard() {
  const colors = useThemeColors();
  return (
    <View style={[layout.fillCol, { padding: spacing[4], gap: spacing[4] }]}>
      {/* Hero card */}
      <View
        style={[
          styles.card,
          styles.heroCard,
          { backgroundColor: colors.bg.card, borderColor: colors.border.DEFAULT },
        ]}
      >
        <Skeleton width="40%" height={12} radius={r.xs} style={{ marginBottom: spacing[2] }} />
        <Skeleton width="70%" height={20} radius={r.sm} style={{ marginBottom: spacing[3] }} />
        <Skeleton width="30%" height={12} radius={r.xs} />
      </View>

      {/* Stat row */}
      <View style={[layout.row, { gap: spacing[3] }]}>
        <SkeletonStatCard />
        <SkeletonStatCard />
      </View>

      {/* Section heading */}
      <Skeleton width="35%" height={14} radius={r.sm} />

      {/* Action grid */}
      <View style={[layout.row, { gap: spacing[3], flexWrap: "wrap" }]}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[
              styles.actionCell,
              { backgroundColor: colors.bg.card, borderColor: colors.border.DEFAULT },
            ]}
          >
            <Skeleton width={36} height={36} radius={r.lg} style={{ marginBottom: spacing[2] }} />
            <Skeleton width="70%" height={11} radius={r.xs} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: r.lg,
    borderWidth:  1,
    padding:      spacing[4],
  },
  heroCard: {
    padding: spacing[5],
  },
  row: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               spacing[3],
    paddingVertical:   spacing[3],
    borderBottomWidth: 1,
  },
  actionCell: {
    flex:         1,
    minWidth:     100,
    borderRadius: r.lg,
    borderWidth:  1,
    padding:      spacing[4],
    alignItems:   "center",
  },
});
