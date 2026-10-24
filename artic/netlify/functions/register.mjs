import { getStore } from "@netlify/blobs";
import { json, normEmail, validEmail, emailKey, hashPw, makeSession, cookie } from "../lib/auth.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ message: "طريقة غير مسموحة" }, 405);
  if (!process.env.CODE_SECRET) return json({ message: "الخدمة غير مهيأة بعد" }, 500);
  let b;
  try { b = await req.json(); } catch { return json({ message: "طلب غير صالح" }, 400); }

  const email = normEmail(b.email), username = String(b.username || "").trim(), password = String(b.password || "");
  if (!validEmail(email)) return json({ message: "البريد الإلكتروني غير صحيح" }, 400);
  if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) return json({ message: "اسم اللاعب غير صحيح" }, 400);
  if (password.length < 8 || password.length > 100) return json({ message: "كلمة المرور من 8 إلى 100 حرف" }, 400);

  const key = emailKey(email);
  const verified = await getStore("verified-emails").get(key, { type: "json" });
  if (!verified || Date.now() - verified.verifiedAt > 30 * 60_000)
    return json({ message: "أكّد بريدك بالكود أولاً" }, 403);

  const users = getStore("users");
  if (await users.get(key, { type: "json" })) return json({ message: "هذا البريد مسجل مسبقاً، سجّل الدخول" }, 409);

  await users.setJSON(key, { email, username, pw: hashPw(password), createdAt: Date.now() });
  await getStore("verified-emails").delete(key);
  return json({ ok: true, user: { email, username } }, 200, { "Set-Cookie": cookie(makeSession(email), 30 * 86400) });
};
