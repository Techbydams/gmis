// ============================================================
// GMIS — Page Header (FIXED for mobile)
// Uses useSafeAreaInsets() for dynamic top padding
// so it works on all phones regardless of notch size.
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { View, TouchableOpacity, StyleSheet, Image } from "react-native";

const GMIS_LOGO = require("@/assets/gmis_logo.png");
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Text }  from "@/components/ui/Text";
import { Icon }  from "@/components/ui/Icon";
import { useThemeColors } from "@/context/ThemeContext";
import { spacing, sizes, radius, brand, fontSize } from "@/theme/tokens";
import { layout, iconBtn } from "@/styles/shared";

interface PageHeaderProps {
  title:        string;
  subtitle?:    string;
  breadcrumb?:  string[];        // e.g. ["Academic", "Results"] renders "Academic › Results" above title
  showBack?:    boolean;
  onBack?:      () => void;
  rightSlot?:   React.ReactNode;
  onMenuPress?: () => void;
  showMenu?:    boolean;
  /** Show GMIS logo instead of text title — use on dashboard home screens */
  showLogo?:    boolean;
}

export function PageHeader({
  title,
  subtitle,
  breadcrumb,
  showBack    = false,
  onBack,
  rightSlot,
  onMenuPress,
  showMenu    = false,
  showLogo    = false,
}: PageHeaderProps) {
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleBack = onBack ?? (() => router.back());

  // Dynamic top padding based on device safe area
  const topPadding = Math.max(insets.top, spacing[3]);

  return (
    <View
      style={[
        styles.container,
        layout.rowBetween,
        {
          backgroundColor:   colors.bg.card,
          borderBottomColor: colors.border.DEFAULT,
          paddingTop:        topPadding,
        },
      ]}
    >
      {/* Left */}
      <View style={styles.side}>
        {showBack && (
          <TouchableOpacity
            onPress={handleBack}
            style={[iconBtn.md, { backgroundColor: colors.bg.hover }]}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="ui-back" size="md" color={colors.text.secondary} />
          </TouchableOpacity>
        )}
        {showMenu && !showBack && (
          <TouchableOpacity
            onPress={onMenuPress}
            style={[iconBtn.md, { backgroundColor: colors.bg.hover }]}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="ui-menu" size="md" color={colors.text.secondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Centre */}
      <View style={[layout.fill, layout.centredH]}>
        {showLogo ? (
          /* GMIS logo — used on dashboard home screens */
          <Image source={GMIS_LOGO} style={styles.headerLogo} resizeMode="contain" />
        ) : (
          <>
            {/* Breadcrumb trail */}
            {breadcrumb && breadcrumb.length > 0 && (
              <View style={[layout.row, { gap: spacing[1], marginBottom: 2 }]}>
                {breadcrumb.map((crumb, idx) => (
                  <View key={idx} style={layout.row}>
                    {idx > 0 && (
                      <Text style={styles.chevron}>›</Text>
                    )}
                    <Text
                      style={[
                        styles.breadcrumbItem,
                        idx === breadcrumb.length - 1 && { color: brand.blue },
                      ]}
                      numberOfLines={1}
                    >
                      {crumb}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <Text variant="subtitle" color="primary" align="center" numberOfLines={1}>
              {title}
            </Text>
            {subtitle && (
              <Text variant="caption" color="muted" align="center" numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </>
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
    paddingBottom:     spacing[3],
    borderBottomWidth: 1,
    minHeight:         sizes.headerHeight,
  },
  side: {
    width:          sizes.iconGridCell,
    alignItems:     "center",
    justifyContent: "center",
  },
  breadcrumbItem: {
    fontSize:  fontSize["2xs"],
    color:     "#64748b",   // muted, below title
  },
  chevron: {
    fontSize:    fontSize["2xs"],
    color:       "#94a3b8",
    marginRight: spacing[1],
  },
  headerLogo: {
    width:  88,
    height: 30,
  },
});
