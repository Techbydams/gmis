// ============================================================
// GMIS — Empty State Component
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { View, StyleSheet } from "react-native";
import { Text }    from "./Text";
import { Button }  from "./Button";
import { Icon, type IconName } from "./Icon";
import { useThemeColors } from "@/context/ThemeContext";
import { spacing, sizes } from "@/theme/tokens";
import { layout } from "@/styles/shared";

interface EmptyStateProps {
  icon?:        IconName;
  title:        string;
  description?: string;
  actionLabel?: string;
  onAction?:    () => void;
}

export function EmptyState({
  icon        = "nav-results",
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const colors = useThemeColors();

  return (
    <View style={[styles.container, layout.colCentre]}>
      <View
        style={[
          styles.iconCircle,
          layout.centred,
          { backgroundColor: colors.bg.hover },
        ]}
      >
        <Icon name={icon} size="3xl" color={colors.text.muted} />
      </View>

      <Text variant="subtitle" color="primary" align="center" style={styles.title}>
        {title}
      </Text>

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

      {actionLabel && onAction && (
        <Button
          label={actionLabel}
          variant="primary"
          size="md"
          onPress={onAction}
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
  iconCircle: {
    width:        sizes.iconCircle,   // 88
    height:       sizes.iconCircle,   // 88
    borderRadius: sizes.iconCircle / 2,
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