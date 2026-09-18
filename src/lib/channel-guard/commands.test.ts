import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ moderate: vi.fn(), telegram: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("./access", async original => ({ ...await original<typeof import("./access")>(), allowedAdmin: () => true, requireChat: vi.fn() }));
vi.mock("./actions", () => ({ moderateMember: mocks.moderate }));
vi.mock("./telegram", async original => ({ ...await original<typeof import("./telegram")>(), telegram: mocks.telegram }));
import { handlePrivateMessage } from "./commands";
import { adminInput } from "./input";

it("uses a valid stable idempotency UUID for repeated Telegram admin commands", async () => {
  const message = { message_id: 1, chat: { id: "11", type: "private" }, from: { id: "11", first_name: "مدیر" }, text: "/ban -100 22 تکرار پیام" };
  await handlePrivateMessage(message, 12345);
  await handlePrivateMessage(message, 12345);
  const first = mocks.moderate.mock.calls[0][0];
  expect(adminInput.safeParse({ ...first, operation: "moderate" }).success).toBe(true);
  expect(mocks.moderate.mock.calls[1][0].requestId).toBe(first.requestId);
  await handlePrivateMessage(message, 12346);
  expect(mocks.moderate.mock.calls[2][0].requestId).not.toBe(first.requestId);
});
