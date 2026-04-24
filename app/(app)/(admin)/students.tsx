/**
 * Admin Students — full list with search, grade/stream filter, add + import.
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../lib/theme';
import { useAuthStore } from '../../../stores/authStore';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import {
  ThemedText, Avatar, SearchBar, FAB, Skeleton, EmptyState, ErrorState,
} from '../../../components/ui';
import { useAllStudents } from '../../../hooks/useStudents';
import { Spacing, Radius } from '../../../constants/Typography';
import { Colors } from '../../../constants/Colors';
import { haptics } from '../../../lib/haptics';

function useStreamsFilter(schoolId: string) {
  return useQuery({
    queryKey: ['streams-filter', schoolId],
    enabled: !!schoolId,
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const db = supabase as any;
      const { data } = await db
        .from('streams')
        .select('id, name, grades(id, name)')
        .eq('school_id', schoolId)
        .order('name');
      return (data ?? []) as any[];
    },
  });
}

export default function AdminStudentsScreen() {
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const schoolId = user?.schoolId ?? '';

  const [search, setSearch] = useState('');
  const [streamFilter, setStreamFilter] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const { data: students = [], isLoading, isError, refetch, isRefetching } = useAllStudents(schoolId, {
    streamId: streamFilter,
    activeOnly: !showInactive,
  });
  const { data: streams = [] } = useStreamsFilter(schoolId);

  const filtered = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.toLowerCase();
    return students.filter(
      (s) => s.full_name.toLowerCase().includes(q) || s.student_number.toLowerCase().includes(q),
    );
  }, [students, search]);

  if (isError) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <ErrorState title="Could not load students" description="Try again." onRetry={refetch} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <ThemedText variant="h4">Students</ThemedText>
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <TouchableOpacity
            onPress={() => router.push('/(app)/(admin)/student-import' as any)}
            style={[styles.headerBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
          >
            <Ionicons name="cloud-upload-outline" size={16} color={colors.brand.primary} />
            <ThemedText variant="caption" style={{ color: colors.brand.primary, fontWeight: '600', marginLeft: 4 }}>Import</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowInactive((v) => !v)}
            style={[styles.headerBtn, {
              backgroundColor: showInactive ? colors.brand.primary + '15' : colors.surfaceSecondary,
              borderColor: showInactive ? colors.brand.primary : colors.border,
            }]}
          >
            <ThemedText variant="caption" style={{ color: showInactive ? colors.brand.primary : colors.textMuted, fontWeight: '600' }}>
              {showInactive ? 'All' : 'Active'}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: Spacing.base, paddingTop: Spacing.sm }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search name or student number…" />
      </View>

      {/* Stream filter chips */}
      {streams.length > 0 && (
        <View style={styles.chipsScroll}>
          <TouchableOpacity
            onPress={() => setStreamFilter(null)}
            style={[styles.chip, { backgroundColor: !streamFilter ? colors.brand.primary + '15' : colors.surfaceSecondary, borderColor: !streamFilter ? colors.brand.primary : colors.border }]}
          >
            <ThemedText variant="caption" style={{ color: !streamFilter ? colors.brand.primary : colors.textMuted, fontWeight: !streamFilter ? '700' : '400', fontSize: 11 }}>
              All
            </ThemedText>
          </TouchableOpacity>
          {streams.map((s: any) => (
            <TouchableOpacity
              key={s.id}
              onPress={() => setStreamFilter(s.id === streamFilter ? null : s.id)}
              style={[styles.chip, {
                backgroundColor: streamFilter === s.id ? colors.brand.primary + '15' : colors.surfaceSecondary,
                borderColor: streamFilter === s.id ? colors.brand.primary : colors.border,
              }]}
            >
              <ThemedText variant="caption" style={{ color: streamFilter === s.id ? colors.brand.primary : colors.textMuted, fontWeight: streamFilter === s.id ? '700' : '400', fontSize: 11 }}>
                {s.grades?.name} {s.name}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Count */}
      {!isLoading && (
        <ThemedText variant="caption" color="muted" style={styles.countLabel}>
          {filtered.length} student{filtered.length !== 1 ? 's' : ''}
        </ThemedText>
      )}

      {isLoading ? (
        <View style={{ padding: Spacing.base, gap: Spacing.md }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <View key={i} style={styles.skeletonRow}>
              <Skeleton width={44} height={44} radius={22} />
              <View style={{ flex: 1, marginLeft: 12, gap: 6 }}>
                <Skeleton width="50%" height={14} />
                <Skeleton width="35%" height={11} />
              </View>
            </View>
          ))}
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={search ? 'No results' : 'No students'}
          description={search ? 'Try a different name or number.' : 'Tap + to add a student or use Import for bulk CSV.'}
          icon="people-outline"
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand.primary} />}
          renderItem={({ item: s }) => (
            <TouchableOpacity
              onPress={() => {
                haptics.selection();
                router.push({ pathname: '/(app)/student/[id]' as any, params: { id: s.id } });
              }}
              activeOpacity={0.8}
              style={[styles.studentRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Avatar name={s.full_name} photoUrl={s.photo_url} size={44} />
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <ThemedText variant="body" style={{ fontWeight: '600' }}>{s.full_name}</ThemedText>
                <ThemedText variant="caption" color="muted">
                  {s.student_number}{s.grade_name ? ` · ${s.grade_name} ${s.stream_name}` : ''}
                </ThemedText>
              </View>
              {!s.is_active && (
                <View style={[styles.inactiveBadge, { backgroundColor: colors.border }]}>
                  <ThemedText variant="caption" style={{ color: colors.textMuted, fontSize: 9, fontWeight: '700' }}>INACTIVE</ThemedText>
                </View>
              )}
              <TouchableOpacity
                onPress={() => {
                  haptics.selection();
                  router.push({ pathname: '/(app)/(admin)/student-edit' as any, params: { student_id: s.id } });
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ marginLeft: Spacing.sm }}
              >
                <Ionicons name="pencil-outline" size={16} color={colors.textMuted} />
              </TouchableOpacity>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          )}
        />
      )}

      <FAB
        icon={<Ionicons name="add" size={24} color="#fff" />}
        onPress={() => { haptics.medium(); router.push('/(app)/(admin)/student-add' as any); }}
      />
    </SafeAreaView>
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
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  chipsScroll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  countLabel: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xs },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  list: { paddingHorizontal: Spacing.base, paddingBottom: 100 },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  inactiveBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
});
