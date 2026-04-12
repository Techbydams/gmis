// ============================================================
// GMIS — Select Modal
// Cross-platform dropdown replacement for React Native.
// Moved from app/(tenant)/components/ to components/ui/
// because Expo Router treats files inside app/ as routes.
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState } from "react";
import {
  View,
  Modal,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from "react-native";
import { Text } from "./Text";
import { Icon } from "./Icon";
import { useThemeColors } from "@/context/ThemeContext";
import { spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectModalProps {
  label?:       string;
  placeholder?: string;
  value:        string;
  options:      SelectOption[];
  onChange:     (value: string) => void;
  error?:       string;
  disabled?:    boolean;
  loading?:     boolean;
}

export function SelectModal({
  label,
  placeholder = "Select an option",
  value,
  options,
  onChange,
  error,
  disabled = false,
  loading  = false,
}: SelectModalProps) {
  const [open, setOpen] = useState(false);
  const colors = useThemeColors();

  const selected = options.find((o) => o.value === value);

  const borderColor = error
    ? colors.status.errorBorder
    : open
    ? "#2d6cff"
    : colors.border.DEFAULT;

  return (
    <View style={styles.container}>
      {label && (
        <Text variant="caption" color="secondary" weight="medium" style={styles.label}>
          {label}
        </Text>
      )}

      {/* Trigger button */}
      <TouchableOpacity
        onPress={() => !disabled && !loading && setOpen(true)}
        activeOpacity={0.75}
        style={[
          styles.trigger,
          {
            backgroundColor: colors.bg.input,
            borderColor,
            opacity: disabled || loading ? 0.6 : 1,
          },
        ]}
      >
        <Text
          style={{
            flex:     1,
            fontSize: fontSize.md,
            color:    selected ? colors.text.primary : colors.text.muted,
          }}
          numberOfLines={1}
        >
          {loading ? "Loading..." : selected?.label || placeholder}
        </Text>
        <Icon
          name={open ? "ui-up" : "ui-down"}
          size="sm"
          color={colors.text.muted}
        />
      </TouchableOpacity>

      {error && (
        <Text variant="caption" color="error" style={styles.error}>{error}</Text>
      )}

      {/* Bottom sheet modal */}
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        {/* Backdrop */}
        <TouchableOpacity
          style={[layout.absoluteFill, styles.backdrop]}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        />

        {/* Sheet */}
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.bg.elevated, borderColor: colors.border.DEFAULT },
          ]}
        >
          {/* Header */}
          <View style={[styles.sheetHeader, { borderBottomColor: colors.border.DEFAULT }]}>
            <Text variant="subtitle" color="primary">{label || "Select"}</Text>
            <TouchableOpacity onPress={() => setOpen(false)} activeOpacity={0.7}>
              <Icon name="ui-close" size="md" color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Options */}
          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            style={styles.list}
            renderItem={({ item }) => {
              const isSelected = item.value === value;
              return (
                <TouchableOpacity
                  onPress={() => { onChange(item.value); setOpen(false); }}
                  activeOpacity={0.75}
                  style={[
                    styles.option,
                    {
                      backgroundColor: isSelected ? colors.status.infoBg : "transparent",
                      borderBottomColor: colors.border.subtle,
                    },
                  ]}
                >
                  <Text
                    style={{
                      flex:       1,
                      fontSize:   fontSize.base,
                      color:      isSelected ? colors.status.info : colors.text.primary,
                      fontWeight: isSelected ? fontWeight.semibold : fontWeight.normal,
                    }}
                    numberOfLines={2}
                  >
                    {item.label}
                  </Text>
                  {isSelected && (
                    <Icon name="status-success" size="md" color={colors.status.info} filled />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[3],
  },
  label: {
    marginBottom: spacing[1],
  },
  trigger: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[3],
    borderRadius:      radius.lg,
    borderWidth:       1,
    minHeight:         spacing[12],
    gap:               spacing[2],
  },
  error: {
    marginTop: spacing[1],
  },
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.65)",
    zIndex:          10,
  },
  sheet: {
    position:             "absolute",
    bottom:               0,
    left:                 0,
    right:                0,
    zIndex:               20,
    borderTopLeftRadius:  radius["2xl"],
    borderTopRightRadius: radius["2xl"],
    borderWidth:          1,
    maxHeight:            "65%",
  },
  sheetHeader: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: spacing[5],
    paddingVertical:   spacing[4],
    borderBottomWidth: 1,
  },
  list: {
    paddingHorizontal: spacing[2],
    paddingVertical:   spacing[2],
  },
  option: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[3],
    borderBottomWidth: 0.5,
    borderRadius:      radius.md,
    marginBottom:      spacing[1],
    gap:               spacing[3],
  },
});
