/**
 * Report hooks — shared across HRT, Admin, Parent views.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// ─── types ────────────────────────────────────────────────────────────────────

export type ReportStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'finance_pending'
  | 'under_review'
  | 'released';

export interface ReportSummary {
  id: string;
  status: ReportStatus;
  hrt_comment: string | null;
  overall_percentage: number | null;
  class_position: number | null;
  pdf_url: string | null;
  released_at: string | null;
  updated_at: string;
  student: {
    id: string;
    full_name: string;
    student_number: string;
    photo_url: string | null;
  };
  semester: { id: string; name: string } | null;
}

export interface ReportVersion {
  id: string;
  version_number: number;
  pdf_url: string;
  verification_token: string;
  is_current: boolean;
  created_at: string;
}

export const STATUS_META: Record<ReportStatus, { label: string; preset: 'success' | 'warning' | 'info' | 'neutral' | 'error'; icon: string }> = {
  draft:            { label: 'Draft',            preset: 'neutral',  icon: 'document-outline' },
  pending_approval: { label: 'Pending Approval', preset: 'warning',  icon: 'time-outline' },
  approved:         { label: 'Approved',         preset: 'info',     icon: 'checkmark-done-outline' },
  finance_pending:  { label: 'Finance Pending',  preset: 'warning',  icon: 'card-outline' },
  under_review:     { label: 'Under Review',     preset: 'info',     icon: 'eye-outline' },
  released:         { label: 'Released',         preset: 'success',  icon: 'checkmark-circle-outline' },
};

// ─── HRT hooks ────────────────────────────────────────────────────────────────

export function useHRTStreamReports(staffId: string | null, schoolId: string) {
  return useQuery<{ reports: ReportSummary[]; semesterId: string | null; streamId: string | null; streamName: string }>({
    queryKey: ['hrt-reports', staffId, schoolId],
    enabled: !!staffId && !!schoolId,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const db = supabase as any;
      const { data: assignment } = await db
        .from('hrt_assignments')
        .select('stream_id, semester_id, streams ( name )')
        .eq('staff_id', staffId!)
        .eq('school_id', schoolId)
        .limit(1)
        .single();
      if (!assignment) return { reports: [], semesterId: null, streamId: null, streamName: '' };

      const { stream_id, semester_id } = assignment;
      const { data: students } = await db
        .from('students')
        .select('id')
        .eq('school_id', schoolId)
        .eq('stream_id', stream_id)
        .eq('status', 'active');
      const studentIds = (students ?? []).map((s: any) => s.id);
      if (studentIds.length === 0) {
        return { reports: [], semesterId: semester_id, streamId: stream_id, streamName: assignment.streams?.name ?? '' };
      }

      const { data, error } = await db
        .from('reports')
        .select(`id, status, hrt_comment, overall_percentage, class_position, pdf_url, released_at, updated_at,
                 students ( id, full_name, student_number, photo_url ),
                 semesters ( id, name )`)
        .eq('school_id', schoolId)
        .eq('semester_id', semester_id)
        .in('student_id', studentIds)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return {
        reports: ((data ?? []) as any[]).map(normaliseReport),
        semesterId: semester_id,
        streamId: stream_id,
        streamName: assignment.streams?.name ?? '',
      };
    },
  });
}

export function useReportVersions(reportId: string | null) {
  return useQuery<ReportVersion[]>({
    queryKey: ['report-versions', reportId],
    enabled: !!reportId,
    staleTime: 1000 * 60,
    queryFn: async () => {
      const db = supabase as any;
      const { data } = await db
        .from('report_versions')
        .select('id, version_number, pdf_url, verification_token, is_current, created_at')
        .eq('report_id', reportId!)
        .order('version_number', { ascending: false });
      return (data ?? []) as ReportVersion[];
    },
  });
}

export function useMarksCompletionForStream(
  streamId: string | null,
  semesterId: string | null,
  schoolId: string,
) {
  return useQuery<{ subjectName: string; entered: number; total: number }[]>({
    queryKey: ['marks-completion-stream', streamId, semesterId, schoolId],
    enabled: !!streamId && !!semesterId && !!schoolId,
    staleTime: 1000 * 60,
    queryFn: async () => {
      const db = supabase as any;
      const [assignmentsRes, studentsRes, marksRes] = await Promise.all([
        db.from('subject_teacher_assignments')
          .select('subject_id, subjects ( name )')
          .eq('stream_id', streamId!)
          .eq('semester_id', semesterId!)
          .eq('school_id', schoolId),
        db.from('students')
          .select('id')
          .eq('stream_id', streamId!)
          .eq('school_id', schoolId)
          .eq('status', 'active'),
        db.from('marks')
          .select('student_id, subject_id')
          .eq('stream_id', streamId!)
          .eq('semester_id', semesterId!)
          .eq('school_id', schoolId)
          .not('value', 'is', null),
      ]);
      const total = (studentsRes.data ?? []).length;
      const assignments: any[] = assignmentsRes.data ?? [];
      const marksBySubject: Record<string, Set<string>> = {};
      ((marksRes.data ?? []) as any[]).forEach((m: any) => {
        if (!marksBySubject[m.subject_id]) marksBySubject[m.subject_id] = new Set();
        marksBySubject[m.subject_id].add(m.student_id);
      });
      return assignments.map((a: any) => ({
        subjectName: a.subjects?.name ?? a.subject_id,
        entered: marksBySubject[a.subject_id]?.size ?? 0,
        total,
      }));
    },
  });
}

// ─── Admin hooks ──────────────────────────────────────────────────────────────

export function useAdminReports(schoolId: string, status: ReportStatus | 'all') {
  return useQuery<ReportSummary[]>({
    queryKey: ['admin-reports', schoolId, status],
    enabled: !!schoolId,
    staleTime: 1000 * 60,
    queryFn: async () => {
      const db = supabase as any;
      let q = db
        .from('reports')
        .select(`id, status, hrt_comment, overall_percentage, class_position, pdf_url, released_at, updated_at,
                 students ( id, full_name, student_number, photo_url ),
                 semesters ( id, name )`)
        .eq('school_id', schoolId)
        .order('updated_at', { ascending: false });
      if (status !== 'all') q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as any[]).map(normaliseReport);
    },
  });
}

export function useAdminReportCounts(schoolId: string) {
  return useQuery<Record<ReportStatus, number>>({
    queryKey: ['admin-report-counts', schoolId],
    enabled: !!schoolId,
    staleTime: 1000 * 60,
    queryFn: async () => {
      const db = supabase as any;
      const { data } = await db
        .from('reports')
        .select('status')
        .eq('school_id', schoolId);
      const counts: Record<string, number> = {};
      ((data ?? []) as any[]).forEach((r: any) => {
        counts[r.status] = (counts[r.status] ?? 0) + 1;
      });
      return counts as Record<ReportStatus, number>;
    },
  });
}

// ─── Parent hooks ─────────────────────────────────────────────────────────────

export function useParentReports(parentId: string | null, schoolId: string) {
  return useQuery<ReportSummary[]>({
    queryKey: ['parent-reports', parentId, schoolId],
    enabled: !!parentId && !!schoolId,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const db = supabase as any;
      const { data: links } = await db
        .from('student_parent_links')
        .select('student_id')
        .eq('parent_id', parentId!);
      const studentIds = (links ?? []).map((l: any) => l.student_id);
      if (studentIds.length === 0) return [];

      const { data, error } = await db
        .from('reports')
        .select(`id, status, hrt_comment, overall_percentage, class_position, pdf_url, released_at, updated_at,
                 students ( id, full_name, student_number, photo_url ),
                 semesters ( id, name )`)
        .eq('school_id', schoolId)
        .eq('status', 'released')
        .in('student_id', studentIds)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map(normaliseReport);
    },
  });
}

// ─── mutations ────────────────────────────────────────────────────────────────

export function useGenerateReportPDF(schoolId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { report_id: string; is_preview?: boolean }) => {
      const { data, error } = await (supabase as any).functions.invoke('generate-report-pdf', {
        body: params,
      });
      if (error) throw error;
      return data as { pdf_url: string; verification_token: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hrt-reports'] }),
  });
}

export function useApproveReport(schoolId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      reportId: string;
      hrtComment: string;
      staffId: string;
    }) => {
      const db = supabase as any;

      // 1. Save comment + set status
      const { error: rErr } = await db
        .from('reports')
        .update({
          status: 'pending_approval',
          hrt_comment: params.hrtComment,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.reportId)
        .eq('school_id', schoolId);
      if (rErr) throw rErr;

      // 2. Get report for student_id + semester_id
      const { data: report } = await db
        .from('reports')
        .select('student_id, semester_id')
        .eq('id', params.reportId)
        .single();

      if (report) {
        // 3. Lock marks for this student + semester
        await db.from('marks')
          .update({ is_locked: true })
          .eq('student_id', report.student_id)
          .eq('semester_id', report.semester_id)
          .eq('school_id', schoolId);

        // 4. Lock CREED
        await db.from('character_records')
          .update({ is_locked: true })
          .eq('student_id', report.student_id)
          .eq('semester_id', report.semester_id)
          .eq('school_id', schoolId);
      }

      // 5. Generate PDF — fire-and-forget
      (supabase as any).functions.invoke('generate-report-pdf', {
        body: { report_id: params.reportId, is_preview: false },
      }).then(() => {}).catch(() => {});
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hrt-reports'] });
      qc.invalidateQueries({ queryKey: ['admin-reports'] });
    },
  });
}

export function useAdminApproveReport(schoolId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { reportId: string; staffId: string }) => {
      const db = supabase as any;
      const { error } = await db
        .from('reports')
        .update({
          status: 'approved',
          approved_by: params.staffId,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.reportId)
        .eq('school_id', schoolId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-reports'] }),
  });
}

export function useReleaseReports(schoolId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { student_ids: string[]; semester_id: string }) => {
      const { error } = await (supabase as any).functions.invoke('release-report', {
        body: { ...params, school_id: schoolId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-reports'] });
      qc.invalidateQueries({ queryKey: ['admin-report-counts'] });
    },
  });
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function normaliseReport(r: any): ReportSummary {
  return {
    id: r.id,
    status: r.status,
    hrt_comment: r.hrt_comment ?? null,
    overall_percentage: r.overall_percentage ?? null,
    class_position: r.class_position ?? null,
    pdf_url: r.pdf_url ?? null,
    released_at: r.released_at ?? null,
    updated_at: r.updated_at,
    student: {
      id: r.students?.id ?? '',
      full_name: r.students?.full_name ?? '—',
      student_number: r.students?.student_number ?? '',
      photo_url: r.students?.photo_url ?? null,
    },
    semester: r.semesters ? { id: r.semesters.id, name: r.semesters.name } : null,
  };
}
