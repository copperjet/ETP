/**
 * Subject Teacher — Marks Entry
 * Picks from ST's subject_teacher_assignments → enters FA1/FA2/Summative per student
 * Marks entry window is enforced: read-only outside window
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../../lib/theme';
import { useAuthStore } from '../../../stores/authStore';
import { supabase } from '../../../lib/supabase';
import {
  ThemedText, BottomSheet, Avatar, Skeleton, SkeletonRow,
  EmptyState, ErrorState, ProgressBar,
} from '../../../components/ui';
import { Spacing, Radius, Typography } from '../../../constants/Typography';
import { Colors } from '../../../constants/Colors';
import { haptics } from '../../../lib/haptics';

const ASSESSMENT_TYPES = ['fa1', 'fa2', 'summative'] as const;
const TYPE_LABELS: Record<string, string> = { fa1: 'FA 1', fa2: 'FA 2', summative: 'Summative' };

function useSTAssignments(staffId: string | null, schoolId: string) {
  return useQuery({
    queryKey: ['st-assignments', staffId, schoolId],
    enabled: !!staffId && !!schoolId,
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subject_teacher_assignments')
        .select(`
          id, subject_id, stream_id, semester_id,
          subjects ( name ),
          streams ( name, grades ( name ) ),
          semesters ( name, is_active, marks_window_open )
        `)
        .eq('staff_id', staffId!)
        .eq('school_id', schoolId);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

function useMarksData(assignment: any | null, schoolId: string) {
  return useQuery({
    queryKey: ['st-marks-entry', assignment?.subject_id, assignment?.stream_id, assignment?.semester_id],
    enabled: !!assignment && !!schoolId,
    staleTime: 1000 * 30,
    queryFn: async () => {
      const [studentsRes, marksRes] = await Promise.all([
        supabase.from('students').select('id, full_name, student_number, photo_url')
          .eq('school_id', schoolId).eq('stream_id', assignment.stream_id)
          .eq('status', 'active').order('full_name'),
        supabase.from('marks').select('id, student_id, assessment_type, value, is_na')
          .eq('school_id', schoolId).eq('subject_id', assignment.subject_id)
          .eq('stream_id', assignment.stream_id).eq('semester_id', assignment.semester_id),
      ]);
      const students = (studentsRes.data ?? []) as any[];
      const marksMap: Record<string, Record<string, any>> = {};
      (marksRes.data ?? []).forEach((m: any) => {
        if (!marksMap[m.student_id]) marksMap[m.student_id] = {};
        marksMap[m.student_id][m.assessment_type] = m;
      });
      const classAvg: Record<string, number> = {};
      ASSESSMENT_TYPES.forEach(t => {
        const vals = (marksRes.data ?? []).filter((m: any) => m.assessment_type === t && m.value != null).map((m: any) => m.value);
        if (vals.length) classAvg[t] = Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length * 10) / 10;
      });
      return { students, marksMap, classAvg };
    },
  });
}

export default function STMarksScreen() {
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const schoolId = user?.schoolId ?? '';

  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);
  const [selectedType, setSelectedType] = useState<string>('fa1');
  const [assignSheetVisible, setAssignSheetVisible] = useState(false);
  const [localEdits, setLocalEdits] = useState<Record<string, Record<string, string>>>({});
  const inputRefs = useRef<Record<string, TextInput | null>>({});

  const { data: assignments, isLoading: assignLoading, isError: assignError, refetch: refetchAssign } = useSTAssignments(user?.staffId ?? null, schoolId);
  const { data: marksData, isLoading: marksLoading, isError: marksError, refetch: refetchMarks } = useMarksData(selectedAssignment, schoolId);

  const saveMark = useMutation({
    mutationFn: async ({ studentId, type, value }: { studentId: string; type: string; value: string }) => {
      const num = parseFloat(value);
      if (isNaN(num) || num < 0 || num > 100) throw new Error('Invalid value');
      await supabase.from('marks').upsert({
        school_id: schoolId,
        student_id: studentId,
        subject_id: selectedAssignment.subject_id,
        stream_id: selectedAssignment.stream_id,
        semester_id: selectedAssignment.semester_id,
        assessment_type: type,
        value: num,
        is_na: false,
        entered_by: user?.staffId,
      } as any, { onConflict: 'student_id,subject_id,stream_id,semester_id,assessment_type' });
    },
    onSuccess: () => {
      haptics.selection();
      queryClient.invalidateQueries({ queryKey: ['st-marks-entry'] });
      queryClient.invalidateQueries({ queryKey: ['st-dashboard'] });
    },
    onError: () => haptics.error(),
  });

  const handleBlur = useCallback((studentId: string) => {
    const val = localEdits[studentId]?.[selectedType];
    if (val !== undefined) {
      saveMark.mutate({ studentId, type: selectedType, value: val });
    }
  }, [localEdits, selectedType, saveMark]);

  const isWindowOpen = selectedAssignment?.semesters?.marks_window_open ?? true;
  const students = marksData?.students ?? [];
  const marksMap = marksData?.marksMap ?? {};
  const classAvg = marksData?.classAvg ?? {};
  const enteredCount = students.filter(s => marksMap[s.id]?.[selectedType]).length;

  if (assignError) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <ErrorState title="Could not load assignments" description="Try again." onRetry={refetchAssign} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <ThemedText variant="h4">Marks Entry</ThemedText>
          <TouchableOpacity
            onPress={() => setAssignSheetVisible(true)}
            style={[styles.assignBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
          >
            <Ionicons name="swap-horizontal-outline" size={16} color={colors.brand.primary} />
            <ThemedText variant="bodySm" style={{ color: colors.brand.primary, fontWeight: '600', maxWidth: 160 }} numberOfLines={1}>
              {selectedAssignment
                ? `${selectedAssignment.subjects?.name ?? '—'} · ${selectedAssignment.streams?.name ?? '—'}`
                : 'Select subject…'}
            </ThemedText>
            <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {!selectedAssignment ? (
          assignLoading ? (
            <View style={{ padding: Spacing.base, gap: Spacing.base }}>
              {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}
            </View>
          ) : (
            <EmptyState
              title="Select a subject"
              description="Tap the subject picker above to choose which class to enter marks for."
            />
          )
        ) : (
          <>
            {/* Marks window closed banner */}
            {!isWindowOpen && (
              <View style={[styles.windowBanner, { backgroundColor: Colors.semantic.warningLight }]}>
                <Ionicons name="lock-closed-outline" size={14} color={Colors.semantic.warning} />
                <ThemedText variant="bodySm" style={{ color: Colors.semantic.warning, marginLeft: Spacing.sm, flex: 1 }}>
                  Marks window is closed. Contact Admin to re-open.
                </ThemedText>
              </View>
            )}

            {/* Assessment type tabs */}
            <View style={[styles.typeTabs, { borderBottomColor: colors.border }]}>
              {ASSESSMENT_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setSelectedType(t)}
                  style={[styles.typeTab, selectedType === t && { borderBottomColor: colors.brand.primary, borderBottomWidth: 2 }]}
                >
                  <ThemedText variant="bodySm" style={{ fontWeight: selectedType === t ? '700' : '500', color: selectedType === t ? colors.brand.primary : colors.textMuted }}>
                    {TYPE_LABELS[t]}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>

            {/* Class average + progress */}
            <View style={[styles.avgRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <ThemedText variant="caption" color="muted">Class avg · {TYPE_LABELS[selectedType]}</ThemedText>
                <ThemedText variant="h4" style={{ color: colors.brand.primary }}>
                  {classAvg[selectedType] != null ? `${classAvg[selectedType]}` : '—'}
                </ThemedText>
              </View>
              <View style={{ flex: 2 }}>
                <ThemedText variant="caption" color="muted">{enteredCount} / {students.length} entered</ThemedText>
                <ProgressBar value={enteredCount} max={students.length || 1} color={colors.brand.primary} height={4} />
              </View>
            </View>

            {marksLoading ? (
              <View style={{ padding: Spacing.base, gap: Spacing.sm }}>
                {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
              </View>
            ) : marksError ? (
              <ErrorState title="Could not load marks" description="Try again." onRetry={refetchMarks} />
            ) : students.length === 0 ? (
              <EmptyState title="No students" description="No active students in this class." />
            ) : (
              <FlatList
                data={students}
                keyExtractor={s => s.id}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item: student, index }) => {
                  const existing = marksMap[student.id]?.[selectedType];
                  const localVal = localEdits[student.id]?.[selectedType];
                  const displayVal = localVal !== undefined ? localVal : (existing?.value != null ? String(existing.value) : '');
                  const nextStudent = students[index + 1];

                  return (
                    <View style={[styles.studentRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <Avatar name={student.full_name} photoUrl={student.photo_url} size={38} />
                      <View style={styles.nameCol}>
                        <ThemedText variant="body" style={{ fontWeight: '600' }} numberOfLines={1}>{student.full_name}</ThemedText>
                        <ThemedText variant="caption" color="muted">{student.student_number}</ThemedText>
                      </View>
                      <TextInput
                        ref={ref => { inputRefs.current[student.id] = ref; }}
                        value={displayVal}
                        onChangeText={v => {
                          if (parseFloat(v) > 100) return;
                          setLocalEdits(prev => ({ ...prev, [student.id]: { ...prev[student.id], [selectedType]: v } }));
                        }}
                        onBlur={() => handleBlur(student.id)}
                        onSubmitEditing={() => {
                          handleBlur(student.id);
                          if (nextStudent) inputRefs.current[nextStudent.id]?.focus();
                        }}
                        placeholder="—"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="decimal-pad"
                        returnKeyType={nextStudent ? 'next' : 'done'}
                        editable={isWindowOpen}
                        style={[
                          styles.markInput,
                          Typography.body,
                          {
                            color: colors.textPrimary,
                            backgroundColor: isWindowOpen ? colors.surfaceSecondary : colors.surface,
                            borderColor: displayVal ? colors.brand.primary : colors.border,
                          },
                        ]}
                      />
                      <ThemedText variant="caption" color="muted" style={{ width: 24, textAlign: 'center' }}>/100</ThemedText>
                    </View>
                  );
                }}
              />
            )}
          </>
        )}
      </KeyboardAvoidingView>

      {/* Assignment picker sheet */}
      <BottomSheet
        visible={assignSheetVisible}
        onClose={() => setAssignSheetVisible(false)}
        title="Select Subject & Class"
        snapHeight={Math.min(500, (assignments?.length ?? 1) * 72 + 120)}
      >
        {(assignments ?? []).map((a: any) => (
          <TouchableOpacity
            key={a.id}
            onPress={() => { setSelectedAssignment(a); setLocalEdits({}); setAssignSheetVisible(false); haptics.selection(); }}
            style={[
              styles.assignOption,
              { borderBottomColor: colors.border, backgroundColor: selectedAssignment?.id === a.id ? colors.brand.primary + '12' : 'transparent' },
            ]}
          >
            <View style={[styles.assignDot, { backgroundColor: colors.brand.primary }]} />
            <View style={{ flex: 1 }}>
              <ThemedText variant="body" style={{ fontWeight: '600' }}>{a.subjects?.name ?? '—'}</ThemedText>
              <ThemedText variant="caption" color="muted">
                {a.streams?.grades?.name ?? ''} · {a.streams?.name ?? ''} · {a.semesters?.name ?? ''}
              </ThemedText>
            </View>
            {selectedAssignment?.id === a.id && <Ionicons name="checkmark" size={18} color={colors.brand.primary} />}
          </TouchableOpacity>
        ))}
      </BottomSheet>
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
    gap: Spacing.sm,
  },
  assignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.md,
    borderWidth: 1,
    maxWidth: '65%',
  },
  windowBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  typeTabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  typeTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  avgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.base,
  },
  list: { paddingHorizontal: Spacing.base, paddingTop: Spacing.sm, paddingBottom: 80 },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  nameCol: { flex: 1, gap: 2 },
  markInput: {
    width: 64,
    height: 40,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 16,
  },
  assignOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
  assignDot: { width: 8, height: 8, borderRadius: 4 },
});
