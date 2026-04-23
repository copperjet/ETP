import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme';
import { Radius, Shadow, Spacing } from '../../constants/Typography';

interface CardProps extends ViewProps {
  accentColor?: string;
  accentSide?: 'left' | 'top';
  noPadding?: boolean;
}

export function Card({ accentColor, accentSide = 'left', noPadding, style, children, ...props }: CardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        Shadow.sm,
        style,
      ]}
      {...props}
    >
      {accentColor && accentSide === 'left' && (
        <View style={[styles.accentLeft, { backgroundColor: accentColor }]} />
      )}
      {accentColor && accentSide === 'top' && (
        <View style={[styles.accentTop, { backgroundColor: accentColor }]} />
      )}
      <View style={noPadding ? undefined : styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  content: {
    padding: Spacing.base,
  },
  accentLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: Radius.lg,
    borderBottomLeftRadius: Radius.lg,
  },
  accentTop: {
    height: 4,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
  },
});
