import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/generated/prisma/client", () => ({ PrismaClient: class { guardChat = {}; } }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: class {} }));
import { db } from "./db";
afterEach(() => vi.unstubAllEnvs());
it("does not silently connect using ambient PostgreSQL defaults", () => {
  vi.stubEnv("DATABASE_URL", "");
  expect(() => db.guardChat).toThrow("DATABASE_URL");
});
