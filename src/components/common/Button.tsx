import React, { memo } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
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
}) => {
  const isOutline = variant === 'outline';
  const isGhost = variant === 'ghost';
  const isSecondary = variant === 'secondary';

  const containerStyles = [
    styles.base,
    styles[size],
    isOutline && styles.outlineContainer,
    isGhost && styles.ghostContainer,
    isSecondary && styles.secondaryContainer,
    disabled && styles.disabledContainer,
    style,
  ];

  const labelStyles = [
    styles.baseText,
    styles[`${size}Text`],
    isOutline && styles.outlineText,
    isGhost && styles.ghostText,
    isSecondary && styles.secondaryText,
    disabled && styles.disabledText,
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={containerStyles}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={isOutline || isGhost ? Colors.primary : Colors.textInverse}
        />
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
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    gap: Spacing.xs,
  },
  sm: {
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.sm,
  },
  md: {
    paddingVertical: Spacing.sm + 4,
    paddingHorizontal: Spacing.md,
  },
  lg: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  outlineContainer: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  ghostContainer: {
    backgroundColor: 'transparent',
  },
  secondaryContainer: {
    backgroundColor: Colors.primaryLight,
  },
  disabledContainer: {
    backgroundColor: Colors.surfaceSubtle,
    borderColor: Colors.border,
  },
  baseText: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.textInverse,
  },
  smText: {
    fontSize: 13,
  },
  mdText: {
    fontSize: 15,
  },
  lgText: {
    fontSize: 16,
  },
  outlineText: {
    color: Colors.primary,
  },
  ghostText: {
    color: Colors.primary,
  },
  secondaryText: {
    color: Colors.primaryDark,
  },
  disabledText: {
    color: Colors.textMuted,
  },
});
