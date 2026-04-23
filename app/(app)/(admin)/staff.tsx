/**
 * Admin Staff Management — /(app)/(admin)/staff
 * View all staff, search, view roles, toggle active/inactive
 */
import React, { useState } from 'react';
import {
  View, StyleSheet, SafeAreaView, FlatList,
  TouchableOpacity, Alert, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { useTheme } from '../../../lib/theme';
import { useAuthStore } from '../../../stores/authStore';
import { supabase } from '../../../lib/supabase';
import {
  ThemedText, Avatar, Badge, SearchBar, BottomSheet,
  SkeletonRow, EmptyState, ErrorState,
} from '../../../components/ui';
import { Spacing, Radius } from '../../../constants/Typography';
import { Colors } from '../../../constants/Colors';
import { haptics } from '../../../lib/haptics';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin', admin: 'Admin', front_desk: 'Front Desk',
  finance: 'Finance', principal: 'Principal', coordinator: 'Coordinator',
  hod: 'HOD', hrt: 'HRT', st: 'Subject Teacher',
};

function useStaff(schoolId: string) {
  return useQuery({
    queryKey: ['admin-staff', schoolId],
    enabled: !!schoolId,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff')
        .select('id, full_name, email, phone, department, status, staff_number, date_joined')
        .eq('school_id', schoolId)
        .order('full_name');
      if (error) throw error;

      const { data: roles } = await supabase
        .from('staff_roles')
        .select('staff_id, role')
        .eq('school_id', schoolId);

      const rolesMap: Record<string, string[]> = {};
      (roles ?? []).forEach((r: any) => {
        if (!rolesMap[r.staff_id]) rolesMap[r.staff_id] = [];
        rolesMap[r.staff_id].push(r.role);
      });

      return (data ?? []).map((s: any) => ({ ...s, roles: rolesMap[s.id] ?? [] })) as any[];
    },
  });
}

export default function AdminStaffScreen() {
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const schoolId = user?.schoolId ?? '';

  const [search, setSearch] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('active');

  const { data, isLoading, isError, refetch, isFetching } = useStaff(schoolId);

  const toggleStatus = useMutation({
    mutationFn: async ({ staffId, currentStatus }: { staffId: string; currentStatus: string }) => {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      const { error } = await (supabase as any)
        .from('staff')
        .update({ status: newStatus })
        .eq('id', staffId)
        .eq('school_id', schoolId);
      if (error) throw error;
      return newStatus;
    },
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['admin-staff'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      setSheetVisible(false);
    },
    onError: () => haptics.error(),
  });

  const handleToggle = (staff: any) => {
    Alert.alert(
      `${staff.status === 'active' ? 'Deactivate' : 'Activate'} Staff`,
      `Are you sure you want to ${staff.status === 'active' ? 'deactivate' : 'activate'} ${staff.full_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: staff.status === 'active' ? 'Deactivate' : 'Activate',
          style: staff.status === 'active' ? 'destructive' : 'default',
          onPress: () => toggleStatus.mutate({ staffId: staff.id, currentStatus: staff.status }),
        },
      ]
    );
  };

  const allStaff = data ?? [];
  const filtered = allStaff
    .filter(s => filterActive === 'all' ? true : s.status === filterActive)
    .filter(s =>
      !search ||
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (s.staff_number ?? '').toLowerCase().includes(search.toLowerCase())
    );

  if (isError) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <ErrorState title="Could not load staff" description="Try again." onRetry={refetch} />
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
        <ThemedText variant="h4">Staff ({allStaff.filter(s => s.status === 'active').length} active)</ThemedText>
        <View style={{ width: 36 }} />
      </View>

      {/* Search + filter */}
      <View style={{ paddingHorizontal: Spacing.base, paddingTop: Spacing.sm, gap: Spacing.sm }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search by name, email, ID…" />
        <View style={styles.filterRow}>
          {(['active', 'all', 'inactive'] as const).map(f => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilterActive(f)}
              style={[styles.filterChip, { borderColor: filterActive === f ? colors.brand.primary : colors.border, backgroundColor: filterActive === f ? colors.brand.primary + '14' : colors.surfaceSecondary }]}
            >
              <ThemedText variant="bodySm" style={{ color: filterActive === f ? colors.brand.primary : colors.textMuted, fontWeight: filterActive === f ? '700' : '500', textTransform: 'capitalize' }}>
                {f}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={{ padding: Spacing.base, gap: Spacing.sm }}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={search ? `No results for "${search}"` : 'No staff found'}
          description={!search ? 'Staff will appear here once added.' : ''}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={s => s.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} />}
          renderItem={({ item: staff }) => (
            <TouchableOpacity
              onPress={() => { setSelectedStaff(staff); setSheetVisible(true); }}
              activeOpacity={0.8}
              style={[styles.staffRow, { backgroundColor: colors.surface, borderColor: colors.border, opacity: staff.status === 'inactive' ? 0.6 : 1 }]}
            >
              <Avatar name={staff.full_name} size={44} />
              <View style={{ flex: 1 }}>
                <ThemedText variant="body" style={{ fontWeight: '600' }}>{staff.full_name}</ThemedText>
                <ThemedText variant="caption" color="muted">{staff.staff_number} · {staff.email}</ThemedText>
                {staff.roles.length > 0 && (
                  <View style={styles.roleChips}>
                    {staff.roles.slice(0, 3).map((r: string) => (
                      <View key={r} style={[styles.roleChip, { backgroundColor: colors.brand.primary + '14' }]}>
                        <ThemedText variant="label" style={{ color: colors.brand.primary, fontSize: 10 }}>
                          {ROLE_LABELS[r] ?? r}
                        </ThemedText>
                      </View>
                    ))}
                    {staff.roles.length > 3 && (
                      <ThemedText variant="caption" color="muted">+{staff.roles.length - 3}</ThemedText>
                    )}
                  </View>
                )}
              </View>
              <Badge label={staff.status} preset={staff.status === 'active' ? 'success' : 'neutral'} />
            </TouchableOpacity>
          )}
        />
      )}

      {/* Staff detail sheet */}
      <BottomSheet
        visible={sheetVisible && !!selectedStaff}
        onClose={() => setSheetVisible(false)}
        title={selectedStaff?.full_name ?? 'Staff'}
        snapHeight={460}
      >
        {selectedStaff && (
          <View style={{ gap: Spacing.base }}>
            {/* Info rows */}
            {[
              { icon: 'id-card-outline', label: selectedStaff.staff_number },
              { icon: 'mail-outline', label: selectedStaff.email },
              { icon: 'call-outline', label: selectedStaff.phone ?? '—' },
              { icon: 'business-outline', label: selectedStaff.department ?? '—' },
              { icon: 'calendar-outline', label: selectedStaff.date_joined ? `Joined ${format(parseISO(selectedStaff.date_joined), 'd MMM yyyy')}` : '—' },
            ].map(row => (
              <View key={row.icon} style={styles.detailRow}>
                <Ionicons name={row.icon as any} size={16} color={colors.textMuted} />
                <ThemedText variant="body" style={{ marginLeft: Spacing.sm, flex: 1 }}>{row.label}</ThemedText>
              </View>
            ))}

            {/* Roles */}
            {selectedStaff.roles.length > 0 && (
              <View>
                <ThemedText variant="label" color="muted" style={{ marginBottom: Spacing.sm }}>ROLES</ThemedText>
                <View style={styles.roleChips}>
                  {selectedStaff.roles.map((r: string) => (
                    <View key={r} style={[styles.roleChip, { backgroundColor: colors.brand.primary + '18' }]}>
                      <ThemedText variant="label" style={{ color: colors.brand.primary }}>{ROLE_LABELS[r] ?? r}</ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Toggle status */}
            <TouchableOpacity
              onPress={() => handleToggle(selectedStaff)}
              disabled={toggleStatus.isPending}
              style={[
                styles.toggleBtn,
                { borderColor: selectedStaff.status === 'active' ? Colors.semantic.error : Colors.semantic.success },
              ]}
            >
              <Ionicons
                name={selectedStaff.status === 'active' ? 'ban-outline' : 'checkmark-circle-outline'}
                size={18}
                color={selectedStaff.status === 'active' ? Colors.semantic.error : Colors.semantic.success}
              />
              <ThemedText variant="body" style={{ marginLeft: 8, fontWeight: '600', color: selectedStaff.status === 'active' ? Colors.semantic.error : Colors.semantic.success }}>
                {selectedStaff.status === 'active' ? 'Deactivate Account' : 'Reactivate Account'}
              </ThemedText>
            </TouchableOpacity>
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
  filterRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1.5,
  },
  list: { paddingHorizontal: Spacing.base, paddingTop: Spacing.sm, paddingBottom: 40 },
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
  roleChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  roleChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center' },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    marginTop: Spacing.sm,
  },
});
