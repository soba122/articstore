import { json } from "../lib/auth.mjs";
export default async () => {
  const pk = process.env.MOYASAR_PUBLISHABLE_KEY;
  if (!pk) return json({ message: "خدمة الدفع غير مهيأة بعد" }, 500);
  return json({ pk });
};
