// ============================================================
// GMIS — Page Header
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { View, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/Text";
import { Icon } from "@/components/ui/Icon";
import { useThemeColors } from "@/context/ThemeContext";
import { spacing, sizes } from "@/theme/tokens";
import { layout, iconBtn } from "@/styles/shared";

interface PageHeaderProps {
  title:        string;
  subtitle?:    string;
  showBack?:    boolean;
  onBack?:      () => void;
  rightSlot?:   React.ReactNode;
  onMenuPress?: () => void;
  showMenu?:    boolean;
}

export function PageHeader({
  title,
  subtitle,
  showBack    = false,
  onBack,
  rightSlot,
  onMenuPress,
  showMenu    = false,
}: PageHeaderProps) {
  const { colors } = useThemeColors() as any;
  const themeColors = useThemeColors();
  const router      = useRouter();

  const handleBack = onBack ?? (() => router.back());

  return (
    <View
      style={[
        styles.container,
        layout.rowBetween,
        {
          backgroundColor:   themeColors.bg.card,
          borderBottomColor: themeColors.border.DEFAULT,
        },
      ]}
    >
      {/* Left */}
      <View style={styles.side}>
        {showBack && (
          <TouchableOpacity
            onPress={handleBack}
            style={[iconBtn.md, { backgroundColor: themeColors.bg.hover }]}
            activeOpacity={0.7}
          >
            <Icon name="ui-back" size="md" color={themeColors.text.secondary} />
          </TouchableOpacity>
        )}
        {showMenu && !showBack && (
          <TouchableOpacity
            onPress={onMenuPress}
            style={[iconBtn.md, { backgroundColor: themeColors.bg.hover }]}
            activeOpacity={0.7}
          >
            <Icon name="ui-menu" size="md" color={themeColors.text.secondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Centre */}
      <View style={[layout.fill, layout.centredH]}>
        <Text variant="subtitle" color="primary" align="center" numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text variant="caption" color="muted" align="center" numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>

      {/* Right */}
      <View style={styles.side}>
        {rightSlot ?? <View style={iconBtn.md} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[3],
    borderBottomWidth: 1,
    minHeight:         sizes.headerHeight,   // 60
  },
  side: {
    width:          sizes.iconGridCell,       // 52 — matches iconBtn.xl outer size
    alignItems:     "center",
    justifyContent: "center",
  },
});