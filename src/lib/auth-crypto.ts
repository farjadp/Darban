import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export type Admin = { id: string; name: string };
export const SESSION_SECONDS = 8 * 60 * 60;
export const LOGIN_SECONDS = 5 * 60;

const idSchema = z.string().regex(/^[1-9]\d{0,15}$/).refine((value) => Number.isSafeInteger(Number(value)));
const integerSchema = z.union([z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), z.string().regex(/^(0|[1-9]\d{0,15})$/)]).transform(Number).refine(Number.isSafeInteger);
const textSchema = z.string().max(256).regex(/^[^\r\n\u0000]*$/);
const loginSchema = z.strictObject({
  id: z.union([idSchema, z.number().int().positive().max(Number.MAX_SAFE_INTEGER)]).transform(String),
  first_name: textSchema.min(1),
  last_name: textSchema.optional(),
  username: z.string().regex(/^[a-zA-Z0-9_]{1,64}$/).optional(),
  photo_url: z.string().max(2048).url().refine((url) => url.startsWith("https://") && !/[\r\n]/.test(url)).optional(),
  auth_date: integerSchema,
  hash: z.string().regex(/^[a-fA-F0-9]{64}$/),
});
const sessionSchema = z.strictObject({
  id: idSchema,
  name: z.string().min(1).max(513).regex(/^[^\r\n\u0000]*$/),
  iat: z.number().int().nonnegative(),
  exp: z.number().int().positive(),
  jti: z.string().regex(/^[a-f0-9]{64}$/),
});

export function equalHex(left: unknown, right: unknown): boolean {
  if (typeof left !== "string" || typeof right !== "string" || !/^[a-fA-F0-9]{64}$/.test(left) || !/^[a-fA-F0-9]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export function verifyTelegramLogin(data: unknown, token: string, nowSeconds: number): (Admin & { hash: string; authDate: number }) | null {
  try {
    const parsed = loginSchema.safeParse(data);
    if (!parsed.success || !token || !Number.isSafeInteger(nowSeconds)) return null;
    const { hash, ...fields } = parsed.data;
    if (nowSeconds - fields.auth_date > LOGIN_SECONDS || fields.auth_date - nowSeconds > 30) return null;
    const canonical = Object.entries(fields).filter(([, value]) => value !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, value]) => `${key}=${value}`).join("\n");
    const key = createHash("sha256").update(token).digest();
    const expected = createHmac("sha256", key).update(canonical).digest("hex");
    if (!equalHex(hash, expected)) return null;
    return { id: fields.id, name: [fields.first_name, fields.last_name].filter(Boolean).join(" "), hash: hash.toLowerCase(), authDate: fields.auth_date };
  } catch {
    return null;
  }
}

export function createSession(admin: Admin, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): string {
  if (Buffer.byteLength(secret, "utf8") < 32) throw new Error("Invalid session configuration");
  const session = sessionSchema.parse({ ...admin, iat: nowSeconds, exp: nowSeconds + SESSION_SECONDS, jti: randomBytes(32).toString("hex") });
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

export function verifySession(value: unknown, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): Admin | null {
  try {
    if (typeof value !== "string" || value.length > 4096 || Buffer.byteLength(secret, "utf8") < 32 || !Number.isSafeInteger(nowSeconds)) return null;
    const parts = value.split(".");
    if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0])) return null;
    const [payload, signature] = parts;
    if (!equalHex(signature, createHmac("sha256", secret).update(payload).digest("hex"))) return null;
    const result = sessionSchema.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
    if (!result.success) return null;
    const session = result.data;
    if (session.exp <= nowSeconds || session.iat > nowSeconds || session.exp <= session.iat || session.exp - session.iat > SESSION_SECONDS) return null;
    return { id: session.id, name: session.name };
  } catch {
    return null;
  }
}
