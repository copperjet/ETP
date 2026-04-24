/**
 * release-report
 * POST { school_id, student_ids: string[], semester_id }
 * Marks reports as released, sends push notifications to parents, logs notifications.
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { school_id, student_ids, semester_id } = await req.json() as {
      school_id: string;
      student_ids: string[];
      semester_id: string;
    };

    if (!school_id || !student_ids?.length || !semester_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: CORS });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const now = new Date().toISOString();

    // ── 1. Get reports for these students ──────────────────────────────────────
    const { data: reports, error: rErr } = await supabase
      .from('reports')
      .select('id, student_id, pdf_url, students ( full_name ), semesters ( name )')
      .eq('school_id', school_id)
      .eq('semester_id', semester_id)
      .in('student_id', student_ids)
      .in('status', ['approved', 'finance_pending']);

    if (rErr) throw rErr;
    if (!reports || reports.length === 0) {
      return new Response(JSON.stringify({ ok: true, released: 0 }), { status: 200, headers: CORS });
    }

    // ── 2. Update report status to released ───────────────────────────────────
    const reportIds = reports.map((r: any) => r.id);
    await supabase
      .from('reports')
      .update({ status: 'released', released_at: now, updated_at: now })
      .in('id', reportIds);

    // ── 3. For each student: find linked parents → get push tokens → notify ───
    for (const report of reports as any[]) {
      const studentName: string = report.students?.full_name ?? 'Your child';
      const semesterName: string = report.semesters?.name ?? 'this semester';
      const title = `${studentName}'s Report is Ready`;
      const body  = `${studentName}'s ${semesterName} report card is now available. Tap to view.`;

      // Get parent links
      const { data: links } = await supabase
        .from('student_parent_links')
        .select('parent_id')
        .eq('student_id', report.student_id);

      const parentIds = (links ?? []).map((l: any) => l.parent_id);
      if (parentIds.length === 0) continue;

      // Get push tokens for these parents
      const { data: tokens } = await supabase
        .from('push_tokens')
        .select('token, user_id')
        .in('user_id', parentIds);

      // Send push notifications
      const pushMessages = (tokens ?? []).map((t: any) => ({
        to: t.token,
        sound: 'default',
        title,
        body,
        data: { type: 'report_released', report_id: report.id, student_id: report.student_id },
      }));

      if (pushMessages.length > 0) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(pushMessages),
        }).catch(() => {}); // fire-and-forget
      }

      // Create in-app notification for each parent (persists even if push fails)
      const notifRows = parentIds.map((pid: string) => ({
        school_id,
        recipient_id: pid,
        type: 'report_released',
        title,
        body,
        sent_at: now,
        is_safeguarding: false,
        meta: { report_id: report.id, student_id: report.student_id, semester_id },
      }));
      await supabase.from('notification_logs').insert(notifRows);

      // Audit log
      await supabase.from('audit_logs').insert({
        school_id,
        action: 'report_released',
        entity_type: 'report',
        entity_id: report.id,
        performed_at: now,
        meta: { student_id: report.student_id, semester_id },
      });
    }

    return new Response(JSON.stringify({ ok: true, released: reports.length }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('release-report error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
