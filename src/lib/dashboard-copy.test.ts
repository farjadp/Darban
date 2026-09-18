import { describe, expect, it } from "vitest";
import { actionLabel, dashboardCopy, mutationError, statusLabel } from "./dashboard-copy";
import { views } from "./dashboard";

describe("dashboard bilingual copy", () => {
  it("provides matching nonempty Persian and English UI copy", () => {
    const fa = dashboardCopy("fa");
    const en = dashboardCopy("en");
    expect(Object.keys(fa).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(fa) as (keyof typeof fa)[]) {
      expect(fa[key].trim(), key).not.toBe("");
      expect(en[key].trim(), key).not.toBe("");
      expect(fa[key], key).toMatch(/[\u0600-\u06ff]/);
      expect(en[key], key).not.toMatch(/[\u0600-\u06ff]/);
    }
    for (const view of views) {
      expect(fa[view]).not.toBe(en[view]);
    }
  });

  it("retains the observed-member, manual-reaction and moderation limitations", () => {
    const en = dashboardCopy("en");
    expect(en.observedWarning).toContain("not the full Telegram member list");
    expect(en.joinWarning).toContain("no waiting period");
    expect(en.nativeWarning).toContain("manually");
    expect(en.noAutomaticBans).toContain("No account is banned automatically");
    expect(en.moderationWarning).toContain("delete message history");
    expect(en.moderationWarning).toContain("does not restore membership");
    expect(en.verificationWarning).toContain("not proof of identity");
    expect(en.networkError).toContain("same request ID");
    expect(en.unknownWarning).toContain("before repeating");
  });

  it("localizes uppercase status codes without leaking unknown codes", () => {
    expect(statusLabel("fa", "SUCCEEDED")).toBe("موفق");
    expect(statusLabel("en", "FAILED")).toBe("Failed");
    expect(statusLabel("en", "UNKNOWN")).toBe("Unknown");
    expect(statusLabel("fa", "PENDING")).toBe("در انتظار");
    expect(statusLabel("en", "UNRECOGNIZED_CODE")).toBe("Recorded status");
    expect(actionLabel("fa", "PUBLISH")).toBe("انتشار پست");
    expect(actionLabel("en", "ban")).toBe("Ban account");
    expect(actionLabel("en", "OTHER_ACTION")).toBe("Recorded action");
  });

  it("never leaks Persian backend errors into English feedback", () => {
    expect(mutationError("en", 400, "خطای سرور")).toBe(dashboardCopy("en").requestError);
    expect(mutationError("en", 400, "Access denied.")).toBe("Access denied.");
    expect(mutationError("fa", 400, "خطای سرور")).toBe("خطای سرور");
    expect(mutationError("fa", 500, null)).toBe(dashboardCopy("fa").requestError);
  });

  it("keeps ambiguous conflict results explicit in both languages", () => {
    expect(mutationError("en", 409, "خطا")).toContain("uncertain");
    expect(mutationError("en", 409, "Conflict")).toContain("before retrying");
    expect(mutationError("fa", 409, null)).toContain("نامشخص");
  });
});
