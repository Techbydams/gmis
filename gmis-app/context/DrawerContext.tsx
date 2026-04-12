// ============================================================
// GMIS — Drawer Context
// Allows any screen inside AppShell to trigger the mobile
// slide-in drawer without prop-drilling.
// Usage: const { openDrawer } = useDrawer();
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { createContext, useContext } from "react";

interface DrawerContextValue {
  openDrawer: () => void;
}

export const DrawerContext = createContext<DrawerContextValue>({
  openDrawer: () => {},
});

export const useDrawer = () => useContext(DrawerContext);
