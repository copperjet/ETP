import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';
import { ThemedText } from './ThemedText';
import { Spacing, Radius } from '../../constants/Typography';
import { Colors } from '../../constants/Colors';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'We could not load this data. Please try again.',
  onRetry,
  retryLabel = 'Try again',
}: ErrorStateProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.iconWrap, { backgroundColor: Colors.semantic.errorLight }]}>
        <Ionicons name="cloud-offline-outline" size={40} color={Colors.semantic.error} />
      </View>
      <ThemedText variant="h4" style={styles.title}>{title}</ThemedText>
      <ThemedText variant="body" color="muted" style={styles.description}>{description}</ThemedText>
      {onRetry && (
        <TouchableOpacity
          onPress={onRetry}
          style={[styles.retryBtn, { backgroundColor: colors.brand.primary }]}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh-outline" size={16} color="#fff" style={{ marginRight: Spacing.sm }} />
          <ThemedText variant="body" style={{ color: '#fff', fontWeight: '600' }}>{retryLabel}</ThemedText>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['2xl'],
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  description: {
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
  },
});
