import { describe, expect, it } from "vitest";
import { isLocale, localeFromPath, localizePath, pathFor, safeReturnPath, formatNumber, text } from "./i18n";

describe("locale routing", () => {
  it("accepts only supported languages", () => { expect(isLocale("fa")).toBe(true); expect(isLocale("en")).toBe(true); expect(isLocale("fr")).toBe(false); });
  it("finds a locale only in the first segment", () => { expect(localeFromPath("/en/portal")).toBe("en"); expect(localeFromPath("/english")).toBe("fa"); });
  it("builds consistent localized paths", () => { expect(pathFor("fa", "/pricing")).toBe("/fa/pricing"); expect(pathFor("en")).toBe("/en"); });
  it("switches locale without changing the selected view", () => expect(localizePath("/fa/portal?view=alerts&chat=-100", "en")).toBe("/en/portal?view=alerts&chat=-100"));
  it("localizes legacy paths", () => expect(localizePath("/preview?view=posts", "en")).toBe("/en/preview?view=posts"));
  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "/en/pricing"])("rejects unsafe or unrelated return destinations %s", value => expect(safeReturnPath(value,"fa")).toBe("/fa/portal"));
  it("keeps protected query state on login and localizes it", () => expect(safeReturnPath("/fa/portal/subscription?plan=pro&interval=annual","en")).toBe("/en/portal/subscription?plan=pro&interval=annual"));
  it("formats each language and selects its copy", () => { expect(formatNumber(21,"fa")).toBe("۲۱"); expect(formatNumber(21,"en")).toBe("21"); expect(text("en","سلام","Hello")).toBe("Hello"); });
});
