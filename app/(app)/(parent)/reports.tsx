/**
 * Parent Reports — list of released report cards for linked children.
 */
import React from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../lib/theme';
import { useAuthStore } from '../../../stores/authStore';
import {
  ThemedText, Avatar, Badge, Skeleton, EmptyState, ErrorState,
} from '../../../components/ui';
import { useParentReports } from '../../../hooks/useReports';
import { Spacing, Radius } from '../../../constants/Typography';
import { Colors } from '../../../constants/Colors';
import { haptics } from '../../../lib/haptics';

export default function ParentReportsScreen() {
  const { colors } = useTheme();
  const { user } = useAuthStore();

  const { data: reports = [], isLoading, isError, refetch } = useParentReports(
    user?.staffId ?? null,   // parentId stored in staffId field for parent role
    user?.schoolId ?? '',
  );

  if (isError) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <ErrorState title="Could not load reports" description="Try again." onRetry={refetch} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <ThemedText variant="h4">Report Cards</ThemedText>
        {reports.length > 0 && (
          <ThemedText variant="caption" color="muted">{reports.length} report{reports.length !== 1 ? 's' : ''}</ThemedText>
        )}
      </View>

      {isLoading ? (
        <View style={{ padding: Spacing.base, gap: Spacing.sm }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={styles.skeletonRow}>
              <Skeleton width={44} height={44} radius={22} />
              <View style={{ flex: 1, marginLeft: 12, gap: 6 }}>
                <Skeleton width="55%" height={14} />
                <Skeleton width="35%" height={11} />
              </View>
              <Skeleton width={70} height={24} radius={Radius.full} />
            </View>
          ))}
        </View>
      ) : reports.length === 0 ? (
        <EmptyState
          title="No reports available"
          description="Your child's report cards will appear here once released by the school."
        />
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: report }) => (
            <TouchableOpacity
              onPress={() => {
                if (!report.pdf_url) return;
                haptics.selection();
                router.push({
                  pathname: '/(app)/report-viewer' as any,
                  params: {
                    report_id: report.id,
                    pdf_url: report.pdf_url,
                    student_name: report.student.full_name,
                    is_draft: 'false',
                  },
                });
              }}
              activeOpacity={report.pdf_url ? 0.8 : 1}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              {/* Accent strip */}
              <View style={[styles.accentStrip, { backgroundColor: Colors.semantic.success }]} />
              <View style={styles.cardBody}>
                <Avatar name={report.student.full_name} photoUrl={report.student.photo_url} size={44} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <ThemedText variant="body" style={{ fontWeight: '700' }}>{report.student.full_name}</ThemedText>
                  <ThemedText variant="caption" color="muted">{report.semester?.name ?? '—'}</ThemedText>
                  {report.overall_percentage !== null && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <View style={[styles.avgChip, { backgroundColor: colors.brand.primary + '15' }]}>
                        <ThemedText variant="label" style={{ color: colors.brand.primary, fontSize: 11 }}>
                          {report.overall_percentage.toFixed(1)}%
                        </ThemedText>
                      </View>
                      {report.class_position !== null && (
                        <View style={[styles.avgChip, { backgroundColor: colors.surfaceSecondary }]}>
                          <ThemedText variant="label" style={{ color: colors.textSecondary, fontSize: 11 }}>
                            #{report.class_position}
                          </ThemedText>
                        </View>
                      )}
                    </View>
                  )}
                </View>
                {report.pdf_url ? (
                  <Ionicons name="document-text" size={22} color={colors.brand.primary} style={{ alignSelf: 'center' }} />
                ) : (
                  <Ionicons name="time-outline" size={20} color={colors.textMuted} style={{ alignSelf: 'center' }} />
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  list: { padding: Spacing.base, paddingBottom: 40, gap: 10 },
  card: {
    flexDirection: 'row',
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  accentStrip: { width: 4 },
  cardBody: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 14 },
  avgChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
});
