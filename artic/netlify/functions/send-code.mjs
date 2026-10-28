import { json, emailOk, sha256Hex, hmacHex, randomCode } from "../../lib/helpers.js";

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch (e) { return json({ message: "طلب غير صالح" }, 400); }

  const email = String(body.email || "").trim().toLowerCase();
  if (!emailOk(email)) return json({ message: "البريد الإلكتروني غير صحيح" }, 400);

  if (!env.RESEND_API_KEY || !env.MAIL_FROM || !env.CODE_SECRET || !env.DB)
    return json({ message: "خدمة البريد غير مهيأة بعد" }, 500);

  const key = await sha256Hex(email);

  if (body.purpose === "register") {
    const u = await env.DB.prepare("SELECT 1 AS x FROM users WHERE key = ?").bind(key).first();
    if (u) return json({ message: "هذا البريد مستخدم بالفعل، سجّل الدخول" }, 409);
  }

  const now = Date.now();
  const old = await env.DB.prepare("SELECT * FROM email_codes WHERE key = ?").bind(key).first();
  if (old && now - old.sent_at < 60000) return json({ message: "انتظر دقيقة قبل إعادة الإرسال" }, 429);

  const hourStart = old && old.hour_start && now - old.hour_start < 3600000 ? old.hour_start : now;
  const hourCount = old && hourStart === old.hour_start ? old.hour_count : 0;
  if (hourCount >= 5) return json({ message: "تجاوزت الحد المسموح، حاول بعد ساعة" }, 429);

  const code = randomCode();
  const codeHash = await hmacHex(env.CODE_SECRET, email + ":" + code);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [email],
      subject: "كود التأكيد - ArticMc.lol",
      html: '<div dir="rtl" style="font-family:Tahoma,Arial;text-align:center;padding:24px">' +
        "<h2>متجر ArticMc.lol</h2><p>كود التأكيد الخاص بك:</p>" +
        '<p style="font-size:34px;font-weight:bold;letter-spacing:8px">' + code + "</p>" +
        "<p>صالح لمدة 10 دقائق. إذا لم تطلبه تجاهل هذه الرسالة.</p></div>",
    }),
  });
  if (!res.ok) {
    console.error("resend failed", res.status);
    return json({ message: "تعذر إرسال البريد، حاول لاحقاً" }, 502);
  }

  await env.DB.prepare(
    "INSERT OR REPLACE INTO email_codes (key, code_hash, expires, attempts, sent_at, hour_start, hour_count) VALUES (?, ?, ?, 0, ?, ?, ?)"
  ).bind(key, codeHash, now + 600000, now, hourStart, hourCount + 1).run();

  return json({ ok: true });
}
