import { getStore } from "@netlify/blobs";
import { createHmac, createHash, randomInt } from "node:crypto";

const json = (b, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

export default async (req) => {
  if (req.method !== "POST") return json({ message: "طريقة غير مسموحة" }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ message: "طلب غير صالح" }, 400); }

  const email = String(body.email || "").trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
    return json({ message: "البريد الإلكتروني غير صحيح" }, 400);

  const { RESEND_API_KEY, MAIL_FROM, CODE_SECRET } = process.env;
  if (!RESEND_API_KEY || !MAIL_FROM || !CODE_SECRET)
    return json({ message: "خدمة البريد غير مهيأة بعد" }, 500);

  if (body.purpose === "register") {
    const exists = await getStore("users").get(createHash("sha256").update(email).digest("hex"), { type: "json" });
    if (exists) return json({ message: "هذا البريد مستخدم بالفعل، سجّل الدخول" }, 409);
  }

  const store = getStore("email-codes");
  const key = createHash("sha256").update(email).digest("hex");
  const old = await store.get(key, { type: "json" });
  const now = Date.now();

  if (old && now - old.sentAt < 60_000)
    return json({ message: "انتظر دقيقة قبل إعادة الإرسال" }, 429);

  let hourStart = old?.hourStart && now - old.hourStart < 3_600_000 ? old.hourStart : now;
  let hourCount = hourStart === old?.hourStart ? old.hourCount : 0;
  if (hourCount >= 5) return json({ message: "تجاوزت الحد المسموح، حاول بعد ساعة" }, 429);

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const codeHash = createHmac("sha256", CODE_SECRET).update(`${email}:${code}`).digest("hex");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: MAIL_FROM,
      to: [email],
      subject: "كود التأكيد - ArticMc.lol",
      html: `<div dir="rtl" style="font-family:Tahoma,Arial;text-align:center;padding:24px">
        <h2>متجر ArticMc.lol</h2><p>كود التأكيد الخاص بك:</p>
        <p style="font-size:34px;font-weight:bold;letter-spacing:8px">${code}</p>
        <p>صالح لمدة 10 دقائق. إذا لم تطلبه تجاهل هذه الرسالة.</p></div>`,
    }),
  });

  if (!res.ok) {
    console.error("resend failed", res.status);
    return json({ message: "تعذر إرسال البريد، حاول لاحقاً" }, 502);
  }

  await store.setJSON(key, { codeHash, expires: now + 600_000, attempts: 0, sentAt: now, hourStart, hourCount: hourCount + 1 });
  return json({ ok: true });
};
