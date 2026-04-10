// ============================================================
// GMIS — Drawer Overlay (FIXED v2)
//
// FIX 1: `split` crash — item.path could be undefined
//         Now strips Expo Router group names safely
// FIX 2: Drawer layout — backdrop + panel absolute overlay
//         No Modal = contexts preserved (router, theme, auth)
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useEffect, useRef } from "react";
import {
  Animated,
  View, TouchableOpacity, ScrollView,
  StyleSheet, useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePathname } from "expo-router";
import { Text, Avatar, Badge } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { useTheme } from "@/context/ThemeContext";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";
import type { NavItem, SidebarUser } from "./Sidebar";

interface DrawerOverlayProps {
  visible:    boolean;
  onClose:    () => void;
  onNavigate: (path: string) => void;
  items:      NavItem[];
  user:       SidebarUser;
  schoolName: string;
  onLogout?:  () => void;
}

// Expo Router usePathname() strips group names — e.g. returns "/dashboard"
// but item.path is "/(tenant)/(student)/dashboard".
// Strip groups so comparison works.
function stripGroups(path: string | undefined): string {
  if (!path) return "";
  return path.replace(/\/\([^)]+\)/g, "") || "/";
}

export function DrawerOverlay({
  visible, onClose, onNavigate, items, user, schoolName, onLogout,
}: DrawerOverlayProps) {
  const { colors, toggleTheme, isDark } = useTheme();
  const pathname    = usePathname();
  const { width }   = useWindowDimensions();

  const drawerWidth = Math.min(280, Math.floor(width * 0.80));

  // Animated values — panel slides in from left, backdrop fades in
  const translateX      = useRef(new Animated.Value(-drawerWidth)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      // Reset to off-screen so the next open starts fresh
      translateX.setValue(-drawerWidth);
      backdropOpacity.setValue(0);
      return;
    }
    // Slide in + fade backdrop together
    Animated.parallel([
      Animated.spring(translateX, {
        toValue:         0,
        damping:         22,
        stiffness:       260,
        mass:            0.9,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue:         1,
        duration:        250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, drawerWidth]);

  const panelStyle    = { transform: [{ translateX }] };
  const backdropStyle = { opacity: backdropOpacity };

  if (!visible) return null;

  return (
    // Sits in same React tree as AppShell → all contexts intact
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">

      {/* Backdrop — animated fade, full screen, tap to close */}
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}
        pointerEvents="auto"
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          activeOpacity={1}
        />
      </Animated.View>

      {/* Drawer panel — animated slide from left */}
      <Animated.View
        style={[
          styles.panel,
          panelStyle,
          {
            width:            drawerWidth,
            backgroundColor:  colors.bg.elevated,
            borderRightColor: colors.border.DEFAULT,
          },
        ]}
      >
        <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>

          {/* School banner */}
          <View style={[styles.header, { borderBottomColor: colors.border.DEFAULT }]}>
            <View style={[styles.initials, { backgroundColor: brand.blueAlpha15 }]}>
              <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: brand.blue }}>
                {schoolName.slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={layout.fill}>
              <Text variant="label" weight="bold" color="primary" numberOfLines={1}>{schoolName}</Text>
              <Text variant="micro" color="muted">Powered by GMIS</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: colors.bg.hover }]}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Icon name="ui-close" size="sm" color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* User info */}
          <View style={[styles.userRow, { borderBottomColor: colors.border.subtle }]}>
            <Avatar name={user.name} role={user.role as any} size="md" src={user.avatarUrl} />
            <View style={layout.fill}>
              <Text variant="label" weight="semibold" color="primary" numberOfLines={1}>
                {user.name}
              </Text>
              {user.sub && (
                <Text variant="micro" color="muted" numberOfLines={1}>{user.sub}</Text>
              )}
              <Badge
                label={user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                variant="brand" size="xs"
                style={{ marginTop: spacing[1] }}
              />
            </View>
          </View>

          {/* Nav items */}
          <ScrollView style={layout.fill} showsVerticalScrollIndicator={false}>
            <View style={{ padding: spacing[3] }}>
              {items.map((item) => {
                if (!item.href) return null;  // safety guard
                const strippedItemPath = stripGroups(item.href);
                const isActive = pathname === strippedItemPath;
                return (
                  <TouchableOpacity
                    key={item.href}
                    onPress={() => { onClose(); onNavigate(item.href); }}
                    activeOpacity={0.75}
                    style={[
                      styles.navItem,
                      { backgroundColor: isActive ? brand.blueAlpha15 : "transparent" },
                    ]}
                  >
                    <Icon
                      name={item.icon}
                      size="md"
                      color={isActive ? brand.blue : colors.text.secondary}
                      filled={isActive}
                    />
                    <Text
                      style={{
                        flex:       1,
                        fontSize:   fontSize.base,
                        fontWeight: isActive ? fontWeight.semibold : fontWeight.normal,
                        color:      isActive ? brand.blue : colors.text.primary,
                        marginLeft: spacing[3],
                      }}
                    >
                      {item.label}
                    </Text>
                    {item.badge && (
                      <Badge label={item.badge} variant="brand" size="xs" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: colors.border.DEFAULT }]}>
            <TouchableOpacity
              onPress={toggleTheme}
              style={[styles.footerBtn, { backgroundColor: colors.bg.hover }]}
              activeOpacity={0.75}
            >
              <Icon name={isDark ? "ui-sun" : "ui-moon"} size="md" color={colors.text.secondary} />
              <Text variant="label" color="secondary" style={{ marginLeft: spacing[3] }}>
                {isDark ? "Light mode" : "Dark mode"}
              </Text>
            </TouchableOpacity>
            {onLogout && (
              <TouchableOpacity
                onPress={() => { onClose(); onLogout(); }}
                style={[styles.footerBtn, { backgroundColor: "rgba(248,113,113,0.08)" }]}
                activeOpacity={0.75}
              >
                <Icon name="auth-logout" size="md" color={colors.status.error} />
                <Text style={{ flex: 1, fontSize: fontSize.base, color: colors.status.error, marginLeft: spacing[3] }}>
                  Sign out
                </Text>
              </TouchableOpacity>
            )}
          </View>

        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.55)",
    zIndex:          1,
  },
  panel: {
    position:         "absolute",
    left:             0,
    top:              0,
    bottom:           0,
    zIndex:           2,
    borderRightWidth: 1,
    elevation:        20,
    shadowColor:      "#000",
    shadowOffset:     { width: 4, height: 0 },
    shadowOpacity:    0.3,
    shadowRadius:     12,
  },
  header: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[4],
    borderBottomWidth: 1,
  },
  initials: {
    width: spacing[10], height: spacing[10],
    borderRadius: radius.lg,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  closeBtn: {
    width: spacing[8], height: spacing[8],
    borderRadius: radius.full,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  userRow: {
    flexDirection: "row", alignItems: "center",
    gap: spacing[3],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1,
  },
  navItem: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
    borderRadius: radius.lg, marginBottom: spacing[1],
  },
  footer: {
    padding: spacing[3], borderTopWidth: 1, gap: spacing[2],
  },
  footerBtn: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderRadius: radius.lg,
  },
});
