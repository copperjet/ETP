import React, { useMemo } from 'react';
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
import { format, isToday } from 'date-fns';
import { useTheme } from '../../../lib/theme';
import { useAuthStore } from '../../../stores/authStore';
import { supabase } from '../../../lib/supabase';
import {
  ThemedText, Card, Badge, Avatar, ProgressBar,
  Skeleton, SkeletonRow, ErrorState,
} from '../../../components/ui';
import { Spacing, Radius } from '../../../constants/Typography';
import { Colors, resolveAttBg, resolveAttColor } from '../../../constants/Colors';

const TODAY = format(new Date(), 'yyyy-MM-dd');
const TODAY_LABEL = format(new Date(), 'EEEE, d MMMM');

function useHRTDashboard(staffId: string | null, schoolId: string) {
  return useQuery({
    queryKey: ['hrt-dashboard', staffId, schoolId, TODAY],
    enabled: !!staffId && !!schoolId,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      // Step 1: get HRT assignment (class + semester)
      const { data: assignment, error: assignErr } = await supabase
        .from('hrt_assignments')
        .select('stream_id, semester_id, streams(name, grade_id, grades(name, section_id, school_sections(name))), semesters(name, end_date)')
        .eq('staff_id', staffId!)
        .eq('school_id', schoolId)
        .limit(1)
        .single();

      if (assignErr || !assignment) throw new Error('No HRT assignment found');

      const a = assignment as any;
      const streamId = a.stream_id;
      const semesterId = a.semester_id;

      // Step 2: parallel fetch attendance, student count, marks, first subject assignment, day book
      const [attendanceRes, studentsRes, marksRes, subjectAssignRes, dayBookRes] = await Promise.all([
        supabase
          .from('attendance_records')
          .select('status, student_id')
          .eq('school_id', schoolId)
          .eq('stream_id', streamId)
          .eq('date', TODAY),

        supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', schoolId)
          .eq('stream_id', streamId)
          .eq('status', 'active'),

        supabase
          .from('marks')
          .select('student_id', { count: 'exact', head: true })
          .eq('school_id', schoolId)
          .eq('stream_id', streamId)
          .eq('semester_id', semesterId)
          .eq('assessment_type', 'fa1'),

        supabase
          .from('subject_teacher_assignments')
          .select('subjects(name)')
          .eq('school_id', schoolId)
          .eq('stream_id', streamId)
          .limit(1)
          .single(),

        supabase
          .from('day_book_entries')
          .select('id, student_id, category, description, date, students(full_name, photo_url)')
          .eq('school_id', schoolId)
          .eq('created_by', staffId!)
          .order('date', { ascending: false })
          .limit(3),
      ]);

      const attendance = (attendanceRes.data ?? []) as any[];
      const totalStudents = studentsRes.count ?? 0;
      const marksEntered = marksRes.count ?? 0;
      const firstSubjectName = (subjectAssignRes.data as any)?.subjects?.name ?? 'FA1';
      const semesterEndDate = a.semesters?.end_date ?? null;
      const dayBook = dayBookRes.data ?? [];

      const presentCount = attendance.filter(a => a.status === 'present').length;
      const absentCount = attendance.filter(a => a.status === 'absent').length;
      const lateCount = attendance.filter(a => a.status === 'late').length;
      const totalMarked = attendance.length;
      const registerSubmitted = totalMarked > 0;

      return {
        assignment,
        attendance: { presentCount, absentCount, lateCount, totalMarked, registerSubmitted },
        marksEntered,
        totalStudents,
        firstSubjectName,
        semesterEndDate,
        dayBook,
      };
    },
  });
}

export default function HRTHome() {
  const { colors, scheme } = useTheme();
  const { user } = useAuthStore();
  const { data, isLoading, isError, refetch, isRefetching } = useHRTDashboard(user?.staffId ?? null, user?.schoolId ?? '');

  const streamName = (data?.assignment as any)?.streams?.name ?? '—';
  const gradeName = (data?.assignment as any)?.streams?.grades?.name ?? '';
  const sectionName = (data?.assignment as any)?.streams?.grades?.school_sections?.name ?? '';

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  if (isError) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <ErrorState
          title="Could not load dashboard"
          description="Check your connection and try again."
          onRetry={refetch}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <ThemedText variant="bodySm" color="muted">{TODAY_LABEL}</ThemedText>
            <ThemedText variant="h3">
              {greeting}, {user?.fullName?.split(' ')[0] ?? 'Teacher'} 👋
            </ThemedText>
            {streamName !== '—' && (
              <ThemedText variant="bodySm" color="muted" style={{ marginTop: 2 }}>
                {sectionName} · {gradeName} · Class {streamName}
              </ThemedText>
            )}
          </View>
          <TouchableOpacity style={[styles.avatarWrap, { borderColor: colors.border }]}>
            <Avatar name={user?.fullName ?? 'T'} size={42} />
          </TouchableOpacity>
        </View>

        {/* Attendance card */}
        <TouchableOpacity activeOpacity={0.85} onPress={() => router.push('/(app)/(hrt)/attendance')}>
          <Card accentColor={data?.attendance.registerSubmitted ? Colors.semantic.success : colors.brand.primary} style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <ThemedText variant="label" color="muted">TODAY'S ATTENDANCE</ThemedText>
                {isLoading
                  ? <Skeleton width={120} height={22} style={{ marginTop: 4 }} />
                  : <ThemedText variant="h3">
                      {data?.attendance.registerSubmitted
                        ? `${data.attendance.presentCount} present`
                        : 'Register not submitted'}
                    </ThemedText>
                }
              </View>
              <View style={[
                styles.statusDot,
                { backgroundColor: data?.attendance.registerSubmitted ? Colors.semantic.successLight : Colors.semantic.warningLight }
              ]}>
                <Ionicons
                  name={data?.attendance.registerSubmitted ? 'checkmark-circle' : 'time-outline'}
                  size={22}
                  color={data?.attendance.registerSubmitted ? Colors.semantic.success : Colors.semantic.warning}
                />
              </View>
            </View>

            {isLoading ? (
              <SkeletonRow lines={1} />
            ) : data?.attendance.registerSubmitted ? (
              <View style={styles.attendancePills}>
                <AttPill label="Present" count={data.attendance.presentCount} color={resolveAttColor('present')} bg={resolveAttBg('present', scheme)} />
                <AttPill label="Absent" count={data.attendance.absentCount} color={resolveAttColor('absent')} bg={resolveAttBg('absent', scheme)} />
                <AttPill label="Late" count={data.attendance.lateCount} color={resolveAttColor('late')} bg={resolveAttBg('late', scheme)} />
              </View>
            ) : (
              <View style={styles.notSubmittedRow}>
                <Ionicons name="alert-circle-outline" size={14} color={Colors.semantic.warning} />
                <ThemedText variant="bodySm" style={{ color: Colors.semantic.warning, marginLeft: 4 }}>
                  Tap to open register
                </ThemedText>
              </View>
            )}
          </Card>
        </TouchableOpacity>

        {/* Quick actions */}
        <ThemedText variant="label" color="muted" style={styles.sectionLabel}>QUICK ACTIONS</ThemedText>
        <View style={styles.quickActions}>
          <QuickAction icon="checkbox-outline" label="Attendance" color="#10B981" onPress={() => router.push('/(app)/(hrt)/attendance')} />
          <QuickAction icon="bar-chart-outline" label="Marks" color={colors.brand.primary} onPress={() => router.push('/(app)/(hrt)/marks')} />
          <QuickAction icon="people-outline" label="Students" color="#8B5CF6" onPress={() => router.push('/(app)/(hrt)/students')} />
          <QuickAction icon="document-text-outline" label="Reports" color="#F59E0B" onPress={() => router.push('/(app)/(hrt)/reports' as any)} />
        </View>

        {/* Marks progress */}
        <ThemedText variant="label" color="muted" style={styles.sectionLabel}>MARKS PROGRESS</ThemedText>
        <Card style={styles.card}>
          {isLoading ? (
            <SkeletonRow lines={2} />
          ) : (
            <View style={{ gap: Spacing.sm }}>
              <View style={styles.marksRow}>
                <ThemedText variant="body">FA1 · {data?.firstSubjectName ?? '—'}</ThemedText>
                <ThemedText variant="bodySm" color="muted">
                  {data?.marksEntered ?? 0} / {data?.totalStudents ?? 0} entered
                </ThemedText>
              </View>
              <ProgressBar value={data?.marksEntered ?? 0} max={data?.totalStudents || 1} color={colors.brand.primary} />
              {data?.semesterEndDate ? (
                <ThemedText variant="caption" color="muted">
                  Marks window closes {format(new Date(data.semesterEndDate), 'd MMM yyyy')}
                </ThemedText>
              ) : (
                <ThemedText variant="caption" color="muted">Marks window open</ThemedText>
              )}
            </View>
          )}
        </Card>

        {/* Day Book */}
        <View style={styles.sectionRow}>
          <ThemedText variant="label" color="muted">DAY BOOK</ThemedText>
          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => router.push('/(app)/(hrt)/daybook' as any)}>
            <ThemedText variant="bodySm" color="brand">See all</ThemedText>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <Card style={styles.card}><SkeletonRow lines={3} /></Card>
        ) : (data?.dayBook ?? []).length === 0 ? (
          <Card style={[styles.card, styles.emptyCard]}>
            <ThemedText variant="body" color="muted" style={{ textAlign: 'center' }}>No Day Book entries yet</ThemedText>
          </Card>
        ) : (
          <View style={{ gap: Spacing.sm }}>
            {(data?.dayBook ?? []).map((entry: any) => (
              <DayBookRow key={entry.id} entry={entry} colors={colors} />
            ))}
          </View>
        )}

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function AttPill({ label, count, color, bg }: { label: string; count: number; color: string; bg: string }) {
  return (
    <View style={[styles.attPill, { backgroundColor: bg }]}>
      <ThemedText variant="h4" style={{ color }}>{count}</ThemedText>
      <ThemedText variant="caption" style={{ color }}>{label}</ThemedText>
    </View>
  );
}

function QuickAction({ icon, label, color, onPress }: { icon: any; label: string; color: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.quickAction, { backgroundColor: color + '14', borderColor: color + '30' }]}
    >
      <Ionicons name={icon} size={26} color={color} />
      <ThemedText variant="bodySm" style={{ color: color, fontWeight: '600', marginTop: 4, textAlign: 'center' }}>
        {label}
      </ThemedText>
    </TouchableOpacity>
  );
}

function DayBookRow({ entry, colors }: { entry: any; colors: any }) {
  const catColors: Record<string, { color: string; icon: string }> = {
    achievement: { color: '#10B981', icon: 'star-outline' },
    academic_concern: { color: '#EF4444', icon: 'alert-circle-outline' },
    behaviour_minor: { color: '#F59E0B', icon: 'warning-outline' },
    behaviour_major: { color: '#DC2626', icon: 'close-circle-outline' },
    health: { color: '#8B5CF6', icon: 'medkit-outline' },
    general: { color: '#6B7280', icon: 'document-text-outline' },
  };
  const cat = catColors[entry.category] ?? catColors.general;
  const studentName = entry.students?.full_name ?? 'Student';

  return (
    <Card accentColor={cat.color} style={styles.card}>
      <View style={styles.dayBookRow}>
        <Avatar name={studentName} photoUrl={entry.students?.photo_url} size={34} />
        <View style={styles.dayBookContent}>
          <View style={styles.dayBookHeader}>
            <ThemedText variant="body" style={{ fontWeight: '600' }}>{studentName}</ThemedText>
            <ThemedText variant="caption" color="muted">{format(new Date(entry.date), 'd MMM')}</ThemedText>
          </View>
          <ThemedText variant="bodySm" color="secondary" numberOfLines={2}>{entry.description}</ThemedText>
        </View>
        <View style={[styles.catIcon, { backgroundColor: cat.color + '18' }]}>
          <Ionicons name={cat.icon as any} size={16} color={cat.color} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.screen, paddingTop: Spacing.base },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  headerLeft: { flex: 1, gap: 2 },
  avatarWrap: { borderRadius: 999, borderWidth: 2, padding: 2 },
  card: { marginBottom: Spacing.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
  statusDot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  attendancePills: { flexDirection: 'row', gap: Spacing.sm },
  attPill: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radius.md, gap: 2 },
  notSubmittedRow: { flexDirection: 'row', alignItems: 'center' },
  sectionLabel: { marginTop: Spacing.base, marginBottom: Spacing.sm },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.base, marginBottom: Spacing.sm },
  quickActions: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: 2,
  },
  marksRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayBookRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  dayBookContent: { flex: 1, gap: 3 },
  dayBookHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { alignItems: 'center', paddingVertical: Spacing.xl },
});
