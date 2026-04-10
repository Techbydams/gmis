// ============================================================
// GMIS — Bottom Navigation
// Mobile tab bar (xs/sm). Max 5 tabs per role.
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useRef, useEffect } from "react";
import { Animated, View, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Text }  from "@/components/ui/Text";
import { useTheme } from "@/context/ThemeContext";
import { brand, spacing, fontSize, fontWeight, radius, sizes } from "@/theme/tokens";
import { layout } from "@/styles/shared";

const PILL_W  = spacing[10]; // 40px — matches active pill width
const PILL_H  = spacing[8];  // 32px — matches active pill height

export interface BottomNavItem {
  label:  string;
  icon:   IconName;
  href:   string;
  badge?: string;
}

export const studentBottomNav: BottomNavItem[] = [
  { label: "Home",     icon: "nav-home",     href: "/(tenant)/(student)/dashboard" },
  { label: "Results",  icon: "nav-results",  href: "/(tenant)/(student)/results"   },
  { label: "Payments", icon: "nav-payments", href: "/(tenant)/(student)/payments"  },
  { label: "Chat",     icon: "nav-chat",     href: "/(tenant)/(student)/chat"      },
  { label: "More",     icon: "ui-menu",      href: "/(tenant)/(student)/more"      },
];

export const adminBottomNav: BottomNavItem[] = [
  { label: "Dashboard", icon: "nav-dashboard", href: "/(tenant)/(admin)/dashboard"  },
  { label: "Approvals", icon: "nav-approvals", href: "/(tenant)/(admin)/approvals"  },
  { label: "Students",  icon: "nav-students",  href: "/(tenant)/(admin)/students"   },
  { label: "Academic",  icon: "nav-academic",  href: "/(tenant)/(admin)/academic"   },
  { label: "More",      icon: "ui-menu",       href: "/(tenant)/(admin)/more"       },
];

export const lecturerBottomNav: BottomNavItem[] = [
  { label: "Home",      icon: "nav-home",       href: "/(tenant)/(lecturer)/dashboard"  },
  { label: "Courses",   icon: "nav-courses",    href: "/(tenant)/(lecturer)/courses"    },
  { label: "Results",   icon: "nav-results",    href: "/(tenant)/(lecturer)/results"    },
  { label: "Attend",    icon: "nav-attendance", href: "/(tenant)/(lecturer)/attendance" },
  { label: "More",      icon: "ui-menu",        href: "/(tenant)/(lecturer)/more"       },
];

export const parentBottomNav: BottomNavItem[] = [
  { label: "Home",     icon: "nav-home",      href: "/(tenant)/(parent)/dashboard" },
  { label: "Results",  icon: "nav-results",   href: "/(tenant)/(parent)/results"   },
  { label: "Payments", icon: "nav-payments",  href: "/(tenant)/(parent)/payments"  },
  { label: "Calendar", icon: "nav-calendar",  href: "/(tenant)/(parent)/calendar"  },
  { label: "More",     icon: "ui-menu",       href: "/(tenant)/(parent)/more"      },
];

interface BottomNavProps {
  items: BottomNavItem[];
}

export function BottomNav({ items }: BottomNavProps) {
  const { colors } = useTheme();
  const router     = useRouter();
  const pathname   = usePathname();

  // Container width measured via onLayout — used to compute pill X position
  const [tabsWidth, setTabsWidth] = useState(0);

  // Animated.Value drives the sliding pill translateX
  const pillX        = useRef(new Animated.Value(0)).current;
  const initialised  = useRef(false);

  const activeIndex = items.findIndex(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/"),
  );

  // Animate pill to new position whenever active tab or container width changes
  useEffect(() => {
    if (tabsWidth === 0 || activeIndex < 0) return;
    const tabW    = tabsWidth / items.length;
    const targetX = activeIndex * tabW + (tabW - PILL_W) / 2;

    if (!initialised.current) {
      // First layout — jump straight to position, no animation
      pillX.setValue(targetX);
      initialised.current = true;
    } else {
      Animated.spring(pillX, {
        toValue:         targetX,
        damping:         22,
        stiffness:       280,
        mass:            0.8,
        useNativeDriver: true,
      }).start();
    }
  }, [pathname, tabsWidth, activeIndex, items.length]);

  const pillStyle = { transform: [{ translateX: pillX }] };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bg.card,
          borderTopColor:  colors.border.DEFAULT,
          paddingBottom:   Platform.OS === "ios" ? spacing[5] : spacing[2],
        },
      ]}
      onLayout={(e) => setTabsWidth(e.nativeEvent.layout.width)}
    >
      {/* Single animated pill — slides between tabs */}
      {activeIndex >= 0 && (
        <Animated.View
          style={[styles.activePill, pillStyle, { backgroundColor: brand.blueAlpha15 }]}
          pointerEvents="none"
        />
      )}

      {/* Tab buttons — rendered in a row on top of the pill */}
      <View style={[layout.row, { flex: 1 }]}>
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <TouchableOpacity
              key={item.href}
              onPress={() => router.push(item.href as any)}
              style={[styles.tab, layout.colCentre]}
              activeOpacity={0.7}
            >
              <View style={styles.iconWrap}>
                <Icon
                  name={item.icon}
                  size="lg"
                  color={active ? brand.blue : colors.text.muted}
                  filled={active}
                />
                {item.badge && (
                  <View
                    style={[
                      styles.badgeDot,
                      { backgroundColor: colors.status.error },
                    ]}
                  />
                )}
              </View>

              <Text
                style={{
                  fontSize:   fontSize["2xs"],
                  fontWeight: active ? fontWeight.bold : fontWeight.normal,
                  color:      active ? brand.blue : colors.text.muted,
                  marginTop:  spacing[1] - 2,
                }}
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
    paddingTop:     spacing[2],
    position:       "relative",  // pill is absolute inside here
  },
  tab: {
    flex:            1,
    paddingVertical: spacing[1],
    gap:             spacing[1] - 2,
  },
  // Single pill — absolute, driven by Reanimated translateX
  activePill: {
    position:     "absolute",
    top:          0,
    left:         0,            // translateX offsets this
    width:        PILL_W,
    height:       PILL_H,
    borderRadius: radius.xl,
  },
  iconWrap: {
    position: "relative",
  },
  badgeDot: {
    position:     "absolute",
    top:          -(spacing[1] - 2),
    right:        -(spacing[1]),
    width:        spacing[2],
    height:       spacing[2],
    borderRadius: radius.full,
  },
});