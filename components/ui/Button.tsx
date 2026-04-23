import React from 'react';
import {
  TouchableOpacity,
  View,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacityProps,
} from 'react-native';
import { ThemedText } from './ThemedText';
import { useTheme } from '../../lib/theme';
import { Radius, Spacing, Typography } from '../../constants/Typography';
import { haptics } from '../../lib/haptics';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends TouchableOpacityProps {
  variant?: Variant;
  size?: Size;
  label: string;
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  label,
  loading,
  iconLeft,
  iconRight,
  fullWidth,
  style,
  onPress,
  ...props
}: ButtonProps) {
  const { colors } = useTheme();

  const sizeMap = {
    sm: { height: 36, px: Spacing.md, textVariant: 'bodySm' as const },
    md: { height: 44, px: Spacing.base, textVariant: 'body' as const },
    lg: { height: 52, px: Spacing.lg, textVariant: 'bodyLg' as const },
  };

  const s = sizeMap[size];

  const bgMap: Record<Variant, string> = {
    primary: colors.brand.primary,
    secondary: colors.surfaceSecondary,
    ghost: 'transparent',
    danger: '#EF4444',
  };

  const textColorMap: Record<Variant, 'inverse' | 'primary' | 'error'> = {
    primary: 'inverse',
    secondary: 'primary',
    ghost: 'primary',
    danger: 'inverse',
  };

  const handlePress = (e: any) => {
    haptics.light();
    onPress?.(e);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={handlePress}
      style={[
        styles.base,
        {
          height: s.height,
          paddingHorizontal: s.px,
          backgroundColor: bgMap[variant],
          borderRadius: Radius.md,
          borderWidth: variant === 'secondary' ? StyleSheet.hairlineWidth : 0,
          borderColor: colors.border,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: props.disabled ? 0.4 : 1,
        },
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#fff' : colors.textPrimary} size="small" />
      ) : (
        <>
          {iconLeft && <View style={styles.iconLeft}>{iconLeft}</View>}
          <ThemedText
            variant={s.textVariant}
            color={textColorMap[variant]}
            style={{ fontWeight: '600' }}
          >
            {label}
          </ThemedText>
          {iconRight && <View style={styles.iconRight}>{iconRight}</View>}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLeft: { marginRight: Spacing.sm },
  iconRight: { marginLeft: Spacing.sm },
});
