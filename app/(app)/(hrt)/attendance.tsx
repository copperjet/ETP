import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useTheme } from '../../../lib/theme';
import { useAuthStore } from '../../../stores/authStore';
import { supabase } from '../../../lib/supabase';
import {
  ThemedText, Avatar, FAB, BottomSheet,
  Skeleton, EmptyState, ErrorState,
} from '../../../components/ui';
import { Spacing, Radius } from '../../../constants/Typography';
import { Colors, resolveAttBg, resolveAttColor } from '../../../constants/Colors';
import { haptics } from '../../../lib/haptics';
import type { AttendanceStatus } from '../../../types/database';

const TODAY = format(new Date(), 'yyyy-MM-dd');
const TODAY_DISPLAY = format(new Date(), 'EEE, d MMM yyyy');

const STATUSES: { value: AttendanceStatus; label: string; icon: string }[] = [
  { value: 'present', label: 'Present', icon: 'checkmark-circle' },
  { value: 'absent', label: 'Absent', icon: 'close-circle' },
  { value: 'late', label: 'Late', icon: 'time' },
  { value: 'ap', label: 'Authorised Absence', icon: 'shield-checkmark' },
  { value: 'sick', label: 'Sick', icon: 'medkit' },
];

interface StudentRow {
  id: string;
  full_name: string;
  student_number: string;
  photo_url: string | null;
  attendance_status: AttendanceStatus | null;
}

function useAttendanceRegister(staffId: string | null, schoolId: string) {
  return useQuery({
    queryKey: ['attendance-register', staffId, schoolId, TODAY],
    enabled: !!staffId && !!schoolId,
    queryFn: async () => {
      const { data: assignment } = await supabase
        .from('hrt_assignments')
        .select('stream_id, semester_id')
        .eq('staff_id', staffId!)
        .eq('school_id', schoolId)
        .limit(1)
        .single();

      if (!assignment) return { students: [], streamId: null, semesterId: null, isLocked: false };

      const { stream_id, semester_id } = assignment as any;

      const [studentsRes, attendanceRes] = await Promise.all([
        supabase
          .from('students')
          .select('id, full_name, student_number, photo_url')
          .eq('school_id', schoolId)
          .eq('stream_id', stream_id)
          .eq('status', 'active')
          .order('full_name'),
        supabase
          .from('attendance_records')
          .select('student_id, status, register_locked, submitted_by')
          .eq('school_id', schoolId)
          .eq('stream_id', stream_id)
          .eq('date', TODAY),
      ]);

      const attendance = (attendanceRes.data ?? []) as any[];
      const attMap = Object.fromEntries(attendance.map((a: any) => [a.student_id, a.status]));
      const isLocked = attendance.some((a: any) => a.register_locked);
      const submittedByOther = attendance.some((a: any) => a.submitted_by && a.submitted_by !== staffId);
      const submittedByOtherId = attendance.find((a: any) => a.submitted_by && a.submitted_by !== staffId)?.submitted_by ?? null;

      const students: StudentRow[] = (studentsRes.data ?? []).map((s: any) => ({
        ...s,
        attendance_status: attMap[s.id] ?? null,
      }));

      return { students, streamId: stream_id, semesterId: semester_id, isLocked, submittedByOther, submittedByOtherId };
    },
  });
}

export default function AttendanceScreen() {
  const { colors, scheme } = useTheme();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useAttendanceRegister(user?.staffId ?? null, user?.schoolId ?? '');

  const [localStatuses, setLocalStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [bulkSheetVisible, setBulkSheetVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const effectiveStatuses = useMemo(() => {
    const base: Record<string, AttendanceStatus> = {};
    (data?.students ?? []).forEach((s) => {
      if (s.attendance_status) base[s.id] = s.attendance_status;
    });
    return { ...base, ...localStatuses };
  }, [data?.students, localStatuses]);

  const markedCount = Object.keys(effectiveStatuses).length;
  const totalCount = data?.students?.length ?? 0;
  const allMarked = markedCount === totalCount && totalCount > 0;

  const setStatus = useCallback((studentId: string, status: AttendanceStatus) => {
    haptics.selection();
    setLocalStatuses(prev => ({ ...prev, [studentId]: status }));
    setSheetVisible(false);
  }, []);

  const markAll = useCallback((status: AttendanceStatus) => {
    haptics.medium();
    const all: Record<string, AttendanceStatus> = {};
    (data?.students ?? []).forEach(s => { all[s.id] = status; });
    setLocalStatuses(all);
    setBulkSheetVisible(false);
  }, [data?.students]);

  const handleSubmit = async () => {
    if (!data?.streamId || !data?.semesterId || !allMarked) return;
    setSubmitting(true);
    setSubmitError(null);

    // Re-check for existing submission by a co-HRT (first-submit-wins / spec C3)
    const { data: existing } = await supabase
      .from('attendance_records')
      .select('submitted_by, register_locked')
      .eq('school_id', user?.schoolId ?? '')
      .eq('stream_id', data.streamId)
      .eq('date', TODAY)
      .limit(1)
      .maybeSingle();

    if (existing && (existing as any).submitted_by && (existing as any).submitted_by !== user?.staffId) {
      setSubmitting(false);
      haptics.error();
      setSubmitError('Your co-HRT already submitted today\'s register. Request an amendment from Admin if a correction is needed.');
      queryClient.invalidateQueries({ queryKey: ['attendance-register'] });
      return;
    }

    const records = Object.entries(effectiveStatuses).map(([studentId, status]) => ({
      school_id: user?.schoolId,
      student_id: studentId,
      stream_id: data.streamId,
      semester_id: data.semesterId,
      date: TODAY,
      status,
      submitted_by: user?.staffId,
      register_locked: true,
    }));

    const { data: upserted, error } = await supabase
      .from('attendance_records')
      .upsert(records as any, { onConflict: 'student_id,date' })
      .select('id');

    if (error) {
      setSubmitting(false);
      haptics.error();
      setSubmitError('Could not save attendance. Please try again.');
      return;
    }

    // Audit log (fire-and-forget)
    supabase.from('audit_logs').insert({
      school_id: user?.schoolId,
      event_type: 'attendance_submitted',
      actor_id: user?.staffId,
      data: {
        stream_id: data.streamId,
        date: TODAY,
        record_count: records.length,
        present: records.filter(r => r.status === 'present').length,
        absent: records.filter(r => r.status === 'absent').length,
        late: records.filter(r => r.status === 'late').length,
      },
    } as any).then(() => {});

    setSubmitting(false);
    haptics.success();
    setSubmitted(true);
    queryClient.invalidateQueries({ queryKey: ['attendance-register'] });
    queryClient.invalidateQueries({ queryKey: ['hrt-dashboard'] });
  };

  if (submitted) {
    return <SubmittedView
      onBack={() => setSubmitted(false)}
      presentCount={Object.values(effectiveStatuses).filter(s => s === 'present').length}
      absentCount={Object.values(effectiveStatuses).filter(s => s === 'absent').length}
      lateCount={Object.values(effectiveStatuses).filter(s => s === 'late' || s === 'ap' || s === 'sick').length}
      total={totalCount}
    />;
  }

  if (isError) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <ErrorState
          title="Could not load register"
          description="Check your connection and try again."
          onRetry={refetch}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <ThemedText variant="h4">Attendance Register</ThemedText>
          <ThemedText variant="caption" color="muted">{TODAY_DISPLAY}</ThemedText>
        </View>
        <TouchableOpacity
          onPress={() => setBulkSheetVisible(true)}
          style={[styles.bulkBtn, { backgroundColor: colors.surfaceSecondary }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="flash-outline" size={18} color={colors.brand.primary} />
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <ThemedText variant="bodySm" color="muted">{markedCount} / {totalCount} marked</ThemedText>
        <View style={[styles.progressTrack, { backgroundColor: colors.surfaceSecondary }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: allMarked ? Colors.semantic.success : colors.brand.primary,
                width: totalCount > 0 ? `${(markedCount / totalCount) * 100}%` : '0%',
              },
            ]}
          />
        </View>
        {allMarked && (
          <View style={styles.checkRow}>
            <Ionicons name="checkmark-circle" size={14} color={Colors.semantic.success} />
          </View>
        )}
      </View>

      {/* Lock / co-HRT conflict banner */}
      {(data?.isLocked || data?.submittedByOther) && (
        <View style={[styles.lockBanner, { backgroundColor: Colors.semantic.infoLight ?? (colors.brand.primary + '14') }]}>
          <Ionicons name="lock-closed" size={14} color={Colors.semantic.info ?? colors.brand.primary} />
          <ThemedText variant="bodySm" style={{ color: Colors.semantic.info ?? colors.brand.primary, marginLeft: Spacing.sm, flex: 1 }}>
            {data?.isLocked
              ? 'Register locked for today. Contact Admin to amend.'
              : 'Your co-HRT already submitted today. Viewing read-only.'}
          </ThemedText>
        </View>
      )}

      {/* Student list */}
      {isLoading ? (
        <View style={styles.skeletonList}>
          {Array.from({ length: 8 }).map((_, i) => (
            <View key={i} style={styles.skeletonRow}>
              <Skeleton width={40} height={40} radius={20} />
              <View style={{ flex: 1, gap: 6, marginLeft: Spacing.md }}>
                <Skeleton width="60%" height={14} />
                <Skeleton width="30%" height={11} />
              </View>
              <Skeleton width={70} height={28} radius={14} />
            </View>
          ))}
        </View>
      ) : totalCount === 0 ? (
        <EmptyState
          title="No students found"
          description="There are no active students assigned to your class."
        />
      ) : (
        <FlatList
          data={data?.students ?? []}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <StudentAttendanceRow
              student={item}
              status={effectiveStatuses[item.id] ?? null}
              isLocked={(data?.isLocked ?? false) || (data?.submittedByOther ?? false)}
              scheme={scheme}
              onPress={() => {
                if (data?.isLocked || data?.submittedByOther) return;
                setSelectedStudent(item);
                setSheetVisible(true);
              }}
              colors={colors}
            />
          )}
        />
      )}

      {/* Submit error banner */}
      {submitError && (
        <View style={[styles.errorBanner, { backgroundColor: Colors.semantic.errorLight }]}>
          <Ionicons name="alert-circle-outline" size={16} color={Colors.semantic.error} />
          <ThemedText variant="bodySm" style={{ color: Colors.semantic.error, marginLeft: Spacing.sm, flex: 1 }}>
            {submitError}
          </ThemedText>
        </View>
      )}

      {/* Submit FAB */}
      {!data?.isLocked && totalCount > 0 && (
        <FAB
          icon={
            submitting
              ? <Ionicons name="sync-outline" size={22} color="#fff" />
              : allMarked
              ? <Ionicons name="checkmark" size={24} color="#fff" />
              : <Ionicons name="send-outline" size={22} color="#fff" />
          }
          label={submitting ? 'Saving…' : allMarked ? 'Submit Register' : `${totalCount - markedCount} unmarked`}
          onPress={handleSubmit}
          disabled={!allMarked || submitting}
          color={allMarked ? Colors.semantic.success : colors.brand.primary}
        />
      )}

      {/* Individual status picker */}
      <BottomSheet
        visible={sheetVisible && !!selectedStudent}
        onClose={() => setSheetVisible(false)}
        title={selectedStudent?.full_name}
        snapHeight={380}
      >
        <View style={styles.statusOptions}>
          {STATUSES.map(s => {
            const isActive = effectiveStatuses[selectedStudent?.id ?? ''] === s.value;
            return (
              <TouchableOpacity
                key={s.value}
                onPress={() => setStatus(selectedStudent!.id, s.value)}
                style={[
                  styles.statusOption,
                  {
                    backgroundColor: isActive ? resolveAttBg(s.value, scheme) : colors.surfaceSecondary,
                    borderColor: isActive ? resolveAttColor(s.value) : colors.border,
                  },
                ]}
              >
                <Ionicons name={s.icon as any} size={22} color={resolveAttColor(s.value)} />
                <ThemedText variant="bodyLg" style={{ color: resolveAttColor(s.value), fontWeight: '600' }}>
                  {s.label}
                </ThemedText>
                {isActive && (
                  <Ionicons name="checkmark" size={18} color={resolveAttColor(s.value)} style={{ marginLeft: 'auto' }} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </BottomSheet>

      {/* Bulk action sheet */}
      <BottomSheet
        visible={bulkSheetVisible}
        onClose={() => setBulkSheetVisible(false)}
        title="Mark all students as…"
        snapHeight={420}
      >
        {/* 1-tap shortcut — most common action */}
        <TouchableOpacity
          onPress={() => markAll('present')}
          style={[styles.quickPresentBtn, { backgroundColor: Colors.semantic.success }]}
          activeOpacity={0.85}
        >
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <ThemedText variant="bodyLg" style={{ color: '#fff', fontWeight: '700', marginLeft: Spacing.sm }}>
            Mark All Present
          </ThemedText>
        </TouchableOpacity>
        <ThemedText variant="caption" color="muted" style={styles.orLabel}>or choose a status</ThemedText>
        <View style={styles.statusOptions}>
          {STATUSES.map(s => (
            <TouchableOpacity
              key={s.value}
              onPress={() => markAll(s.value)}
              style={[styles.statusOption, { backgroundColor: resolveAttBg(s.value, scheme), borderColor: resolveAttColor(s.value) }]}
            >
              <Ionicons name={s.icon as any} size={22} color={resolveAttColor(s.value)} />
              <ThemedText variant="bodyLg" style={{ color: resolveAttColor(s.value), fontWeight: '600' }}>
                {s.label}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

function StudentAttendanceRow({
  student,
  status,
  isLocked,
  scheme,
  onPress,
  colors,
}: {
  student: StudentRow;
  status: AttendanceStatus | null;
  isLocked: boolean;
  scheme: 'light' | 'dark';
  onPress: () => void;
  colors: any;
}) {
  const attColor = status ? resolveAttColor(status) : colors.textMuted;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={isLocked ? 1 : 0.75}
      style={[
        styles.studentRow,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Avatar name={student.full_name} photoUrl={student.photo_url} size={42} />
      <View style={styles.studentInfo}>
        <ThemedText variant="body" style={{ fontWeight: '600' }}>{student.full_name}</ThemedText>
        <ThemedText variant="caption" color="muted">{student.student_number}</ThemedText>
      </View>
      <View style={[styles.statusBtn, { backgroundColor: status ? resolveAttBg(status, scheme) : colors.surfaceSecondary, borderColor: attColor + '60' }]}>
        {status ? (
          <>
            <Ionicons
              name={STATUSES.find(s => s.value === status)?.icon as any ?? 'ellipse'}
              size={14}
              color={attColor}
            />
            <ThemedText variant="label" style={{ color: attColor, marginLeft: 4, fontSize: 11 }}>
              {status.toUpperCase()}
            </ThemedText>
          </>
        ) : (
          <ThemedText variant="label" style={{ color: colors.textMuted, fontSize: 11 }}>SET</ThemedText>
        )}
      </View>
    </TouchableOpacity>
  );
}

function SubmittedView({ onBack, presentCount, absentCount, lateCount, total }: { onBack: () => void; presentCount: number; absentCount: number; lateCount: number; total: number }) {
  const { colors } = useTheme();
  const scale = useSharedValue(0.4);
  const opacity = useSharedValue(0);
  const contentY = useSharedValue(30);
  const contentOp = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 140 });
    opacity.value = withTiming(1, { duration: 300 });
    contentY.value = withDelay(200, withSpring(0, { damping: 14 }));
    contentOp.value = withDelay(200, withTiming(1, { duration: 350 }));
  }, []);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));
  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateY: contentY.value }], opacity: contentOp.value }));

  const otherCount = total - presentCount - absentCount - lateCount;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.submittedContainer}>
        <Animated.View style={[styles.successIcon, { backgroundColor: Colors.semantic.successLight }, iconStyle]}>
          <Ionicons name="checkmark-circle" size={64} color={Colors.semantic.success} />
        </Animated.View>

        <Animated.View style={[{ alignItems: 'center' }, contentStyle]}>
          <ThemedText variant="h2" style={styles.successTitle}>Register Submitted</ThemedText>
          <ThemedText variant="body" color="muted" style={styles.successSub}>
            Today's attendance has been locked and recorded.
          </ThemedText>

          <View style={[styles.statsGrid, { borderColor: colors.border }]}>
            <View style={[styles.statBox, { borderColor: colors.border }]}>
              <ThemedText variant="h2" style={{ color: Colors.attendance.present }}>{presentCount}</ThemedText>
              <ThemedText variant="caption" color="muted">Present</ThemedText>
            </View>
            <View style={[styles.statBox, styles.statBoxMid, { borderColor: colors.border }]}>
              <ThemedText variant="h2" style={{ color: Colors.attendance.absent }}>{absentCount}</ThemedText>
              <ThemedText variant="caption" color="muted">Absent</ThemedText>
            </View>
            <View style={[styles.statBox, { borderColor: colors.border }]}>
              <ThemedText variant="h2" style={{ color: Colors.attendance.late }}>{lateCount}</ThemedText>
              <ThemedText variant="caption" color="muted">Late / Other</ThemedText>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => { haptics.light(); router.replace('/(app)/(hrt)/home'); }}
            style={[styles.doneBtn, { backgroundColor: colors.brand.primary }]}
            activeOpacity={0.85}
          >
            <Ionicons name="home-outline" size={18} color="#fff" />
            <ThemedText variant="bodyLg" style={{ color: '#fff', fontWeight: '700', marginLeft: 8 }}>Back to Home</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity onPress={onBack} style={styles.viewRegisterBtn}>
            <ThemedText variant="body" color="brand">View Register</ThemedText>
          </TouchableOpacity>
        </Animated.View>
      </View>
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
  bulkBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  progressTrack: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  checkRow: { marginLeft: 2 },
  skeletonList: { padding: Spacing.base, gap: Spacing.sm },
  skeletonRow: { flexDirection: 'row', alignItems: 'center' },
  list: { paddingHorizontal: Spacing.base, paddingTop: Spacing.sm, paddingBottom: 120 },
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
  studentInfo: { flex: 1, gap: 2 },
  statusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    minWidth: 70,
    justifyContent: 'center',
  },
  quickPresentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    marginBottom: Spacing.sm,
  },
  orLabel: {
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
  },
  lockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  statusOptions: { gap: Spacing.sm, paddingVertical: Spacing.sm },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
  },
  submittedContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing['2xl'] },
  successIcon: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xl },
  successTitle: { marginBottom: Spacing.sm, textAlign: 'center' },
  successSub: { textAlign: 'center', marginBottom: Spacing.xl },
  statsGrid: {
    flexDirection: 'row',
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: Spacing['2xl'],
    width: '100%',
  },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: Spacing.base, gap: 4 },
  statBoxMid: { borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth },
  doneBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.base, borderRadius: Radius.full, marginBottom: Spacing.base },
  viewRegisterBtn: { paddingVertical: Spacing.sm },
});
