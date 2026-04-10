// ============================================================
// GMIS — App Shell (FIXED)
//
// FIX: DrawerOverlay is now an absolute-positioned overlay
// rendered inside the same View tree (not a Modal).
// This preserves Expo Router context so navigation works.
// onNavigate passes router.push down to the drawer.
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Sidebar }       from "./Sidebar";
import { BottomNav }     from "./BottomNav";
import { PageHeader }    from "./PageHeader";
import { DrawerOverlay } from "./DrawerOverlay";
import {
  studentNav, adminNav, lecturerNav, parentNav,
} from "./Sidebar";
import {
  studentBottomNav, adminBottomNav, lecturerBottomNav, parentBottomNav,
} from "./BottomNav";
import { useTheme }      from "@/context/ThemeContext";
import { useResponsive } from "@/lib/responsive";
import { layout }        from "@/styles/shared";
import type { NavItem, SidebarUser } from "./Sidebar";

type AppRole = "student" | "lecturer" | "admin" | "parent";

export interface AppShellUser extends SidebarUser {}

interface AppShellProps {
  role:          AppRole;
  user:          AppShellUser;
  schoolName:    string;
  pageTitle?:    string;
  pageSubtitle?: string;
  showBack?:     boolean;
  onBack?:       () => void;
  headerRight?:  React.ReactNode;
  onLogout?:     () => void;
  children:      React.ReactNode;
}

const sidebarNavMap: Record<AppRole, NavItem[]> = {
  student:  studentNav,
  lecturer: lecturerNav,
  admin:    adminNav,
  parent:   parentNav,
};

const bottomNavMap: Record<AppRole, any[]> = {
  student:  studentBottomNav,
  lecturer: lecturerBottomNav,
  admin:    adminBottomNav,
  parent:   parentBottomNav,
};

export function AppShell({
  role,
  user,
  schoolName,
  pageTitle    = "",
  pageSubtitle,
  showBack     = false,
  onBack,
  headerRight,
  onLogout,
  children,
}: AppShellProps) {
  const router                         = useRouter();
  const { colors }                     = useTheme();
  const { showSidebar, showBottomNav } = useResponsive();
  const [drawerOpen, setDrawerOpen]    = useState(false);

  // This is passed to DrawerOverlay so navigation works from within the overlay
  const handleNavigate = (path: string) => {
    router.push(path as any);
  };

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.bg.primary }]}
      edges={showSidebar ? ["top", "bottom"] : ["bottom"]}
    >
      {/* Main layout row */}
      <View style={[layout.fillRow, styles.inner]}>

        {/* Desktop sidebar — only shown when showSidebar is true */}
        {showSidebar && (
          <Sidebar
            items={sidebarNavMap[role]}
            user={user}
            schoolName={schoolName}
            onLogout={onLogout}
          />
        )}

        {/* Main content column */}
        <View style={[layout.fillCol, styles.main]}>

          {/* Mobile page header — only when no sidebar */}
          {!showSidebar && (
            <PageHeader
              title={pageTitle}
              subtitle={pageSubtitle}
              showBack={showBack}
              onBack={onBack}
              showMenu={!showBack}
              onMenuPress={() => setDrawerOpen(true)}
              rightSlot={headerRight}
            />
          )}

          {/* Page content */}
          <View style={layout.fillCol}>
            {children}
          </View>

          {/* Mobile bottom nav */}
          {showBottomNav && (
            <BottomNav items={bottomNavMap[role]} />
          )}
        </View>
      </View>

      {/* Mobile drawer — absolute overlay, SAME TREE as router/theme providers */}
      {!showSidebar && (
        <DrawerOverlay
          visible={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onNavigate={handleNavigate}    // ← router.push passed as prop
          items={sidebarNavMap[role]}
          user={user}
          schoolName={schoolName}
          onLogout={onLogout}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  inner: {
    flex: 1,
  },
  main: {
    flex:     1,
    overflow: "hidden",
  },
});
