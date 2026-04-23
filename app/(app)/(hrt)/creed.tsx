/**
 * CREED Entry — /(app)/(hrt)/creed
 * HRT enters character ratings (Creativity, Respect, Excellence, Empathy, Discipline)
 * per student for the current semester. Rating: E / G / S / NI (Excellent/Good/Satisfactory/NeedsImprovement)
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../../lib/theme';
import { useAuthStore } from '../../../stores/authStore';
import { supabase } from '../../../lib/supabase';
import {
  ThemedText, Avatar, BottomSheet, FAB,
  Skeleton, EmptyState, ErrorState,
} from '../../../components/ui';
import { Spacing, Radius } from '../../../constants/Typography';
import { Colors } from '../../../constants/Colors';
import { haptics } from '../../../lib/haptics';

const TRAITS = [
  { key: 'creativity', label: 'Creativity' },
  { key: 'respect', label: 'Respect' },
  { key: 'excellence', label: 'Excellence' },
  { key: 'empathy', label: 'Empathy' },
  { key: 'discipline', label: 'Discipline' },
] as const;

type TraitKey = typeof TRAITS[number]['key'];

const RATINGS = [
  { value: 'E', label: 'Excellent', color: Colors.semantic.success },
  { value: 'G', label: 'Good', color: Colors.semantic.info },
  { value: 'S', label: 'Satisfactory', color: Colors.semantic.warning },
  { value: 'NI', label: 'Needs Improvement', color: Colors.semantic.error },
] as const;

type RatingValue = typeof RATINGS[number]['value'];

function useCREEDData(staffId: string | null, schoolId: string) {
  return useQuery({
    queryKey: ['creed-register', staffId, schoolId],
    enabled: !!staffId && !!schoolId,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data: assignment } = await supabase
        .from('hrt_assignments')
        .select('stream_id, semester_id')
        .eq('staff_id', staffId!)
        .eq('school_id', schoolId)
        .limit(1)
        .single();
      if (!assignment) return { students: [], streamId: null, semesterId: null };
      const { stream_id, semester_id } = assignment as any;

      const [studentsRes, creedRes] = await Promise.all([
        supabase.from('students').select('id, full_name, student_number, photo_url')
          .eq('school_id', schoolId).eq('stream_id', stream_id)
          .eq('status', 'active').order('full_name'),
        supabase.from('character_records').select('student_id, creativity, respect, excellence, empathy, discipline, is_locked')
          .eq('school_id', schoolId).eq('semester_id', semester_id),
      ]);

      const creedMap: Record<string, any> = {};
      (creedRes.data ?? []).forEach((r: any) => { creedMap[r.student_id] = r; });

      return {
        students: (studentsRes.data ?? []) as any[],
        creedMap,
        streamId: stream_id,
        semesterId: semester_id,
      };
    },
  });
}

export default function CREEDScreen() {
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [selectedTrait, setSelectedTrait] = useState<TraitKey>('creativity');
  const [localRatings, setLocalRatings] = useState<Record<string, Record<TraitKey, RatingValue>>>({});

  const { data, isLoading, isError, refetch } = useCREEDData(user?.staffId ?? null, user?.schoolId ?? '');

  const saveMutation = useMutation({
    mutationFn: async ({ studentId, ratings }: { studentId: string; ratings: Record<string, string> }) => {
      await supabase.from('character_records').upsert({
        school_id: user?.schoolId,
        student_id: studentId,
        semester_id: data?.semesterId,
        entered_by: user?.staffId,
        ...ratings,
      } as any, { onConflict: 'student_id,semester_id' });
    },
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['creed-register'] });
    },
    onError: () => haptics.error(),
  });

  const getRating = useCallback((studentId: string, trait: TraitKey): RatingValue | null => {
    return localRatings[studentId]?.[trait] ?? (data?.creedMap?.[studentId]?.[trait] ?? null);
  }, [localRatings, data?.creedMap]);

  const setRating = useCallback((studentId: string, trait: TraitKey, value: RatingValue) => {
    haptics.selection();
    setLocalRatings(prev => ({
      ...prev,
      [studentId]: { ...(prev[studentId] ?? {}), [trait]: value },
    }));
  }, []);

  const saveStudent = useCallback((studentId: string) => {
    const existing = data?.creedMap?.[studentId] ?? {};
    const local = localRatings[studentId] ?? {};
    const merged = { ...existing, ...local };
    const ratings: Record<string, string> = {};
    TRAITS.forEach(t => { if (merged[t.key]) ratings[t.key] = merged[t.key]; });
    saveMutation.mutate({ studentId, ratings });
    setSheetVisible(false);
  }, [localRatings, data?.creedMap, saveMutation]);

  const completedCount = useMemo(() => {
    return (data?.students ?? []).filter((s: any) => {
      const local = localRatings[s.id] ?? {};
      const saved = data?.creedMap?.[s.id] ?? {};
      const merged = { ...saved, ...local };
      return TRAITS.every(t => !!merged[t.key]);
    }).length;
  }, [data?.students, data?.creedMap, localRatings]);

  if (isError) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <ErrorState title="Could not load CREED data" description="Try again." onRetry={refetch} />
      </SafeAreaView>
    );
  }

  const students = data?.students ?? [];
  const total = students.length;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <ThemedText variant="h4">CREED Ratings</ThemedText>
          <ThemedText variant="caption" color="muted">{completedCount} / {total} complete</ThemedText>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {isLoading ? (
        <View style={{ padding: Spacing.base, gap: Spacing.md }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
              <Skeleton width={42} height={42} radius={21} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width="55%" height={14} />
                <Skeleton width="80%" height={10} />
              </View>
            </View>
          ))}
        </View>
      ) : total === 0 ? (
        <EmptyState title="No students" description="No active students in your class." />
      ) : (
        <FlatList
          data={students}
          keyExtractor={s => s.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: student }) => {
            const isComplete = TRAITS.every(t => !!getRating(student.id, t.key));
            return (
              <TouchableOpacity
                onPress={() => { setSelectedStudent(student); setSheetVisible(true); }}
                activeOpacity={0.8}
                style={[styles.studentRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Avatar name={student.full_name} photoUrl={student.photo_url} size={42} />
                <View style={styles.studentInfo}>
                  <ThemedText variant="body" style={{ fontWeight: '600' }}>{student.full_name}</ThemedText>
                  <View style={styles.traitDots}>
                    {TRAITS.map(t => {
                      const rating = getRating(student.id, t.key);
                      const ratingColor = rating ? RATINGS.find(r => r.value === rating)?.color : colors.border;
                      return (
                        <View
                          key={t.key}
                          style={[styles.traitDot, { backgroundColor: ratingColor ?? colors.border }]}
                        />
                      );
                    })}
                    <ThemedText variant="caption" color="muted" style={{ marginLeft: 4 }}>
                      {TRAITS.filter(t => !!getRating(student.id, t.key)).length}/5
                    </ThemedText>
                  </View>
                </View>
                {isComplete ? (
                  <Ionicons name="checkmark-circle" size={22} color={Colors.semantic.success} />
                ) : (
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* CREED entry sheet */}
      <BottomSheet
        visible={sheetVisible && !!selectedStudent}
        onClose={() => setSheetVisible(false)}
        title={selectedStudent?.full_name ?? ''}
        snapHeight={520}
      >
        <View style={{ gap: Spacing.md }}>
          {TRAITS.map(trait => (
            <View key={trait.key}>
              <ThemedText variant="label" color="muted" style={styles.traitLabel}>{trait.label.toUpperCase()}</ThemedText>
              <View style={styles.ratingRow}>
                {RATINGS.map(r => {
                  const isSelected = getRating(selectedStudent?.id ?? '', trait.key) === r.value;
                  return (
                    <TouchableOpacity
                      key={r.value}
                      onPress={() => setRating(selectedStudent!.id, trait.key, r.value)}
                      style={[
                        styles.ratingBtn,
                        { borderColor: isSelected ? r.color : colors.border, backgroundColor: isSelected ? r.color + '20' : colors.surfaceSecondary },
                      ]}
                    >
                      <ThemedText variant="label" style={{ color: isSelected ? r.color : colors.textMuted, fontSize: 11, fontWeight: isSelected ? '700' : '500' }}>
                        {r.value}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}

          <TouchableOpacity
            onPress={() => saveStudent(selectedStudent!.id)}
            style={[styles.saveBtn, { backgroundColor: colors.brand.primary }]}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark" size={18} color="#fff" />
            <ThemedText variant="bodyLg" style={{ color: '#fff', fontWeight: '700', marginLeft: 8 }}>Save Ratings</ThemedText>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCenter: { flex: 1, alignItems: 'center', gap: 2 },
  list: { paddingHorizontal: Spacing.base, paddingTop: Spacing.sm, paddingBottom: 40 },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
  studentInfo: { flex: 1, gap: 6 },
  traitDots: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  traitDot: { width: 8, height: 8, borderRadius: 4 },
  traitLabel: { marginBottom: 6, letterSpacing: 0.5, fontSize: 11 },
  ratingRow: { flexDirection: 'row', gap: Spacing.sm },
  ratingBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 1.5,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    marginTop: Spacing.sm,
  },
});
