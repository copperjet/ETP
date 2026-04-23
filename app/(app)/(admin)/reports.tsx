/**
 * Admin Reports — /(app)/(admin)/reports
 * Admin approves pending reports + releases after finance clearance
 * Pipeline: pending_approval → approved → (finance_pending) → released
 */
import React, { useState } from 'react';
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
  ThemedText, Avatar, Badge, BottomSheet,
  SkeletonRow, EmptyState, ErrorState,
} from '../../../components/ui';
import { Spacing, Radius } from '../../../constants/Typography';
import { Colors } from '../../../constants/Colors';
import { haptics } from '../../../lib/haptics';

const FILTER_TABS = ['pending_approval', 'approved', 'finance_pending', 'released'] as const;
const TAB_LABELS: Record<string, string> = {
  pending_approval: 'Pending',
  approved: 'Approved',
  finance_pending: 'Finance',
  released: 'Released',
};
const STATUS_META: Record<string, { preset: any }> = {
  pending_approval: { preset: 'warning' },
  approved:         { preset: 'info' },
  finance_pending:  { preset: 'warning' },
  released:         { preset: 'success' },
};

function useAdminReports(schoolId: string, status: string) {
  return useQuery({
    queryKey: ['admin-reports', schoolId, status],
    enabled: !!schoolId,
    staleTime: 1000 * 60,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('reports')
        .select(`
          id, status, hrt_comment, overall_percentage, class_position, updated_at, pdf_url,
          students ( id, full_name, student_number, photo_url ),
          semesters ( name )
        `)
        .eq('school_id', schoolId)
        .eq('status', status)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export default function AdminReportsScreen() {
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const schoolId = user?.schoolId ?? '';

  const [activeTab, setActiveTab] = useState<string>('pending_approval');
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const { data, isLoading, isError, refetch } = useAdminReports(schoolId, activeTab);

  const approveReport = useMutation({
    mutationFn: async (reportId: string) => {
      const { error } = await (supabase as any)
        .from('reports')
        .update({
          status: 'approved',
          approved_by: user?.staffId,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', reportId)
        .eq('school_id', schoolId);
      if (error) throw error;
    },
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      setSheetVisible(false);
    },
    onError: () => haptics.error(),
  });

  const releaseReport = useMutation({
    mutationFn: async (reportId: string) => {
      const { error } = await (supabase as any)
        .from('reports')
        .update({
          status: 'released',
          released_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', reportId)
        .eq('school_id', schoolId);
      if (error) throw error;
    },
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      setSheetVisible(false);
    },
    onError: () => haptics.error(),
  });

  if (isError) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <ErrorState title="Could not load reports" description="Try again." onRetry={refetch} />
      </SafeAreaView>
    );
  }

  const reports = data ?? [];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <ThemedText variant="h4">Reports</ThemedText>
        <View style={{ width: 36 }} />
      </View>

      {/* Status filter tabs */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tab, activeTab === tab && { borderBottomColor: colors.brand.primary, borderBottomWidth: 2 }]}
          >
            <ThemedText variant="bodySm" style={{ fontWeight: activeTab === tab ? '700' : '500', color: activeTab === tab ? colors.brand.primary : colors.textMuted }}>
              {TAB_LABELS[tab]}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={{ padding: Spacing.base, gap: Spacing.sm }}>
          {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
        </View>
      ) : reports.length === 0 ? (
        <EmptyState
          title={`No ${TAB_LABELS[activeTab].toLowerCase()} reports`}
          description={activeTab === 'pending_approval' ? 'All reports have been reviewed.' : 'No reports in this status.'}
        />
      ) : (
        <FlatList
          data={reports}
          keyExtractor={r => r.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: report }) => {
            const student = report.students;
            return (
              <TouchableOpacity
                onPress={() => { setSelectedReport(report); setSheetVisible(true); }}
                activeOpacity={0.8}
                style={[styles.reportRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Avatar name={student?.full_name ?? '?'} photoUrl={student?.photo_url} size={40} />
                <View style={{ flex: 1 }}>
                  <ThemedText variant="body" style={{ fontWeight: '600' }}>{student?.full_name ?? '—'}</ThemedText>
                  <ThemedText variant="caption" color="muted">{report.semesters?.name ?? ''}</ThemedText>
                  {report.overall_percentage != null && (
                    <ThemedText variant="caption" color="muted">
                      {report.overall_percentage.toFixed(1)}%{report.class_position ? ` · #${report.class_position}` : ''}
                    </ThemedText>
                  )}
                </View>
                <Badge label={TAB_LABELS[report.status] ?? report.status} preset={STATUS_META[report.status]?.preset ?? 'neutral'} />
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Report action sheet */}
      <BottomSheet
        visible={sheetVisible && !!selectedReport}
        onClose={() => setSheetVisible(false)}
        title={selectedReport?.students?.full_name ?? 'Report'}
        snapHeight={440}
      >
        {selectedReport && (
          <View style={{ gap: Spacing.base }}>
            {/* Stats */}
            <View style={[styles.statRow, { backgroundColor: colors.surfaceSecondary, borderRadius: Radius.md }]}>
              <View style={styles.statItem}>
                <ThemedText variant="h3" style={{ color: colors.brand.primary }}>
                  {selectedReport.overall_percentage != null ? `${selectedReport.overall_percentage.toFixed(1)}%` : '—'}
                </ThemedText>
                <ThemedText variant="caption" color="muted">Average</ThemedText>
              </View>
              <View style={[styles.statItem, { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border }]}>
                <ThemedText variant="h3" style={{ color: colors.brand.primary }}>
                  {selectedReport.class_position != null ? `#${selectedReport.class_position}` : '—'}
                </ThemedText>
                <ThemedText variant="caption" color="muted">Position</ThemedText>
              </View>
            </View>

            {/* HRT Comment */}
            {selectedReport.hrt_comment ? (
              <View style={[styles.commentBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <ThemedText variant="label" color="muted" style={{ marginBottom: 4 }}>HRT COMMENT</ThemedText>
                <ThemedText variant="bodySm">{selectedReport.hrt_comment}</ThemedText>
              </View>
            ) : (
              <View style={[styles.commentBox, { backgroundColor: Colors.semantic.warningLight, borderColor: Colors.semantic.warning + '40' }]}>
                <ThemedText variant="bodySm" style={{ color: Colors.semantic.warning }}>⚠ No HRT comment added</ThemedText>
              </View>
            )}

            {/* Action buttons */}
            <View style={{ gap: Spacing.sm }}>
              {selectedReport.status === 'pending_approval' && (
                <TouchableOpacity
                  onPress={() => approveReport.mutate(selectedReport.id)}
                  disabled={approveReport.isPending}
                  style={[styles.actionBtn, { backgroundColor: Colors.semantic.success }]}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <ThemedText variant="body" style={{ color: '#fff', fontWeight: '700', marginLeft: 8 }}>
                    {approveReport.isPending ? 'Approving…' : 'Approve Report'}
                  </ThemedText>
                </TouchableOpacity>
              )}
              {(selectedReport.status === 'approved' || selectedReport.status === 'finance_pending') && (
                <TouchableOpacity
                  onPress={() => releaseReport.mutate(selectedReport.id)}
                  disabled={releaseReport.isPending}
                  style={[styles.actionBtn, { backgroundColor: colors.brand.primary }]}
                >
                  <Ionicons name="send-outline" size={18} color="#fff" />
                  <ThemedText variant="body" style={{ color: '#fff', fontWeight: '700', marginLeft: 8 }}>
                    {releaseReport.isPending ? 'Releasing…' : 'Release to Parent'}
                  </ThemedText>
                </TouchableOpacity>
              )}
              {selectedReport.pdf_url && (
                <TouchableOpacity
                  onPress={() => {
                    setSheetVisible(false);
                    router.push({ pathname: '/(app)/report-viewer' as any, params: { report_id: selectedReport.id, pdf_url: selectedReport.pdf_url, student_name: selectedReport.students?.full_name ?? '', is_draft: selectedReport.status !== 'released' ? 'true' : 'false' } });
                  }}
                  style={[styles.outlineBtn, { borderColor: colors.brand.primary }]}
                >
                  <Ionicons name="document-text-outline" size={18} color={colors.brand.primary} />
                  <ThemedText variant="body" style={{ color: colors.brand.primary, fontWeight: '600', marginLeft: 6 }}>View PDF</ThemedText>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
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
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  list: { paddingHorizontal: Spacing.base, paddingTop: Spacing.sm, paddingBottom: 40 },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    padding: Spacing.base,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  commentBox: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
  },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
  },
});
