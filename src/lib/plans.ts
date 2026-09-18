import { db } from "./db";
import type { Prisma } from "@/generated/prisma/client";
import { planSchema, type PlanConfig } from "./plan-schema";

export { planSchema, type PlanConfig };

function envCents(key: string, fallback: number) {
  const raw = process.env[key];
  if (!raw || !/^[1-9]\d*$/.test(raw)) return fallback;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value <= 100_000_000 ? value : fallback;
}

export function getDefaultPlans(): PlanConfig[] {
  const annualCents = envCents("PLAN_PRO_ANNUAL_CENTS", 5500);
  const intro = envCents("PLAN_PRO_INTRO_ANNUAL_CENTS", 2100);
  return [
    { id: "free", monthlyCents: 0, annualCents: 0, introAnnualCents: null, currency: "USD", featuresFa: [], featuresEn: [], available: true },
    { id: "pro", monthlyCents: envCents("PLAN_PRO_MONTHLY_CENTS", 500), annualCents, introAnnualCents: intro <= annualCents ? intro : annualCents >= 2100 ? 2100 : null, currency: "USD", featuresFa: [], featuresEn: [], available: true },
  ];
}

export function quotePlan(plan: PlanConfig, interval: "monthly" | "annual") {
  const valid = planSchema.parse(plan);
  const renewalCents = interval === "monthly" ? valid.monthlyCents : valid.annualCents;
  const initialCents = interval === "annual" ? valid.introAnnualCents ?? renewalCents : renewalCents;
  return { initialCents, renewalCents, interval, introductory: initialCents < renewalCents };
}

export function persistedPlan(plan: PlanConfig) {
  const { featuresFa, featuresEn, ...rest } = plan;
  return { ...rest, featuresFaJson: featuresFa, featuresEnJson: featuresEn };
}

export function parseStoredPlan(row: { id: string; monthlyCents: number; annualCents: number; introAnnualCents: number | null; currency: string; featuresFaJson: unknown; featuresEnJson: unknown; available: boolean }): PlanConfig {
  return planSchema.parse({ id: row.id, monthlyCents: row.monthlyCents, annualCents: row.annualCents, introAnnualCents: row.introAnnualCents, currency: row.currency, featuresFa: row.featuresFaJson, featuresEn: row.featuresEnJson, available: row.available });
}

export async function ensurePlans(tx: Prisma.TransactionClient) {
  await tx.plan.createMany({ data: getDefaultPlans().map(persistedPlan), skipDuplicates: true });
}

export async function getPlans(): Promise<{ plans: PlanConfig[]; source: "database" | "defaults"; unavailable: boolean }> {
  const fallback = { plans: getDefaultPlans(), source: "defaults" as const, unavailable: false };
  if (!process.env.DATABASE_URL) return fallback;
  try {
    const rows = await db.plan.findMany({ where: { id: { in: ["free", "pro"] } }, orderBy: { id: "asc" } });
    if (!rows.length) return fallback;
    if (rows.length !== 2) return { ...fallback, unavailable: true };
    return { plans: rows.map(parseStoredPlan), source: "database", unavailable: false };
  } catch { return { ...fallback, unavailable: true }; }
}
