import { json, cookie } from "../lib/auth.mjs";
export default async () => json({ ok: true }, 200, { "Set-Cookie": cookie("", 0) });
