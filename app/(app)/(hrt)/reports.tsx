/**
 * HRT Reports — /(app)/(hrt)/reports
 * HRT adds comment + submits reports for their class → Admin approval → Finance → Release
 * Status pipeline: draft → pending_approval → approved → finance_pending → released
 */
import React, { useState, useCallback } from 'react';
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
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../../lib/theme';
import { useAuthStore } from '../../../stores/authStore';
import { supabase } from '../../../lib/supabase';
import {
  ThemedText, Avatar, Badge, BottomSheet, FAB,
  Skeleton, SkeletonRow, EmptyState, ErrorState,
} from '../../../components/ui';
import { Spacing, Radius } from '../../../constants/Typography';
import { Colors } from '../../../constants/Colors';
import { haptics } from '../../../lib/haptics';

const STATUS_META: Record<string, { label: string; preset: any; icon: string }> = {
  draft:            { label: 'Draft',            preset: 'neutral',  icon: 'document-outline' },
  pending_approval: { label: 'Pending Approval', preset: 'warning',  icon: 'time-outline' },
  approved:         { label: 'Approved',         preset: 'info',     icon: 'checkmark-done-outline' },
  finance_pending:  { label: 'Finance Pending',  preset: 'warning',  icon: 'card-outline' },
  under_review:     { label: 'Under Review',     preset: 'info',     icon: 'eye-outline' },
  released:         { label: 'Released',         preset: 'success',  icon: 'checkmark-circle-outline' },
};

function useClassReports(staffId: string | null, schoolId: string) {
  return useQuery({
    queryKey: ['hrt-reports', staffId, schoolId],
    enabled: !!staffId && !!schoolId,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { data: assignment } = await supabase
        .from('hrt_assignments')
        .select('stream_id, semester_id')
        .eq('staff_id', staffId!)
        .eq('school_id', schoolId)
        .limit(1)
        .single();
      if (!assignment) return { reports: [], semesterId: null };
      const { stream_id, semester_id } = assignment as any;

      const { data: streamStudents } = await supabase
        .from('students')
        .select('id')
        .eq('school_id', schoolId)
        .eq('stream_id', stream_id)
        .eq('status', 'active');
      const studentIds = (streamStudents ?? []).map((s: any) => s.id);
      if (studentIds.length === 0) return { reports: [], semesterId: semester_id };

      const { data, error } = await supabase
        .from('reports')
        .select(`
          id, status, hrt_comment, overall_percentage, class_position, released_at,
          students ( id, full_name, student_number, photo_url )
        `)
        .eq('school_id', schoolId)
        .eq('semester_id', semester_id)
        .in('student_id', studentIds)
        .order('created_at', { ascending: false });
      if (error) throw error;

      return { reports: (data ?? []) as any[], semesterId: semester_id };
    },
  });
}

export default function HRTReportsScreen() {
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [comment, setComment] = useState('');

  const { data, isLoading, isError, refetch } = useClassReports(user?.staffId ?? null, user?.schoolId ?? '');

  const saveComment = useMutation({
    mutationFn: async ({ reportId, hrtComment }: { reportId: string; hrtComment: string }) => {
      const { error } = await (supabase as any)
        .from('reports')
        .update({ hrt_comment: hrtComment, updated_at: new Date().toISOString() })
        .eq('id', reportId)
        .eq('school_id', user?.schoolId ?? '');
      if (error) throw error;
    },
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['hrt-reports'] });
      setSheetVisible(false);
    },
    onError: () => haptics.error(),
  });

  const submitReport = useMutation<void, Error, string>({
    mutationFn: async (reportId: string) => {
      const { error } = await (supabase as any)
        .from('reports')
        .update({ status: 'pending_approval', updated_at: new Date().toISOString() })
        .eq('id', reportId)
        .eq('school_id', user?.schoolId ?? '');
      if (error) throw error;
    },
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['hrt-reports'] });
      setSheetVisible(false);
    },
    onError: () => haptics.error(),
  });

  const submitAll = useMutation<void, Error, void>({
    mutationFn: async () => {
      const draftIds = (data?.reports ?? [])
        .filter((r: any) => r.status === 'draft')
        .map((r: any) => r.id);
      if (draftIds.length === 0) return;
      const { error } = await (supabase as any)
        .from('reports')
        .update({ status: 'pending_approval', updated_at: new Date().toISOString() })
        .in('id', draftIds)
        .eq('school_id', user?.schoolId ?? '');
      if (error) throw error;
    },
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['hrt-reports'] });
    },
    onError: () => haptics.error(),
  });

  const openSheet = useCallback((report: any) => {
    setSelectedReport(report);
    setComment(report.hrt_comment ?? '');
    setSheetVisible(true);
  }, []);

  if (isError) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <ErrorState title="Could not load reports" description="Try again." onRetry={refetch} />
      </SafeAreaView>
    );
  }

  const reports = data?.reports ?? [];
  const draftCount = reports.filter((r: any) => r.status === 'draft').length;
  const releasedCount = reports.filter((r: any) => r.status === 'released').length;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <ThemedText variant="h4">Report Cards</ThemedText>
          <ThemedText variant="caption" color="muted">
            {releasedCount}/{reports.length} released
          </ThemedText>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Stats row */}
      {!isLoading && reports.length > 0 && (
        <View style={[styles.statsRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          {Object.entries(STATUS_META).map(([status, meta]) => {
            const count = reports.filter((r: any) => r.status === status).length;
            if (count === 0) return null;
            return (
              <View key={status} style={styles.statItem}>
                <ThemedText variant="h4" style={{ color: count > 0 ? colors.brand.primary : colors.textMuted }}>{count}</ThemedText>
                <ThemedText variant="caption" color="muted" style={{ fontSize: 10, textAlign: 'center' }}>{meta.label}</ThemedText>
              </View>
            );
          })}
        </View>
      )}

      {isLoading ? (
        <View style={{ padding: Spacing.base, gap: Spacing.sm }}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
        </View>
      ) : reports.length === 0 ? (
        <EmptyState
          title="No reports yet"
          description="Reports will appear once generated for the current semester."
        />
      ) : (
        <FlatList
          data={reports}
          keyExtractor={r => r.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: report }) => {
            const meta = STATUS_META[report.status] ?? STATUS_META.draft;
            const student = report.students;
            const canEdit = report.status === 'draft';
            const canView = !!report.pdf_url;
            return (
              <TouchableOpacity
                onPress={() => openSheet(report)}
                activeOpacity={0.8}
                style={[styles.reportRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Avatar name={student?.full_name ?? '?'} photoUrl={student?.photo_url} size={40} />
                <View style={{ flex: 1 }}>
                  <ThemedText variant="body" style={{ fontWeight: '600' }}>{student?.full_name ?? '—'}</ThemedText>
                  {report.overall_percentage != null && (
                    <ThemedText variant="caption" color="muted">
                      {report.overall_percentage.toFixed(1)}%
                      {report.class_position ? ` · #${report.class_position}` : ''}
                    </ThemedText>
                  )}
                  {report.hrt_comment ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Ionicons name="chatbubble-outline" size={11} color="#9CA3AF" />
                      <ThemedText variant="caption" color="muted" numberOfLines={1} style={{ flex: 1 }}>
                        {report.hrt_comment}
                      </ThemedText>
                    </View>
                  ) : canEdit ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Ionicons name="alert-circle-outline" size={12} color={Colors.semantic.warning} />
                      <ThemedText variant="caption" style={{ color: Colors.semantic.warning }}>Comment required</ThemedText>
                    </View>
                  ) : null}
                </View>
                <Badge label={meta.label} preset={meta.preset} />
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Submit all FAB */}
      {draftCount > 0 && (
        <FAB
          icon={<Ionicons name="send-outline" size={20} color="#fff" />}
          label={`Submit ${draftCount} for Approval`}
          onPress={() => submitAll.mutate()}
          color={colors.brand.primary}
        />
      )}

      {/* Report detail / comment sheet */}
      <BottomSheet
        visible={sheetVisible && !!selectedReport}
        onClose={() => setSheetVisible(false)}
        title={selectedReport?.students?.full_name ?? 'Report'}
        snapHeight={480}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Status */}
          <View style={styles.sheetStatusRow}>
            {selectedReport && (
              <Badge
                label={STATUS_META[selectedReport.status]?.label ?? selectedReport.status}
                preset={STATUS_META[selectedReport.status]?.preset ?? 'neutral'}
              />
            )}
            {selectedReport?.overall_percentage != null && (
              <ThemedText variant="body" style={{ fontWeight: '700', color: colors.brand.primary }}>
                {selectedReport.overall_percentage.toFixed(1)}%
              </ThemedText>
            )}
          </View>

          {/* HRT Comment */}
          <ThemedText variant="label" color="muted" style={styles.fieldLabel}>
            HRT COMMENT (max 600 chars)
          </ThemedText>
          <TextInput
            value={comment}
            onChangeText={t => { if (t.length <= 600) setComment(t); }}
            placeholder="Write your class teacher comment…"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={4}
            editable={selectedReport?.status === 'draft'}
            style={[
              styles.commentInput,
              { color: colors.textPrimary, backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
            ]}
          />
          <ThemedText variant="caption" color="muted" style={{ textAlign: 'right', marginBottom: Spacing.base }}>
            {comment.length}/600
          </ThemedText>

          <View style={styles.sheetBtns}>
            {selectedReport?.status === 'draft' && (
              <>
                <TouchableOpacity
                  onPress={() => saveComment.mutate({ reportId: selectedReport.id, hrtComment: comment })}
                  disabled={saveComment.isPending}
                  style={[styles.outlineBtn, { borderColor: colors.brand.primary }]}
                >
                  <ThemedText variant="body" style={{ color: colors.brand.primary, fontWeight: '600' }}>Save Draft</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => submitReport.mutate(selectedReport.id)}
                  disabled={submitReport.isPending || !comment.trim()}
                  style={[styles.primaryBtn, { backgroundColor: comment.trim() ? colors.brand.primary : colors.border }]}
                >
                  <ThemedText variant="body" style={{ color: '#fff', fontWeight: '700' }}>Submit for Approval</ThemedText>
                </TouchableOpacity>
              </>
            )}
            {selectedReport?.pdf_url && (
              <TouchableOpacity
                onPress={() => {
                  setSheetVisible(false);
                  router.push({ pathname: '/(app)/report-viewer' as any, params: { report_id: selectedReport.id, pdf_url: selectedReport.pdf_url, student_name: selectedReport.students?.full_name ?? '', is_draft: selectedReport.status !== 'released' ? 'true' : 'false' } });
                }}
                style={[styles.primaryBtn, { backgroundColor: colors.brand.primary }]}
              >
                <Ionicons name="document-text-outline" size={18} color="#fff" />
                <ThemedText variant="body" style={{ color: '#fff', fontWeight: '700', marginLeft: 6 }}>View PDF</ThemedText>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
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
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.base,
    flexWrap: 'wrap',
  },
  statItem: { alignItems: 'center', minWidth: 56 },
  list: { paddingHorizontal: Spacing.base, paddingTop: Spacing.sm, paddingBottom: 120 },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
  sheetStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.base,
  },
  fieldLabel: { marginBottom: Spacing.sm, letterSpacing: 0.5, fontSize: 11 },
  commentInput: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
    padding: Spacing.md,
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 15,
  },
  sheetBtns: { flexDirection: 'row', gap: Spacing.sm },
  outlineBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
  },
});
