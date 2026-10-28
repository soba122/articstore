import { timingSafeEqual } from "node:crypto";
import { json } from "../lib/auth.mjs";
import { fetchPayment, settle } from "../lib/orders.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ message: "طريقة غير مسموحة" }, 405);
  const want = process.env.MOYASAR_WEBHOOK_SECRET;
  if (!want || !process.env.MOYASAR_SECRET_KEY) return json({ message: "غير مهيأ" }, 500);

  let b;
  try { b = await req.json(); } catch (e) { return json({ message: "bad request" }, 400); }

  const got = Buffer.from(String(b.secret_token || "")), exp = Buffer.from(want);
  if (got.length !== exp.length || !timingSafeEqual(got, exp)) return json({ message: "unauthorized" }, 401);

  if (!String(b.type || "").startsWith("payment_")) return json({ ok: true });
  const pid = b.data && b.data.id;
  if (!pid) return json({ ok: true });

  const payment = await fetchPayment(pid);
  if (!payment) return json({ ok: false }, 502);
  const m = String(payment.description || "").match(/^Order (AMC-[0-9A-F]{10})$/);
  if (!m) return json({ ok: true });

  await settle(m[1], payment);
  return json({ ok: true });
};
