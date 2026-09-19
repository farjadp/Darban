// Post formatting, in the syntax Telegram users already know from MarkdownV2.
//
// The editor never hands us HTML. It hands us plain text with markers, we parse
// that into a small tree, and only then render — to Telegram HTML on the server,
// or to React elements in the preview. Nothing the author types can become a tag
// it did not earn: every text node is escaped at render time, and the only
// attribute we ever emit is an href we parsed and re-serialized ourselves.

export type Tag = "b" | "i" | "u" | "s" | "tg-spoiler";
export type Node =
  | { type: "text"; value: string }
  | { type: "tag"; tag: Tag; children: Node[] }
  | { type: "link"; href: string; children: Node[] }
  | { type: "code"; value: string; block: boolean }
  | { type: "quote"; children: Node[] };

type Marker = { open: string; tag: Tag };
// Longest first: `__` must win over `_`.
const MARKERS: Marker[] = [
  { open: "||", tag: "tg-spoiler" },
  { open: "__", tag: "u" },
  { open: "*", tag: "b" },
  { open: "_", tag: "i" },
  { open: "~", tag: "s" },
];
export const MARKER_FOR: Record<Tag, string> = { "tg-spoiler": "||", u: "__", b: "*", i: "_", s: "~" };

/** A link target we are willing to put in an href. Anything else is left as plain text. */
export function safeUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    return ["http:", "https:", "tg:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function inline(text: string): Node[] {
  const nodes: Node[] = [];
  let plain = "";
  const flush = () => { if (plain) { nodes.push({ type: "text", value: plain }); plain = ""; } };
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    if (text[i] === "\\" && i + 1 < text.length) { plain += text[i + 1]; i += 2; continue; }
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end > i + 1) { flush(); nodes.push({ type: "code", value: text.slice(i + 1, end), block: false }); i = end + 1; continue; }
    }
    if (text[i] === "[") {
      const match = /^\[([^\]\n]*)\]\(([^)\s]+)\)/.exec(rest);
      const href = match && safeUrl(match[2]);
      if (match && href) { flush(); nodes.push({ type: "link", href, children: inline(match[1]) }); i += match[0].length; continue; }
    }
    const marker = MARKERS.find((candidate) => rest.startsWith(candidate.open));
    if (marker) {
      const end = text.indexOf(marker.open, i + marker.open.length);
      if (end > i + marker.open.length) {
        flush();
        nodes.push({ type: "tag", tag: marker.tag, children: inline(text.slice(i + marker.open.length, end)) });
        i = end + marker.open.length;
        continue;
      }
    }
    plain += text[i];
    i += 1;
  }
  flush();
  return nodes;
}

/** Parse the editor's text. Fenced blocks and quoted lines are read first, the rest inline. */
export function parse(markup: string): Node[] {
  const nodes: Node[] = [];
  const lines = markup.split("\n");
  let fence: string[] | null = null;
  let quote: string[] | null = null;
  let paragraph: string[] = [];
  const flushParagraph = () => { if (paragraph.length) { nodes.push(...inline(paragraph.join("\n"))); paragraph = []; } };
  const flushQuote = () => { if (quote) { nodes.push({ type: "quote", children: inline(quote.join("\n")) }); quote = null; } };

  for (const line of lines) {
    if (line.trim() === "```") {
      if (fence) { nodes.push({ type: "code", value: fence.join("\n"), block: true }); fence = null; }
      else { flushParagraph(); flushQuote(); fence = []; }
      continue;
    }
    if (fence) { fence.push(line); continue; }
    if (line.startsWith(">")) { flushParagraph(); (quote ??= []).push(line.slice(1).replace(/^ /, "")); continue; }
    flushQuote();
    paragraph.push(line);
  }
  // An unclosed fence is the author still typing, not a reason to lose their text.
  if (fence) { paragraph.push("```", ...fence); }
  flushQuote();
  flushParagraph();
  return nodes;
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
function escape(value: string): string {
  return value.replace(/[&<>"]/g, (character) => ESCAPES[character]);
}

/** Telegram-flavoured HTML: only the tags Telegram documents, only hrefs we parsed. */
export function toHtml(nodes: Node[]): string {
  return nodes.map((node) => {
    if (node.type === "text") return escape(node.value);
    if (node.type === "code") return node.block ? `<pre>${escape(node.value)}</pre>` : `<code>${escape(node.value)}</code>`;
    if (node.type === "link") return `<a href="${escape(node.href)}">${toHtml(node.children)}</a>`;
    if (node.type === "quote") return `<blockquote>${toHtml(node.children)}</blockquote>`;
    return `<${node.tag}>${toHtml(node.children)}</${node.tag}>`;
  }).join("");
}

/** What Telegram will count against the length limit: the text without any markers. */
export function plainText(nodes: Node[]): string {
  return nodes.map((node) => {
    if (node.type === "text") return node.value;
    if (node.type === "code") return node.value;
    return plainText(node.children);
  }).join("");
}

export function render(markup: string): { html: string; length: number } {
  const nodes = parse(markup);
  return { html: toHtml(nodes), length: [...plainText(nodes)].length };
}
