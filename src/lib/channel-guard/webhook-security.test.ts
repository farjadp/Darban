import { expect, it } from "vitest";
import { validWebhookSecret } from "./webhook-security";
import { limitedJson } from "@/lib/http";

it("fails closed with no configured webhook secret", () => expect(validWebhookSecret("", "")).toBe(false));
it("rejects a short configured webhook secret", () => expect(validWebhookSecret("abc", "abc")).toBe(false));
it("compares webhook secrets", () => { expect(validWebhookSecret("a".repeat(32), "a".repeat(32))).toBe(true); expect(validWebhookSecret("b".repeat(32), "a".repeat(32))).toBe(false); });
it("enforces actual request byte size without content-length", async () => { const request = new Request("http://localhost", { method: "POST", body: JSON.stringify({ text: "a".repeat(50) }) }); await expect(limitedJson(request, 20)).rejects.toThrow("body too large"); });
it("decodes valid bounded JSON", async () => { const request = new Request("http://localhost", { method: "POST", body: '{"text":"سلام"}' }); await expect(limitedJson(request)).resolves.toEqual({ text: "سلام" }); });
