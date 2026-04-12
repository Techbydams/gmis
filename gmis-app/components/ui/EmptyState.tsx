// ============================================================
// GMIS — Empty State Component
// Variants: default | error | offline | onboarding
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { View, StyleSheet } from "react-native";
import { Text }   from "./Text";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";
import { useThemeColors } from "@/context/ThemeContext";
import { spacing, sizes, radius } from "@/theme/tokens";
import { layout } from "@/styles/shared";

export type EmptyVariant = "default" | "error" | "offline" | "onboarding";

interface EmptyStateProps {
  variant?:     EmptyVariant;
  icon?:        IconName;           // overrides variant default icon
  title:        string;
  description?: string;
  actionLabel?: string;
  onAction?:    () => void;
  secondaryLabel?: string;
  onSecondary?:    () => void;
}

// Per-variant defaults — icon, circle background, icon colour
const VARIANT_DEFAULTS: Record<EmptyVariant, {
  icon:     IconName;
  circleBg: (colors: ReturnType<typeof useThemeColors>) => string;
  iconColor:(colors: ReturnType<typeof useThemeColors>) => string;
  large:    boolean;
}> = {
  default: {
    icon:      "nav-results",
    circleBg:  (c) => c.bg.hover,
    iconColor: (c) => c.text.muted,
    large:     false,
  },
  error: {
    icon:      "status-error",
    circleBg:  (c) => c.status.errorBg,
    iconColor: (c) => c.status.error,
    large:     false,
  },
  offline: {
    icon:      "status-warning",
    circleBg:  (c) => c.status.warningBg,
    iconColor: (c) => c.status.warning,
    large:     false,
  },
  onboarding: {
    icon:      "status-info",
    circleBg:  (c) => c.status.infoBg,
    iconColor: (c) => c.status.info,
    large:     true,  // larger icon circle, more generous spacing
  },
};

export function EmptyState({
  variant      = "default",
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: EmptyStateProps) {
  const colors  = useThemeColors();
  const cfg     = VARIANT_DEFAULTS[variant];
  const isLarge = cfg.large;

  const resolvedIcon      = icon ?? cfg.icon;
  const resolvedCircleBg  = cfg.circleBg(colors);
  const resolvedIconColor = cfg.iconColor(colors);

  const circleSize  = isLarge ? sizes.iconCircle + 32 : sizes.iconCircle; // 88 or 120
  const iconSize    = isLarge ? "3xl" : "2xl";

  return (
    <View style={[styles.container, layout.colCentre, isLarge && styles.containerLarge]}>
      {/* Icon circle */}
      <View
        style={[
          styles.iconCircle,
          layout.centred,
          {
            width:           circleSize,
            height:          circleSize,
            borderRadius:    circleSize / 2,
            backgroundColor: resolvedCircleBg,
          },
        ]}
      >
        <Icon name={resolvedIcon} size={iconSize} color={resolvedIconColor} />
      </View>

      {/* Title */}
      <Text
        variant={isLarge ? "title" : "subtitle"}
        color="primary"
        align="center"
        style={styles.title}
      >
        {title}
      </Text>

      {/* Description */}
      {description && (
        <Text
          variant="body"
          color="secondary"
          align="center"
          style={styles.description}
        >
          {description}
        </Text>
      )}

      {/* Primary action */}
      {actionLabel && onAction && (
        <Button
          label={actionLabel}
          variant={variant === "error" ? "danger" : "primary"}
          size="md"
          onPress={onAction}
          style={[layout.selfCentre, { marginTop: spacing[2] }]}
        />
      )}

      {/* Secondary action (e.g. "Go back" alongside "Retry") */}
      {secondaryLabel && onSecondary && (
        <Button
          label={secondaryLabel}
          variant="ghost"
          size="sm"
          onPress={onSecondary}
          style={layout.selfCentre}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:              1,
    paddingVertical:   spacing[16],
    paddingHorizontal: spacing[6],
    gap:               spacing[3],
  },
  containerLarge: {
    paddingVertical: spacing[20],
    gap:             spacing[4],
  },
  iconCircle: {
    marginBottom: spacing[2],
  },
  title: {
    maxWidth: 300,
  },
  description: {
    maxWidth:   320,
    lineHeight: 22,
  },
});
