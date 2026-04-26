/**
 * generate-transcript — Supabase Edge Function
 * 
 * POST /functions/v1/generate-transcript
 * Body: { student_id: string, academic_year_ids: string[] }
 * Auth: Bearer <user JWT>
 * 
 * Generates multi-year academic transcript PDF.
 */

import puppeteer from "npm:puppeteer-core@22.15.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // ── Auth ──────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl  = Deno.env.get("SUPABASE_URL")!;
    const serviceKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Verify caller and resolve staff ID
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) return json({ error: "Invalid token" }, 401);

    // Resolve staff ID for generated_by
    const { data: staffRow } = await adminClient
      .from("staff")
      .select("id")
      .eq("auth_user_id", caller.id)
      .maybeSingle();
    const generatedBy: string | null = staffRow?.id ?? null;

    // ── Input ─────────────────────────────────────────────────
    const { student_id, academic_year_ids } = await req.json() as { 
      student_id: string; 
      academic_year_ids: string[];
    };
    
    if (!student_id || !academic_year_ids?.length) {
      return json({ error: "student_id and academic_year_ids required" }, 400);
    }

    // ── Fetch student data ────────────────────────────────────
    const { data: student, error: sErr } = await adminClient
      .from("students")
      .select(`
        id, full_name, student_number, date_of_birth, gender, photo_url,
        school_id, stream_id,
        grades ( name ),
        streams ( name ),
        schools ( id, name, logo_url, primary_color, address, phone, email )
      `)
      .eq("id", student_id)
      .single();

    if (sErr || !student) return json({ error: "Student not found" }, 404);

    const schoolId = student.school_id;
    const schoolColor = student.schools?.primary_color ?? "#0F5132";

    // ── Fetch academic years ──────────────────────────────────
    const { data: years } = await adminClient
      .from("academic_years")
      .select("id, name, start_date, end_date")
      .in("id", academic_year_ids)
      .order("start_date", { ascending: true });

    // ── Fetch all semesters for these years ───────────────────
    const { data: semesters } = await adminClient
      .from("semesters")
      .select("id, name, academic_year_id, start_date, end_date, is_active")
      .in("academic_year_id", academic_year_ids)
      .order("start_date", { ascending: true });

    const semesterIds = semesters?.map((s) => s.id) ?? [];

    // ── Fetch all marks across these semesters ────────────────
    const { data: marks } = await adminClient
      .from("marks")
      .select(`
        assessment_type, value, is_excused,
        subjects ( id, name ),
        semesters ( id, name, academic_year_id )
      `)
      .eq("student_id", student_id)
      .eq("school_id", schoolId)
      .in("semester_id", semesterIds);

    // ── Fetch reports for overall performance ─────────────────
    const { data: reports } = await adminClient
      .from("reports")
      .select("semester_id, overall_percentage, class_position, status")
      .eq("student_id", student_id)
      .eq("school_id", schoolId)
      .in("semester_id", semesterIds)
      .eq("status", "released");

    // ── Aggregate data by year → semester ─────────────────────
    const yearData = (years ?? []).map((year) => {
      const yearSemesters = (semesters ?? []).filter((s) => s.academic_year_id === year.id);
      
      return {
        year,
        semesters: yearSemesters.map((sem) => {
          const semMarks = (marks ?? []).filter((m) => m.semesters?.id === sem.id);
          const semReport = (reports ?? []).find((r) => r.semester_id === sem.id);
          
          // Group marks by subject
          const subjectMap = new Map();
          for (const m of semMarks) {
            const subjId = m.subjects?.id;
            if (!subjId) continue;
            
            if (!subjectMap.has(subjId)) {
              subjectMap.set(subjId, {
                subject: m.subjects,
                fa1: null,
                fa2: null,
                summative: null,
              });
            }
            const entry = subjectMap.get(subjId);
            if (m.assessment_type === 'fa1') entry.fa1 = m.value;
            if (m.assessment_type === 'fa2') entry.fa2 = m.value;
            if (m.assessment_type === 'summative') entry.summative = m.value;
          }
          
          return {
            semester: sem,
            subjects: Array.from(subjectMap.values()),
            overall: semReport?.overall_percentage ?? null,
            position: semReport?.class_position ?? null,
          };
        }),
      };
    });

    // ── Build HTML ────────────────────────────────────────────
    const html = buildTranscriptHTML({
      student,
      years: yearData,
      schoolColor,
    });

    // ── Generate PDF ──────────────────────────────────────────
    const pdfBuffer = await generatePDF(html);

    // ── Ensure storage bucket exists ────────────────────────
    const { data: buckets } = await adminClient.storage.listBuckets();
    if (!buckets?.some((b: any) => b.name === "school-assets")) {
      await adminClient.storage.createBucket("school-assets", { public: true });
    }

    // ── Upload to storage ─────────────────────────────────────
    const fileName = `transcripts/${schoolId}/${student_id}/${Date.now()}.pdf`;
    const { error: uploadErr } = await adminClient
      .storage
      .from("school-assets")
      .upload(fileName, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadErr) throw uploadErr;

    const { data: publicUrl } = adminClient
      .storage
      .from("school-assets")
      .getPublicUrl(fileName);

    // ── Save transcript record ────────────────────────────────
    const { data: transcript, error: tErr } = await adminClient
      .from("transcripts")
      .insert({
        school_id: schoolId,
        student_id: student_id,
        academic_year_ids: academic_year_ids,
        generated_by: generatedBy,
        pdf_url: publicUrl.publicUrl,
        status: "ready",
        generated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (tErr) throw tErr;

    return json({ success: true, transcript_id: transcript.id, pdf_url: publicUrl.publicUrl });

  } catch (err: any) {
    console.error("generate-transcript error:", err);
    return json({ error: err.message || "Internal error" }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function buildTranscriptHTML({ student, years, schoolColor }: any) {
  const school = student.schools;
  const dob = student.date_of_birth 
    ? new Date(student.date_of_birth).toLocaleDateString() 
    : "N/A";

  let yearsHtml = "";
  for (const year of years) {
    let semsHtml = "";
    for (const sem of year.semesters) {
      const rows = sem.subjects.map((s: any) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #ddd;">${s.subject?.name || "Unknown"}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;">${s.fa1 ?? "-"}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;">${s.fa2 ?? "-"}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;">${s.summative ?? "-"}</td>
        </tr>
      `).join("");

      semsHtml += `
        <div style="margin-bottom:30px;">
          <h4 style="color:${schoolColor};margin-bottom:10px;">${sem.semester.name}</h4>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="background:#f5f5f5;">
                <th style="padding:8px;text-align:left;">Subject</th>
                <th style="padding:8px;text-align:center;">FA1</th>
                <th style="padding:8px;text-align:center;">FA2</th>
                <th style="padding:8px;text-align:center;">Summative</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          ${sem.overall ? `<p style="margin-top:10px;text-align:right;"><strong>Overall: ${sem.overall}%</strong></p>` : ""}
        </div>
      `;
    }

    yearsHtml += `
      <div style="margin-bottom:40px;page-break-inside:avoid;">
        <h3 style="color:${schoolColor};border-bottom:2px solid ${schoolColor};padding-bottom:8px;">
          ${year.year.name}
        </h3>
        ${semsHtml}
      </div>
    `;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Academic Transcript - ${student.full_name}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
    h1, h2, h3, h4 { color: ${schoolColor}; }
    .header { text-align: center; margin-bottom: 30px; }
    .school-name { font-size: 24px; font-weight: bold; color: ${schoolColor}; }
    .transcript-title { font-size: 18px; margin-top: 10px; }
    .student-info { background: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
    .info-row { display: flex; margin-bottom: 8px; }
    .info-label { width: 120px; font-weight: bold; color: #666; }
    table { width: 100%; }
  </style>
</head>
<body>
  <div class="header">
    <div class="school-name">${school?.name || "School"}</div>
    <div class="transcript-title">Official Academic Transcript</div>
    ${school?.address ? `<div style="font-size:12px;color:#666;">${school.address}</div>` : ""}
  </div>

  <div class="student-info">
    <div class="info-row">
      <span class="info-label">Student:</span>
      <span>${student.full_name}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Student No:</span>
      <span>${student.student_number || "N/A"}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Date of Birth:</span>
      <span>${dob}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Gender:</span>
      <span>${student.gender || "N/A"}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Grade/Stream:</span>
      <span>${student.grades?.name || ""} ${student.streams?.name || ""}</span>
    </div>
  </div>

  ${yearsHtml}

  <div style="margin-top:50px;padding-top:20px;border-top:1px solid #ddd;font-size:12px;color:#666;text-align:center;">
    <p>This is an official academic transcript generated by eScholr.</p>
    <p>Generated on: ${new Date().toLocaleDateString()}</p>
  </div>
</body>
</html>
  `;
}

async function generatePDF(html: string): Promise<Uint8Array> {
  const chromeWs = Deno.env.get("CHROME_WS_ENDPOINT");
  const browser = await puppeteer.connect({
    browserWSEndpoint: chromeWs,
    defaultViewport: { width: 1200, height: 800 },
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  const pdfBuf = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "20mm", right: "20mm", bottom: "20mm", left: "20mm" },
  });

  await browser.close();
  return pdfBuf;
}
