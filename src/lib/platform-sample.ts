import { getDefaultPlans, type PlanConfig } from "./plans";

// Synthetic platform data for /preview/admin, mirroring getPlatformOverview()
// so the admin screens can be shown without a database or a signed-in operator.
export type PlatformAccount = { id: string; name: string; locale: string; status: string; createdAt: Date; subscription: { planId: string; status: string } | null };
export type PlatformRequest = { id: string; accountId: string; planId: string; interval: string; initialCents: number; renewalCents: number; currency: string; status: string; createdAt: Date; account: { name: string } };
export type PlatformEventRow = { id: string; actorId: string; action: string; targetId: string | null; detailJson: unknown; createdAt: Date };
export type PlatformOverview = { accounts: PlatformAccount[]; requests: PlatformRequest[]; events: PlatformEventRow[]; plans: PlanConfig[] };

export function samplePlatformOverview(): PlatformOverview {
  const at = (iso: string) => new Date(iso);
  const plans = getDefaultPlans().map((plan) => plan.id === "pro"
    ? { ...plan, featuresFa: ["کانال‌های نامحدود", "هشدار هجوم رأی", "گزارش کامل عملیات"], featuresEn: ["Unlimited channels", "Brigading alerts", "Full audit log"] }
    : { ...plan, featuresFa: ["یک کانال", "رأی‌گیری دروازه‌دار"], featuresEn: ["One channel", "Gated voting"] });
  const accounts: PlatformAccount[] = [
    { id: "900000001", name: "کاربر نمونهٔ اول", locale: "fa", status: "ACTIVE", createdAt: at("2026-09-10T08:00:00Z"), subscription: { planId: "pro", status: "ACTIVE" } },
    { id: "900000002", name: "Sample customer two", locale: "en", status: "ACTIVE", createdAt: at("2026-09-14T10:30:00Z"), subscription: { planId: "free", status: "FREE" } },
    { id: "900000003", name: "کاربر نمونهٔ سوم", locale: "fa", status: "SUSPENDED", createdAt: at("2026-09-16T17:45:00Z"), subscription: { planId: "free", status: "FREE" } },
  ];
  const requests: PlatformRequest[] = [
    { id: "sample-request-1", accountId: "900000002", planId: "pro", interval: "annual", initialCents: 2100, renewalCents: 5500, currency: "USD", status: "PENDING", createdAt: at("2026-09-18T09:15:00Z"), account: { name: "Sample customer two" } },
    { id: "sample-request-2", accountId: "900000001", planId: "pro", interval: "monthly", initialCents: 500, renewalCents: 500, currency: "USD", status: "APPROVED", createdAt: at("2026-09-11T12:00:00Z"), account: { name: "کاربر نمونهٔ اول" } },
  ];
  const events: PlatformEventRow[] = [
    { id: "sample-event-1", actorId: "900000000", action: "account-status", targetId: "900000003", detailJson: { status: "SUSPENDED" }, createdAt: at("2026-09-17T08:20:00Z") },
    { id: "sample-event-2", actorId: "900000000", action: "update-plan", targetId: "pro", detailJson: { monthlyCents: 500, annualCents: 5500, introAnnualCents: 2100 }, createdAt: at("2026-09-12T15:00:00Z") },
  ];
  return { accounts, requests, events, plans };
}
