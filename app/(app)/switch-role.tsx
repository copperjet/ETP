/**
 * Role Switcher — /(app)/switch-role
 * For users with multiple roles. Shown when user has 2+ roles.
 * Calls switchRole() → navigates back to root which re-routes.
 */
import React from 'react';
import {
  View, StyleSheet, SafeAreaView, TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';
import { useAuthStore } from '../../stores/authStore';
import { ThemedText } from '../../components/ui';
import { Spacing, Radius } from '../../constants/Typography';
import { Colors } from '../../constants/Colors';
import { haptics } from '../../lib/haptics';
import type { UserRole } from '../../types/database';

const ROLE_META: Record<UserRole, { label: string; icon: string; color: string; description: string }> = {
  hrt:        { label: 'Class Teacher (HRT)', icon: 'people',          color: '#1B2A4A', description: 'Attendance, marks, CREED, day book, reports' },
  st:         { label: 'Subject Teacher',     icon: 'book',            color: '#7C3AED', description: 'Subject assignments and marks entry' },
  admin:      { label: 'Administrator',       icon: 'shield',          color: '#1D4ED8', description: 'School-wide management and approvals' },
  super_admin:{ label: 'Super Admin',         icon: 'shield-checkmark',color: '#1D4ED8', description: 'Full system access across all schools' },
  principal:  { label: 'Principal',          icon: 'ribbon',          color: '#1D4ED8', description: 'School leadership and oversight' },
  coordinator:{ label: 'Coordinator',        icon: 'git-merge',       color: '#1D4ED8', description: 'Academic coordination and scheduling' },
  hod:        { label: 'Head of Department', icon: 'layers',          color: '#1D4ED8', description: 'Departmental marks and staff oversight' },
  finance:    { label: 'Finance',            icon: 'card',            color: '#059669', description: 'Fee clearance and financial reports' },
  front_desk: { label: 'Front Desk',         icon: 'headset',         color: '#D97706', description: 'Admission inquiries and visitor management' },
  parent:     { label: 'Parent',            icon: 'heart',           color: '#DB2777', description: "Your children's progress and reports" },
};

export default function SwitchRoleScreen() {
  const { colors } = useTheme();
  const { user, switchRole } = useAuthStore();

  const roles = user?.roles ?? [];
  const activeRole = user?.activeRole;

  const handleSwitch = (role: UserRole) => {
    if (role === activeRole) {
      router.back();
      return;
    }
    haptics.medium();
    switchRole(role);
    router.replace('/');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <ThemedText variant="h4">Switch Role</ThemedText>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.content}>
        <ThemedText variant="body" color="muted" style={{ marginBottom: Spacing.lg }}>
          You have access to multiple roles. Select the one you want to use.
        </ThemedText>

        {roles.map((role) => {
          const meta = ROLE_META[role] ?? { label: role, icon: 'person', color: colors.brand.primary, description: '' };
          const isActive = role === activeRole;
          return (
            <TouchableOpacity
              key={role}
              onPress={() => handleSwitch(role)}
              activeOpacity={0.8}
              style={[
                styles.roleCard,
                {
                  backgroundColor: isActive ? meta.color + '12' : colors.surface,
                  borderColor: isActive ? meta.color : colors.border,
                  borderWidth: isActive ? 2 : StyleSheet.hairlineWidth,
                },
              ]}
            >
              <View style={[styles.roleIcon, { backgroundColor: meta.color + '18' }]}>
                <Ionicons name={meta.icon as any} size={24} color={meta.color} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText variant="body" style={{ fontWeight: '700', color: isActive ? meta.color : colors.textPrimary }}>
                  {meta.label}
                </ThemedText>
                <ThemedText variant="caption" color="muted">{meta.description}</ThemedText>
              </View>
              {isActive ? (
                <View style={[styles.activeDot, { backgroundColor: meta.color }]}>
                  <Ionicons name="checkmark" size={14} color="#fff" />
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
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
  content: {
    flex: 1,
    padding: Spacing.base,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    borderRadius: Radius.lg,
    gap: Spacing.md,
  },
  roleIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
