// ============================================================
// GMIS — Parent More Menu
// Route: /(tenant)/(parent)/more
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
import { brand, spacing, radius } from "@/theme/tokens";
import { layout }    from "@/styles/shared";

const MORE_ITEMS: { label: string; icon: IconName; href: string; description: string }[] = [
  { label: "Results",           icon: "nav-results",    href: "/(tenant)/(parent)/results",    description: "View ward's academic results"     },
  { label: "Fee Status",        icon: "nav-payments",   href: "/(tenant)/(parent)/payments",   description: "Check payment history & status"  },
  { label: "Attendance",        icon: "nav-attendance", href: "/(tenant)/(parent)/attendance", description: "Track ward's attendance record"   },
  { label: "Academic Calendar", icon: "nav-calendar",   href: "/(tenant)/(parent)/calendar",   description: "School events & exam timetable"  },
];

export default function ParentMore() {
  const router            = useRouter();
  const { user, signOut } = useAuth();
  const { tenant }        = useTenant();
  const { colors }        = useTheme();

  const shellUser = { name: user?.email || "Parent", role: "parent" as const };

  return (
    <AppShell
      role="parent"
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
