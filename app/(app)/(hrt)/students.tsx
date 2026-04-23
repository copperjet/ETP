import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../../../lib/theme';
import { useAuthStore } from '../../../stores/authStore';
import { supabase } from '../../../lib/supabase';
import { ThemedText, SearchBar, Avatar, Skeleton, EmptyState, ErrorState } from '../../../components/ui';
import { Spacing, Radius } from '../../../constants/Typography';

function useStudents(schoolId: string, streamId?: string) {
  return useQuery({
    queryKey: ['students', schoolId, streamId],
    enabled: !!schoolId,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      let q = supabase
        .from('students')
        .select('id, full_name, student_number, photo_url, status, streams(name, grades(name))')
        .eq('school_id', schoolId)
        .eq('status', 'active')
        .order('full_name');
      if (streamId) q = q.eq('stream_id', streamId);
      const { data } = await q;
      return (data ?? []) as any[];
    },
  });
}

export default function StudentsScreen() {
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const { data: students, isLoading, isError, refetch } = useStudents(user?.schoolId ?? '');  

  const filtered = (students ?? []).filter((s: any) =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.student_number.toLowerCase().includes(search.toLowerCase())
  );

  if (isError) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <ErrorState title="Could not load students" description="Check your connection and try again." onRetry={refetch} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <ThemedText variant="h4">Students</ThemedText>
        <TouchableOpacity style={[styles.filterBtn, { backgroundColor: colors.surfaceSecondary }]}>
          <Ionicons name="filter-outline" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or ID…"
        />
      </View>

      {isLoading ? (
        <View style={styles.skeletonList}>
          {Array.from({ length: 8 }).map((_, i) => (
            <View key={i} style={styles.skeletonRow}>
              <Skeleton width={46} height={46} radius={23} />
              <View style={{ flex: 1, gap: 6, marginLeft: Spacing.md }}>
                <Skeleton width="55%" height={14} />
                <Skeleton width="30%" height={11} />
              </View>
              <Skeleton width={50} height={22} radius={11} />
            </View>
          ))}
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={search ? 'No students found' : 'No students yet'}
          description={search ? `No results for "${search}"` : 'Students will appear here once enrolled.'}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <StudentRow student={item} colors={colors} onPress={() => router.push({ pathname: '/(app)/student/[id]' as any, params: { id: item.id } })} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function StudentRow({ student, colors, onPress }: { student: any; colors: any; onPress: () => void }) {
  const gradeName = student.streams?.grades?.name ?? '';
  const streamName = student.streams?.name ?? '';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.studentRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Avatar name={student.full_name} photoUrl={student.photo_url} size={46} />
      <View style={styles.studentInfo}>
        <ThemedText variant="body" style={{ fontWeight: '600' }}>{student.full_name}</ThemedText>
        <ThemedText variant="caption" color="muted">
          {student.student_number}{gradeName ? `  ·  ${gradeName}` : ''}{streamName ? ` ${streamName}` : ''}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  searchWrap: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.md },
  skeletonList: { padding: Spacing.base, gap: Spacing.md },
  skeletonRow: { flexDirection: 'row', alignItems: 'center' },
  list: { paddingHorizontal: Spacing.base, paddingBottom: 24 },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
  studentInfo: { flex: 1, gap: 3 },
});
