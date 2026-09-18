import { z } from "zod";

// The plan shape and its invariants, with no database import: client forms
// validate against this before posting, and plans.ts builds on it server-side.
const cents = z.number().int().min(0).max(100_000_000);
const features = z.array(z.string().trim().min(1).max(300)).max(30);
export const planSchema = z.strictObject({
  id: z.enum(["free", "pro"]), monthlyCents: cents, annualCents: cents,
  introAnnualCents: cents.nullable(), currency: z.literal("USD"),
  featuresFa: features, featuresEn: features, available: z.boolean(),
}).refine(plan => plan.introAnnualCents === null || plan.introAnnualCents <= plan.annualCents)
  .refine(plan => plan.id === "free"
    ? plan.monthlyCents === 0 && plan.annualCents === 0 && (plan.introAnnualCents === null || plan.introAnnualCents === 0)
    : plan.monthlyCents > 0 && plan.annualCents > 0 && (plan.introAnnualCents === null || plan.introAnnualCents > 0));
export type PlanConfig = z.infer<typeof planSchema>;
