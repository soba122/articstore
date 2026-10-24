import { getStore } from "@netlify/blobs";
import { json, normEmail, emailKey, checkPw, hashPw, makeSession, cookie } from "../lib/auth.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ message: "طريقة غير مسموحة" }, 405);
  if (!process.env.CODE_SECRET) return json({ message: "الخدمة غير مهيأة بعد" }, 500);
  let b;
  try { b = await req.json(); } catch { return json({ message: "طلب غير صالح" }, 400); }

  const email = normEmail(b.email), password = String(b.password || "");
  const key = emailKey(email);
  const att = getStore("login-attempts");
  const now = Date.now();
  let rec = await att.get(key, { type: "json" });
  if (rec && now - rec.first > 15 * 60_000) rec = null;
  if (rec && rec.n >= 5) return json({ message: "محاولات كثيرة، حاول بعد 15 دقيقة" }, 429);

  const user = await getStore("users").get(key, { type: "json" });
  const ok = user ? checkPw(password, user.pw) : (hashPw(password), false); // نفس الزمن تقريباً
  if (!ok) {
    await att.setJSON(key, { n: (rec?.n || 0) + 1, first: rec?.first || now });
    return json({ message: "البريد أو كلمة المرور غير صحيحة" }, 401);
  }
  await att.delete(key);
  return json({ ok: true, user: { email: user.email, username: user.username } }, 200,
    { "Set-Cookie": cookie(makeSession(user.email), 30 * 86400) });
};
