import { json, sha256Hex, hmacHex, safeEqual } from "../../lib/helpers.js";

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch (e) { return json({ message: "طلب غير صالح" }, 400); }

  const email = String(body.email || "").trim().toLowerCase();
  const code = String(body.code || "");
  if (!email || !/^\d{6}$/.test(code)) return json({ message: "الكود غير صحيح" }, 400);
  if (!env.CODE_SECRET || !env.DB) return json({ message: "الخدمة غير مهيأة بعد" }, 500);

  const key = await sha256Hex(email);
  const rec = await env.DB.prepare("SELECT * FROM email_codes WHERE key = ?").bind(key).first();
  if (!rec || Date.now() > rec.expires) return json({ message: "الكود منتهي، اطلب كوداً جديداً" }, 400);

  if (rec.attempts >= 5) {
    await env.DB.prepare("DELETE FROM email_codes WHERE key = ?").bind(key).run();
    return json({ message: "محاولات كثيرة، اطلب كوداً جديداً" }, 429);
  }

  const given = await hmacHex(env.CODE_SECRET, email + ":" + code);
  if (!safeEqual(given, rec.code_hash)) {
    await env.DB.prepare("UPDATE email_codes SET attempts = attempts + 1 WHERE key = ?").bind(key).run();
    return json({ message: "الكود غير صحيح" }, 400);
  }

  await env.DB.batch([
    env.DB.prepare("DELETE FROM email_codes WHERE key = ?").bind(key),
    env.DB.prepare("INSERT OR REPLACE INTO verified_emails (key, email, verified_at) VALUES (?, ?, ?)").bind(key, email, Date.now()),
  ]);
  return json({ ok: true });
}
