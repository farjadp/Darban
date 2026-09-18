import { timingSafeEqual } from "node:crypto";

export function validWebhookSecret(received: string | null, expected = process.env.GUARD_WEBHOOK_SECRET) {
  if (!expected || !/^[A-Za-z0-9_-]{32,256}$/.test(expected) || !received) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
