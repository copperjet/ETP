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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../../lib/theme';
import { useAuthStore } from '../../../stores/authStore';
import { supabase } from '../../../lib/supabase';
import {
  ThemedText, Avatar, FAB, BottomSheet,
  Skeleton, EmptyState, ErrorState, SearchBar,
} from '../../../components/ui';
import { Spacing, Radius } from '../../../constants/Typography';
import { Colors } from '../../../constants/Colors';
import { haptics } from '../../../lib/haptics';

interface FinanceStudent {
  id: string;
  student_id: string;
  status: 'paid' | 'unpaid';
  balance: number;
  students: {
    id: string;
    full_name: string;
    student_number: string;
    photo_url: string | null;
    grades: { name: string } | null;
    streams: { name: string } | null;
  };
}

function useFinanceRecords(schoolId: string) {
  return useQuery({
    queryKey: ['finance-records', schoolId],
    enabled: !!schoolId,
    staleTime: 1000 * 30,
    queryFn: async () => {
      const { data: sem } = await supabase
        .from('semesters')
        .select('id, name')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .limit(1)
        .single();

      const semesterId = (sem as any)?.id;
      if (!semesterId) return { records: [], semester: null };

      const { data, error } = await supabase
        .from('finance_records')
        .select(`
          id, student_id, status, balance,
          students (
            id, full_name, student_number, photo_url,
            grades ( name ),
            streams ( name )
          )
        `)
        .eq('school_id', schoolId)
        .eq('semester_id', semesterId)
        .order('status', { ascending: true });

      if (error) throw error;
      return { records: (data ?? []) as unknown as FinanceStudent[], semester: sem };
    },
  });
}

export default function FinanceHome() {
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const schoolId = user?.schoolId ?? '';

  const { data, isLoading, isError, refetch, isRefetching } = useFinanceRecords(schoolId);

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkSheetVisible, setBulkSheetVisible] = useState(false);

  const records = data?.records ?? [];
  const semester = data?.semester as any;

  const paid       = records.filter(r => r.status === 'paid').length;
  const unpaid     = records.filter(r => r.status === 'unpaid').length;
  const outstanding = records.reduce((sum, r) => sum + Number(r.balance), 0);

  const filtered = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.toLowerCase();
    return records.filter(r =>
      r.students?.full_name?.toLowerCase().includes(q) ||
      r.students?.student_number?.toLowerCase().includes(q)
    );
  }, [records, search]);

  const unpaidFiltered = filtered.filter(r => r.status === 'unpaid');
  const hasSelection = selected.size > 0;

  const toggleSelect = useCallback((id: string) => {
    haptics.selection();
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const selectAllUnpaid = () => {
    haptics.medium();
    setSelected(new Set(unpaidFiltered.map(r => r.id)));
  };

  const bulkClear = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await (supabase.from('finance_records') as any)
        .update({ status: 'paid', balance: 0, updated_by: user?.staffId, updated_at: new Date().toISOString() })
        .in('id', ids);
      if (error) throw error;
      supabase.from('audit_logs').insert({
        school_id: schoolId,
        event_type: 'finance_status_changed',
        actor_id: user?.staffId,
        data: { action: 'bulk_clear_paid', count: ids.length },
      } as any).then(() => {});
    },
    onSuccess: () => {
      haptics.success();
      setSelected(new Set());
      setBulkSheetVisible(false);
      queryClient.invalidateQueries({ queryKey: ['finance-records'] });
    },
    onError: () => haptics.error(),
  });

  if (isError) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <ErrorState title="Could not load finance" description="Check your connection and try again." onRetry={refetch} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View>
          <ThemedText variant="h4">Finance</ThemedText>
          <ThemedText variant="caption" color="muted">
            {isLoading ? 'Loading…' : semester?.name ?? 'Active Semester'}
          </ThemedText>
        </View>
        {!hasSelection && (
          <TouchableOpacity
            onPress={() => router.push('/(app)/(finance)/finance-reports' as any)}
            style={[styles.bulkClearBtn, { backgroundColor: colors.brand.primary }]}
          >
            <Ionicons name="document-text-outline" size={16} color="#fff" />
            <ThemedText variant="bodySm" style={{ color: '#fff', fontWeight: '700', marginLeft: 4 }}>
              Reports
            </ThemedText>
          </TouchableOpacity>
        )}
        {hasSelection && (
          <TouchableOpacity
            onPress={() => setBulkSheetVisible(true)}
            style={[styles.bulkClearBtn, { backgroundColor: Colors.semantic.success }]}
          >
            <Ionicons name="checkmark-done" size={16} color="#fff" />
            <ThemedText variant="bodySm" style={{ color: '#fff', fontWeight: '700', marginLeft: 4 }}>
              Clear {selected.size}
            </ThemedText>
          </TouchableOpacity>
        )}
      </View>

      {/* Summary cards */}
      {isLoading ? (
        <View style={styles.statsRow}>
          {[1, 2, 3].map(i => <Skeleton key={i} width="30%" height={72} radius={Radius.lg} />)}
        </View>
      ) : (
        <View style={styles.statsRow}>
          <StatCard label="Paid" value={String(paid)} color={Colors.semantic.success} icon="checkmark-circle" />
          <StatCard label="Unpaid" value={String(unpaid)} color={Colors.semantic.error} icon="close-circle" />
          <StatCard
            label="Outstanding"
            value={outstanding > 0 ? formatAmount(outstanding) : '0'}
            color={outstanding > 0 ? Colors.semantic.warning : Colors.semantic.success}
            icon="cash-outline"
          />
        </View>
      )}

      {/* Search + select-all */}
      <View style={styles.searchRow}>
        <View style={{ flex: 1 }}>
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search student…" />
        </View>
        {unpaidFiltered.length > 0 && (
          <TouchableOpacity
            onPress={selectAllUnpaid}
            style={[styles.selectAllBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
          >
            <ThemedText variant="bodySm" style={{ color: colors.brand.primary, fontWeight: '600' }}>
              Select all unpaid
            </ThemedText>
          </TouchableOpacity>
        )}
      </View>

      {/* Student list */}
      {isLoading ? (
        <View style={styles.skeletonList}>
          {Array.from({ length: 8 }).map((_, i) => (
            <View key={i} style={styles.skeletonRow}>
              <Skeleton width={40} height={40} radius={20} />
              <View style={{ flex: 1, marginLeft: Spacing.md, gap: 6 }}>
                <Skeleton width="55%" height={14} />
                <Skeleton width="35%" height={11} />
              </View>
              <Skeleton width={64} height={28} radius={14} />
            </View>
          ))}
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={search ? 'No results' : 'No fee records'}
          description={search ? 'Try a different name or student number.' : 'No finance records for this semester.'}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand.primary} />}
          renderItem={({ item }) => (
            <FinanceRow
              record={item}
              selected={selected.has(item.id)}
              onPress={() => router.push({
                pathname: '/(app)/(finance)/student-finance',
                params: { finance_record_id: item.id, student_name: item.students?.full_name },
              } as any)}
              onLongPress={() => toggleSelect(item.id)}
              onToggleSelect={() => toggleSelect(item.id)}
              colors={colors}
            />
          )}
        />
      )}

      {/* FAB — shortcut when nothing manually selected */}
      {!hasSelection && unpaid > 0 && (
        <FAB
          icon={<Ionicons name="checkmark-done" size={22} color="#fff" />}
          label={`Mark all ${unpaid} paid`}
          onPress={() => { selectAllUnpaid(); setBulkSheetVisible(true); }}
          color={Colors.semantic.success}
        />
      )}

      {/* Bulk clear sheet */}
      <BottomSheet
        visible={bulkSheetVisible}
        onClose={() => { setBulkSheetVisible(false); }}
        title={`Clear ${selected.size} student${selected.size !== 1 ? 's' : ''}?`}
        snapHeight={260}
      >
        <View style={{ gap: Spacing.md, paddingTop: Spacing.sm }}>
          <ThemedText variant="body" color="secondary">
            Mark {selected.size} student{selected.size !== 1 ? 's' : ''} as{' '}
            <ThemedText variant="body" style={{ color: Colors.semantic.success, fontWeight: '700' }}>Paid</ThemedText>
            {' '}and set their balance to zero.
          </ThemedText>
          <TouchableOpacity
            onPress={() => bulkClear.mutate(Array.from(selected))}
            disabled={bulkClear.isPending}
            style={[styles.confirmBtn, { backgroundColor: Colors.semantic.success, opacity: bulkClear.isPending ? 0.7 : 1 }]}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <ThemedText variant="bodyLg" style={{ color: '#fff', fontWeight: '700', marginLeft: Spacing.sm }}>
              {bulkClear.isPending ? 'Saving…' : 'Confirm — Mark Paid'}
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setBulkSheetVisible(false)}
            style={[styles.cancelBtn, { backgroundColor: colors.surfaceSecondary }]}
          >
            <ThemedText variant="body" color="muted">Cancel</ThemedText>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function FinanceRow({ record, selected, onPress, onLongPress, onToggleSelect, colors }: {
  record: FinanceStudent; selected: boolean;
  onPress: () => void; onLongPress: () => void; onToggleSelect: () => void;
  colors: any;
}) {
  const paid = record.status === 'paid';
  const statusColor = paid ? Colors.semantic.success : Colors.semantic.error;

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.8}
      style={[
        styles.row,
        {
          backgroundColor: selected ? Colors.semantic.success + '10' : colors.surface,
          borderColor: selected ? Colors.semantic.success : colors.border,
        },
      ]}
    >
      <TouchableOpacity onPress={onToggleSelect} style={styles.checkbox} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
        <View style={[
          styles.checkboxInner,
          { backgroundColor: selected ? Colors.semantic.success : 'transparent', borderColor: selected ? Colors.semantic.success : colors.border },
        ]}>
          {selected && <Ionicons name="checkmark" size={12} color="#fff" />}
        </View>
      </TouchableOpacity>

      <Avatar name={record.students?.full_name ?? '?'} photoUrl={record.students?.photo_url} size={40} />

      <View style={styles.rowInfo}>
        <ThemedText variant="body" style={{ fontWeight: '600' }}>{record.students?.full_name}</ThemedText>
        <ThemedText variant="caption" color="muted">
          {record.students?.student_number} · {record.students?.grades?.name} {record.students?.streams?.name}
        </ThemedText>
      </View>

      <View style={styles.rowRight}>
        {!paid && Number(record.balance) > 0 && (
          <ThemedText variant="bodySm" style={{ color: Colors.semantic.error, fontWeight: '700', marginBottom: 2 }}>
            {formatAmount(Number(record.balance))}
          </ThemedText>
        )}
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
          <ThemedText variant="caption" style={{ color: statusColor, fontWeight: '700', fontSize: 10 }}>
            {paid ? 'PAID' : 'UNPAID'}
          </ThemedText>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginLeft: 4 }} />
    </TouchableOpacity>
  );
}

function StatCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: string }) {
  return (
    <View style={[styles.statCard, { backgroundColor: color + '12', borderColor: color + '30' }]}>
      <Ionicons name={icon as any} size={18} color={color} />
      <ThemedText variant="h4" style={{ color, marginTop: 4 }}>{value}</ThemedText>
      <ThemedText variant="caption" style={{ color: color + 'CC' }}>{label}</ThemedText>
    </View>
  );
}

function formatAmount(v: number): string {
  return v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bulkClearBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: Radius.full },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.base, paddingVertical: Spacing.md },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, gap: 2 },
  searchRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm, alignItems: 'center' },
  selectAllBtn: { paddingHorizontal: Spacing.sm, paddingVertical: 8, borderRadius: Radius.md, borderWidth: 1 },
  skeletonList: { padding: Spacing.base, gap: Spacing.md },
  skeletonRow: { flexDirection: 'row', alignItems: 'center' },
  list: { paddingHorizontal: Spacing.base, paddingBottom: 120 },
  row: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, marginBottom: Spacing.sm, borderRadius: Radius.lg, borderWidth: 1, gap: Spacing.sm },
  checkbox: { justifyContent: 'center', alignItems: 'center' },
  checkboxInner: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  rowInfo: { flex: 1, gap: 2 },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, borderRadius: Radius.lg },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.md, borderRadius: Radius.lg },
});
