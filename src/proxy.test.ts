import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

const at = (path: string) => proxy(new NextRequest(`https://darban.example${path}`));

describe("legacy paths", () => {
  it("sends the bare origin to Persian with a real 307", () => {
    const response = at("/");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://darban.example/fa");
  });
  it("keeps the return path when redirecting the old login", () => {
    expect(at("/login?next=%2Ffa%2Fportal").headers.get("location")).toBe("https://darban.example/fa/login?next=%2Ffa%2Fportal");
    expect(at("/preview").headers.get("location")).toBe("https://darban.example/fa/preview");
  });
  it("does not redirect localized or unrelated paths", () => {
    for (const path of ["/fa", "/en/pricing", "/fa/login", "/loginx", "/preview/admin"]) expect(at(path).status).toBe(200);
  });
});

describe("locale header", () => {
  it("tags requests with the locale from the path, defaulting to Persian", () => {
    expect(at("/en/pricing").headers.get("x-middleware-request-x-darban-locale")).toBe("en");
    expect(at("/fa/portal").headers.get("x-middleware-request-x-darban-locale")).toBe("fa");
    expect(at("/somewhere").headers.get("x-middleware-request-x-darban-locale")).toBe("fa");
  });
});
