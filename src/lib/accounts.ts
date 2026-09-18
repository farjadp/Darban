import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { AuthError, isPlatformAdminId } from "./auth";
import { limitedJson } from "./http";
import { ensurePlans, parseStoredPlan, persistedPlan, planSchema, quotePlan } from "./plans";

const localeSchema = z.enum(["fa", "en"]);
const telegramId = z.string().regex(/^[1-9]\d{0,15}$/).refine(id => Number.isSafeInteger(Number(id)));
export const accountInput = z.discriminatedUnion("operation", [
  z.strictObject({ operation: z.literal("profile"), locale: localeSchema }),
  z.strictObject({ operation: z.literal("request-plan"), planId: z.enum(["free", "pro"]), interval: z.enum(["monthly", "annual"]), requestId: z.uuid() }),
  z.strictObject({ operation: z.literal("cancel-request"), requestId: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/) }),
]);
export const platformInput = z.discriminatedUnion("operation", [
  z.strictObject({ operation: z.literal("update-plan"), plan: planSchema }),
  z.strictObject({ operation: z.literal("account-status"), accountId: telegramId, status: z.enum(["ACTIVE", "SUSPENDED"]) }),
]);

export async function readAccountBody(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new AuthError(415, "نوع درخواست باید JSON باشد.");
  try { return await limitedJson(request, 32_768); }
  catch { throw new AuthError(400, "ساختار درخواست معتبر نیست."); }
}

export async function upsertAccount(tx: Prisma.TransactionClient, user: { id: string; name: string }, locale?: "fa" | "en") {
  const account = await tx.account.upsert({
    where: { id: user.id }, create: { id: user.id, name: user.name, locale: locale ?? "fa", status: "ACTIVE" },
    update: { name: user.name, ...(locale ? { locale } : {}) },
  });
  if (account.status !== "ACTIVE") throw new AuthError(403, "این حساب تعلیق شده است.");
  await ensurePlans(tx);
  await tx.subscription.upsert({ where: { accountId: user.id }, create: { accountId: user.id, planId: "free", status: "FREE" }, update: {} });
  return account;
}

async function activeAccount(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${id} FOR UPDATE`;
  const account = await tx.account.findUnique({ where: { id } });
  if (!account || account.status !== "ACTIVE") throw new AuthError(403, "حساب فعال پیدا نشد.");
  return account;
}

export async function mutateAccount(id: string, input: z.infer<typeof accountInput>) {
  try {
    return await db.$transaction(async tx => {
      await activeAccount(tx, id);
      if (input.operation === "profile") return tx.account.update({ where: { id }, data: { locale: input.locale } });
      if (input.operation === "cancel-request") {
        const changed = await tx.planRequest.updateMany({ where: { id: input.requestId, accountId: id, status: "PENDING" }, data: { status: "CANCELLED" } });
        if (!changed.count) throw new AuthError(409, "درخواست در انتظار پیدا نشد.");
        return { id: input.requestId, status: "CANCELLED" };
      }
      const existing = await tx.planRequest.findUnique({ where: { requestId: input.requestId } });
      if (existing) {
        if (existing.accountId !== id || existing.planId !== input.planId || existing.interval !== input.interval) throw new AuthError(409, "شناسه درخواست قبلاً استفاده شده است.");
        return existing;
      }
      await ensurePlans(tx);
      const row = await tx.plan.findUnique({ where: { id: input.planId } });
      if (!row) throw new AuthError(503, "تنظیمات طرح در دسترس نیست.");
      const plan = parseStoredPlan(row);
      if (!plan.available) throw new AuthError(409, "این طرح در دسترس نیست.");
      const quote = quotePlan(plan, input.interval);
      return tx.planRequest.create({ data: { accountId: id, planId: plan.id, interval: input.interval, requestId: input.requestId, initialCents: quote.initialCents, renewalCents: quote.renewalCents, currency: plan.currency, status: "PENDING" } });
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") throw new AuthError(409, "شناسه درخواست قبلاً استفاده شده است.");
    throw error;
  }
}

export async function mutatePlatform(actorId: string, input: z.infer<typeof platformInput>) {
  if (!isPlatformAdminId(actorId)) throw new AuthError(403, "دسترسی مجاز نیست.");
  return db.$transaction(async tx => {
    await activeAccount(tx, actorId);
    if (input.operation === "update-plan") {
      const plan = planSchema.parse(input.plan);
      const data = persistedPlan(plan);
      const result = await tx.plan.upsert({ where: { id: plan.id }, create: data, update: data });
      await tx.platformEvent.create({ data: { actorId, action: "update-plan", targetId: plan.id, detailJson: plan } });
      return result;
    }
    if (input.accountId === actorId || isPlatformAdminId(input.accountId)) throw new AuthError(403, "وضعیت مدیر پلتفرم قابل تغییر نیست.");
    const target = await tx.account.findUnique({ where: { id: input.accountId } });
    if (!target) throw new AuthError(404, "حساب پیدا نشد.");
    const result = await tx.account.update({ where: { id: input.accountId }, data: { status: input.status } });
    await tx.platformEvent.create({ data: { actorId, action: "account-status", targetId: input.accountId, detailJson: { status: input.status } } });
    return result;
  });
}

const accountSelect = { id: true, name: true, locale: true, status: true, createdAt: true } as const;
const subscriptionSelect = { planId: true, status: true } as const;
export async function getAccountOverview(id: string) {
  const record = await db.account.findUnique({ where: { id }, select: { ...accountSelect, subscription: { select: subscriptionSelect }, requests: { orderBy: { createdAt: "desc" }, take: 100, select: { id: true, planId: true, interval: true, initialCents: true, renewalCents: true, currency: true, status: true, createdAt: true } } } });
  if (!record || record.status !== "ACTIVE") throw new AuthError(403, "حساب فعال پیدا نشد.");
  const { subscription, requests, ...account } = record;
  if (!subscription) throw new AuthError(503, "تنظیمات اشتراک در دسترس نیست.");
  return { account, subscription, requests };
}

export async function getPlatformOverview() {
  const [accounts, requests, events] = await Promise.all([
    db.account.findMany({ orderBy: { createdAt: "desc" }, take: 100, select: { ...accountSelect, subscription: { select: subscriptionSelect } } }),
    db.planRequest.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { account: { select: { name: true } } } }),
    db.platformEvent.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  return { accounts, requests, events };
}
