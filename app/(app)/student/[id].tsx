/**
 * Unified Student Profile — /(app)/student/[id]
 * Tabbed view: Overview · Marks · Attendance · Reports · Day Book · Fees
 * Accessible from: HRT students list, Admin, Subject Teacher
 */
import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
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
import { Spacing, Radius, Typography } from '../../../constants/Typography';
import { Colors, resolveAttBg, resolveAttColor } from '../../../constants/Colors';
import type { AttendanceStatus } from '../../../types/database';

const TABS = ['Overview', 'Marks', 'Attendance', 'Reports', 'Day Book', 'Fees'] as const;
type Tab = typeof TABS[number];

function useStudentProfile(studentId: string, schoolId: string) {
  return useQuery({
    queryKey: ['student-profile', studentId, schoolId],
    enabled: !!studentId && !!schoolId,
    staleTime: 1000 * 60 * 3,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select(`
          id, full_name, student_number, date_of_birth, gender, photo_url,
          enrollment_date, status,
          grades ( id, name ),
          streams ( id, name ),
          school_sections ( name )
        `)
        .eq('id', studentId)
        .eq('school_id', schoolId)
        .single();
      if (error) throw error;
      return data as any;
    },
  });
}

function useStudentMarks(studentId: string, schoolId: string) {
  return useQuery({
    queryKey: ['student-marks', studentId, schoolId],
    enabled: !!studentId && !!schoolId,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marks')
        .select('assessment_type, value, is_na, subjects ( name ), semesters ( name )')
        .eq('student_id', studentId)
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

function useStudentAttendance(studentId: string, schoolId: string) {
  return useQuery({
    queryKey: ['student-attendance', studentId, schoolId],
    enabled: !!studentId && !!schoolId,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('date, status, semesters ( name )')
        .eq('student_id', studentId)
        .eq('school_id', schoolId)
        .order('date', { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

function useStudentReports(studentId: string, schoolId: string) {
  return useQuery({
    queryKey: ['student-reports', studentId, schoolId],
    enabled: !!studentId && !!schoolId,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports')
        .select('id, status, overall_percentage, class_position, pdf_url, released_at, semesters ( name )')
        .eq('student_id', studentId)
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

function useStudentDayBook(studentId: string, schoolId: string) {
  return useQuery({
    queryKey: ['student-daybook', studentId, schoolId],
    enabled: !!studentId && !!schoolId,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('day_book_entries')
        .select('id, date, category, description, send_to_parent, created_at')
        .eq('student_id', studentId)
        .eq('school_id', schoolId)
        .order('date', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

function useStudentFinance(studentId: string, schoolId: string) {
  return useQuery({
    queryKey: ['student-fees', studentId, schoolId],
    enabled: !!studentId && !!schoolId,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finance_records')
        .select('id, status, balance, updated_at, semesters ( name )')
        .eq('student_id', studentId)
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export default function StudentProfileScreen() {
  const { colors, scheme } = useTheme();
  const { user } = useAuthStore();
  const { id: studentId } = useLocalSearchParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('Overview');

  const schoolId = user?.schoolId ?? '';

  const profileQuery = useStudentProfile(studentId ?? '', schoolId);
  const marksQuery = useStudentMarks(studentId ?? '', schoolId);
  const attendanceQuery = useStudentAttendance(studentId ?? '', schoolId);
  const reportsQuery = useStudentReports(studentId ?? '', schoolId);
  const dayBookQuery = useStudentDayBook(studentId ?? '', schoolId);
  const financeQuery = useStudentFinance(studentId ?? '', schoolId);

  if (profileQuery.isError) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <ErrorState title="Student not found" description="Could not load this student's profile." onRetry={profileQuery.refetch} />
      </SafeAreaView>
    );
  }

  const student = profileQuery.data;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <ThemedText variant="h4" style={{ flex: 1, marginLeft: Spacing.sm }}>Student Profile</ThemedText>
      </View>

      {/* Identity card */}
      {profileQuery.isLoading ? (
        <View style={[styles.identityCard, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Skeleton width={64} height={64} radius={32} />
          <View style={{ flex: 1, gap: 8, marginLeft: Spacing.base }}>
            <Skeleton width="60%" height={18} />
            <Skeleton width="40%" height={13} />
            <Skeleton width="50%" height={13} />
          </View>
        </View>
      ) : student ? (
        <View style={[styles.identityCard, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Avatar name={student.full_name} photoUrl={student.photo_url} size={64} />
          <View style={styles.identityInfo}>
            <ThemedText variant="h4">{student.full_name}</ThemedText>
            <ThemedText variant="bodySm" color="muted">{student.student_number}</ThemedText>
            <ThemedText variant="caption" color="muted">
              {student.grades?.name ?? ''}{student.streams?.name ? ` · ${student.streams.name}` : ''}
              {student.school_sections?.name ? ` · ${student.school_sections.name}` : ''}
            </ThemedText>
          </View>
          <Badge
            label={student.status === 'active' ? 'Active' : student.status}
            preset={student.status === 'active' ? 'success' : 'warning'}
          />
        </View>
      ) : null}

      {/* Tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabBar, { borderBottomColor: colors.border }]}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tab, activeTab === tab && { borderBottomColor: colors.brand.primary, borderBottomWidth: 2 }]}
          >
            <ThemedText
              variant="bodySm"
              style={{ fontWeight: activeTab === tab ? '700' : '500', color: activeTab === tab ? colors.brand.primary : colors.textMuted }}
            >
              {tab}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab content */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'Overview' && <OverviewTab student={student} colors={colors} loading={profileQuery.isLoading} />}
        {activeTab === 'Marks' && <MarksTab query={marksQuery} colors={colors} />}
        {activeTab === 'Attendance' && <AttendanceTab query={attendanceQuery} colors={colors} scheme={scheme} />}
        {activeTab === 'Reports' && <ReportsTab query={reportsQuery} colors={colors} student={student} />}
        {activeTab === 'Day Book' && <DayBookTab query={dayBookQuery} colors={colors} />}
        {activeTab === 'Fees' && <FeesTab query={financeQuery} colors={colors} schoolId={schoolId} />}
      </ScrollView>
    </SafeAreaView>
  );
}

function OverviewTab({ student, colors, loading }: { student: any; colors: any; loading: boolean }) {
  if (loading || !student) return <TabSkeleton />;
  return (
    <View style={{ gap: Spacing.base }}>
      <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ThemedText variant="label" color="muted" style={styles.sectionLabel}>PERSONAL</ThemedText>
        <InfoRow label="Full Name" value={student.full_name} colors={colors} />
        <InfoRow label="Student ID" value={student.student_number} colors={colors} />
        <InfoRow label="Gender" value={student.gender ?? '—'} colors={colors} />
        <InfoRow label="Date of Birth" value={student.date_of_birth ? format(new Date(student.date_of_birth), 'd MMM yyyy') : '—'} colors={colors} />
        <InfoRow label="Enrolled" value={student.enrollment_date ? format(new Date(student.enrollment_date), 'd MMM yyyy') : '—'} colors={colors} last />
      </View>
      <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ThemedText variant="label" color="muted" style={styles.sectionLabel}>CLASS</ThemedText>
        <InfoRow label="Grade" value={student.grades?.name ?? '—'} colors={colors} />
        <InfoRow label="Stream / Class" value={student.streams?.name ?? '—'} colors={colors} />
        <InfoRow label="Section" value={student.school_sections?.name ?? '—'} colors={colors} last />
      </View>
    </View>
  );
}

function InfoRow({ label, value, colors, last }: { label: string; value: string; colors: any; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      <ThemedText variant="bodySm" color="muted" style={{ flex: 1 }}>{label}</ThemedText>
      <ThemedText variant="bodySm" style={{ fontWeight: '600', flex: 1.5, textAlign: 'right' }}>{value}</ThemedText>
    </View>
  );
}

function MarksTab({ query, colors }: { query: any; colors: any }) {
  if (query.isLoading) return <TabSkeleton />;
  if (query.isError) return <ErrorState title="Could not load marks" description="Try again." onRetry={query.refetch} />;
  const marks = query.data ?? [];
  if (marks.length === 0) return <EmptyState title="No marks yet" description="Marks will appear once entered by subject teachers." />;

  const grouped: Record<string, any[]> = {};
  marks.forEach((m: any) => {
    const key = m.subjects?.name ?? 'Unknown';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(m);
  });

  return (
    <View style={{ gap: Spacing.base }}>
      {Object.entries(grouped).map(([subject, items]) => (
        <View key={subject} style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText variant="label" color="muted" style={styles.sectionLabel}>{subject.toUpperCase()}</ThemedText>
          {items.map((m: any, i: number) => (
            <View key={i} style={[styles.infoRow, i < items.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
              <ThemedText variant="bodySm" color="muted">{(m.assessment_type ?? '').toUpperCase()}</ThemedText>
              {m.is_na ? (
                <Badge label="N/A" preset="warning" />
              ) : (
                <ThemedText variant="bodySm" style={{ fontWeight: '700' }}>{m.value ?? '—'}</ThemedText>
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function AttendanceTab({ query, colors, scheme }: { query: any; colors: any; scheme: 'light' | 'dark' }) {
  if (query.isLoading) return <TabSkeleton />;
  if (query.isError) return <ErrorState title="Could not load attendance" description="Try again." onRetry={query.refetch} />;
  const records = query.data ?? [];
  if (records.length === 0) return <EmptyState title="No attendance records" description="Records will appear once attendance is submitted." />;

  const presentCount = records.filter((r: any) => r.status === 'present').length;
  const pct = Math.round((presentCount / records.length) * 100);

  return (
    <View style={{ gap: Spacing.base }}>
      <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ThemedText variant="label" color="muted" style={styles.sectionLabel}>ATTENDANCE RATE</ThemedText>
        <View style={styles.infoRow}>
          <ThemedText variant="h2" style={{ color: pct >= 85 ? Colors.semantic.success : Colors.semantic.error }}>{pct}%</ThemedText>
          <ThemedText variant="bodySm" color="muted">{presentCount} of {records.length} days</ThemedText>
        </View>
        <ProgressBar value={pct} max={100} color={pct >= 85 ? Colors.semantic.success : Colors.semantic.error} />
      </View>

      {records.map((r: any, i: number) => (
        <View key={i} style={[styles.attRow, { backgroundColor: resolveAttBg(r.status as any, scheme), borderColor: resolveAttColor(r.status as any) + '40' }]}>
          <Ionicons name="calendar-outline" size={14} color={resolveAttColor(r.status as any)} />
          <ThemedText variant="bodySm" style={{ flex: 1, marginLeft: Spacing.sm }}>
            {r.date ? format(new Date(r.date), 'EEE, d MMM yyyy') : ''}
          </ThemedText>
          <ThemedText variant="label" style={{ color: resolveAttColor(r.status as any), fontWeight: '700', textTransform: 'uppercase', fontSize: 11 }}>
            {r.status}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

function ReportsTab({ query, colors, student }: { query: any; colors: any; student: any }) {
  if (query.isLoading) return <TabSkeleton />;
  if (query.isError) return <ErrorState title="Could not load reports" description="Try again." onRetry={query.refetch} />;
  const reports = query.data ?? [];
  if (reports.length === 0) return <EmptyState title="No reports yet" description="Reports will appear once generated and released." />;

  const statusColor: Record<string, string> = {
    released: Colors.semantic.success,
    approved: Colors.semantic.info,
    pending_approval: Colors.semantic.warning,
    draft: Colors.semantic.warning,
    finance_pending: Colors.semantic.warning,
  };

  return (
    <View style={{ gap: Spacing.sm }}>
      {reports.map((r: any) => (
        <TouchableOpacity
          key={r.id}
          style={[styles.reportRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => {
            if (r.pdf_url) {
              router.push({ pathname: '/(app)/report-viewer' as any, params: { report_id: r.id, pdf_url: r.pdf_url, student_name: student?.full_name ?? '', is_draft: r.status !== 'released' ? 'true' : 'false' } });
            }
          }}
          activeOpacity={r.pdf_url ? 0.75 : 1}
        >
          <Ionicons name="document-text-outline" size={22} color={colors.brand.primary} />
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <ThemedText variant="body" style={{ fontWeight: '600' }}>{r.semesters?.name ?? 'Report'}</ThemedText>
            {r.overall_percentage != null && (
              <ThemedText variant="caption" color="muted">{r.overall_percentage.toFixed(1)}% {r.class_position ? `· Position ${r.class_position}` : ''}</ThemedText>
            )}
          </View>
          <Badge label={r.status.replace('_', ' ')} preset={r.status === 'released' ? 'success' : 'warning'} />
          {r.pdf_url && <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginLeft: 4 }} />}
        </TouchableOpacity>
      ))}
    </View>
  );
}

function DayBookTab({ query, colors }: { query: any; colors: any }) {
  if (query.isLoading) return <TabSkeleton />;
  if (query.isError) return <ErrorState title="Could not load day book" description="Try again." onRetry={query.refetch} />;
  const entries = query.data ?? [];
  if (entries.length === 0) return <EmptyState title="No day book entries" description="Entries will appear once your teacher creates them." />;

  return (
    <View style={{ gap: Spacing.sm }}>
      {entries.map((e: any) => (
        <View key={e.id} style={[styles.dayBookEntry, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.dayBookHeader}>
            <ThemedText variant="label" style={{ color: colors.brand.primary, textTransform: 'uppercase', fontSize: 11 }}>{e.category}</ThemedText>
            {e.send_to_parent && <Ionicons name="mail-outline" size={13} color={Colors.semantic.success} />}
          </View>
          <ThemedText variant="body">{e.description}</ThemedText>
          <ThemedText variant="caption" color="muted" style={{ marginTop: 4 }}>
            {e.date ? format(new Date(e.date), 'EEE, d MMM yyyy') : ''}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

function FeesTab({ query, colors, schoolId }: { query: any; colors: any; schoolId: string }) {
  if (query.isLoading) return <TabSkeleton />;
  if (query.isError) return <ErrorState title="Could not load fees" description="Try again." onRetry={query.refetch} />;
  const records = query.data ?? [];
  if (records.length === 0) return <EmptyState title="No fee records" description="Fee records will appear once set up by Finance." />;

  return (
    <View style={{ gap: Spacing.sm }}>
      {records.map((r: any) => (
        <View key={r.id} style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.infoRow}>
            <ThemedText variant="body" style={{ fontWeight: '600' }}>{r.semesters?.name ?? 'Semester'}</ThemedText>
            <Badge label={r.status} preset={r.status === 'paid' ? 'success' : 'error'} />
          </View>
          {r.balance != null && (
            <View style={[styles.infoRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
              <ThemedText variant="bodySm" color="muted">Balance</ThemedText>
              <ThemedText variant="bodySm" style={{ fontWeight: '700', color: r.balance > 0 ? Colors.semantic.error : Colors.semantic.success }}>
                {r.balance > 0 ? `-${r.balance.toLocaleString()}` : 'Cleared'}
              </ThemedText>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

function TabSkeleton() {
  return (
    <View style={{ gap: Spacing.base }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
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
  backBtn: { padding: Spacing.base },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.base,
  },
  identityInfo: { flex: 1, gap: 4 },
  tabBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexGrow: 0,
  },
  tabBarContent: { paddingHorizontal: Spacing.base, gap: 0 },
  tab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabContent: { padding: Spacing.base, paddingBottom: 40 },
  infoCard: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sectionLabel: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    letterSpacing: 0.6,
    fontSize: 11,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  attRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dayBookEntry: {
    padding: Spacing.base,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  dayBookHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
});
