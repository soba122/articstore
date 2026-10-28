import { json, readSession } from "../lib/auth.mjs";
import { PRODUCTS } from "../lib/catalog.mjs";
import { newId, saveOrder, addToUser } from "../lib/orders.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ message: "طريقة غير مسموحة" }, 405);
  const { MOYASAR_SECRET_KEY, MOYASAR_PUBLISHABLE_KEY, CODE_SECRET } = process.env;
  if (!MOYASAR_SECRET_KEY || !MOYASAR_PUBLISHABLE_KEY || !CODE_SECRET)
    return json({ message: "خدمة الدفع غير مهيأة بعد" }, 500);

  const email = readSession(req);
  if (!email) return json({ message: "سجّل الدخول أولاً" }, 401);

  let b;
  try { b = await req.json(); } catch (e) { return json({ message: "طلب غير صالح" }, 400); }

  const username = String(b.username || "").trim();
  if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) return json({ message: "اسم اللاعب غير صحيح" }, 400);

  const entries = Object.entries(b.items && typeof b.items === "object" ? b.items : {});
  if (!entries.length || entries.length > 10) return json({ message: "السلة فارغة أو غير صحيحة" }, 400);

  const items = [];
  let amount = 0;
  for (const [pid, q] of entries) {
    const qty = Number(q);
    if (!Object.prototype.hasOwnProperty.call(PRODUCTS, pid) || !Number.isInteger(qty) || qty < 1 || qty > 5)
      return json({ message: "منتج أو كمية غير صحيحة" }, 400);
    const p = PRODUCTS[pid];
    items.push({ id: pid, name: p.name, qty, unit: p.price });
    amount += p.price * qty;
  }

  const id = newId();
  const origin = new URL(req.url).origin;
  const res = await fetch("https://api.moyasar.com/v1/payment_intents", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(MOYASAR_SECRET_KEY + ":").toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount, currency: "SAR", description: "Order " + id, callback_url: origin + "/?order=" + id,
    }),
  });
  if (!res.ok) {
    console.error("moyasar intent failed", res.status);
    return json({ message: "تعذر تجهيز الدفع، حاول لاحقاً" }, 502);
  }
  const intent = await res.json();

  await saveOrder({
    id, email, username, items, amount, currency: "SAR",
    status: "pending_payment", intentId: intent.id, createdAt: Date.now(),
  });
  await addToUser(email, id);
  return json({ orderId: id, intent_id: intent.id, client_secret: intent.client_secret, amount });
};
