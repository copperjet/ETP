/**
 * Notification Inbox — /(app)/notifications
 * Shared by all roles. Shows last 90 days of in-app notifications.
 * Mark as read on open. Badge count driven by unread count.
 */
import React, { useCallback } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, subDays, parseISO, isToday, isYesterday } from 'date-fns';
import { useTheme } from '../../lib/theme';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { ThemedText, Skeleton, EmptyState, ErrorState } from '../../components/ui';
import { Spacing, Radius } from '../../constants/Typography';
import { Colors } from '../../constants/Colors';
import { haptics } from '../../lib/haptics';

const NINETY_DAYS_AGO = subDays(new Date(), 90).toISOString();

const TYPE_META: Record<string, { icon: string; color: string }> = {
  attendance_submitted:   { icon: 'checkmark-circle-outline', color: Colors.semantic.success },
  report_submitted:       { icon: 'document-text-outline',    color: Colors.semantic.info },
  report_approved:        { icon: 'shield-checkmark-outline', color: Colors.semantic.success },
  report_released:        { icon: 'gift-outline',             color: Colors.semantic.success },
  report_rejected:        { icon: 'close-circle-outline',     color: Colors.semantic.error },
  daybook_note:           { icon: 'book-outline',             color: Colors.semantic.warning },
  finance_cleared:        { icon: 'card-outline',             color: Colors.semantic.success },
  system:                 { icon: 'information-circle-outline', color: Colors.semantic.info },
};

function formatNotifDate(dateStr: string): string {
  const d = parseISO(dateStr);
  if (isToday(d)) return `Today ${format(d, 'h:mm a')}`;
  if (isYesterday(d)) return `Yesterday ${format(d, 'h:mm a')}`;
  return format(d, 'd MMM yyyy');
}

function useNotifications(userId: string, schoolId: string) {
  return useQuery({
    queryKey: ['notifications', userId, schoolId],
    enabled: !!userId && !!schoolId,
    staleTime: 1000 * 30,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('notifications')
        .select('id, type, title, body, is_read, created_at, data')
        .eq('school_id', schoolId)
        .eq('recipient_id', userId)
        .gte('created_at', NINETY_DAYS_AGO)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useNotifications(user?.id ?? '', user?.schoolId ?? '');

  const markRead = useMutation({
    mutationFn: async (notifId: string) => {
      await (supabase as any)
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notifId)
        .eq('recipient_id', user?.id ?? '');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await (supabase as any)
        .from('notifications')
        .update({ is_read: true })
        .eq('school_id', user?.schoolId ?? '')
        .eq('recipient_id', user?.id ?? '')
        .eq('is_read', false);
    },
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });

  const getDeepLink = (notif: any): string | null => {
    const role = user?.activeRole;
    switch (notif.type) {
      case 'report_submitted':
      case 'report_approved':
      case 'report_rejected':
        return role === 'admin' ? '/(app)/(admin)/reports' : '/(app)/(hrt)/reports';
      case 'report_released':
        return role === 'parent' ? '/(app)/(parent)/home' : '/(app)/(admin)/reports';
      case 'daybook_note':
        return role === 'parent' ? '/(app)/(parent)/home' : '/(app)/(hrt)/daybook';
      case 'attendance_submitted':
        return role === 'hrt' ? '/(app)/(hrt)/attendance' : null;
      case 'finance_cleared':
        return null;
      default:
        return null;
    }
  };

  const handlePress = useCallback((notif: any) => {
    if (!notif.is_read) markRead.mutate(notif.id);
    haptics.selection();
    const link = getDeepLink(notif);
    if (link) router.push(link as any);
  }, [markRead, user?.activeRole]);

  const unreadCount = (data ?? []).filter((n: any) => !n.is_read).length;
  const notifications = data ?? [];

  if (isError) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <ErrorState title="Could not load notifications" description="Try again." onRetry={refetch} />
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
          <ThemedText variant="h4">Notifications</ThemedText>
          {unreadCount > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: colors.brand.primary }]}>
              <ThemedText variant="label" style={{ color: '#fff', fontSize: 10 }}>{unreadCount}</ThemedText>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={() => markAllRead.mutate()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ThemedText variant="bodySm" style={{ color: colors.brand.primary, fontWeight: '600' }}>Mark all read</ThemedText>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={{ padding: Spacing.base, gap: Spacing.md }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
              <Skeleton width={40} height={40} radius={20} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width="70%" height={14} />
                <Skeleton width="90%" height={11} />
                <Skeleton width="40%" height={10} />
              </View>
            </View>
          ))}
        </View>
      ) : notifications.length === 0 ? (
        <EmptyState
          title="No notifications"
          description="You're all caught up! Notifications appear here for the last 90 days."
        />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={n => n.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: notif }) => {
            const meta = TYPE_META[notif.type] ?? TYPE_META.system;
            const isUnread = !notif.is_read;
            const hasLink = !!getDeepLink(notif);
            return (
              <TouchableOpacity
                onPress={() => handlePress(notif)}
                activeOpacity={0.8}
                style={[
                  styles.notifRow,
                  {
                    backgroundColor: isUnread ? colors.brand.primary + '08' : colors.surface,
                    borderColor: isUnread ? colors.brand.primary + '30' : colors.border,
                  },
                ]}
              >
                <View style={[styles.iconWrap, { backgroundColor: meta.color + '18' }]}>
                  <Ionicons name={meta.icon as any} size={20} color={meta.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.notifTitleRow}>
                    <ThemedText variant="body" style={{ fontWeight: isUnread ? '700' : '500', flex: 1 }}>
                      {notif.title}
                    </ThemedText>
                    {isUnread && (
                      <View style={[styles.unreadDot, { backgroundColor: colors.brand.primary }]} />
                    )}
                  </View>
                  {notif.body ? (
                    <ThemedText variant="bodySm" color="muted" numberOfLines={2}>{notif.body}</ThemedText>
                  ) : null}
                  <ThemedText variant="caption" color="muted" style={{ marginTop: 4 }}>
                    {formatNotifDate(notif.created_at)}
                  </ThemedText>
                </View>
                {hasLink && (
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  backBtn: { padding: Spacing.base },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  unreadBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  list: { paddingHorizontal: Spacing.base, paddingTop: Spacing.sm, paddingBottom: 40 },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
});
