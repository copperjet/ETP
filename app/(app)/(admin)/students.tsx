import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { useTheme } from '../../../lib/theme';
import { EmptyState } from '../../../components/ui';

export default function AdminStudents() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <EmptyState title="Students" description="Full student management coming soon." />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({ safe: { flex: 1 } });
