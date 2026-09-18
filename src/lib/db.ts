import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalDb = globalThis as unknown as { guardDb?: PrismaClient };
export const db = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is required.");
    const client = globalDb.guardDb ??= new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
