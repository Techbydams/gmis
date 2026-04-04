// ============================================================
// GMIS — Drawer Overlay
// Mobile slide-in sidebar drawer with animated backdrop.
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useRef, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import { Sidebar, type NavItem, type SidebarUser } from "./Sidebar";
import { duration, sizes } from "@/theme/tokens";
import { layout } from "@/styles/shared";

interface DrawerOverlayProps {
  visible:    boolean;
  onClose:    () => void;
  items:      NavItem[];
  user:       SidebarUser;
  schoolName: string;
  onLogout?:  () => void;
}

export function DrawerOverlay({
  visible,
  onClose,
  items,
  user,
  schoolName,
  onLogout,
}: DrawerOverlayProps) {
  const slideAnim = useRef(new Animated.Value(-sizes.drawerWidth)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue:         visible ? 0 : -sizes.drawerWidth,
        duration:        visible ? duration.normal : duration.fast,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue:         visible ? 1 : 0,
        duration:        visible ? duration.normal : duration.fast,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible]);

  return (
    <View
      style={layout.absoluteFill}
      pointerEvents={visible ? "auto" : "none"}
    >
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, layout.absoluteFill, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={layout.absoluteFill}
          onPress={onClose}
          activeOpacity={1}
        />
      </Animated.View>

      {/* Sidebar panel */}
      <Animated.View
        style={[
          styles.drawer,
          { transform: [{ translateX: slideAnim }] },
        ]}
      >
        <Sidebar
          items={items}
          user={user}
          schoolName={schoolName}
          onLogout={() => { onLogout?.(); onClose(); }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.60)",
    zIndex:          10,
  },
  drawer: {
    position: "absolute",
    left:     0,
    top:      0,
    bottom:   0,
    width:    sizes.drawerWidth,   // 260
    zIndex:   20,
  },
});