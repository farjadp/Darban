import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("./db", () => ({ db: { plan: { findMany: mocks.findMany } } }));
import { getDefaultPlans, getPlans, planSchema, quotePlan } from "./plans";
beforeEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });
it("quotes the agreed USD amounts without invented features", () => {
  const [free, pro] = getDefaultPlans();
  expect(free).toMatchObject({ monthlyCents: 0, annualCents: 0, featuresFa: [], featuresEn: [] });
  expect(quotePlan(pro, "monthly")).toEqual({ initialCents: 500, renewalCents: 500, interval: "monthly", introductory: false });
  expect(quotePlan(pro, "annual")).toEqual({ initialCents: 2100, renewalCents: 5500, interval: "annual", introductory: true });
  expect(quotePlan(free, "annual").initialCents).toBe(0);
});
it("validates environment prices and falls back safely", () => {
  vi.stubEnv("PLAN_PRO_MONTHLY_CENTS", "600");
  vi.stubEnv("PLAN_PRO_ANNUAL_CENTS", "-10");
  vi.stubEnv("PLAN_PRO_INTRO_ANNUAL_CENTS", "NaN");
  expect(getDefaultPlans()[1]).toMatchObject({ monthlyCents: 600, annualCents: 5500, introAnnualCents: 2100 });
});
it("distinguishes missing configuration from database outage", async () => {
  vi.stubEnv("DATABASE_URL", "");
  expect(await getPlans()).toMatchObject({ source: "defaults", unavailable: false });
  expect(mocks.findMany).not.toHaveBeenCalled();
  vi.stubEnv("DATABASE_URL", "postgresql://mock");
  mocks.findMany.mockRejectedValue(new Error("secret"));
  expect(await getPlans()).toMatchObject({ source: "defaults", unavailable: true });
});
it("handles an empty database explicitly and loads persisted prices", async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://mock");
  mocks.findMany.mockResolvedValue([]);
  expect(await getPlans()).toMatchObject({ source: "defaults", unavailable: false });
  mocks.findMany.mockResolvedValue(getDefaultPlans().map(({ featuresFa, featuresEn, ...plan }) => ({ ...plan, featuresFaJson: featuresFa, featuresEnJson: featuresEn })));
  expect(await getPlans()).toEqual({ plans: getDefaultPlans(), source: "database", unavailable: false });
});
it("rejects invalid platform pricing and normalizes bounded feature text", () => {
  const [free, pro] = getDefaultPlans();
  for (const plan of [{ ...free, monthlyCents: 1 }, { ...pro, annualCents: 0 }, { ...pro, monthlyCents: 100000001 }, { ...pro, introAnnualCents: 5501 }, { ...pro, monthlyCents: 1.5 }]) expect(planSchema.safeParse(plan).success).toBe(false);
  expect(planSchema.parse({ ...pro, featuresEn: ["  Configured feature  "] }).featuresEn).toEqual(["Configured feature"]);
});
