import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  db: {
    account: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    plan: { findUnique: vi.fn(), upsert: vi.fn(), createMany: vi.fn() },
    subscription: { findUnique: vi.fn() },
    planRequest: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
    platformEvent: { create: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(), $queryRaw: vi.fn(),
  }, user: vi.fn(), admin: vi.fn(),
}));
vi.mock("./db", () => ({ db: mocks.db }));
vi.mock("./auth", async original => ({ ...await original<typeof import("./auth")>(), getUser: mocks.user, getAdmin: mocks.admin }));
import { POST as accountPost } from "../app/api/account/route";
import { POST as platformPost } from "../app/api/platform/route";
import { getDefaultPlans } from "./plans";
const requestId = "3297dd39-2a1b-4e43-bb3d-bb39dc6fe3d0";
const request = (body: unknown, origin = "https://guard.example") => new Request("https://guard.example/api/account", { method: "POST", headers: { origin, "content-type": "application/json", "x-darban-locale": "en" }, body: JSON.stringify(body) });
const selection = { operation: "request-plan", planId: "pro", interval: "annual", requestId };
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("APP_URL", "https://guard.example"); vi.stubEnv("GUARD_ADMIN_IDS", "11");
  mocks.user.mockResolvedValue({ id: "22", name: "Customer", locale: "en", isPlatformAdmin: false });
  mocks.admin.mockResolvedValue({ id: "11", name: "Admin" });
  mocks.db.$transaction.mockImplementation(async work => work(mocks.db));
  mocks.db.account.findUnique.mockResolvedValue({ id: "22", status: "ACTIVE" });
  const { featuresFa, featuresEn, ...plan } = getDefaultPlans()[1];
  mocks.db.plan.findUnique.mockResolvedValue({ ...plan, featuresFaJson: featuresFa, featuresEnJson: featuresEn });
  mocks.db.planRequest.findUnique.mockResolvedValue(null);
  mocks.db.planRequest.create.mockImplementation(async ({ data }) => ({ id: "request-record", ...data }));
});
it("records a server-priced pending request without activating or charging", async () => {
  const response = await accountPost(request(selection));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ ok: true, charged: false, result: { status: "PENDING", initialCents: 2100, renewalCents: 5500, currency: "USD" } });
  expect(mocks.db.planRequest.create).toHaveBeenCalledWith({ data: expect.objectContaining({ accountId: "22", planId: "pro", interval: "annual", requestId }) });
});
it("rejects client pricing and roles", async () => {
  for (const extra of [{ initialCents: 1 }, { role: "admin" }]) expect((await accountPost(request({ ...selection, ...extra }))).status).toBe(400);
  expect(mocks.db.planRequest.create).not.toHaveBeenCalled();
});
it("replays the immutable original quote and rejects cross-account collisions", async () => {
  const stored = { id: "request-record", accountId: "22", planId: "pro", interval: "annual", initialCents: 2000, status: "PENDING" };
  mocks.db.planRequest.findUnique.mockResolvedValue(stored);
  expect(await (await accountPost(request(selection))).json()).toMatchObject({ result: stored });
  expect(mocks.db.planRequest.create).not.toHaveBeenCalled();
  mocks.db.planRequest.findUnique.mockResolvedValue({ ...stored, accountId: "33" });
  expect((await accountPost(request(selection))).status).toBe(409);
});
it("scopes cancellation to the customer and pending requests", async () => {
  mocks.db.planRequest.updateMany.mockResolvedValue({ count: 1 });
  expect((await accountPost(request({ operation: "cancel-request", requestId: "cm123456789012345678901234" }))).status).toBe(200);
  expect(mocks.db.planRequest.updateMany).toHaveBeenCalledWith({ where: { id: "cm123456789012345678901234", accountId: "22", status: "PENDING" }, data: { status: "CANCELLED" } });
});
it("checks session, origin, and active status before account mutations", async () => {
  mocks.user.mockResolvedValue(null);
  expect((await accountPost(request(selection))).status).toBe(401);
  mocks.user.mockResolvedValue({ id: "22" });
  expect((await accountPost(request(selection, "https://evil.example"))).status).toBe(403);
  mocks.db.account.findUnique.mockResolvedValue({ status: "SUSPENDED" });
  expect((await accountPost(request(selection))).status).toBe(403);
  expect(mocks.db.planRequest.create).not.toHaveBeenCalled();
});
it("allows only a locale profile update", async () => {
  mocks.db.account.update.mockResolvedValue({ id: "22", locale: "fa" });
  expect((await accountPost(request({ operation: "profile", locale: "fa" }))).status).toBe(200);
  expect(mocks.db.account.update).toHaveBeenCalledWith({ where: { id: "22" }, data: { locale: "fa" } });
  expect((await accountPost(request({ operation: "profile", locale: "en", status: "ACTIVE" }))).status).toBe(400);
});
it("denies platform mutation without platform authentication even with a role header", async () => {
  mocks.admin.mockResolvedValue(null);
  expect((await platformPost(request({ operation: "account-status", accountId: "33", status: "SUSPENDED" }))).status).toBe(401);
  expect(mocks.db.account.update).not.toHaveBeenCalled();
});
it("protects platform IDs and self from status changes", async () => {
  expect((await platformPost(request({ operation: "account-status", accountId: "11", status: "SUSPENDED" }))).status).toBe(403);
  expect(mocks.db.account.update).not.toHaveBeenCalled();
});
it("audits suspension and plan edits in the same transaction", async () => {
  mocks.db.account.update.mockResolvedValue({ id: "22", status: "SUSPENDED" });
  expect((await platformPost(request({ operation: "account-status", accountId: "22", status: "SUSPENDED" }))).status).toBe(200);
  expect(mocks.db.platformEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ actorId: "11", action: "account-status", targetId: "22" }) });
  expect((await platformPost(request({ operation: "update-plan", plan: getDefaultPlans()[1] }))).status).toBe(200);
  expect(mocks.db.plan.upsert).toHaveBeenCalledOnce();
  expect(mocks.db.platformEvent.create).toHaveBeenCalledTimes(2);
});
it("never falls back to a purchase during a database outage", async () => {
  mocks.db.plan.findUnique.mockRejectedValue(new Error("private database password"));
  const response = await accountPost(request(selection));
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("password");
  expect(mocks.db.planRequest.create).not.toHaveBeenCalled();
});
