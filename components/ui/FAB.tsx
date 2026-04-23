import React from 'react';
import { TouchableOpacity, View, StyleSheet, ViewStyle } from 'react-native';
import { ThemedText } from './ThemedText';
import { useTheme } from '../../lib/theme';
import { Shadow, Radius, Spacing } from '../../constants/Typography';
import { haptics } from '../../lib/haptics';

interface FABProps {
  icon: React.ReactNode;
  label?: string;
  onPress: () => void;
  style?: ViewStyle;
  color?: string;
  disabled?: boolean;
}

export function FAB({ icon, label, onPress, style, color, disabled }: FABProps) {
  const { colors } = useTheme();
  const bg = color ?? colors.brand.primary;

  const handlePress = () => {
    if (disabled) return;
    haptics.medium();
    onPress();
  };

  return (
    <TouchableOpacity
      activeOpacity={disabled ? 1 : 0.85}
      onPress={handlePress}
      disabled={disabled}
      style={[
        styles.fab,
        { backgroundColor: bg, opacity: disabled ? 0.55 : 1 },
        Shadow.lg,
        label ? styles.extended : styles.round,
        style,
      ]}
    >
      {icon}
      {label && (
        <ThemedText
          variant="body"
          style={{ color: '#fff', fontWeight: '600', marginLeft: Spacing.sm }}
        >
          {label}
        </ThemedText>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: Spacing['2xl'],
    right: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  round: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  extended: {
    height: 52,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
  },
});
