/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

/**
 * AnimatedThemeToggler — pill toggle with a sliding thumb and
 * animated sun ↔ moon icons. Uses RN built-in Animated only.
 */

import { useEffect, useRef } from "react";
import { Animated, StyleSheet, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { Icon } from "@/components/ui/Icon";

type Size = "sm" | "md" | "lg";

const CONFIGS: Record<Size, { pill: number; thumb: number; gap: number }> = {
  sm: { pill: 64, thumb: 26, gap: 6  },
  md: { pill: 76, thumb: 30, gap: 8  },
  lg: { pill: 88, thumb: 34, gap: 10 },
};

export function AnimatedThemeToggler({ size = "md" }: { size?: Size }) {
  const { isDark, toggleTheme } = useTheme();
  const cfg = CONFIGS[size];

  // 0 = light, 1 = dark
  const progress = useRef(new Animated.Value(isDark ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue:         isDark ? 1 : 0,
      damping:         22,
      stiffness:       280,
      mass:            0.7,
      useNativeDriver: false, // needed for color interpolation
    }).start();
  }, [isDark]);

  const thumbTravel = cfg.pill - cfg.thumb - cfg.gap * 2;

  // Thumb slide
  const thumbX = progress.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, thumbTravel],
  });

  // Pill background
  const pillBg = progress.interpolate({
    inputRange:  [0, 1],
    outputRange: ["rgba(0,0,0,0.08)", "rgba(255,255,255,0.10)"],
  });

  const pillBorder = progress.interpolate({
    inputRange:  [0, 1],
    outputRange: ["rgba(0,0,0,0.12)", "rgba(255,255,255,0.15)"],
  });

  // Thumb background
  const thumbBg = progress.interpolate({
    inputRange:  [0, 1],
    outputRange: ["#ffffff", "#1e293b"],
  });

  // Sun icon opacity + scale
  const sunOpacity = progress.interpolate({
    inputRange: [0, 1], outputRange: [1, 0.35],
  });
  const sunScale = progress.interpolate({
    inputRange: [0, 1], outputRange: [1.1, 0.85],
  });

  // Moon icon opacity + scale
  const moonOpacity = progress.interpolate({
    inputRange: [0, 1], outputRange: [0.35, 1],
  });
  const moonScale = progress.interpolate({
    inputRange: [0, 1], outputRange: [0.85, 1.1],
  });

  const pillH = cfg.thumb + cfg.gap * 2;

  return (
    <TouchableOpacity
      onPress={toggleTheme}
      activeOpacity={0.85}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Animated.View
        style={[
          styles.pill,
          {
            width:            cfg.pill,
            height:           pillH,
            borderRadius:     pillH / 2,
            padding:          cfg.gap,
            backgroundColor:  pillBg,
            borderColor:      pillBorder,
          },
        ]}
      >
        {/* Sliding thumb */}
        <Animated.View
          style={[
            styles.thumb,
            {
              width:           cfg.thumb,
              height:          cfg.thumb,
              borderRadius:    cfg.thumb / 2,
              backgroundColor: thumbBg,
              transform:       [{ translateX: thumbX }],
            },
          ]}
        />

        {/* Icon overlay */}
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.iconRow,
            { paddingHorizontal: cfg.gap },
          ]}
        >
          {/* Sun — left */}
          <Animated.View
            style={[
              styles.iconSlot,
              { width: cfg.thumb, opacity: sunOpacity, transform: [{ scale: sunScale }] },
            ]}
          >
            <Icon name="ui-sun" size="xs" color="#f59e0b" />
          </Animated.View>

          {/* Moon — right */}
          <Animated.View
            style={[
              styles.iconSlot,
              { width: cfg.thumb, opacity: moonOpacity, transform: [{ scale: moonScale }] },
            ]}
          >
            <Icon name="ui-moon" size="xs" color="#818cf8" />
          </Animated.View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderWidth: 1,
    overflow:    "hidden",
    position:    "relative",
  },
  thumb: {
    shadowColor:   "#000",
    shadowOffset:  { width: 0, height: 2 },
    shadowRadius:  4,
    shadowOpacity: 0.18,
    elevation:     3,
  },
  iconRow: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "space-between",
  },
  iconSlot: {
    alignItems:     "center",
    justifyContent: "center",
  },
});
