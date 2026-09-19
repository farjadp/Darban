import { describe, expect, it } from "vitest";
import { parse, plainText, render, safeUrl, toHtml } from "./markup";

const html = (markup: string) => render(markup).html;

describe("formatting markers", () => {
  it("renders every style Telegram supports", () => {
    expect(html("*bold*")).toBe("<b>bold</b>");
    expect(html("_italic_")).toBe("<i>italic</i>");
    expect(html("__underline__")).toBe("<u>underline</u>");
    expect(html("~struck~")).toBe("<s>struck</s>");
    expect(html("||hidden||")).toBe("<tg-spoiler>hidden</tg-spoiler>");
    expect(html("`code`")).toBe("<code>code</code>");
    expect(html("> quoted")).toBe("<blockquote>quoted</blockquote>");
  });
  it("prefers the longer marker so underline never reads as two italics", () => {
    expect(html("__x__")).toBe("<u>x</u>");
    expect(html("_x_")).toBe("<i>x</i>");
  });
  it("nests styles", () => {
    expect(html("*bold with _italic_ inside*")).toBe("<b>bold with <i>italic</i> inside</b>");
  });
  it("leaves an unclosed or empty marker as ordinary text", () => {
    expect(html("2 * 3 = 6")).toBe("2 * 3 = 6");
    expect(html("**")).toBe("**");
    expect(html("a_b")).toBe("a_b");
  });
  it("lets a backslash escape a marker", () => {
    expect(html("\\*not bold\\*")).toBe("*not bold*");
  });
  it("keeps code spans literal", () => {
    expect(html("`*not bold*`")).toBe("<code>*not bold*</code>");
  });
  it("renders a fenced block and survives an unclosed fence", () => {
    expect(html("```\nline one\nline two\n```")).toBe("<pre>line one\nline two</pre>");
    expect(html("```\nstill typing")).toContain("```");
  });
  it("joins consecutive quoted lines into one blockquote", () => {
    expect(html("> one\n> two")).toBe("<blockquote>one\ntwo</blockquote>");
  });
});

describe("links", () => {
  it("renders an http or https target", () => {
    expect(html("[Darban](https://darban.xyz/)")).toBe('<a href="https://darban.xyz/">Darban</a>');
  });
  it("refuses any other scheme and leaves the text alone", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd"]) {
      expect(safeUrl(bad)).toBeNull();
      expect(html(`[click](${bad})`)).not.toContain("<a");
    }
  });
  it("accepts Telegram's own scheme", () => {
    expect(safeUrl("tg://user?id=1")).not.toBeNull();
  });
});

describe("escaping", () => {
  it("never lets authored text become a tag", () => {
    expect(html("<script>alert(1)</script>")).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html("a & b")).toBe("a &amp; b");
    expect(html("*<b>x</b>*")).toBe("<b>&lt;b&gt;x&lt;/b&gt;</b>");
  });
  it("escapes inside code and quotes too", () => {
    expect(html("`<i>`")).toBe("<code>&lt;i&gt;</code>");
    expect(html("> <i>")).toBe("<blockquote>&lt;i&gt;</blockquote>");
  });
  it("escapes a quote character in an href", () => {
    expect(html('[x](https://e.com/?a="b")')).not.toContain('="b"');
  });
});

describe("length", () => {
  it("counts what Telegram counts, not the markers", () => {
    expect(render("*bold*").length).toBe(4);
    expect(render("[Darban](https://darban.xyz)").length).toBe(6);
    expect(render("plain").length).toBe(5);
  });
  it("counts an emoji the way Telegram does, not the way a reader would", () => {
    // Telegram's 4096 is UTF-16 code units, so an emoji outside the BMP is two.
    expect(render("🌳").length).toBe(2);
    expect(render("سلام").length).toBe(4);
    expect(render("*🌳🌳*").length).toBe(4);
  });
  it("agrees with the limit Telegram will apply", () => {
    const post = "🌳".repeat(2048);
    expect(render(post).length).toBe(4096);
    expect(render(post + "🌳").length).toBeGreaterThan(4096);
  });
  it("reports the text of a whole post", () => {
    expect(plainText(parse("*a* _b_ `c`"))).toBe("a b c");
  });
});

describe("Persian text", () => {
  it("formats right-to-left text without disturbing it", () => {
    expect(html("*سلام* دنیا")).toBe("<b>سلام</b> دنیا");
    expect(toHtml(parse("> نقل‌قول"))).toBe("<blockquote>نقل‌قول</blockquote>");
  });
});
