import { describe, expect, it } from "vitest";
import { marketingCopy, pricePresentation } from "./marketing-copy";

function shape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, shape(item)]));
  }
  expect(typeof value).toBe("string");
  expect(String(value).trim().length).toBeGreaterThan(0);
  return "string";
}

const pro = { id: "pro" as const, monthlyCents: 500, annualCents: 5500, introAnnualCents: 2100, currency: "USD" as const };

describe("public marketing copy", () => {
  it("has matching, nonempty Persian and English content", () => {
    expect(shape(marketingCopy.fa)).toEqual(shape(marketingCopy.en));
  });

  it("makes the sample, human decision, and Telegram limits explicit", () => {
    expect(marketingCopy.en.sample.notice).toMatch(/synthetic.*read-only/i);
    expect(marketingCopy.fa.sample.notice).toContain("ساختگی");
    expect(marketingCopy.en.safety.body).toMatch(/never.*automatically/i);
    expect(marketingCopy.en.safety.body).toMatch(/beliefs/i);
    expect(marketingCopy.en.limits.body).toMatch(/account creation dates/i);
    expect(marketingCopy.en.limits.body).toMatch(/full subscriber list/i);
    expect(marketingCopy.en.pricing.pending).toBe("Plan-specific limits and features are being finalized.");
    expect(marketingCopy.en.pricing.payment).toMatch(/not.*configured/i);
    expect(marketingCopy.en.pricing.reference).toMatch(/reference.*not live/i);
  });

  it("does not invent unlimited allowances, social proof, or urgency", () => {
    expect(JSON.stringify(marketingCopy)).not.toMatch(/unlimited|نامحدود|trusted by|last chance|countdown|most popular/i);
  });
});

describe("truthful configurable price presentation", () => {
  it("distinguishes the first annual year from regular renewal", () => {
    expect(pricePresentation(pro, "annual")).toEqual({ initialCents: 2100, renewalCents: 5500, introductory: true, interval: "annual" });
  });

  it("does not apply the annual promotion to monthly prices", () => {
    expect(pricePresentation(pro, "monthly")).toEqual({ initialCents: 500, renewalCents: 500, introductory: false, interval: "monthly" });
  });

  it("keeps free pricing zero in either interval", () => {
    const free = { ...pro, id: "free" as const, monthlyCents: 0, annualCents: 0, introAnnualCents: null };
    expect(pricePresentation(free, "annual").initialCents).toBe(0);
    expect(pricePresentation(free, "monthly").initialCents).toBe(0);
    expect(pricePresentation(free, "annual").introductory).toBe(false);
  });

  it("reads changed configuration rather than hardcoding advertised prices", () => {
    expect(pricePresentation({ ...pro, introAnnualCents: 2900, annualCents: 6900 }, "annual")).toMatchObject({ initialCents: 2900, renewalCents: 6900 });
    expect(pricePresentation({ ...pro, introAnnualCents: null }, "annual")).toMatchObject({ initialCents: 5500, introductory: false });
  });
});
