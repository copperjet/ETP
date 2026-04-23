import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { ThemedText } from './ThemedText';
import { Colors, resolveAttBg, resolveAttColor } from '../../constants/Colors';
import { useTheme } from '../../lib/theme';
import type { AttendanceStatus } from '../../types/database';

type Preset = AttendanceStatus | 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface BadgeProps {
  label: string;
  preset?: Preset;
  bg?: string;
  fg?: string;
  style?: ViewStyle;
}

const SEMANTIC_PRESETS: Record<string, { bg: string; fg: string }> = {
  success: { bg: Colors.semantic.successLight, fg: Colors.semantic.success },
  warning: { bg: Colors.semantic.warningLight, fg: Colors.semantic.warning },
  error: { bg: Colors.semantic.errorLight, fg: Colors.semantic.error },
  info: { bg: Colors.semantic.infoLight, fg: Colors.semantic.info },
  neutral: { bg: '#F3F4F6', fg: '#6B7280' },
};

const ATT_PRESETS: AttendanceStatus[] = ['present', 'absent', 'late', 'ap', 'sick'];

export function Badge({ label, preset = 'neutral', bg, fg, style }: BadgeProps) {
  const { scheme } = useTheme();
  const isAtt = ATT_PRESETS.includes(preset as AttendanceStatus);
  const colors = isAtt
    ? { bg: resolveAttBg(preset as AttendanceStatus, scheme), fg: resolveAttColor(preset as AttendanceStatus) }
    : SEMANTIC_PRESETS[preset] ?? SEMANTIC_PRESETS.neutral;
  const finalBg = bg ?? colors.bg;
  const finalFg = fg ?? colors.fg;

  return (
    <View style={[styles.badge, { backgroundColor: finalBg }, style]}>
      <ThemedText variant="label" style={{ color: finalFg, fontSize: 10 }}>
        {label.toUpperCase()}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
});
