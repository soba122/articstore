import { getStore } from "@netlify/blobs";
import { createHmac, createHash, scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

export const json = (b, s = 200, h = {}) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: Object.assign({ "Content-Type": "application/json" }, h),
  });

export const normEmail = (e) => String(e || "").trim().toLowerCase();

export const validEmail = (e) =>
  e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

export const emailKey = (e) => createHash("sha256").update(e).digest("hex");

export function hashPw(pw) {
  const salt = randomBytes(16);
  return salt.toString("hex") + ":" + scryptSync(pw, salt, 64).toString("hex");
}

export function checkPw(pw, stored) {
  const parts = String(stored).split(":");
  const a = scryptSync(pw, Buffer.from(parts[0], "hex"), 64);
  const b = Buffer.from(parts[1], "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function sign(p) {
  return createHmac("sha256", process.env.CODE_SECRET)
    .update("session:" + p)
    .digest("base64url");
}

export function makeSession(email) {
  const data = { e: email, x: Date.now() + 30 * 24 * 3600 * 1000 };
  const p = Buffer.from(JSON.stringify(data)).toString("base64url");
  return p + "." + sign(p);
}

export function readSession(req) {
  const raw = req.headers.get("cookie") || "";
  const m = raw.match(/(?:^|;\s*)session=([^;]+)/);
  if (!m) return null;
  const parts = m[1].split(".");
  const p = parts[0];
  const sig = parts[1];
  if (!p || !sig) return null;
  const good = Buffer.from(sign(p));
  const given = Buffer.from(sig);
  if (good.length !== given.length || !timingSafeEqual(good, given)) return null;
  try {
    const d = JSON.parse(Buffer.from(p, "base64url").toString());
    return d.x > Date.now() ? d.e : null;
  } catch (e) {
    return null;
  }
}

export function cookie(v, age) {
  return "session=" + v + "; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=" + age;
}

export async function tooMany(key) {
  const r = await getStore("login-attempts").get(key, { type: "json" });
  return !!r && Date.now() - r.first < 900000 && r.n >= 5;
}

export async function failed(key) {
  const s = getStore("login-attempts");
  const r = await s.get(key, { type: "json" });
  const fresh = r && Date.now() - r.first < 900000;
  await s.setJSON(key, {
    n: (fresh ? r.n : 0) + 1,
    first: fresh ? r.first : Date.now(),
  });
}

export async function cleared(key) {
  await getStore("login-attempts").delete(key);
}
