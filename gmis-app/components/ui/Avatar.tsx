// ============================================================
// GMIS — Avatar Component
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { View, Image, StyleSheet } from "react-native";
import { Text }  from "./Text";
import { roles, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
type AvatarRole = "student" | "lecturer" | "admin" | "parent";

interface AvatarProps {
  name:  string;
  src?:  string | null;
  size?: AvatarSize;
  role?: AvatarRole;
}

// All sizes are explicit layout constants — see sizes token
const dimMap: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
};

// Font sizes from token scale
const fontSizeMap: Record<AvatarSize, number> = {
  xs: fontSize["2xs"],  // 10
  sm: fontSize.xs,      // 11
  md: fontSize.base,    // 13
  lg: fontSize.xl,      // 18
  xl: fontSize["3xl"],  // 24
};

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => (w[0] ?? "").toUpperCase())
    .join("");
}

export function Avatar({ name, src, size = "md", role = "student" }: AvatarProps) {
  const dim      = dimMap[size];
  const bgColor  = roles[role];
  const initials = getInitials(name);

  if (src) {
    return (
      <Image
        source={{ uri: src }}
        style={{ width: dim, height: dim, borderRadius: dim / 2, overflow: "hidden" }}
      />
    );
  }

  return (
    <View
      style={[
        styles.base,
        layout.centred,
        {
          width:           dim,
          height:          dim,
          borderRadius:    dim / 2,
          backgroundColor: bgColor,
        },
      ]}
    >
      <Text
        style={{
          fontSize:   fontSizeMap[size],
          fontWeight: fontWeight.black,
          color:      "#ffffff",
        }}
      >
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexShrink: 0,
    overflow:   "hidden",
  },
});