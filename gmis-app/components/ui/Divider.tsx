// ============================================================
// GMIS — Divider Component
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { View } from "react-native";
import { useThemeColors } from "@/context/ThemeContext";
import { spacing } from "@/theme/tokens";

interface DividerProps {
  direction?: "horizontal" | "vertical";
  spacing?:   number;
}

export function Divider({
  direction = "horizontal",
  spacing:  sp = spacing[4],
}: DividerProps) {
  const colors = useThemeColors();
  const isH    = direction === "horizontal";

  return (
    <View
      style={
        isH
          ? { height: 1,  width: "100%",    marginVertical:   sp, backgroundColor: colors.border.DEFAULT }
          : { width:  1,  alignSelf: "stretch", marginHorizontal: sp, backgroundColor: colors.border.DEFAULT }
      }
    />
  );
}