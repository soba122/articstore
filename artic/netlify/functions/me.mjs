import { getStore } from "@netlify/blobs";
import { json, emailKey, readSession } from "../lib/auth.mjs";

export default async (req) => {
  if (!process.env.CODE_SECRET) return json({ message: "الخدمة غير مهيأة" }, 500);
  const email = readSession(req);
  if (!email) return json({ message: "غير مسجل" }, 401);
  const u = await getStore("users").get(emailKey(email), { type: "json" });
  if (!u) return json({ message: "غير مسجل" }, 401);
  return json({ email: u.email, username: u.username });
};
