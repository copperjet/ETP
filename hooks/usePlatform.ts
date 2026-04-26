import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SchoolUsage {
  id: string;
  name: string;
  code: string;
  subscription_plan: string;
  subscription_status: string;
  country: string | null;
  created_at: string;
  renewal_date: string | null;
  student_count: number;
  staff_count: number;
  report_count: number;
  attendance_count: number;
  monthly_revenue: number;
}

export interface PlatformMetrics {
  summary: {
    mrr: number;
    arr: number;
    total_schools: number;
    active_schools: number;
    trial_schools: number;
    churn_rate_pct: number;
    total_students: number;
    total_staff: number;
  };
  plan_distribution: Record<string, number>;
  status_distribution: Record<string, number>;
  school_growth: { month: string; count: number }[];
  school_usage: SchoolUsage[];
  recent_impersonations: {
    school_id: string;
    target_email: string;
    reason: string | null;
    created_at: string;
  }[];
}

export interface SchoolNote {
  id: string;
  school_id: string;
  author_id: string;
  body: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface ImpersonationLog {
  id: string;
  school_id: string;
  target_email: string;
  reason: string | null;
  expires_at: string | null;
  revoked: boolean;
  created_at: string;
}

// ── Platform metrics ──────────────────────────────────────────────────────────

export function usePlatformMetrics() {
  return useQuery<PlatformMetrics>({
    queryKey: ['platform-metrics'],
    staleTime: 1000 * 60 * 3,
    queryFn: async () => {
      const { data, error } = await (supabase as any).functions.invoke('get-platform-metrics');
      if (error) throw new Error(error.message);
      return data as PlatformMetrics;
    },
  });
}

// ── School notes ──────────────────────────────────────────────────────────────

export function useSchoolNotes(schoolId: string) {
  return useQuery<SchoolNote[]>({
    queryKey: ['school-notes', schoolId],
    enabled: !!schoolId,
    staleTime: 1000 * 60,
    queryFn: async () => {
      const { data, error } = await (supabase as any).functions.invoke('manage-school-notes', {
        body: { action: 'list', school_id: schoolId },
      });
      if (error) throw new Error(error.message);
      return (data?.notes ?? []) as SchoolNote[];
    },
  });
}

export function useCreateSchoolNote(schoolId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { body: string; is_pinned?: boolean }) => {
      const { data, error } = await (supabase as any).functions.invoke('manage-school-notes', {
        body: { action: 'create', school_id: schoolId, ...payload },
      });
      if (error) throw new Error(error.message);
      return data?.note as SchoolNote;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['school-notes', schoolId] });
      qc.invalidateQueries({ queryKey: ['platform-schools-overview'] });
    },
  });
}

export function useDeleteSchoolNote(schoolId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await (supabase as any).functions.invoke('manage-school-notes', {
        body: { action: 'delete', school_id: schoolId, note_id: noteId },
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['school-notes', schoolId] }),
  });
}

export function usePinSchoolNote(schoolId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ noteId, isPinned }: { noteId: string; isPinned: boolean }) => {
      const { error } = await (supabase as any).functions.invoke('manage-school-notes', {
        body: { action: 'pin', school_id: schoolId, note_id: noteId, is_pinned: isPinned },
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['school-notes', schoolId] }),
  });
}

// ── Impersonation ─────────────────────────────────────────────────────────────

export function useImpersonateSchool() {
  return useMutation({
    mutationFn: async (payload: { school_id: string; target_staff_id?: string; reason?: string }) => {
      const { data, error } = await (supabase as any).functions.invoke('impersonate-school', {
        body: payload,
      });
      if (error) throw new Error(error.message);
      return data as {
        success: boolean;
        method: 'magic_link' | 'manual';
        action_link?: string;
        target_email: string;
        school_name: string;
        school_code: string;
        log_id?: string;
        expires_at: string;
        note?: string;
      };
    },
  });
}

// ── Impersonation log ─────────────────────────────────────────────────────────

export function useImpersonationLog(schoolId?: string) {
  return useQuery<ImpersonationLog[]>({
    queryKey: ['platform-impersonation-log', schoolId ?? 'all'],
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const body: Record<string, string> = {};
      if (schoolId) body.school_id = schoolId;
      const { data, error } = await (supabase as any).functions.invoke('get-impersonation-log', { body });
      if (error) throw new Error(error.message);
      return (data?.entries ?? []) as ImpersonationLog[];
    },
  });
}

// ── Update school ─────────────────────────────────────────────────────────────

export function useUpdateSchoolPlatform(schoolId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: {
      subscription_plan?: string;
      subscription_status?: string;
      name?: string;
      logo_url?: string;
      primary_color?: string;
      secondary_color?: string;
      renewal_date?: string;
    }) => {
      const { error } = await (supabase as any).functions.invoke('update-school', {
        body: { school_id: schoolId, ...patch },
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-schools-overview'] });
      qc.invalidateQueries({ queryKey: ['platform-school-detail', schoolId] });
      qc.invalidateQueries({ queryKey: ['platform-metrics'] });
    },
  });
}
