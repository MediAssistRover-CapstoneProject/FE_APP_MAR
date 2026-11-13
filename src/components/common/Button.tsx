import React, { memo } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../../constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

export const Button: React.FC<ButtonProps> = memo(({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  style,
  textStyle,
  accessibilityLabel,
}) => {
  const isOutline = variant === 'outline';
  const isGhost = variant === 'ghost';
  const isSecondary = variant === 'secondary';
  const isDanger = variant === 'danger';

  const containerStyles = [
    styles.base,
    styles[size],
    isOutline && styles.outlineContainer,
    isGhost && styles.ghostContainer,
    isSecondary && styles.secondaryContainer,
    isDanger && styles.dangerContainer,
    disabled && styles.disabledContainer,
    style,
  ];

  const labelStyles = [
    styles.baseText,
    styles[`${size}Text`],
    isOutline && styles.outlineText,
    isGhost && styles.ghostText,
    isSecondary && styles.secondaryText,
    isDanger && styles.dangerText,
    disabled && styles.disabledText,
    textStyle,
  ];

  const spinnerColor = isOutline || isGhost
    ? Colors.primaryAction
    : isSecondary
    ? Colors.textPrimary
    : Colors.textInverse;

  return (
    <TouchableOpacity
      style={containerStyles}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : (
        <>
          {leftIcon && <>{leftIcon}</>}
          <Text style={labelStyles}>{title}</Text>
          {rightIcon && <>{rightIcon}</>}
        </>
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primaryAction,
    gap: Spacing.sm,
    minHeight: 52,
    ...Shadows.button,
  },
  sm: {
    minHeight: 40,
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  md: {
    minHeight: 52,
    paddingVertical: Spacing.sm + 4,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  lg: {
    minHeight: 56,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.card,
  },
  outlineContainer: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primaryAction,
    shadowOpacity: 0,
    elevation: 0,
  },
  ghostContainer: {
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  secondaryContainer: {
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  dangerContainer: {
    backgroundColor: Colors.danger,
    borderColor: Colors.danger,
  },
  disabledContainer: {
    opacity: 0.45,
    shadowOpacity: 0,
    elevation: 0,
  },
  baseText: {
    ...Typography.field,
    color: Colors.textInverse,
    fontWeight: '600',
    textAlign: 'center',
  },
  smText: {
    fontSize: 13,
    lineHeight: 18,
  },
  mdText: {
    fontSize: 15,
    lineHeight: 22,
  },
  lgText: {
    fontSize: 16,
    lineHeight: 24,
  },
  outlineText: {
    color: Colors.primaryAction,
  },
  ghostText: {
    color: Colors.primaryAction,
  },
  secondaryText: {
    color: Colors.textPrimary,
  },
  dangerText: {
    color: Colors.textInverse,
  },
  disabledText: {
    opacity: 0.8,
  },
});
