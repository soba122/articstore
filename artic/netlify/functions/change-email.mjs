import { getStore } from "@netlify/blobs";
import { json, normEmail, validEmail, emailKey, readSession, checkPw, makeSession, cookie, tooMany, failed, cleared } from "../lib/auth.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ message: "طريقة غير مسموحة" }, 405);
  if (!process.env.CODE_SECRET) return json({ message: "الخدمة غير مهيأة بعد" }, 500);
  const oldEmail = readSession(req);
  if (!oldEmail) return json({ message: "سجّل الدخول أولاً" }, 401);
  let b;
  try { b = await req.json(); } catch { return json({ message: "طلب غير صالح" }, 400); }
  const newEmail = normEmail(b.email), password = String(b.password || "");
  if (!validEmail(newEmail)) return json({ message: "البريد الإلكتروني غير صحيح" }, 400);

  const oldKey = emailKey(oldEmail), newKey = emailKey(newEmail);
  if (await tooMany(oldKey)) return json({ message: "محاولات كثيرة، حاول بعد 15 دقيقة" }, 429);
  const users = getStore("users");
  const u = await users.get(oldKey, { type: "json" });
  if (!u || !checkPw(password, u.pw)) { await failed(oldKey); return json({ message: "كلمة المرور غير صحيحة" }, 401); }
  await cleared(oldKey);

  const ver = getStore("verified-emails");
  const v = await ver.get(newKey, { type: "json" });
  if (!v || Date.now() - v.verifiedAt > 30 * 60_000) return json({ message: "أكّد البريد الجديد بالكود أولاً" }, 403);
  if (await users.get(newKey, { type: "json" })) return json({ message: "هذا البريد مستخدم بالفعل" }, 409);

  await users.setJSON(newKey, { ...u, email: newEmail });
  await users.delete(oldKey);
  await ver.delete(newKey);
  return json({ ok: true, user: { email: newEmail, username: u.username, avatar: u.avatar || null } }, 200,
    { "Set-Cookie": cookie(makeSession(newEmail), 30 * 86400) });
};
