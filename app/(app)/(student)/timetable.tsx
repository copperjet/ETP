import React from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { useTheme } from '../../../lib/theme';
import { ThemedText, EmptyState } from '../../../components/ui';
import { Spacing } from '../../../constants/Typography';

export default function StudentTimetable() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <ThemedText variant="h4">My Timetable</ThemedText>
      </View>
      <EmptyState
        title="Timetable view"
        description="Your class timetable will appear here."
        icon="calendar-outline"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
  },
});
