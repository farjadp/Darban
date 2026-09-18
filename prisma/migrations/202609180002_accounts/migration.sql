CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'fa',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Account_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Account_locale_check" CHECK ("locale" IN ('fa', 'en')),
    CONSTRAINT "Account_status_check" CHECK ("status" IN ('ACTIVE', 'SUSPENDED'))
);
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "monthlyCents" INTEGER NOT NULL,
    "annualCents" INTEGER NOT NULL,
    "introAnnualCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "featuresFaJson" JSONB NOT NULL DEFAULT '[]',
    "featuresEnJson" JSONB NOT NULL DEFAULT '[]',
    "available" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Plan_amounts_check" CHECK (
      "id" IN ('free', 'pro') AND "currency" = 'USD'
      AND "monthlyCents" BETWEEN 0 AND 100000000 AND "annualCents" BETWEEN 0 AND 100000000
      AND ("introAnnualCents" IS NULL OR "introAnnualCents" BETWEEN 0 AND "annualCents")
      AND (("id" = 'free' AND "monthlyCents" = 0 AND "annualCents" = 0 AND ("introAnnualCents" IS NULL OR "introAnnualCents" = 0))
        OR ("id" = 'pro' AND "monthlyCents" > 0 AND "annualCents" > 0 AND ("introAnnualCents" IS NULL OR "introAnnualCents" > 0)))
    )
);
CREATE TABLE "Subscription" (
    "accountId" TEXT NOT NULL,
    "planId" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("accountId"),
    CONSTRAINT "Subscription_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "PlanRequest" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "initialCents" INTEGER NOT NULL,
    "renewalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PlanRequest_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlanRequest_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlanRequest_quote_check" CHECK ("interval" IN ('monthly', 'annual') AND "currency" = 'USD' AND "initialCents" BETWEEN 0 AND 100000000 AND "renewalCents" BETWEEN 0 AND 100000000)
);
CREATE UNIQUE INDEX "PlanRequest_requestId_key" ON "PlanRequest"("requestId");
CREATE INDEX "PlanRequest_accountId_createdAt_idx" ON "PlanRequest"("accountId", "createdAt");
CREATE TABLE "PlatformEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "detailJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlatformEvent_createdAt_idx" ON "PlatformEvent"("createdAt");
INSERT INTO "Plan" ("id", "monthlyCents", "annualCents", "introAnnualCents", "currency", "featuresFaJson", "featuresEnJson", "available") VALUES
  ('free', 0, 0, NULL, 'USD', '[]', '[]', true),
  ('pro', 500, 5500, 2100, 'USD', '[]', '[]', true)
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Account" ("id", "name", "updatedAt")
SELECT DISTINCT "userId", "userId", CURRENT_TIMESTAMP FROM "ChatAdmin"
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Subscription" ("accountId", "planId", "status", "updatedAt")
SELECT "id", 'free', 'FREE', CURRENT_TIMESTAMP FROM "Account"
ON CONFLICT ("accountId") DO NOTHING;
