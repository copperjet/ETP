import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from './ThemedText';
import { Button } from './Button';
import { Spacing } from '../../constants/Typography';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon && <View style={styles.icon}>{icon}</View>}
      <ThemedText variant="h4" style={styles.title}>{title}</ThemedText>
      {description && (
        <ThemedText variant="body" color="muted" style={styles.description}>
          {description}
        </ThemedText>
      )}
      {actionLabel && onAction && (
        <Button label={actionLabel} onPress={onAction} style={styles.action} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing['4xl'],
  },
  icon: {
    marginBottom: Spacing.base,
    opacity: 0.4,
  },
  title: {
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  description: {
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  action: {
    alignSelf: 'center',
  },
});
