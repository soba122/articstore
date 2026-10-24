import { getStore } from "@netlify/blobs";
import { json, emailKey, readSession } from "../lib/auth.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ message: "طريقة غير مسموحة" }, 405);
  if (!process.env.CODE_SECRET) return json({ message: "الخدمة غير مهيأة بعد" }, 500);
  const email = readSession(req);
  if (!email) return json({ message: "سجّل الدخول أولاً" }, 401);
  let b;
  try { b = await req.json(); } catch (e) { return json({ message: "طلب غير صالح" }, 400); }

  const username = String(b.username || "").trim();
  if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) return json({ message: "اسم اللاعب غير صحيح" }, 400);

  const key = emailKey(email), users = getStore("users");
  const u = await users.get(key, { type: "json" });
  if (!u) return json({ message: "سجّل الدخول أولاً" }, 401);
  await users.setJSON(key, Object.assign({}, u, { username }));
  return json({ ok: true });
};
