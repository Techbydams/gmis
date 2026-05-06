/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

/**
 * BorderBeam — animated glowing comet that travels the card perimeter.
 * Uses RN built-in Animated + requestAnimationFrame (no Reanimated needed).
 *
 * Usage:
 *   <View style={{ borderRadius:16, overflow:"hidden" }}>
 *     <BorderBeam />
 *     {content}
 *   </View>
 */

import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";

interface BorderBeamProps {
  size?:      number;
  duration?:  number;
  colorFrom?: string;
  colorTo?:   string;
  opacity?:   number;
}

export function BorderBeam({
  size     = 80,
  duration = 8,
  colorFrom = "#3b82f6",
  colorTo   = "#a855f7",
  opacity   = 0.8,
}: BorderBeamProps) {
  const [dims, setDims] = useState({ w: 0, h: 0 });

  // Animated x/y for the orb centre
  const beamX = useRef(new Animated.Value(-size)).current;
  const beamY = useRef(new Animated.Value(-size)).current;

  useEffect(() => {
    if (dims.w === 0 || dims.h === 0) return;
    const { w, h } = dims;
    const perimeter   = 2 * (w + h);
    const msPerFrame  = 1000 / 60;
    const distPerFrame = perimeter / (duration * 60);

    let dist = 0;
    let rafId: ReturnType<typeof requestAnimationFrame>;

    const step = () => {
      dist = (dist + distPerFrame) % perimeter;

      let x: number, y: number;
      if (dist <= w) {
        x = dist;       y = 0;
      } else if (dist <= w + h) {
        x = w;          y = dist - w;
      } else if (dist <= 2 * w + h) {
        x = w - (dist - w - h);  y = h;
      } else {
        x = 0;          y = h - (dist - 2 * w - h);
      }

      beamX.setValue(x - size / 2);
      beamY.setValue(y - size / 2);

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [dims.w, dims.h, duration, size]);

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setDims({ w: width, h: height });
      }}
    >
      {/* Soft outer glow */}
      <Animated.View
        style={[
          styles.orb,
          {
            width:           size * 1.6,
            height:          size * 1.6,
            borderRadius:    size,
            backgroundColor: colorTo,
            opacity:         opacity * 0.5,
            transform: [
              { translateX: beamX },
              { translateY: beamY },
            ],
            // Compensate for larger glow size so the centre matches
            marginLeft: -(size * 0.3),
            marginTop:  -(size * 0.3),
            shadowColor:    colorTo,
            shadowOffset:   { width: 0, height: 0 },
            shadowOpacity:  0.7,
            shadowRadius:   size * 0.6,
          },
        ]}
      />
      {/* Bright core */}
      <Animated.View
        style={[
          styles.orb,
          {
            width:           size * 0.4,
            height:          size * 0.4,
            borderRadius:    size,
            backgroundColor: colorFrom,
            opacity,
            transform: [
              { translateX: beamX },
              { translateY: beamY },
            ],
            marginLeft: size * 0.3,
            marginTop:  size * 0.3,
            shadowColor:   colorFrom,
            shadowOffset:  { width: 0, height: 0 },
            shadowOpacity: 1,
            shadowRadius:  size * 0.25,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  orb: { position: "absolute" },
});
