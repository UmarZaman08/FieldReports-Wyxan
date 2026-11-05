import React from 'react';
import type { SvgProps } from 'react-native-svg';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import { theme } from '../../constants/theme';

interface ButtonProps {
  label: string;
  icon?: React.ComponentType<SvgProps>;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function Button({
  icon: Icon,
  label,
  onPress,
  secondary = false,
  disabled = false,
  loading = false,
  style,
  accessibilityLabel,
}: ButtonProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary ? styles.secondary : styles.primary,
        (pressed || disabled || loading) && styles.dimmed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={secondary ? theme.colors.primary : theme.colors.white}
        />
      ) : (
        <>
          {Icon ? (
            <Icon
              width={20}
              height={20}
              stroke={secondary ? theme.colors.primary : theme.colors.white}
              color={secondary ? theme.colors.primary : theme.colors.white}
              accessible={false}
            />
          ) : null}
          <Text style={[styles.label, secondary && styles.secondaryLabel]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    gap: 8,
    minHeight: 52,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.lg,
  },
  primary: { backgroundColor: theme.colors.primary },
  secondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  label: { color: theme.colors.white, fontSize: 16, fontWeight: '700' },
  secondaryLabel: { color: theme.colors.primary },
  dimmed: { opacity: 0.62 },
});
