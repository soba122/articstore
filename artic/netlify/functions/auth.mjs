import { createHmac, createHash, scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

export const json = (b, s = 200, h = {}) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", ...h } });
export const normEmail = (e) => String(e || "").trim().toLowerCase();
export const validEmail = (e) => e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
export const emailKey = (e) => createHash("sha256").update(e).digest("hex");

export function hashPw(pw) {
  const salt = randomBytes(16);
  return salt.toString("hex") + ":" + scryptSync(pw, salt, 64).toString("hex");
}
export function checkPw(pw, stored) {
  const [s, h] = String(stored).split(":");
  const a = scryptSync(pw, Buffer.from(s, "hex"), 64);
  const b = Buffer.from(h, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

const sign = (p) => createHmac("sha256", process.env.CODE_SECRET).update("session:" + p).digest("base64url");

export function makeSession(email) {
  const p = Buffer.from(JSON.stringify({ e: email, x: Date.now() + 30 * 864e5 })).toString("base64url");
  return p + "." + sign(p);
}
export function readSession(req) {
  const m = (req.headers.get("cookie") || "").match(/(?:^|;\s*)session=([^;]+)/);
  if (!m) return null;
  const [p, sig] = m[1].split(".");
  if (!p || !sig) return null;
  const good = Buffer.from(sign(p));
  const given = Buffer.from(sig);
  if (good.length !== given.length || !timingSafeEqual(good, given)) return null;
  try {
    const d = JSON.parse(Buffer.from(p, "base64url").toString());
    return d.x > Date.now() ? d.e : null;
  } catch { return null; }
}
export const cookie = (v, age) => `session=${v}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${age}`;
