// =====================================================================
// shk-mail — يرسل رسائل البريد المنتظرة في الطابور (shk_mail_queue) لمقدمي مقترحات الجهات الخارجية.
// النشر (مرة واحدة):
//   1) شغّل supabase/external_links_v2.sql في SQL Editor.
//   2) لوحة Supabase ← Edge Functions ← Deploy a new function ← Via Editor، الاسم: shk-mail،
//      الصق هذا الملف، وأوقف خيار «Verify JWT» (أو: supabase functions deploy shk-mail --no-verify-jwt).
//   3) من المنصة: الإعدادات ← مقترحات الجهات الخارجية ← «البريد الإلكتروني للمراسلات» — أضف البريد واختبره.
// الأمان: الدالة لا تستقبل عنوانًا ولا نصًا من المتصفح؛ ترسل فقط ما في الطابور الذي تملؤه دوال قاعدة البيانات.
// كلمة مرور البريد تُقرأ من جدول مغلق بمفتاح الخدمة المتاح للدالة تلقائيًا، ولا تصل للمتصفح.
// =====================================================================
import nodemailer from "npm:nodemailer@6.9.16";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });

const STATUS: Record<string, [string, string]> = {
  submitted: ["تم الاستلام", "وصل مقترحكم وسيُدرس قريبًا."],
  review: ["قيد الدراسة", "تدرس إدارة الشراكات مقترحكم الآن."],
  info: ["مطلوب معلومات إضافية", "تحتاج إدارة الشراكات إلى بعض المعلومات لاستكمال دراسة مقترحكم. يمكنكم الرد وإرفاق الملفات من صفحة المتابعة."],
  accepted: ["مقبول مبدئيًا", "قُبل مقترحكم مبدئيًا، وستتواصل معكم إدارة الشراكات للخطوات التالية."],
  converted: ["مقبول — بدأت إجراءات الشراكة", "بدأت إجراءات الشراكة رسميًا."],
  rejected: ["نعتذر عن عدم القبول", "شكرًا لاهتمامكم؛ لم يُقبل المقترح في الوقت الحالي."],
};
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]!));

type Item = { id: number; kind: string; to: string; payload: Record<string, string> };
function compose(it: Item) {
  const p = it.payload || {}, org = p.org || "مؤسسة مروج الأهلية";
  let subject = "", title = "", lead = "", body = "", cta = "متابعة المقترح";
  if (it.kind === "test") {
    subject = `رسالة تجريبية — ${org}`; title = "البريد يعمل بنجاح";
    lead = "هذه رسالة تجريبية من منصة الشراكات للتأكد من إعداد البريد.";
    body = "من الآن ستصل رسائل الاستلام وتحديثات الحالة إلى مقدمي مقترحات الشراكة من هذا البريد."; cta = "فتح المنصة";
  } else {
    const st = STATUS[p.status] || STATUS.submitted;
    if (it.kind === "received") {
      subject = `وصل مقترحكم ${p.ref} — ${org}`; title = "شكرًا، وصل مقترحكم";
      lead = `مرحبًا، وصل مقترح الشراكة الخاص بكم إلى إدارة الشراكات برقم <b dir="ltr">${esc(p.ref)}</b>.`;
      body = "ستصلكم رسالة على هذا البريد عند كل تحديث لحالة المقترح، ويمكنكم متابعته في أي وقت من الرابط أدناه.";
    } else {
      subject = `تحديث مقترحكم ${p.ref}: ${st[0]}`; title = st[0];
      lead = `مرحبًا ${esc(p.requesterName)}، تحدّثت حالة مقترح الشراكة الخاص بـ «${esc(p.partnerName)}» (<b dir="ltr">${esc(p.ref)}</b>).`;
      body = st[1];
    }
  }
  const msg = p.message ? `<div style="margin:18px 0;padding:14px 16px;background:#F6F1E4;border-right:3px solid #B08A3E;border-radius:8px;white-space:pre-wrap;line-height:1.9">${esc(p.message)}</div>` : "";
  const btn = p.link ? `<p style="margin:24px 0 8px"><a href="${esc(p.link)}" style="display:inline-block;background:#0B3F38;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700">${cta}</a></p>` : "";
  const html = `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#F3F5F4;font-family:Tahoma,Arial,sans-serif;color:#14201B">
<div style="max-width:600px;margin:0 auto;padding:24px 14px"><div style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #D9E3DF">
<div style="background:#0B3F38;color:#fff;padding:18px 24px;font-size:15px;font-weight:700">${esc(org)} — إدارة الشراكات</div>
<div style="height:4px;background:#B08A3E"></div>
<div style="padding:24px;font-size:15px;line-height:1.9"><h1 style="margin:0 0 10px;font-size:21px;color:#0B3F38">${esc(title)}</h1>
<p style="margin:0 0 8px">${lead}</p><p style="margin:0;color:#5E6B65">${esc(body)}</p>${msg}${btn}</div></div>
<p style="text-align:center;color:#8A9690;font-size:12px;margin-top:14px">رسالة آلية من منظومة الشراكات — ${esc(org)}</p></div></body></html>`;
  const text = [title, lead.replace(/<[^>]+>/g, ""), body, p.message || "", p.link ? `${cta}: ${p.link}` : ""].filter(Boolean).join("\n\n");
  return { subject, html, text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!, key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const rpc = (fn: string, body: unknown) => fetch(`${url}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const r = await rpc("shk_mail_claim", { p_n: 10 });
  if (!r.ok) return json({ error: "claim", status: r.status }, 500);
  const { items, config: c } = await r.json() as { items: Item[]; config: Record<string, any> | null };
  if (!items.length) return json({ sent: 0 });
  if (!c || !c.enabled || !c.fromEmail || !c.secret) {
    for (const it of items) await rpc("shk_mail_done", { p_id: it.id, p_error: "البريد غير مُعد أو غير مفعّل" });
    return json({ sent: 0, error: "not_configured" });
  }
  const from = c.fromName ? `${c.fromName} <${c.fromEmail}>` : c.fromEmail;
  // deno-lint-ignore no-explicit-any
  let smtp: any = null, sent = 0;
  for (const it of items) {
    const m = compose(it);
    try {
      if (c.provider === "resend") {
        const res = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${c.secret}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [it.to], subject: m.subject, html: m.html, text: m.text }) });
        if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
      } else {
        const host = c.provider === "gmail" ? "smtp.gmail.com" : c.smtpHost, port = c.provider === "gmail" ? 465 : +c.smtpPort || 465;
        smtp = smtp || nodemailer.createTransport({ host, port, secure: port === 465, auth: { user: c.provider === "gmail" ? c.fromEmail : (c.smtpUser || c.fromEmail), pass: c.secret }, connectionTimeout: 15000 });
        await smtp.sendMail({ from, to: it.to, subject: m.subject, text: m.text, html: m.html });
      }
      await rpc("shk_mail_done", { p_id: it.id, p_error: null }); sent++;
    } catch (e) {
      await rpc("shk_mail_done", { p_id: it.id, p_error: String((e as Error)?.message || e) });
    }
  }
  try { smtp?.close(); } catch { /* */ }
  return json({ sent, total: items.length });
});
