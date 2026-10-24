import { getStore } from "@netlify/blobs";
import { createHmac, createHash, timingSafeEqual } from "node:crypto";

const json = (b, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

export default async (req) => {
  if (req.method !== "POST") return json({ message: "طريقة غير مسموحة" }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ message: "طلب غير صالح" }, 400); }

  const email = String(body.email || "").trim().toLowerCase();
  const code = String(body.code || "");
  if (!/^\d{6}$/.test(code) || !email) return json({ message: "الكود غير صحيح" }, 400);

  const secret = process.env.CODE_SECRET;
  if (!secret) return json({ message: "الخدمة غير مهيأة بعد" }, 500);

  const store = getStore("email-codes");
  const key = createHash("sha256").update(email).digest("hex");
  const rec = await store.get(key, { type: "json" });

  if (!rec || Date.now() > rec.expires) return json({ message: "الكود منتهي، اطلب كوداً جديداً" }, 400);
  if (rec.attempts >= 5) {
    await store.delete(key);
    return json({ message: "محاولات كثيرة، اطلب كوداً جديداً" }, 429);
  }

  const given = createHmac("sha256", secret).update(`${email}:${code}`).digest();
  const saved = Buffer.from(rec.codeHash, "hex");
  const ok = given.length === saved.length && timingSafeEqual(given, saved);

  if (!ok) {
    await store.setJSON(key, { ...rec, attempts: rec.attempts + 1 });
    return json({ message: "الكود غير صحيح" }, 400);
  }

  await store.delete(key); // الكود يُستخدم مرة واحدة
  await getStore("verified-emails").setJSON(key, { email, verifiedAt: Date.now() });
  return json({ ok: true });
};
