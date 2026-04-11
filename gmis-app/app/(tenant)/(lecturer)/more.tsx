// ============================================================
// GMIS — Lecturer More Menu
// Route: /(tenant)/(lecturer)/more
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { View, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth }   from "@/context/AuthContext";
import { useTenant } from "@/context/TenantContext";
import { Text }      from "@/components/ui/Text";
import { Icon, type IconName } from "@/components/ui/Icon";
import { AppShell }  from "@/components/layout";
import { useTheme }  from "@/context/ThemeContext";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout }    from "@/styles/shared";

const MORE_ITEMS: { label: string; icon: IconName; href: string; description: string }[] = [
  { label: "My Courses",    icon: "nav-courses",    href: "/(tenant)/(lecturer)/courses",    description: "View your assigned courses"         },
  { label: "Upload Results",icon: "action-upload",  href: "/(tenant)/(lecturer)/results",    description: "Enter and submit student grades"    },
  { label: "QR Attendance", icon: "nav-attendance", href: "/(tenant)/(lecturer)/attendance", description: "Take attendance manually or by QR"  },
  { label: "Student List",  icon: "nav-students",   href: "/(tenant)/(lecturer)/students",   description: "View enrolled students"             },
  { label: "Timetable",     icon: "nav-timetable",  href: "/(tenant)/(lecturer)/timetable",  description: "View your teaching schedule"        },
];

export default function LecturerMore() {
  const router            = useRouter();
  const { user, signOut } = useAuth();
  const { tenant }        = useTenant();
  const { colors }        = useTheme();

  const shellUser = { name: user?.email || "Lecturer", role: "lecturer" as const };

  return (
    <AppShell
      role="lecturer"
      user={shellUser}
      schoolName={tenant?.name || ""}
      pageTitle="More"
      onLogout={async () => { await signOut(); router.replace("/login"); }}
    >
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="heading" color="primary" style={{ marginBottom: spacing[1] }}>More</Text>
        <Text variant="caption" color="muted" style={{ marginBottom: spacing[5] }}>All features at your fingertips</Text>

        {MORE_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.href}
            onPress={() => router.push(item.href as any)}
            activeOpacity={0.75}
            style={[styles.row, { backgroundColor: colors.bg.card, borderColor: colors.border.DEFAULT }]}
          >
            <View style={[styles.iconBox, { backgroundColor: brand.blueAlpha10 }]}>
              <Icon name={item.icon} size="md" color={brand.blue} />
            </View>
            <View style={layout.fill}>
              <Text variant="label" weight="semibold" color="primary">{item.label}</Text>
              <Text variant="caption" color="muted">{item.description}</Text>
            </View>
            <Icon name="ui-forward" size="sm" color={colors.text.muted} />
          </TouchableOpacity>
        ))}

        {/* Logout */}
        <TouchableOpacity
          onPress={async () => { await signOut(); router.replace("/login"); }}
          activeOpacity={0.75}
          style={[styles.row, { backgroundColor: colors.status.errorBg, borderColor: colors.status.errorBorder, marginTop: spacing[4] }]}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.status.errorBg }]}>
            <Icon name="auth-logout" size="md" color={colors.status.error} />
          </View>
          <Text variant="label" weight="semibold" color="error">Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing[5], gap: spacing[3] },
  row: {
    flexDirection: "row", alignItems: "center",
    gap: spacing[4], padding: spacing[4],
    borderRadius: radius.xl, borderWidth: 1,
  },
  iconBox: {
    width: spacing[10], height: spacing[10],
    borderRadius: radius.lg, alignItems: "center", justifyContent: "center",
  },
});
