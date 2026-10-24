import { getStore } from "@netlify/blobs";
import { json, emailKey, readSession } from "../lib/auth.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ message: "طريقة غير مسموحة" }, 405);
  if (!process.env.CODE_SECRET) return json({ message: "الخدمة غير مهيأة بعد" }, 500);
  const email = readSession(req);
  if (!email) return json({ message: "سجّل الدخول أولاً" }, 401);
  let b;
  try { b = await req.json(); } catch { return json({ message: "طلب غير صالح" }, 400); }

  const img = b.image;
  if (img !== null && (typeof img !== "string" || img.length > 80_000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(img)))
    return json({ message: "الصورة غير صالحة" }, 400);

  const key = emailKey(email), users = getStore("users");
  const u = await users.get(key, { type: "json" });
  if (!u) return json({ message: "سجّل الدخول أولاً" }, 401);
  await users.setJSON(key, { ...u, avatar: img });
  return json({ ok: true });
};
