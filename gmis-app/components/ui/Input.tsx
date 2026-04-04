// ============================================================
// GMIS — Input Component
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState } from "react";
import {
  View,
  TextInput,
  type TextInputProps,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Text } from "./Text";
import { Icon, type IconName } from "./Icon";
import { useThemeColors } from "@/context/ThemeContext";
import { brand, radius, spacing, fontSize } from "@/theme/tokens";
import { layout } from "@/styles/shared";

interface InputProps extends TextInputProps {
  label?:         string;
  error?:         string;
  hint?:          string;
  iconLeft?:      IconName;
  iconRight?:     IconName;
  onPressRight?:  () => void;
  containerStyle?: any;
}

export function Input({
  label,
  error,
  hint,
  iconLeft,
  iconRight,
  onPressRight,
  containerStyle,
  style,
  ...props
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const colors = useThemeColors();

  const borderColor = error
    ? colors.status.errorBorder
    : focused
    ? brand.blue
    : colors.border.DEFAULT;

  const borderWidth = focused && !error ? 1.5 : 1;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text
          variant="caption"
          color="secondary"
          weight="medium"
          style={styles.label}
        >
          {label}
        </Text>
      )}

      <View
        style={[
          styles.inputRow,
          layout.row,
          {
            backgroundColor: colors.bg.input,
            borderColor,
            borderWidth,
          },
        ]}
      >
        {iconLeft && (
          <View style={styles.iconLeft}>
            <Icon
              name={iconLeft}
              size="sm"
              color={focused ? brand.blue : colors.text.muted}
            />
          </View>
        )}

        <TextInput
          style={[
            styles.input,
            layout.fill,
            {
              color:        colors.text.primary,
              fontSize:     fontSize.md,
              paddingLeft:  iconLeft  ? spacing[1] : spacing[4],
              paddingRight: iconRight ? spacing[1] : spacing[4],
            },
            style,
          ]}
          placeholderTextColor={colors.text.muted}
          onFocus={() => setFocused(true)}
          onBlur={() =>  setFocused(false)}
          {...props}
        />

        {iconRight && (
          <TouchableOpacity
            onPress={onPressRight}
            disabled={!onPressRight}
            style={styles.iconRight}
          >
            <Icon name={iconRight} size="sm" color={colors.text.muted} />
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <Text variant="caption" color="error" style={styles.hint}>{error}</Text>
      ) : hint ? (
        <Text variant="caption" color="muted"  style={styles.hint}>{hint}</Text>
      ) : null}
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
  inputRow: {
    borderRadius: radius.lg,
    overflow:     "hidden",
    minHeight:    spacing[12],   // 48px
  },
  input: {
    paddingVertical: spacing[3],
  },
  iconLeft: {
    paddingLeft:  spacing[3],
    paddingRight: spacing[1],
  },
  iconRight: {
    paddingLeft:  spacing[1],
    paddingRight: spacing[3],
  },
  hint: {
    marginTop: spacing[1],
  },
});