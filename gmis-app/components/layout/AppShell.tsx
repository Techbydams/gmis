// ============================================================
// GMIS — App Shell
// Responsive authenticated wrapper.
// Desktop (lg+): sidebar left. Mobile: header + bottom nav + drawer.
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { Sidebar, type SidebarUser, type NavItem } from "./Sidebar";
import { BottomNav, type BottomNavItem } from "./BottomNav";
import { PageHeader }   from "./PageHeader";
import { DrawerOverlay } from "./DrawerOverlay";
import { studentNav, adminNav, lecturerNav, parentNav } from "./Sidebar";
import {
  studentBottomNav, adminBottomNav,
  lecturerBottomNav, parentBottomNav,
} from "./BottomNav";
import { useTheme }       from "@/context/ThemeContext";
import { useResponsive }  from "@/lib/responsive";
import { layout }         from "@/styles/shared";

type AppRole = "student" | "lecturer" | "admin" | "parent";

interface AppShellProps {
  role:           AppRole;
  user:           SidebarUser;
  schoolName:     string;
  pageTitle?:     string;
  pageSubtitle?:  string;
  showBack?:      boolean;
  onBack?:        () => void;
  headerRight?:   React.ReactNode;
  onLogout?:      () => void;
  children:       React.ReactNode;
}

const sidebarNavMap: Record<AppRole, NavItem[]> = {
  student:  studentNav,
  lecturer: lecturerNav,
  admin:    adminNav,
  parent:   parentNav,
};

const bottomNavMap: Record<AppRole, BottomNavItem[]> = {
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
  const { colors }                     = useTheme();
  const { showSidebar, showBottomNav } = useResponsive();
  const [drawerOpen, setDrawerOpen]    = useState(false);

  return (
    <View
      style={[
        layout.fillRow,
        { backgroundColor: colors.bg.primary },
      ]}
    >
      {/* Desktop sidebar */}
      {showSidebar && (
        <Sidebar
          items={sidebarNavMap[role]}
          user={user}
          schoolName={schoolName}
          onLogout={onLogout}
        />
      )}

      {/* Main content */}
      <View style={[layout.fillCol, styles.main]}>

        {/* Mobile header */}
        {!showSidebar && pageTitle !== "" && (
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

      {/* Mobile drawer */}
      {!showSidebar && (
        <DrawerOverlay
          visible={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          items={sidebarNavMap[role]}
          user={user}
          schoolName={schoolName}
          onLogout={onLogout}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  main: {
    overflow: "hidden",
  },
});