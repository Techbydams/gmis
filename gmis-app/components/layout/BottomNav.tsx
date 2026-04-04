// ============================================================
// GMIS — Bottom Navigation
// Mobile tab bar (xs/sm). Max 5 tabs per role.
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { View, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Text }  from "@/components/ui/Text";
import { useTheme } from "@/context/ThemeContext";
import { brand, spacing, fontSize, fontWeight, radius, sizes } from "@/theme/tokens";
import { layout } from "@/styles/shared";

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

  return (
    <View
      style={[
        styles.container,
        layout.row,
        {
          backgroundColor: colors.bg.card,
          borderTopColor:  colors.border.DEFAULT,
          paddingBottom:   Platform.OS === "ios" ? spacing[5] : spacing[2],
        },
      ]}
    >
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");

        return (
          <TouchableOpacity
            key={item.href}
            onPress={() => router.push(item.href as any)}
            style={[styles.tab, layout.colCentre]}
            activeOpacity={0.7}
          >
            {/* Active indicator */}
            {active && (
              <View
                style={[
                  styles.activePill,
                  { backgroundColor: brand.blueAlpha15 },
                ]}
              />
            )}

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
                fontSize:   fontSize["2xs"],   // 10
                fontWeight: active ? fontWeight.bold : fontWeight.normal,
                color:      active ? brand.blue : colors.text.muted,
                marginTop:  spacing[1] - 2,    // 2
              }}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingTop:     spacing[2],
  },
  tab: {
    flex:            1,
    paddingVertical: spacing[1],
    gap:             spacing[1] - 2,  // 2
    position:        "relative",
  },
  activePill: {
    position:     "absolute",
    top:          0,
    width:        spacing[10],    // 40
    height:       spacing[8],     // 32
    borderRadius: radius.xl,
  },
  iconWrap: {
    position: "relative",
  },
  badgeDot: {
    position:     "absolute",
    top:          -(spacing[1] - 2),   // -2
    right:        -(spacing[1]),       // -4
    width:        spacing[2],          // 8
    height:       spacing[2],          // 8
    borderRadius: radius.full,
  },
});