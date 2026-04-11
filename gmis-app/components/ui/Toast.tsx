// ============================================================
// GMIS — Toast Notification System
//
// Usage:
//   const { showToast } = useToast();
//   showToast({ message: "Saved!", variant: "success" });
//
// Wrap your app root (or layout) with <ToastProvider>.
// The toast portal renders above everything via absolute
// positioning at zIndex: 50 (from tokens).
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import {
  createContext, useContext, useCallback, useRef,
  useState, useEffect, type ReactNode,
} from "react";
import {
  Animated,
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text }    from "./Text";
import { Icon }    from "./Icon";
import { useTheme } from "@/context/ThemeContext";
import { brand, spacing, radius, fontSize, fontWeight, zIndex } from "@/theme/tokens";
import { platformShadow } from "@/styles/shared";

// ── Types ──────────────────────────────────────────────────

export type ToastVariant = "success" | "error" | "warning" | "info" | "default";

export interface ToastConfig {
  message:     string;
  variant?:    ToastVariant;
  duration?:   number;    // ms before auto-dismiss (default 3000, 0 = sticky)
  actionLabel?: string;
  onAction?:    () => void;
}

interface ToastContextValue {
  showToast: (config: ToastConfig) => void;
  hideToast: () => void;
}

// ── Context ────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
  hideToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

// ── Variant config ─────────────────────────────────────────

const VARIANT_CONFIG: Record<ToastVariant, {
  iconName:  string;
  iconColor: (c: any) => string;
  bg:        (c: any) => string;
  border:    (c: any) => string;
}> = {
  success: {
    iconName:  "status-success",
    iconColor: (c) => c.status.success,
    bg:        (c) => c.status.successBg,
    border:    (c) => c.status.successBorder,
  },
  error: {
    iconName:  "status-error",
    iconColor: (c) => c.status.error,
    bg:        (c) => c.status.errorBg,
    border:    (c) => c.status.errorBorder,
  },
  warning: {
    iconName:  "status-warning",
    iconColor: (c) => c.status.warning,
    bg:        (c) => c.status.warningBg,
    border:    (c) => c.status.warningBorder,
  },
  info: {
    iconName:  "status-info",
    iconColor: (c) => c.status.info,
    bg:        (c) => c.status.infoBg,
    border:    (c) => c.status.infoBorder,
  },
  default: {
    iconName:  "status-info",
    iconColor: (c) => c.text.secondary,
    bg:        (c) => c.bg.elevated,
    border:    (c) => c.border.DEFAULT,
  },
};

// ── Toast item (single visible toast) ─────────────────────

interface ToastItemProps {
  config:   ToastConfig;
  onDismiss: () => void;
}

function ToastItem({ config, onDismiss }: ToastItemProps) {
  const { colors }  = useTheme();
  const insets      = useSafeAreaInsets();
  const translateY  = useRef(new Animated.Value(-80)).current;
  const opacity     = useRef(new Animated.Value(0)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cfg      = VARIANT_CONFIG[config.variant ?? "default"];
  const duration = config.duration ?? 3000;

  const dismiss = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    Animated.parallel([
      Animated.timing(translateY, { toValue: -80, duration: 200, useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: 0,   duration: 200, useNativeDriver: true }),
    ]).start(onDismiss);
  }, [onDismiss, translateY, opacity]);

  useEffect(() => {
    // Slide in
    Animated.parallel([
      Animated.spring(translateY, {
        toValue:         0,
        damping:         20,
        stiffness:       280,
        mass:            0.7,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue:         1,
        duration:        220,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss
    if (duration > 0) {
      dismissTimer.current = setTimeout(dismiss, duration);
    }
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  const topOffset = insets.top + spacing[3];

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          top:             topOffset,
          backgroundColor: cfg.bg(colors),
          borderColor:     cfg.border(colors),
          transform:       [{ translateY }],
          opacity,
        },
      ]}
    >
      {/* Left icon */}
      <View style={{ flexShrink: 0 }}>
        <Icon name={cfg.iconName as any} size="md" color={cfg.iconColor(colors)} />
      </View>

      {/* Message */}
      <View style={styles.messageCol}>
        <Text
          style={{
            fontSize:   fontSize.sm,
            fontWeight: fontWeight.medium,
            color:      colors.text.primary,
            flexShrink: 1,
          }}
          numberOfLines={2}
        >
          {config.message}
        </Text>

        {config.actionLabel && config.onAction && (
          <TouchableOpacity
            onPress={() => { config.onAction?.(); dismiss(); }}
            activeOpacity={0.7}
            style={{ marginTop: spacing[1] }}
          >
            <Text
              style={{
                fontSize:   fontSize.xs,
                fontWeight: fontWeight.semibold,
                color:      brand.blue,
              }}
            >
              {config.actionLabel}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Dismiss X */}
      <TouchableOpacity
        onPress={dismiss}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={styles.closeBtn}
      >
        <Icon name="ui-close" size="sm" color={colors.text.muted} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Provider ───────────────────────────────────────────────

interface ToastProviderProps { children: ReactNode }

export function ToastProvider({ children }: ToastProviderProps) {
  const [current, setCurrent] = useState<ToastConfig | null>(null);

  const showToast = useCallback((config: ToastConfig) => {
    // Replace any existing toast immediately
    setCurrent(null);
    // Small tick so the item unmounts / remounts with fresh animation
    setTimeout(() => setCurrent(config), 20);
  }, []);

  const hideToast = useCallback(() => setCurrent(null), []);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {current && (
        <ToastItem
          config={current}
          onDismiss={hideToast}
        />
      )}
    </ToastContext.Provider>
  );
}

// ── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  toast: {
    position:          "absolute",
    left:              spacing[4],
    right:             spacing[4],
    zIndex:            zIndex.toast,
    flexDirection:     "row",
    alignItems:        "center",
    gap:               spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[3],
    borderRadius:      radius.xl,
    borderWidth:       1,
    // Shadow — cross-platform via platformShadow utility
    ...platformShadow("#000", 4, 12, 0.15, 8),
  },
  messageCol: {
    flex: 1,
  },
  closeBtn: {
    flexShrink: 0,
    padding:    spacing[1],
  },
});
