// ============================================================
// GMIS — Bottom Navigation (Global Standard v2)
//
// Material Design 3 + Apple HIG compliant tab bar:
//  · 56dp active indicator pill — centered on icon only
//  · 48x48dp minimum touch targets
//  · Spring-animated sliding pill
//  · Subtle top shadow/elevation
//  · Safe-area aware for iOS home indicator
//  · Filled icon when active, outline when inactive
//  · Badge dot with border ring for clarity
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useRef, useEffect } from "react";
import {
  Animated, View, TouchableOpacity, StyleSheet,
  Platform,
} from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/context/ThemeContext";
import { brand, spacing, fontSize, fontWeight, radius } from "@/theme/tokens";
import { layout, platformShadow } from "@/styles/shared";

// ── Pill geometry (Material 3 spec) ───────────────────────
const PILL_W = 64;   // width of the active indicator pill
const PILL_H = 32;   // height of the active indicator pill
const TAB_H  = 56;   // total visible tab bar height (excl. safe area)

// ── Tab item types ─────────────────────────────────────────
export interface BottomNavItem {
  label:  string;
  icon:   IconName;
  href:   string;
  badge?: string | number;
}

// ── Role nav configs ───────────────────────────────────────
export const studentBottomNav: BottomNavItem[] = [
  { label: "Home",    icon: "nav-home",    href: "/(tenant)/(student)/dashboard" },
  { label: "Results", icon: "nav-results", href: "/(tenant)/(student)/results"   },
  { label: "Social",  icon: "nav-social",  href: "/(tenant)/(student)/social"    },
  { label: "Chat",    icon: "nav-chat",    href: "/(tenant)/(student)/chat"       },
  { label: "More",    icon: "ui-menu",     href: "/(tenant)/(student)/more"       },
];

export const adminBottomNav: BottomNavItem[] = [
  { label: "Dashboard", icon: "nav-dashboard", href: "/(tenant)/(admin)/dashboard" },
  { label: "Approvals", icon: "nav-approvals", href: "/(tenant)/(admin)/approvals" },
  { label: "Students",  icon: "nav-students",  href: "/(tenant)/(admin)/students"  },
  { label: "Academic",  icon: "nav-academic",  href: "/(tenant)/(admin)/academic"  },
  { label: "More",      icon: "ui-menu",       href: "/(tenant)/(admin)/more"      },
];

export const lecturerBottomNav: BottomNavItem[] = [
  { label: "Home",    icon: "nav-home",       href: "/(tenant)/(lecturer)/dashboard"  },
  { label: "Courses", icon: "nav-courses",    href: "/(tenant)/(lecturer)/courses"    },
  { label: "Results", icon: "nav-results",    href: "/(tenant)/(lecturer)/results"    },
  { label: "Attend",  icon: "nav-attendance", href: "/(tenant)/(lecturer)/attendance" },
  { label: "More",    icon: "ui-menu",        href: "/(tenant)/(lecturer)/more"       },
];

export const parentBottomNav: BottomNavItem[] = [
  { label: "Home",     icon: "nav-home",     href: "/(tenant)/(parent)/dashboard" },
  { label: "Results",  icon: "nav-results",  href: "/(tenant)/(parent)/results"   },
  { label: "Payments", icon: "nav-payments", href: "/(tenant)/(parent)/payments"  },
  { label: "Calendar", icon: "nav-calendar", href: "/(tenant)/(parent)/calendar"  },
  { label: "More",     icon: "ui-menu",      href: "/(tenant)/(parent)/more"      },
];

// Strip Expo Router group segments so usePathname() output matches item hrefs.
// usePathname() returns "/dashboard" but item.href is "/(tenant)/(student)/dashboard".
function stripGroups(path: string): string {
  return path.replace(/\/\([^)]+\)/g, "") || "/";
}

// ── Component ──────────────────────────────────────────────
interface BottomNavProps {
  items: BottomNavItem[];
}

export function BottomNav({ items }: BottomNavProps) {
  const { colors, isDark } = useTheme();
  const router             = useRouter();
  const pathname           = usePathname();
  const insets             = useSafeAreaInsets();

  // Container width → used to compute pill X
  const [barWidth, setBarWidth] = useState(0);

  // Spring-driven translateX for the sliding pill
  const pillX       = useRef(new Animated.Value(0)).current;
  const initialised = useRef(false);

  // Icon scale animations — one per tab, indexes align with items
  const iconScales = useRef(items.map(() => new Animated.Value(1))).current;

  // Strip group names from both sides so "/dashboard" matches "/(tenant)/(student)/dashboard"
  const strippedPathname = stripGroups(pathname);
  const activeIndex = items.findIndex((item) => {
    const stripped = stripGroups(item.href);
    return strippedPathname === stripped || strippedPathname.startsWith(stripped + "/");
  });

  // Slide pill + pulse active icon on tab change
  useEffect(() => {
    if (barWidth === 0 || activeIndex < 0) return;

    const tabW    = barWidth / items.length;
    const targetX = activeIndex * tabW + (tabW - PILL_W) / 2;

    // Animate icon scale — pop the new active, reset others
    iconScales.forEach((scale, idx) => {
      Animated.spring(scale, {
        toValue:         idx === activeIndex ? 1.15 : 1,
        damping:         18,
        stiffness:       300,
        mass:            0.7,
        useNativeDriver: true,
      }).start();
    });

    if (!initialised.current) {
      pillX.setValue(targetX);
      initialised.current = true;
    } else {
      Animated.spring(pillX, {
        toValue:         targetX,
        damping:         24,
        stiffness:       300,
        mass:            0.8,
        useNativeDriver: true,
      }).start();
    }
  }, [pathname, barWidth, activeIndex, items.length]);

  // Bottom padding — iOS drops 6px below safe area so the bar blends naturally
  // with the home-indicator area rather than floating above it.
  // Android adds a small baseline so it doesn't feel cramped on gesture-nav devices.
  const bottomPad = Platform.OS === "ios"
    ? Math.max(0, insets.bottom - 6)       // iOS: sink 6px into safe area for natural blend
    : insets.bottom > 0
      ? insets.bottom + spacing[1]         // Android gesture-nav: safe area + 4px
      : spacing[3];                        // Android button-nav: 12px baseline

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bg.card,
          borderTopColor:  colors.border.DEFAULT,
          paddingBottom:   bottomPad,
          ...platformShadow("#000", -2, 8, isDark ? 0.35 : 0.08, 12),
        },
      ]}
      onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
    >
      {/* Sliding active-indicator pill */}
      {activeIndex >= 0 && barWidth > 0 && (
        <Animated.View
          style={[
            styles.pill,
            {
              backgroundColor: brand.blueAlpha15,
              transform: [{ translateX: pillX }],
            },
          ]}
          pointerEvents="none"
        />
      )}

      {/* Tab buttons */}
      <View style={[layout.row, styles.tabRow]}>
        {items.map((item, idx) => {
          const strippedHref = stripGroups(item.href);
          const active = strippedPathname === strippedHref || strippedPathname.startsWith(strippedHref + "/");

          return (
            <TouchableOpacity
              key={item.href}
              onPress={() => router.push(item.href as any)}
              style={styles.tab}
              activeOpacity={0.75}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              {/* Icon with scale animation */}
              <View style={styles.iconWrap}>
                <Animated.View style={{ transform: [{ scale: iconScales[idx] }] }}>
                  <Icon
                    name={item.icon}
                    size="lg"
                    color={active ? brand.blue : colors.text.muted}
                    filled={active}
                  />
                </Animated.View>

                {/* Badge */}
                {item.badge != null && (
                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor: colors.status.error,
                        borderColor:     colors.bg.card,
                      },
                    ]}
                  >
                    {typeof item.badge === "number" && item.badge > 0 && (
                      <Text
                        style={{
                          fontSize:   8,
                          fontWeight: fontWeight.bold,
                          color:      "#fff",
                          lineHeight: 10,
                        }}
                      >
                        {item.badge > 99 ? "99+" : String(item.badge)}
                      </Text>
                    )}
                  </View>
                )}
              </View>

              {/* Label */}
              <Text
                style={[
                  styles.label,
                  {
                    color:      active ? brand.blue : colors.text.muted,
                    fontWeight: active ? fontWeight.semibold : fontWeight.normal,
                  },
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    position:       "relative",
  },
  tabRow: {
    height: TAB_H,
  },
  tab: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    gap:            3,
    paddingTop:     spacing[2],
  },
  // Narrow pill sits behind icon at top of tab
  pill: {
    position:     "absolute",
    top:          spacing[2],              // aligned with top of icon area
    left:         0,
    width:        PILL_W,
    height:       PILL_H,
    borderRadius: radius.full,
    zIndex:       0,
  },
  iconWrap: {
    position:       "relative",
    width:          28,
    height:         28,
    alignItems:     "center",
    justifyContent: "center",
    zIndex:         1,
  },
  badge: {
    position:     "absolute",
    top:          -4,
    right:        -6,
    minWidth:     14,
    height:       14,
    borderRadius: radius.full,
    borderWidth:  2,
    alignItems:   "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  label: {
    fontSize:   fontSize["2xs"] + 1,   // 11sp — readable but compact
    zIndex:     1,
    letterSpacing: 0.1,
  },
});
