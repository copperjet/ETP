/**
 * Front Desk Inquiry CRM — /(app)/(frontdesk)/inquiries
 * Create, view, and update status of school admission inquiries
 */
import React, { useState, useCallback } from 'react';
import {
  View, StyleSheet, SafeAreaView, FlatList,
  TouchableOpacity, TextInput, KeyboardAvoidingView, Platform,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { useTheme } from '../../../lib/theme';
import { useAuthStore } from '../../../stores/authStore';
import { supabase } from '../../../lib/supabase';
import {
  ThemedText, SearchBar, Badge, BottomSheet, FAB,
  SkeletonRow, EmptyState, ErrorState,
} from '../../../components/ui';
import { Spacing, Radius } from '../../../constants/Typography';
import { Colors } from '../../../constants/Colors';
import { haptics } from '../../../lib/haptics';

const STATUS_TABS = ['new', 'in_progress', 'enrolled', 'closed'] as const;
const STATUS_META: Record<string, { label: string; preset: any; color: string }> = {
  new:         { label: 'New',         preset: 'info',    color: Colors.semantic.info },
  in_progress: { label: 'In Progress', preset: 'warning', color: Colors.semantic.warning },
  enrolled:    { label: 'Enrolled',    preset: 'success', color: Colors.semantic.success },
  closed:      { label: 'Closed',      preset: 'neutral', color: '#9CA3AF' },
};

const NATURES = ['Admission', 'Re-Enrollment', 'Fee Query', 'General', 'Transfer', 'Other'] as const;

function useInquiries(schoolId: string, status: string) {
  return useQuery({
    queryKey: ['inquiries', schoolId, status],
    enabled: !!schoolId,
    staleTime: 1000 * 30,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('inquiries')
        .select('id, name, contact_phone, contact_email, nature_of_inquiry, date, status, notes, created_at')
        .eq('school_id', schoolId)
        .eq('status', status)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export default function InquiriesScreen() {
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const schoolId = user?.schoolId ?? '';

  const [activeTab, setActiveTab] = useState<string>('new');
  const [search, setSearch] = useState('');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [detailSheet, setDetailSheet] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState<any | null>(null);

  // New inquiry form state
  const [form, setForm] = useState({
    name: '', phone: '', email: '', nature: 'Admission', notes: '',
  });

  const { data, isLoading, isError, refetch, isFetching } = useInquiries(schoolId, activeTab);

  const createInquiry = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error('Name required');
      const { error } = await (supabase as any)
        .from('inquiries')
        .insert({
          school_id: schoolId,
          name: form.name.trim(),
          contact_phone: form.phone.trim() || null,
          contact_email: form.email.trim() || null,
          nature_of_inquiry: form.nature,
          notes: form.notes.trim() || null,
          created_by: user?.staffId,
          status: 'new',
        });
      if (error) throw error;
    },
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['inquiries'] });
      setSheetVisible(false);
      setForm({ name: '', phone: '', email: '', nature: 'Admission', notes: '' });
    },
    onError: () => haptics.error(),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase as any)
        .from('inquiries')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('school_id', schoolId);
      if (error) throw error;
    },
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['inquiries'] });
      setDetailSheet(false);
    },
    onError: () => haptics.error(),
  });

  const filtered = (data ?? []).filter(
    (i: any) => !search || i.name.toLowerCase().includes(search.toLowerCase()) || (i.contact_phone ?? '').includes(search)
  );

  if (isError) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <ErrorState title="Could not load inquiries" description="Try again." onRetry={refetch} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <ThemedText variant="h4">Inquiries</ThemedText>
      </View>

      {/* Status tabs */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {STATUS_TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tab, activeTab === tab && { borderBottomColor: colors.brand.primary, borderBottomWidth: 2 }]}
          >
            <ThemedText variant="bodySm" style={{ fontWeight: activeTab === tab ? '700' : '500', color: activeTab === tab ? colors.brand.primary : colors.textMuted }}>
              {STATUS_META[tab].label}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: Spacing.base, paddingTop: Spacing.sm }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search by name or phone…" />
      </View>

      {isLoading ? (
        <View style={{ padding: Spacing.base, gap: Spacing.sm }}>
          {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={search ? `No results for "${search}"` : `No ${STATUS_META[activeTab].label.toLowerCase()} inquiries`}
          description={!search && activeTab === 'new' ? 'Tap + to log a new inquiry.' : ''}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} />}
          renderItem={({ item: inq }) => (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/(app)/(frontdesk)/inquiry-detail' as any, params: { inquiry_id: inq.id } })}
              activeOpacity={0.8}
              style={[styles.inqRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.inqAvatar, { backgroundColor: STATUS_META[inq.status].color + '18' }]}>
                <ThemedText variant="h4" style={{ color: STATUS_META[inq.status].color }}>
                  {(inq.name ?? '?')[0].toUpperCase()}
                </ThemedText>
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText variant="body" style={{ fontWeight: '600' }}>{inq.name}</ThemedText>
                {inq.nature_of_inquiry && (
                  <ThemedText variant="caption" color="muted">{inq.nature_of_inquiry}</ThemedText>
                )}
                {inq.contact_phone && (
                  <ThemedText variant="caption" color="muted">{inq.contact_phone}</ThemedText>
                )}
                <ThemedText variant="caption" color="muted">
                  {inq.date ? format(parseISO(inq.date), 'd MMM yyyy') : ''}
                </ThemedText>
              </View>
              <Badge label={STATUS_META[inq.status].label} preset={STATUS_META[inq.status].preset} />
            </TouchableOpacity>
          )}
        />
      )}

      {/* FAB */}
      <FAB
        icon={<Ionicons name="add" size={26} color="#fff" />}
        label="New Inquiry"
        onPress={() => setSheetVisible(true)}
        color={colors.brand.primary}
      />

      {/* Create sheet */}
      <BottomSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        title="New Inquiry"
        snapHeight={560}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ gap: Spacing.base }}>
            {[
              { key: 'name', label: 'FULL NAME *', placeholder: 'Parent / Guardian name', autoFocus: true },
              { key: 'phone', label: 'PHONE', placeholder: '+263 77 000 0000', keyboardType: 'phone-pad' as const },
              { key: 'email', label: 'EMAIL', placeholder: 'example@mail.com', keyboardType: 'email-address' as const },
            ].map(field => (
              <View key={field.key}>
                <ThemedText variant="label" color="muted" style={styles.fieldLabel}>{field.label}</ThemedText>
                <TextInput
                  value={(form as any)[field.key]}
                  onChangeText={v => setForm(prev => ({ ...prev, [field.key]: v }))}
                  placeholder={field.placeholder}
                  placeholderTextColor={colors.textMuted}
                  autoFocus={field.autoFocus}
                  keyboardType={field.keyboardType}
                  style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                />
              </View>
            ))}

            {/* Nature */}
            <View>
              <ThemedText variant="label" color="muted" style={styles.fieldLabel}>NATURE OF INQUIRY</ThemedText>
              <View style={styles.chipRow}>
                {NATURES.map(n => (
                  <TouchableOpacity
                    key={n}
                    onPress={() => setForm(prev => ({ ...prev, nature: n }))}
                    style={[styles.chip, { borderColor: form.nature === n ? colors.brand.primary : colors.border, backgroundColor: form.nature === n ? colors.brand.primary + '18' : colors.surfaceSecondary }]}
                  >
                    <ThemedText variant="label" style={{ color: form.nature === n ? colors.brand.primary : colors.textMuted, fontSize: 11, fontWeight: form.nature === n ? '700' : '500' }}>{n}</ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Notes */}
            <View>
              <ThemedText variant="label" color="muted" style={styles.fieldLabel}>NOTES</ThemedText>
              <TextInput
                value={form.notes}
                onChangeText={v => setForm(prev => ({ ...prev, notes: v }))}
                placeholder="Additional notes…"
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surfaceSecondary, borderColor: colors.border, minHeight: 72, textAlignVertical: 'top' }]}
              />
            </View>

            <TouchableOpacity
              onPress={() => createInquiry.mutate()}
              disabled={!form.name.trim() || createInquiry.isPending}
              style={[styles.saveBtn, { backgroundColor: form.name.trim() ? colors.brand.primary : colors.border }]}
            >
              <ThemedText variant="bodyLg" style={{ color: '#fff', fontWeight: '700' }}>
                {createInquiry.isPending ? 'Saving…' : 'Log Inquiry'}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </BottomSheet>

      {/* Detail sheet */}
      <BottomSheet
        visible={detailSheet && !!selectedInquiry}
        onClose={() => setDetailSheet(false)}
        title={selectedInquiry?.name ?? 'Inquiry'}
        snapHeight={440}
      >
        {selectedInquiry && (
          <View style={{ gap: Spacing.base }}>
            {selectedInquiry.contact_phone && (
              <View style={styles.detailRow}>
                <Ionicons name="call-outline" size={16} color={colors.textMuted} />
                <ThemedText variant="body" style={{ marginLeft: Spacing.sm }}>{selectedInquiry.contact_phone}</ThemedText>
              </View>
            )}
            {selectedInquiry.contact_email && (
              <View style={styles.detailRow}>
                <Ionicons name="mail-outline" size={16} color={colors.textMuted} />
                <ThemedText variant="body" style={{ marginLeft: Spacing.sm }}>{selectedInquiry.contact_email}</ThemedText>
              </View>
            )}
            {selectedInquiry.nature_of_inquiry && (
              <View style={styles.detailRow}>
                <Ionicons name="help-circle-outline" size={16} color={colors.textMuted} />
                <ThemedText variant="body" style={{ marginLeft: Spacing.sm }}>{selectedInquiry.nature_of_inquiry}</ThemedText>
              </View>
            )}
            {selectedInquiry.notes && (
              <View style={[styles.notesBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <ThemedText variant="label" color="muted" style={{ marginBottom: 4 }}>NOTES</ThemedText>
                <ThemedText variant="bodySm">{selectedInquiry.notes}</ThemedText>
              </View>
            )}

            <ThemedText variant="label" color="muted" style={styles.fieldLabel}>UPDATE STATUS</ThemedText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
              {STATUS_TABS.filter(s => s !== selectedInquiry.status).map(s => (
                <TouchableOpacity
                  key={s}
                  onPress={() => updateStatus.mutate({ id: selectedInquiry.id, status: s })}
                  disabled={updateStatus.isPending}
                  style={[styles.statusBtn, { borderColor: STATUS_META[s].color, backgroundColor: STATUS_META[s].color + '18' }]}
                >
                  <ThemedText variant="bodySm" style={{ color: STATUS_META[s].color, fontWeight: '600' }}>
                    → {STATUS_META[s].label}
                  </ThemedText>
                </TouchableOpacity>
              ))}
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
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBar: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  list: { paddingHorizontal: Spacing.base, paddingTop: Spacing.sm, paddingBottom: 120 },
  inqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
  inqAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: { marginBottom: Spacing.sm, letterSpacing: 0.5, fontSize: 11 },
  input: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 15,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1.5,
  },
  saveBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center' },
  notesBox: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statusBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1.5,
  },
});
