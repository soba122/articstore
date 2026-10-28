import { json, readSession } from "../lib/auth.mjs";
import { getOrder, userOrders, pub } from "../lib/orders.mjs";

export default async (req) => {
  const email = readSession(req);
  if (!email) return json({ message: "سجّل الدخول أولاً" }, 401);
  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const o = await getOrder(id);
    if (!o || o.email !== email) return json({ message: "الطلب غير موجود" }, 404);
    return json({ order: pub(o) });
  }
  const list = await userOrders(email);
  return json({ orders: list.map(pub) });
};
