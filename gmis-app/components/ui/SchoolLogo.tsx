// ============================================================
// GMIS — School Logo Component
// Shows organization logo_url if available, falls back to initials.
// Used in: find-school, login banner, sidebar, drawer, anywhere
// school branding appears.
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState } from "react";
import { View, Image, StyleSheet } from "react-native";
import { Text } from "@/components/ui/Text";
import { brand, radius, fontWeight, fontSize } from "@/theme/tokens";

interface SchoolLogoProps {
  name:     string;          // school name or slug (for initials fallback)
  logoUrl?: string | null;   // from organizations.logo_url
  size?:    number;          // px — defaults to 40
  rounded?: "sm" | "md" | "lg" | "full";
}

export function SchoolLogo({
  name,
  logoUrl,
  size    = 40,
  rounded = "md",
}: SchoolLogoProps) {
  const [imgError, setImgError] = useState(false);
  const showImage = !!logoUrl && !imgError;

  const borderRadius = rounded === "full" ? size / 2
    : rounded === "lg" ? size * 0.3
    : rounded === "sm" ? size * 0.15
    : size * 0.22;   // "md"

  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");

  const initialsSize = size * 0.32;

  if (showImage) {
    return (
      <Image
        source={{ uri: logoUrl! }}
        style={[
          styles.base,
          { width: size, height: size, borderRadius },
        ]}
        resizeMode="contain"
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <View
      style={[
        styles.base,
        styles.fallback,
        { width: size, height: size, borderRadius },
      ]}
    >
      <Text
        style={{
          fontSize:   initialsSize,
          fontWeight: fontWeight.bold,
          color:      brand.blue,
          lineHeight: initialsSize * 1.2,
        }}
      >
        {initials || "?"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexShrink: 0,
    overflow:   "hidden",
  },
  fallback: {
    backgroundColor: brand.blueAlpha15,
    alignItems:      "center",
    justifyContent:  "center",
  },
});
