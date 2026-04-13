// ============================================================
// GMIS — App Shell (Native-first)
//
// Mobile: No PageHeader. Each screen owns its own top bar.
//         Drawer triggered via DrawerContext → useDrawer().
// Desktop: Sidebar layout, no bottom nav.
//
// Context: DrawerContext.openDrawer() is provided to all
//          children so any screen can open the nav drawer.
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
import { DrawerContext } from "@/context/DrawerContext";
import { layout }        from "@/styles/shared";
import type { NavItem, SidebarUser } from "./Sidebar";

type AppRole = "student" | "lecturer" | "admin" | "parent";

export interface AppShellUser extends SidebarUser {}

interface AppShellProps {
  role:           AppRole;
  user:           AppShellUser;
  schoolName:     string;
  schoolLogoUrl?: string | null;
  /** Used only on desktop sidebar. Mobile screens own their top bar. */
  pageTitle?:     string;
  pageSubtitle?:  string;
  showBack?:      boolean;
  onBack?:        () => void;
  headerRight?:   React.ReactNode;
  onLogout?:      () => void;
  /** Show GMIS logo in desktop sidebar header */
  showLogo?:      boolean;
  children:       React.ReactNode;
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
  schoolLogoUrl,
  pageTitle    = "",
  pageSubtitle,
  showBack     = false,
  onBack,
  headerRight,
  onLogout,
  showLogo     = false,
  children,
}: AppShellProps) {
  const router                         = useRouter();
  const { colors }                     = useTheme();
  const { showSidebar, showBottomNav } = useResponsive();
  const [drawerOpen, setDrawerOpen]    = useState(false);

  const handleNavigate = (path: string) => {
    router.push(path as any);
  };

  return (
    <DrawerContext.Provider value={{ openDrawer: () => setDrawerOpen(true) }}>
      <SafeAreaView
        style={[styles.root, { backgroundColor: colors.bg.primary }]}
        edges={showSidebar ? ["top", "bottom"] : ["bottom"]}
      >
        {/* Main layout row */}
        <View style={[layout.fillRow, styles.inner]}>

          {/* Desktop sidebar — only when showSidebar */}
          {showSidebar && (
            <Sidebar
              items={sidebarNavMap[role]}
              user={user}
              schoolName={schoolName}
              schoolLogoUrl={schoolLogoUrl}
              onLogout={onLogout}
            />
          )}

          {/* Main content column */}
          <View style={[layout.fillCol, styles.main]}>

            {/* Page header — desktop sidebar pages AND mobile inner pages.
                On mobile, the back arrow is always shown so inner pages
                never have a dead/empty left slot. */}
            {pageTitle ? (
              <PageHeader
                title={pageTitle}
                subtitle={pageSubtitle}
                showBack={showBack || !showSidebar}
                onBack={onBack}
                rightSlot={headerRight}
                showLogo={showLogo}
              />
            ) : null}

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

        {/* Mobile drawer — absolute overlay, same tree */}
        {!showSidebar && (
          <DrawerOverlay
            visible={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            onNavigate={handleNavigate}
            items={sidebarNavMap[role]}
            user={user}
            schoolName={schoolName}
            schoolLogoUrl={schoolLogoUrl}
            onLogout={onLogout}
          />
        )}
      </SafeAreaView>
    </DrawerContext.Provider>
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
