// ============================================================
// GMIS — Bottom Sheet
//
// A slide-up overlay anchored to the bottom of the screen.
// Uses RN built-in Animated (no Reanimated required).
//
// Usage:
//   <BottomSheet visible={open} onClose={() => setOpen(false)}>
//     <View>...</View>
//   </BottomSheet>
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useEffect, useRef, type ReactNode } from "react";
import {
  Animated,
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import { spacing, radius, zIndex } from "@/theme/tokens";
import { platformShadow } from "@/styles/shared";

interface BottomSheetProps {
  visible:     boolean;
  onClose:     () => void;
  children:    ReactNode;
  snapHeight?: number;          // fixed height in px — if omitted, wraps content
  scrollable?: boolean;         // wrap content in ScrollView
}

export function BottomSheet({
  visible,
  onClose,
  children,
  snapHeight,
  scrollable = false,
}: BottomSheetProps) {
  const { colors }          = useTheme();
  const insets              = useSafeAreaInsets();
  const { height: SCREEN_H } = useWindowDimensions();

  const sheetHeight = snapHeight ?? SCREEN_H * 0.55;

  const translateY      = useRef(new Animated.Value(sheetHeight)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      // Instantly reset so next open starts from off-screen
      translateY.setValue(sheetHeight);
      backdropOpacity.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.spring(translateY, {
        toValue:         0,
        damping:         26,
        stiffness:       320,
        mass:            0.8,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue:         1,
        duration:        220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, sheetHeight]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue:         sheetHeight,
        duration:        240,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue:         0,
        duration:        200,
        useNativeDriver: true,
      }),
    ]).start(onClose);
  };

  if (!visible) return null;

  const bottomPad = Math.max(insets.bottom, Platform.OS === "ios" ? spacing[5] : spacing[2]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">

      {/* Backdrop */}
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]}
        pointerEvents="auto"
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={dismiss}
          activeOpacity={1}
        />
      </Animated.View>

      {/* Sheet panel */}
      <Animated.View
        style={[
          styles.sheet,
          {
            height:          snapHeight ? sheetHeight : undefined,
            maxHeight:       SCREEN_H * 0.90,
            backgroundColor: colors.bg.elevated,
            paddingBottom:   bottomPad,
            transform:       [{ translateY }],
          },
        ]}
      >
        {/* Drag handle */}
        <View style={styles.handleWrap} pointerEvents="none">
          <View style={[styles.handle, { backgroundColor: colors.border.strong }]} />
        </View>

        {/* Content */}
        {scrollable ? (
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View style={{ flex: snapHeight ? 1 : undefined }}>
            {children}
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.55)",
    zIndex:          zIndex.modal - 1,
  },
  sheet: {
    position:          "absolute",
    left:              0,
    right:             0,
    bottom:            0,
    zIndex:            zIndex.modal,
    borderTopLeftRadius:  radius["3xl"],
    borderTopRightRadius: radius["3xl"],
    ...platformShadow("#000", -4, 16, 0.2, 20),
  },
  handleWrap: {
    alignItems:     "center",
    paddingVertical: spacing[3],
  },
  handle: {
    width:        spacing[8],
    height:       4,
    borderRadius: radius.full,
  },
});
