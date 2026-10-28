import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import { emailKey } from "./auth.mjs";

export const newId = () => "AMC-" + randomBytes(5).toString("hex").toUpperCase();
export const getOrder = (id) => getStore("orders").get(String(id), { type: "json" });
export const saveOrder = (o) => getStore("orders").setJSON(o.id, o);

export async function addToUser(email, id) {
  const s = getStore("user-orders"), k = emailKey(email);
  const list = (await s.get(k, { type: "json" })) || [];
  list.unshift(id);
  await s.setJSON(k, list.slice(0, 200));
}
export async function userOrders(email) {
  const ids = (await getStore("user-orders").get(emailKey(email), { type: "json" })) || [];
  const out = [];
  for (const id of ids.slice(0, 50)) {
    const o = await getOrder(id);
    if (o) out.push(o);
  }
  return out;
}
export const pub = (o) => ({
  id: o.id, items: o.items, amount: o.amount, currency: o.currency,
  status: o.status, username: o.username, createdAt: o.createdAt, paidAt: o.paidAt || null,
});

export async function fetchPayment(id) {
  const key = Buffer.from(process.env.MOYASAR_SECRET_KEY + ":").toString("base64");
  const r = await fetch("https://api.moyasar.com/v1/payments/" + encodeURIComponent(id), {
    headers: { Authorization: "Basic " + key },
  });
  if (!r.ok) return null;
  return r.json();
}

export async function settle(orderId, payment) {
  const o = await getOrder(orderId);
  if (!o) return null;
  if (["paid", "delivering", "delivered"].includes(o.status)) return o;

  if (payment.status === "paid") {
    if (payment.amount !== o.amount || payment.currency !== o.currency) {
      o.note = "amount_or_currency_mismatch";
      await saveOrder(o);
      return o;
    }
    if (payment.description && payment.description !== "Order " + o.id) {
      o.note = "description_mismatch";
      await saveOrder(o);
      return o;
    }
    const pays = getStore("payments");
    const used = await pays.get(payment.id, { type: "json" });
    if (used && used.orderId !== o.id) return o;
    await pays.setJSON(payment.id, { orderId: o.id });
    o.status = "paid";
    o.paymentId = payment.id;
    o.paidAt = Date.now();
    await saveOrder(o);
    await getStore("delivery-jobs").setJSON(o.id, {
      orderId: o.id, username: o.username, items: o.items, status: "pending", attempts: 0, createdAt: Date.now(),
    });
  } else if (payment.status === "failed") {
    if (o.status === "pending_payment" || o.status === "verifying") {
      o.status = "failed";
      o.paymentId = payment.id;
      await saveOrder(o);
    }
  } else if (payment.status === "initiated" && o.status === "pending_payment") {
    o.status = "verifying";
    o.paymentId = payment.id;
    await saveOrder(o);
  }
  return o;
}
