/**
 * generate-receipt
 * POST /functions/v1/generate-receipt
 * Authorization: Bearer <user_jwt>
 *
 * Body: { finance_record_id: string }
 *
 * Returns: { receipt_url: string }
 *
 * Generates a payment receipt PDF using Puppeteer, uploads to
 * Supabase Storage receipts/{school_id}/{finance_record_id}.pdf
 * and returns the public URL.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // ── Auth check ─────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const callerClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user: caller } } = await callerClient.auth.getUser();
  if (!caller) return json({ error: "Unauthorized" }, 401);

  const callerRoles: string[] = (caller.app_metadata as any)?.roles ?? [];
  const allowed = ["finance", "admin", "super_admin", "hot"];
  if (!callerRoles.some((r) => allowed.includes(r))) {
    return json({ error: "Forbidden" }, 403);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let finance_record_id: string;
  try {
    const body = await req.json();
    finance_record_id = body.finance_record_id;
    if (!finance_record_id) throw new Error("finance_record_id required");
  } catch (e: any) {
    return json({ error: e.message }, 400);
  }

  // ── Fetch finance record with related data ─────────────────────────────────
  const { data: record, error: recErr } = await supabase
    .from("finance_records")
    .select(`
      id, status, balance, updated_at,
      students (
        id, full_name, student_number, photo_url,
        grades ( name ), streams ( name )
      ),
      semesters ( id, name, academic_years ( name ) ),
      schools (
        id, name, primary_color, secondary_color, logo_url, currency
      )
    `)
    .eq("id", finance_record_id)
    .single();

  if (recErr || !record) return json({ error: "Finance record not found" }, 404);

  const { data: txns } = await supabase
    .from("payment_transactions")
    .select("id, amount, paid_at, note, staff:recorded_by(full_name)")
    .eq("finance_record_id", finance_record_id)
    .order("paid_at", { ascending: false });

  const transactions: any[] = txns ?? [];

  // ── Build receipt data ─────────────────────────────────────────────────────
  const school: any    = record.schools as any;
  const student: any   = record.students as any;
  const semester: any  = record.semesters as any;
  const primaryColor   = school?.primary_color ?? "#1B2A4A";
  const secondaryColor = school?.secondary_color ?? "#E8A020";
  const currency       = school?.currency ?? "ZMW";

  const totalPaid   = transactions.reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);
  const balance     = Number(record.balance) || 0;
  const receiptNo   = `RCP-${finance_record_id.slice(0, 8).toUpperCase()}`;
  const issuedAt    = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  // ── HTML receipt template ──────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #1F2937; background: #fff; padding: 40px; }
  .header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid ${primaryColor}; }
  .school-info h1 { font-size: 22px; font-weight: 800; color: ${primaryColor}; }
  .school-info p  { font-size: 12px; color: #6B7280; margin-top: 4px; }
  .receipt-meta { text-align: right; }
  .receipt-meta h2 { font-size: 18px; font-weight: 700; color: ${primaryColor}; letter-spacing: 1px; }
  .receipt-meta .receipt-no { font-size: 13px; color: #6B7280; margin-top: 4px; }
  .receipt-meta .issued { font-size: 12px; color: #9CA3AF; margin-top: 2px; }
  .status-badge { display: inline-block; padding: 4px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; margin-top: 8px; background: ${record.status === "paid" ? "#D1FAE5" : "#FEF3C7"}; color: ${record.status === "paid" ? "#065F46" : "#92400E"}; }
  .student-section { background: #F9FAFB; border-radius: 10px; padding: 20px; margin-bottom: 28px; display: flex; gap: 40px; }
  .student-section .field { flex: 1; }
  .field label { font-size: 10px; font-weight: 700; color: #9CA3AF; letter-spacing: 0.5px; text-transform: uppercase; display: block; margin-bottom: 4px; }
  .field .value { font-size: 14px; font-weight: 600; color: #111827; }
  .section-title { font-size: 11px; font-weight: 700; color: #9CA3AF; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead tr { background: ${primaryColor}; color: #fff; }
  thead th { padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 700; letter-spacing: 0.4px; }
  tbody tr:nth-child(even) { background: #F9FAFB; }
  tbody td { padding: 10px 14px; font-size: 12px; border-bottom: 1px solid #F3F4F6; }
  .amount-col { text-align: right; font-variant-numeric: tabular-nums; }
  .summary { margin-left: auto; width: 260px; }
  .summary-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #F3F4F6; font-size: 13px; }
  .summary-row.total { font-weight: 800; font-size: 15px; color: ${primaryColor}; border-bottom: none; padding-top: 12px; }
  .summary-row.balance-row { color: ${balance > 0 ? "#B45309" : "#065F46"}; font-weight: 700; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E7EB; display: flex; justify-content: space-between; align-items: flex-end; }
  .footer .note { font-size: 11px; color: #9CA3AF; max-width: 300px; line-height: 1.5; }
  .footer .sig { text-align: right; }
  .footer .sig .sig-line { border-top: 1px solid #9CA3AF; width: 160px; margin-left: auto; margin-bottom: 4px; margin-top: 40px; }
  .footer .sig .sig-label { font-size: 11px; color: #6B7280; }
  .accent-bar { height: 4px; background: ${secondaryColor}; border-radius: 2px; margin-bottom: 20px; }
</style>
</head>
<body>
<div class="accent-bar"></div>
<div class="header">
  <div class="school-info">
    ${school?.logo_url ? `<img src="${school.logo_url}" style="height:48px;margin-bottom:8px;" />` : ""}
    <h1>${school?.name ?? "School"}</h1>
    <p>Official Payment Receipt</p>
  </div>
  <div class="receipt-meta">
    <h2>RECEIPT</h2>
    <div class="receipt-no">${receiptNo}</div>
    <div class="issued">${issuedAt}</div>
    <div class="status-badge">${record.status === "paid" ? "PAID" : "BALANCE OUTSTANDING"}</div>
  </div>
</div>

<div class="student-section">
  <div class="field">
    <label>Student Name</label>
    <div class="value">${student?.full_name ?? "—"}</div>
  </div>
  <div class="field">
    <label>Student ID</label>
    <div class="value">${student?.student_number ?? "—"}</div>
  </div>
  <div class="field">
    <label>Grade / Stream</label>
    <div class="value">${(student?.grades as any)?.name ?? "—"} · ${(student?.streams as any)?.name ?? "—"}</div>
  </div>
  <div class="field">
    <label>Semester</label>
    <div class="value">${semester?.name ?? "—"}${semester?.academic_years ? " · " + (semester.academic_years as any).name : ""}</div>
  </div>
</div>

<div class="section-title">Payment Transactions</div>
${transactions.length > 0 ? `
<table>
  <thead>
    <tr>
      <th>#</th>
      <th>Date</th>
      <th>Note</th>
      <th>Recorded By</th>
      <th class="amount-col">Amount (${currency})</th>
    </tr>
  </thead>
  <tbody>
    ${transactions.map((t: any, i: number) => `
    <tr>
      <td>${i + 1}</td>
      <td>${t.paid_at ? new Date(t.paid_at).toLocaleDateString("en-GB") : "—"}</td>
      <td>${t.note ?? "—"}</td>
      <td>${(t.staff as any)?.full_name ?? "—"}</td>
      <td class="amount-col">${Number(t.amount).toLocaleString("en", { minimumFractionDigits: 2 })}</td>
    </tr>`).join("")}
  </tbody>
</table>
` : `<p style="color:#9CA3AF;font-size:12px;margin-bottom:24px;">No individual transactions recorded.</p>`}

<div class="summary">
  <div class="summary-row">
    <span>Total Paid</span>
    <span>${currency} ${totalPaid.toLocaleString("en", { minimumFractionDigits: 2 })}</span>
  </div>
  <div class="summary-row balance-row">
    <span>${balance > 0 ? "Outstanding Balance" : "Balance"}</span>
    <span>${currency} ${balance.toLocaleString("en", { minimumFractionDigits: 2 })}</span>
  </div>
  <div class="summary-row total">
    <span>Status</span>
    <span>${record.status === "paid" ? "Cleared" : "Pending"}</span>
  </div>
</div>

<div class="footer">
  <div class="note">
    This is an official receipt issued by ${school?.name ?? "the school"}.<br/>
    Please retain this document for your records.<br/>
    Receipt #${receiptNo} · ${issuedAt}
  </div>
  <div class="sig">
    <div class="sig-line"></div>
    <div class="sig-label">Authorised Signature</div>
  </div>
</div>
</body>
</html>`;

  // ── Generate PDF via Puppeteer ─────────────────────────────────────────────
  let pdfBuffer: Uint8Array;
  try {
    const puppeteer = await import("npm:puppeteer-core@21");
    const browser = await (puppeteer as any).default.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      executablePath: "/usr/bin/chromium-browser",
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfData = await page.pdf({ format: "A4", printBackground: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } });
    pdfBuffer = new Uint8Array(pdfData);
    await browser.close();
  } catch (_e) {
    // Fallback: return HTML as receipt if Puppeteer unavailable
    const htmlBytes = new TextEncoder().encode(html);
    const path = `receipts/${school?.id ?? "school"}/${finance_record_id}.html`;
    await supabase.storage.from("receipts").upload(path, htmlBytes, {
      contentType: "text/html",
      upsert: true,
    });
    const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(path);
    return json({ receipt_url: urlData.publicUrl, format: "html" });
  }

  // ── Upload PDF to Storage ──────────────────────────────────────────────────
  const storagePath = `receipts/${school?.id ?? "school"}/${finance_record_id}.pdf`;
  const { error: uploadErr } = await supabase.storage
    .from("receipts")
    .upload(storagePath, pdfBuffer, { contentType: "application/pdf", upsert: true });

  if (uploadErr) return json({ error: "Upload failed: " + uploadErr.message }, 500);

  const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(storagePath);

  // ── Store URL on finance record ────────────────────────────────────────────
  await supabase
    .from("finance_records")
    .update({ receipt_url: urlData.publicUrl })
    .eq("id", finance_record_id);

  return json({ receipt_url: urlData.publicUrl, format: "pdf" });
});
