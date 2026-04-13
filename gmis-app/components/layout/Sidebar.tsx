// ============================================================
// GMIS — Sidebar Navigation
// Desktop sidebar (lg+). School branding, user info, nav items.
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { View, TouchableOpacity, ScrollView, StyleSheet, Image } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { Text }    from "@/components/ui/Text";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Avatar }  from "@/components/ui/Avatar";
import { Badge }   from "@/components/ui/Badge";
import { useTheme } from "@/context/ThemeContext";
import { useTenant } from "@/context/TenantContext";
import {
  brand, spacing, radius, fontSize, fontWeight, sizes,
} from "@/theme/tokens";

const GMIS_LOGO_LIGHT = require("@/assets/gmis_logo_light.png");
const GMIS_LOGO_DARK  = require("@/assets/gmis_logo_dark.png");
import { layout, iconBtn } from "@/styles/shared";

// ── Types ──────────────────────────────────────────────────
export interface NavItem {
  label:  string;
  icon:   IconName;
  href:   string;
  badge?: string;
}

export interface SidebarUser {
  name:       string;
  role:       "student" | "lecturer" | "admin" | "parent";
  sub?:       string;
  avatarUrl?: string | null;
}

// ── Nav items per role ─────────────────────────────────────
export const studentNav: NavItem[] = [
  { label: "Dashboard",    icon: "nav-home",      href: "/(tenant)/(student)/dashboard"    },
  { label: "Results",      icon: "nav-results",   href: "/(tenant)/(student)/results"      },
  { label: "Timetable",    icon: "nav-timetable", href: "/(tenant)/(student)/timetable"    },
  { label: "Payments",     icon: "nav-payments",  href: "/(tenant)/(student)/payments"     },
  { label: "Courses",      icon: "nav-courses",   href: "/(tenant)/(student)/courses"      },
  { label: "GPA Calc",     icon: "nav-gpa",       href: "/(tenant)/(student)/gpa"          },
  { label: "Clearance",    icon: "nav-clearance", href: "/(tenant)/(student)/clearance"    },
  { label: "Chat",         icon: "nav-chat",      href: "/(tenant)/(student)/chat"         },
  { label: "Social",       icon: "nav-social",    href: "/(tenant)/(student)/social"       },
  { label: "Voting",       icon: "nav-voting",    href: "/(tenant)/(student)/voting"       },
  { label: "Calendar",     icon: "nav-calendar",  href: "/(tenant)/(student)/calendar"     },
  { label: "AI Assistant", icon: "nav-ai",        href: "/(tenant)/(student)/ai"           },
];

export const adminNav: NavItem[] = [
  { label: "Dashboard",  icon: "nav-dashboard",  href: "/(tenant)/(admin)/dashboard"  },
  { label: "Approvals",  icon: "nav-approvals",  href: "/(tenant)/(admin)/approvals"  },
  { label: "Students",   icon: "nav-students",   href: "/(tenant)/(admin)/students"   },
  { label: "Academic",   icon: "nav-academic",   href: "/(tenant)/(admin)/academic"   },
  { label: "Results",    icon: "nav-results",    href: "/(tenant)/(admin)/results"    },
  { label: "Timetable",  icon: "nav-timetable",  href: "/(tenant)/(admin)/timetable"  },
  { label: "Fees",       icon: "nav-fees",       href: "/(tenant)/(admin)/fees"       },
  { label: "ID Cards",   icon: "nav-idcards",    href: "/(tenant)/(admin)/idcards"    },
  { label: "Elections",  icon: "nav-elections",  href: "/(tenant)/(admin)/elections"  },
  { label: "News",       icon: "nav-news",       href: "/(tenant)/(admin)/news"       },
  { label: "Paystack",   icon: "nav-paystack",   href: "/(tenant)/(admin)/paystack"   },
  { label: "Settings",   icon: "nav-settings",   href: "/(tenant)/(admin)/settings"   },
];

export const lecturerNav: NavItem[] = [
  { label: "Dashboard",  icon: "nav-dashboard",  href: "/(tenant)/(lecturer)/dashboard"  },
  { label: "My Courses", icon: "nav-courses",    href: "/(tenant)/(lecturer)/courses"    },
  { label: "Students",   icon: "nav-students",   href: "/(tenant)/(lecturer)/students"   },
  { label: "Results",    icon: "nav-results",    href: "/(tenant)/(lecturer)/results"    },
  { label: "Attendance", icon: "nav-attendance", href: "/(tenant)/(lecturer)/attendance" },
  { label: "Handouts",   icon: "nav-handouts",   href: "/(tenant)/(lecturer)/handouts"   },
  { label: "Timetable",  icon: "nav-timetable",  href: "/(tenant)/(lecturer)/timetable"  },
];

export const parentNav: NavItem[] = [
  { label: "Dashboard",  icon: "nav-dashboard",  href: "/(tenant)/(parent)/dashboard"  },
  { label: "Results",    icon: "nav-results",    href: "/(tenant)/(parent)/results"    },
  { label: "Payments",   icon: "nav-payments",   href: "/(tenant)/(parent)/payments"   },
  { label: "Attendance", icon: "nav-attendance", href: "/(tenant)/(parent)/attendance" },
  { label: "Calendar",   icon: "nav-calendar",   href: "/(tenant)/(parent)/calendar"   },
];

// ── Nav Row ────────────────────────────────────────────────
function NavRow({
  item,
  active,
  onPress,
}: { item: NavItem; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.navRow,
        layout.row,
        active && styles.navRowActive,
      ]}
    >
      <Icon
        name={item.icon}
        size="md"
        color={active ? brand.blue : "#7a8bbf"}
        filled={active}
      />
      <Text
        variant="label"
        weight={active ? "semibold" : "normal"}
        color={active ? "brand" : "secondary"}
        style={styles.navLabel}
        numberOfLines={1}
      >
        {item.label}
      </Text>
      {item.badge && (
        <Badge label={item.badge} variant="blue" size="sm" />
      )}
    </TouchableOpacity>
  );
}

// ── Sidebar ────────────────────────────────────────────────
interface SidebarProps {
  items:          NavItem[];
  user:           SidebarUser;
  schoolName:     string;
  schoolLogoUrl?: string | null;
  onLogout?:      () => void;
}

// Strip Expo Router group segments — usePathname() returns "/dashboard"
// but item.href is "/(tenant)/(student)/dashboard".
function stripGroups(path: string): string {
  return path.replace(/\/\([^)]+\)/g, "") || "/";
}

export function Sidebar({ items, user, schoolName, schoolLogoUrl, onLogout }: SidebarProps) {
  const { colors, toggleTheme, isDark } = useTheme();
  const { tenant } = useTenant();
  const router    = useRouter();
  const pathname  = usePathname();
  const GMIS_LOGO = isDark ? GMIS_LOGO_DARK : GMIS_LOGO_LIGHT;
  // Prefer explicit prop, fall back to tenant context logo
  const logoUrl   = schoolLogoUrl ?? tenant?.logo_url ?? null;
  const strippedPathname = stripGroups(pathname);

  return (
    <View
      style={[
        styles.sidebar,
        layout.col,
        {
          backgroundColor:  colors.bg.secondary,
          borderRightColor: colors.border.DEFAULT,
        },
      ]}
    >
      {/* School brand */}
      <View
        style={[
          styles.brand,
          layout.row,
          { borderBottomColor: colors.border.subtle },
        ]}
      >
        <View
          style={[
            styles.brandIcon,
            layout.centred,
            { backgroundColor: logoUrl ? "transparent" : brand.blueAlpha15,
              borderWidth: logoUrl ? 0 : 0, overflow: "hidden" },
          ]}
        >
          {logoUrl ? (
            <Image
              source={{ uri: logoUrl }}
              style={{ width: "100%" as any, height: "100%" as any }}
              resizeMode="contain"
            />
          ) : (
            <Icon name="academic-faculty" size="lg" color={brand.blue} />
          )}
        </View>
        <View style={layout.fill}>
          <Text variant="label" weight="bold" color="primary" numberOfLines={1}>
            {schoolName}
          </Text>
          <View style={[{ flexDirection: "row", alignItems: "center", gap: spacing[1], marginTop: 2 }]}>
            <Text variant="micro" color="muted">Powered by</Text>
            <Image source={GMIS_LOGO} style={styles.logoSmall} resizeMode="contain" />
          </View>
        </View>
      </View>

      {/* User info */}
      <View
        style={[
          styles.userRow,
          layout.row,
          { borderBottomColor: colors.border.subtle },
        ]}
      >
        <Avatar name={user.name} src={user.avatarUrl} size="md" role={user.role} />
        <View style={[layout.fill, { marginLeft: spacing[3] }]}>
          <Text variant="label" weight="semibold" color="primary" numberOfLines={1}>
            {user.name}
          </Text>
          {user.sub && (
            <Text variant="mono" color="muted">{user.sub}</Text>
          )}
        </View>
        <Badge
          label={user.role}
          variant={
            user.role === "student"  ? "blue"   :
            user.role === "lecturer" ? "green"  :
            user.role === "admin"    ? "gold"   : "indigo"
          }
          size="sm"
        />
      </View>

      {/* Nav items */}
      <ScrollView
        style={layout.fill}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.navList}
      >
        {items.map((item) => {
          const stripped = stripGroups(item.href);
          return (
            <NavRow
              key={item.href}
              item={item}
              active={strippedPathname === stripped || strippedPathname.startsWith(stripped + "/")}
              onPress={() => router.push(item.href as any)}
            />
          );
        })}
      </ScrollView>

      {/* Footer */}
      <View
        style={[
          styles.footer,
          { borderTopColor: colors.border.subtle },
        ]}
      >
        {/* Theme toggle */}
        <TouchableOpacity
          onPress={toggleTheme}
          style={[
            styles.footerBtn,
            layout.row,
            { backgroundColor: colors.bg.hover },
          ]}
          activeOpacity={0.7}
        >
          <Icon
            name={isDark ? "ui-sun" : "ui-moon"}
            size="md"
            color={colors.text.secondary}
          />
          <Text
            variant="caption"
            color="secondary"
            style={{ marginLeft: spacing[2] }}
          >
            {isDark ? "Light mode" : "Dark mode"}
          </Text>
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity
          onPress={onLogout}
          style={[
            styles.footerBtn,
            layout.row,
            { backgroundColor: colors.status.errorBg },
          ]}
          activeOpacity={0.7}
        >
          <Icon name="auth-logout" size="md" color={colors.status.error} />
          <Text
            variant="caption"
            weight="medium"
            color="error"
            style={{ marginLeft: spacing[2] }}
          >
            Sign out
          </Text>
        </TouchableOpacity>

        {/* GMIS logo + DAMS credit */}
        <View style={[{ alignItems: "center", marginTop: spacing[3], gap: spacing[1] }]}>
          <Image source={GMIS_LOGO} style={styles.logoFooter} resizeMode="contain" />
          <Text variant="micro" color="muted" align="center">
            DAMS Technologies © {new Date().getFullYear()}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width:            sizes.sidebarWidth,   // 260
    flexGrow:         0,                    // never expand beyond 260px
    flexShrink:       0,                    // never collapse below 260px
    flexBasis:        sizes.sidebarWidth,
    borderRightWidth: 1,
  },
  brand: {
    gap:               spacing[3],
    padding:           spacing[4],
    borderBottomWidth: 1,
  },
  brandIcon: {
    width:        sizes.brandIconSize,       // 40
    height:       sizes.brandIconSize,
    borderRadius: radius.md,
  },
  userRow: {
    padding:           spacing[4],
    borderBottomWidth: 1,
  },
  navList: {
    paddingVertical: spacing[2],
    gap:             spacing[1],
  },
  navRow: {
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[3],
    marginHorizontal:  spacing[2],
    borderRadius:      radius.lg,
    gap:               spacing[2],
  },
  navRowActive: {
    backgroundColor: brand.blueAlpha15,
  },
  navLabel: {
    flex: 1,
  },
  footer: {
    padding:        spacing[4],
    borderTopWidth: 1,
    gap:            spacing[2],
  },
  footerBtn: {
    paddingHorizontal: spacing[3],
    paddingVertical:   spacing[2],
    borderRadius:      radius.md,
    gap:               spacing[2],
  },
  // GMIS logo sizes
  logoSmall: {
    width:  36,
    height: 14,
  },
  logoFooter: {
    width:  64,
    height: 22,
  },
});