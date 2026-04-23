import React from 'react';
import { View, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useTheme } from '../../../lib/theme';
import { useAuthStore } from '../../../stores/authStore';
import { supabase } from '../../../lib/supabase';
import { ThemedText, Avatar, Card, FAB, SkeletonRow, ErrorState } from '../../../components/ui';
import { Spacing, Radius } from '../../../constants/Typography';
import { Colors } from '../../../constants/Colors';

const TODAY = format(new Date(), 'EEEE, d MMMM');
const TODAY_DATE = format(new Date(), 'yyyy-MM-dd');

const STATUS_META = [
  { key: 'new',         label: 'New',         color: Colors.semantic.info,    icon: 'add-circle-outline' },
  { key: 'in_progress', label: 'In Progress', color: Colors.semantic.warning, icon: 'time-outline' },
  { key: 'enrolled',   label: 'Enrolled',    color: Colors.semantic.success,  icon: 'checkmark-circle-outline' },
  { key: 'closed',     label: 'Closed',      color: '#9CA3AF',                icon: 'close-circle-outline' },
] as const;

function useFrontDeskDashboard(schoolId: string) {
  return useQuery({
    queryKey: ['frontdesk-dashboard', schoolId],
    enabled: !!schoolId,
    staleTime: 1000 * 30,
    queryFn: async () => {
      const [allRes, todayRes] = await Promise.all([
        (supabase as any).from('inquiries').select('id, status').eq('school_id', schoolId),
        (supabase as any).from('inquiries').select('id, status').eq('school_id', schoolId).eq('date', TODAY_DATE),
      ]);
      const all = (allRes.data ?? []) as any[];
      const today = (todayRes.data ?? []) as any[];
      const counts: Record<string, number> = {};
      const todayCounts: Record<string, number> = {};
      STATUS_META.forEach(s => { counts[s.key] = 0; todayCounts[s.key] = 0; });
      all.forEach((i: any) => { if (counts[i.status] !== undefined) counts[i.status]++; });
      today.forEach((i: any) => { if (todayCounts[i.status] !== undefined) todayCounts[i.status]++; });
      return { counts, todayCounts, totalToday: today.length, totalAll: all.length };
    },
  });
}

export default function FrontDeskHome() {
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const { data, isLoading, isError, refetch, isFetching } = useFrontDeskDashboard(user?.schoolId ?? '');

  if (isError) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <ErrorState title="Could not load dashboard" description="Check your connection and try again." onRetry={refetch} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} />}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <ThemedText variant="h3">Front Desk</ThemedText>
            <ThemedText variant="bodySm" color="muted">{TODAY}</ThemedText>
          </View>
          <Avatar name={user?.fullName ?? 'F'} size={42} />
        </View>

        {/* Today summary */}
        <ThemedText variant="label" color="muted" style={styles.sectionLabel}>TODAY'S INQUIRIES</ThemedText>
        {isLoading ? (
          <Card style={[styles.card, { marginHorizontal: Spacing.base }]}><SkeletonRow lines={2} /></Card>
        ) : (
          <Card style={[styles.statsCard, { marginHorizontal: Spacing.base, borderColor: colors.border }]}>
            <View style={styles.statsRow}>
              {STATUS_META.map(s => (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => router.push('/(app)/(frontdesk)/inquiries' as any)}
                  style={styles.statItem}
                  activeOpacity={0.7}
                >
                  <View style={[styles.statIcon, { backgroundColor: s.color + '18' }]}>
                    <Ionicons name={s.icon as any} size={18} color={s.color} />
                  </View>
                  <ThemedText variant="h3" style={{ color: s.color }}>
                    {data?.todayCounts[s.key] ?? 0}
                  </ThemedText>
                  <ThemedText variant="caption" color="muted" style={{ textAlign: 'center', fontSize: 10 }}>{s.label}</ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </Card>
        )}

        {/* All-time totals */}
        <ThemedText variant="label" color="muted" style={styles.sectionLabel}>ALL TIME</ThemedText>
        {isLoading ? (
          <Card style={[styles.card, { marginHorizontal: Spacing.base }]}><SkeletonRow lines={2} /></Card>
        ) : (
          <Card style={[styles.statsCard, { marginHorizontal: Spacing.base, borderColor: colors.border }]}>
            <View style={styles.statsRow}>
              {STATUS_META.map(s => (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => router.push('/(app)/(frontdesk)/inquiries' as any)}
                  style={styles.statItem}
                  activeOpacity={0.7}
                >
                  <ThemedText variant="h3" style={{ color: colors.textPrimary }}>
                    {data?.counts[s.key] ?? 0}
                  </ThemedText>
                  <ThemedText variant="caption" color="muted" style={{ textAlign: 'center', fontSize: 10 }}>{s.label}</ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </Card>
        )}

        {/* Quick tip */}
        <View style={[styles.tipRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Ionicons name="bulb-outline" size={16} color={colors.brand.secondary} />
          <ThemedText variant="caption" color="muted" style={{ flex: 1 }}>
            Tap + to log a new inquiry instantly. All fields except name are optional.
          </ThemedText>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <FAB
        icon={<Ionicons name="add" size={26} color="#fff" />}
        label="New Inquiry"
        onPress={() => router.push('/(app)/(frontdesk)/inquiries' as any)}
        color={colors.brand.primary}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingTop: Spacing.xl, paddingBottom: Spacing.base },
  sectionLabel: { paddingHorizontal: Spacing.base, marginTop: Spacing.lg, marginBottom: Spacing.sm, letterSpacing: 0.6, fontSize: 11 },
  card: { padding: Spacing.base },
  statsCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.lg, padding: Spacing.base },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center', gap: 4, minWidth: 60 },
  statIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginHorizontal: Spacing.base, marginTop: Spacing.lg, padding: Spacing.md, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth },
});
