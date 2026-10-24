import { getStore } from "@netlify/blobs";
import { json, emailKey, readSession, checkPw, hashPw, tooMany, failed, cleared } from "../lib/auth.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ message: "طريقة غير مسموحة" }, 405);
  if (!process.env.CODE_SECRET) return json({ message: "الخدمة غير مهيأة بعد" }, 500);
  const email = readSession(req);
  if (!email) return json({ message: "سجّل الدخول أولاً" }, 401);
  let b;
  try { b = await req.json(); } catch { return json({ message: "طلب غير صالح" }, 400); }
  const cur = String(b.current || ""), next = String(b.next || "");
  if (next.length < 8 || next.length > 100) return json({ message: "كلمة المرور الجديدة من 8 إلى 100 حرف" }, 400);

  const key = emailKey(email);
  if (await tooMany(key)) return json({ message: "محاولات كثيرة، حاول بعد 15 دقيقة" }, 429);
  const users = getStore("users");
  const u = await users.get(key, { type: "json" });
  if (!u || !checkPw(cur, u.pw)) { await failed(key); return json({ message: "كلمة المرور الحالية غير صحيحة" }, 401); }
  await cleared(key);
  await users.setJSON(key, { ...u, pw: hashPw(next) });
  return json({ ok: true });
};
