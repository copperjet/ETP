import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useTheme } from '../../../lib/theme';
import { useAuthStore } from '../../../stores/authStore';
import { supabase } from '../../../lib/supabase';
import {
  ThemedText, Card, Avatar, Badge, ProgressBar,
  Skeleton, SkeletonRow, EmptyState, ErrorState,
} from '../../../components/ui';
import { Spacing, Radius } from '../../../constants/Typography';
import { Colors } from '../../../constants/Colors';

const TODAY = format(new Date(), 'EEEE, d MMMM');

function useSTDashboard(staffId: string | null, schoolId: string) {
  return useQuery({
    queryKey: ['st-dashboard', staffId, schoolId],
    enabled: !!staffId && !!schoolId,
    staleTime: 1000 * 60 * 3,
    queryFn: async () => {
      const { data: assignments, error } = await supabase
        .from('subject_teacher_assignments')
        .select(`
          id, subject_id, stream_id, semester_id,
          subjects ( name, department ),
          streams ( name, grades ( name, school_sections ( section_type ) ) ),
          semesters ( name, is_active )
        `)
        .eq('staff_id', staffId!)
        .eq('school_id', schoolId);
      if (error) throw error;

      const activeAssignments = (assignments ?? []).filter((a: any) => a.semesters?.is_active);

      const marksProgress = await Promise.all(
        activeAssignments.map(async (a: any) => {
          const sectionType = a.streams?.grades?.school_sections?.section_type ?? 'primary';
          const assessmentTypeCount = sectionType === 'igcse' ? 1 : 3;
          const [studentsRes, marksRes] = await Promise.all([
            supabase.from('students').select('id', { count: 'exact', head: true })
              .eq('school_id', schoolId).eq('stream_id', a.stream_id).eq('status', 'active'),
            supabase.from('marks').select('id', { count: 'exact', head: true })
              .eq('school_id', schoolId).eq('subject_id', a.subject_id)
              .eq('stream_id', a.stream_id).eq('semester_id', a.semester_id),
          ]);
          const studentCount = studentsRes.count ?? 0;
          const markedCount = marksRes.count ?? 0;
          const expected = studentCount * assessmentTypeCount;
          return { ...a, studentCount, markedCount, expected };
        })
      );

      return marksProgress as any[];
    },
  });
}

export default function STHome() {
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const { data, isLoading, isError, refetch, isFetching } = useSTDashboard(user?.staffId ?? null, user?.schoolId ?? '');

  if (isError) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <ErrorState title="Could not load dashboard" description="Check your connection and try again." onRetry={refetch} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} />}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <ThemedText variant="h3">Good morning 👋</ThemedText>
            <ThemedText variant="bodySm" color="muted">{TODAY}</ThemedText>
          </View>
          <Avatar name={user?.fullName ?? 'T'} size={42} />
        </View>

        {/* Assignment cards */}
        <ThemedText variant="label" color="muted" style={styles.sectionLabel}>MY SUBJECTS</ThemedText>

        {isLoading ? (
          <View style={{ paddingHorizontal: Spacing.base, gap: Spacing.base }}>
            {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}
          </View>
        ) : !data?.length ? (
          <EmptyState
            title="No assignments yet"
            description="You have no subject assignments for the current semester."
          />
        ) : (
          <View style={{ paddingHorizontal: Spacing.base, gap: Spacing.base }}>
            {data.map((a: any) => {
              const pct = a.expected > 0 ? Math.round((a.markedCount / a.expected) * 100) : 0;
              return (
                <TouchableOpacity
                  key={a.id}
                  activeOpacity={0.8}
                  onPress={() => router.push({ pathname: '/(app)/(st)/marks' as any })}
                  style={[styles.assignCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.cardTop}>
                    <View style={[styles.subjectIcon, { backgroundColor: colors.brand.primary + '18' }]}>
                      <Ionicons name="book-outline" size={20} color={colors.brand.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText variant="body" style={{ fontWeight: '700' }}>{a.subjects?.name ?? '—'}</ThemedText>
                      <ThemedText variant="caption" color="muted">
                        {a.streams?.grades?.name ?? ''} · {a.streams?.name ?? ''}
                      </ThemedText>
                    </View>
                    <ThemedText variant="bodySm" style={{ color: pct === 100 ? Colors.semantic.success : colors.brand.primary, fontWeight: '700' }}>
                      {pct}%
                    </ThemedText>
                  </View>
                  <ProgressBar
                    value={a.markedCount}
                    max={a.expected || 1}
                    color={pct === 100 ? Colors.semantic.success : colors.brand.primary}
                    style={{ marginTop: Spacing.sm }}
                  />
                  <ThemedText variant="caption" color="muted" style={{ marginTop: 4 }}>
                    {a.markedCount} / {a.expected} marks entered · {a.studentCount} students
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.base,
  },
  sectionLabel: {
    paddingHorizontal: Spacing.base,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    letterSpacing: 0.6,
    fontSize: 11,
  },
  assignCard: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.base,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  subjectIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
