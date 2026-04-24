/**
 * notify-marks-complete
 * Called after all marks for a subject/stream/semester are entered.
 * Notifies the HRT of that stream via push notification.
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface Payload {
  school_id: string;
  subject_id: string;
  stream_id: string;
  semester_id: string;
  subject_name: string;
  stream_name: string;
  entered_by_name: string;
}

serve(async (req) => {
  try {
    const payload: Payload = await req.json();
    const {
      school_id, subject_id, stream_id, semester_id,
      subject_name, stream_name, entered_by_name,
    } = payload;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Find HRT assignment for this stream
    const { data: hrtData } = await supabase
      .from('hrt_assignments')
      .select('staff_id')
      .eq('school_id', school_id)
      .eq('stream_id', stream_id)
      .eq('semester_id', semester_id)
      .limit(1)
      .single();

    if (!hrtData?.staff_id) {
      return new Response(JSON.stringify({ ok: true, message: 'No HRT for stream' }), { status: 200 });
    }

    // Get push token for HRT
    const { data: tokenData } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', hrtData.staff_id)
      .limit(1)
      .single();

    if (!tokenData?.token) {
      return new Response(JSON.stringify({ ok: true, message: 'No push token for HRT' }), { status: 200 });
    }

    // Send Expo push notification
    const message = {
      to: tokenData.token,
      sound: 'default',
      title: 'Marks Entry Complete',
      body: `${subject_name} marks for ${stream_name} have been fully entered by ${entered_by_name}.`,
      data: { type: 'marks_complete', subject_id, stream_id, semester_id },
    };

    const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(message),
    });

    const pushJson = await pushRes.json();

    // Log notification
    await supabase.from('notification_logs').insert({
      school_id,
      recipient_id: hrtData.staff_id,
      type: 'marks_complete',
      title: message.title,
      body: message.body,
      sent_at: new Date().toISOString(),
      is_safeguarding: false,
      meta: {
        subject_id,
        stream_id,
        semester_id,
        expo_response: pushJson,
      },
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error('notify-marks-complete error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
