import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme';
import { Typography } from '../../constants/Typography';

type Variant = keyof typeof Typography;
type ColorKey = 'primary' | 'secondary' | 'muted' | 'inverse' | 'brand' | 'success' | 'error' | 'warning';

interface ThemedTextProps extends TextProps {
  variant?: Variant;
  color?: ColorKey;
}

export function ThemedText({ variant = 'body', color = 'primary', style, ...props }: ThemedTextProps) {
  const { colors } = useTheme();

  const colorMap: Record<ColorKey, string> = {
    primary: colors.textPrimary,
    secondary: colors.textSecondary,
    muted: colors.textMuted,
    inverse: colors.textInverse,
    brand: colors.brand.primary,
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
  };

  return (
    <Text
      style={[Typography[variant], { color: colorMap[color] }, style]}
      {...props}
    />
  );
}
