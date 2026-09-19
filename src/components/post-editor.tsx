"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { parse, plainText, type Node } from "@/lib/channel-guard/markup";
import { formatNumber, text as t, type Locale } from "@/lib/i18n";

// The author writes plain text with markers. Nothing here produces HTML: the
// preview renders the same tree the server will render, as React elements, so
// what is shown is what Telegram will be asked for.

export const TEXT_LIMIT = 4096;
export const CAPTION_LIMIT = 1024;
const PHOTO_LIMIT = 10 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp";

type Tool = { key: string; marker: string; label: [string, string]; glyph: ReactNode; sample: [string, string] };
const TOOLS: Tool[] = [
  { key: "bold", marker: "*", label: ["پررنگ", "Bold"], glyph: <span className="font-bold">B</span>, sample: ["متن پررنگ", "bold text"] },
  { key: "italic", marker: "_", label: ["مورب", "Italic"], glyph: <span className="font-serif italic">I</span>, sample: ["متن مورب", "italic text"] },
  { key: "underline", marker: "__", label: ["زیرخط", "Underline"], glyph: <span className="underline">U</span>, sample: ["زیرخط", "underlined"] },
  { key: "strike", marker: "~", label: ["خط‌خورده", "Strikethrough"], glyph: <span className="line-through">S</span>, sample: ["خط‌خورده", "struck out"] },
  { key: "spoiler", marker: "||", label: ["اسپویلر", "Spoiler"], glyph: <span aria-hidden="true">▒</span>, sample: ["متن پنهان", "hidden text"] },
  { key: "code", marker: "`", label: ["کد", "Code"], glyph: <span className="font-mono text-xs">{"</>"}</span>, sample: ["کد", "code"] },
];
const EMOJI = "🌳 🚪 ✅ ❌ ⚠️ 📌 🔔 🗳 💬 🙌 👍 👎 🔥 ✨ 🎯 📣 📷 🕰 ⏳ 🤝 ❤️ 🧡 💚 💙 🌿 🌙 ☀️ ⭐️ 🏛 📚 ✍️ 🧭 🔍 🛡 ⚖️ 🎉 🙏 👋 😊 🤔 😮 😢 😡 🇮🇷".split(" ");

function Rendered({ nodes, locale }: { nodes: Node[]; locale: Locale }) {
  return <>{nodes.map((node, index) => {
    if (node.type === "text") return <span key={index}>{node.value}</span>;
    if (node.type === "code") return node.block
      ? <pre key={index} dir="ltr" className="my-2 overflow-x-auto rounded-md bg-canvas p-3 text-start font-mono text-xs leading-6">{node.value}</pre>
      : <code key={index} dir="ltr" className="rounded bg-canvas px-1 font-mono text-xs">{node.value}</code>;
    if (node.type === "quote") return <blockquote key={index} className="my-2 border-s-2 border-forest ps-3 text-muted"><Rendered nodes={node.children} locale={locale} /></blockquote>;
    if (node.type === "link") return <a key={index} href={node.href} target="_blank" rel="noopener noreferrer nofollow" className="text-forest underline underline-offset-4"><Rendered nodes={node.children} locale={locale} /></a>;
    const inner = <Rendered nodes={node.children} locale={locale} />;
    if (node.tag === "b") return <strong key={index}>{inner}</strong>;
    if (node.tag === "i") return <em key={index}>{inner}</em>;
    if (node.tag === "u") return <u key={index}>{inner}</u>;
    if (node.tag === "s") return <s key={index}>{inner}</s>;
    return <span key={index} title={t(locale, "متن اسپویلر", "Spoiler")} className="rounded bg-ink/80 text-transparent transition-colors hover:bg-transparent hover:text-ink focus:bg-transparent focus:text-ink" tabIndex={0}>{inner}</span>;
  })}</>;
}

export function PostEditor({ locale, name = "text", disabled = false, onPhotoChange }: { locale: Locale; name?: string; disabled?: boolean; onPhotoChange?: (file: File | null) => void }) {
  const area = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [photoError, setPhotoError] = useState("");

  const nodes = useMemo(() => parse(value), [value]);
  // UTF-16 code units, matching the limit Telegram enforces (see markup.ts).
  const length = useMemo(() => plainText(nodes).length, [nodes]);
  const limit = photo ? CAPTION_LIMIT : TEXT_LIMIT;
  const over = length > limit;

  function edit(next: string, from: number, to: number) {
    setValue(next);
    requestAnimationFrame(() => { const el = area.current; if (el) { el.focus(); el.setSelectionRange(from, to); } });
  }

  function wrap(tool: Tool) {
    const el = area.current;
    if (!el) return;
    const start = el.selectionStart, end = el.selectionEnd;
    const chosen = value.slice(start, end) || t(locale, tool.sample[0], tool.sample[1]);
    const next = `${value.slice(0, start)}${tool.marker}${chosen}${tool.marker}${value.slice(end)}`;
    edit(next, start + tool.marker.length, start + tool.marker.length + chosen.length);
  }

  function insert(fragment: string, caretOffset = fragment.length) {
    const el = area.current;
    const start = el?.selectionStart ?? value.length, end = el?.selectionEnd ?? value.length;
    edit(`${value.slice(0, start)}${fragment}${value.slice(end)}`, start + caretOffset, start + caretOffset);
  }

  function addLink() {
    const el = area.current;
    const start = el?.selectionStart ?? 0, end = el?.selectionEnd ?? 0;
    const label = value.slice(start, end) || t(locale, "متن لینک", "link text");
    const url = window.prompt(t(locale, "نشانی لینک (با https:// شروع شود)", "Link address (must start with https://)"), "https://");
    if (!url) return;
    const fragment = `[${label}](${url.trim()})`;
    edit(`${value.slice(0, start)}${fragment}${value.slice(end)}`, start + fragment.length, start + fragment.length);
  }

  function quoteLine() {
    const el = area.current;
    const start = el?.selectionStart ?? 0;
    const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    edit(`${value.slice(0, lineStart)}> ${value.slice(lineStart)}`, start + 2, start + 2);
  }

  function choosePhoto(file: File | null) {
    setPhotoError("");
    if (photo) URL.revokeObjectURL(photo.url);
    if (!file) { setPhoto(null); onPhotoChange?.(null); return; }
    if (!ACCEPT.split(",").includes(file.type)) { setPhoto(null); onPhotoChange?.(null); setPhotoError(t(locale, "فقط عکس JPEG، PNG یا WebP.", "Only JPEG, PNG or WebP images.")); return; }
    if (file.size > PHOTO_LIMIT) { setPhoto(null); onPhotoChange?.(null); setPhotoError(t(locale, "حجم عکس بیش از ۱۰ مگابایت است.", "The image is larger than 10 MB.")); return; }
    setPhoto({ file, url: URL.createObjectURL(file) });
    onPhotoChange?.(file);
  }

  const toolButton = "inline-flex size-10 items-center justify-center rounded-md border border-line bg-white text-ink transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50";

  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label={t(locale, "قالب‌بندی متن", "Text formatting")}>
      {TOOLS.map((tool) => (
        <button key={tool.key} type="button" disabled={disabled} onClick={() => wrap(tool)} title={t(locale, tool.label[0], tool.label[1])} aria-label={t(locale, tool.label[0], tool.label[1])} className={toolButton}>{tool.glyph}</button>
      ))}
      <button type="button" disabled={disabled} onClick={addLink} title={t(locale, "لینک", "Link")} aria-label={t(locale, "لینک", "Link")} className={toolButton}>
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" /></svg>
      </button>
      <button type="button" disabled={disabled} onClick={quoteLine} title={t(locale, "نقل‌قول", "Quote")} aria-label={t(locale, "نقل‌قول", "Quote")} className={toolButton}>”</button>
      <span aria-hidden="true" className="mx-1 h-6 w-px bg-line" />
      <button type="button" disabled={disabled} onClick={() => setEmojiOpen((open) => !open)} aria-expanded={emojiOpen} title={t(locale, "ایموجی", "Emoji")} aria-label={t(locale, "ایموجی", "Emoji")} className={toolButton}>😊</button>
      <button type="button" disabled={disabled} onClick={() => picker.current?.click()} title={t(locale, "افزودن عکس", "Add photo")} aria-label={t(locale, "افزودن عکس", "Add photo")} className={toolButton}>
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="10" r="1.5" /><path d="m4 17 5-5 4 4 3-2 4 4" /></svg>
      </button>
      <input ref={picker} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} onChange={(event) => choosePhoto(event.target.files?.[0] ?? null)} />
    </div>

    {emojiOpen && <div className="flex max-h-40 flex-wrap gap-1 overflow-y-auto rounded-lg border border-line bg-white p-2">
      {EMOJI.map((emoji) => (
        <button key={emoji} type="button" disabled={disabled} onClick={() => insert(emoji)} className="size-9 rounded text-lg leading-none transition-colors hover:bg-canvas" aria-label={emoji}>{emoji}</button>
      ))}
    </div>}

    <textarea
      ref={area} name={name} dir="auto" required minLength={1} maxLength={8192} rows={7} disabled={disabled}
      value={value} onChange={(event) => setValue(event.target.value)}
      placeholder={t(locale, "متنی که می‌خواهید در کانال منتشر شود…", "The text you want to publish…")}
      className="min-h-11 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm leading-7 text-ink placeholder:text-muted focus:border-forest focus:outline-2 focus:outline-offset-2 focus:outline-forest disabled:bg-canvas"
      aria-describedby="post-editor-count"
    />

    <p id="post-editor-count" className={`text-sm ${over ? "font-medium text-red-800" : "text-muted"}`}>
      {formatNumber(length, locale)} {t(locale, "از", "of")} {formatNumber(limit, locale)} {t(locale, "نویسه", "characters")}
      {photo && <span className="text-muted"> · {t(locale, "با عکس، سقف متن کمتر است", "a caption is shorter than a post")}</span>}
    </p>

    {photo && <div className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-white p-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, never a remote asset */}
      <img src={photo.url} alt="" className="size-20 shrink-0 rounded-md object-cover" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium"><bdi>{photo.file.name}</bdi></p>
        <p className="mt-1 text-xs text-muted">{formatNumber(Math.max(1, Math.round(photo.file.size / 1024)), locale)} {t(locale, "کیلوبایت", "KB")}</p>
      </div>
      <button type="button" disabled={disabled} onClick={() => { choosePhoto(null); if (picker.current) picker.current.value = ""; }} className="inline-flex min-h-11 items-center rounded-md border border-line px-3 text-sm hover:bg-canvas">{t(locale, "حذف عکس", "Remove photo")}</button>
    </div>}
    {photoError && <p role="alert" className="text-sm leading-7 text-red-800">{photoError}</p>}

    <details open className="rounded-lg border border-line bg-canvas">
      <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-medium">{t(locale, "پیش‌نمایش", "Preview")}</summary>
      <div className="border-t border-line px-4 py-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, never a remote asset */}
        {photo && <img src={photo.url} alt="" className="mb-3 max-h-64 w-full rounded-md object-contain" />}
        {value.trim()
          ? <div dir="auto" className="whitespace-pre-wrap break-words text-sm leading-8"><Rendered nodes={nodes} locale={locale} /></div>
          : <p className="text-sm text-muted">{t(locale, "هنوز چیزی ننوشته‌اید.", "Nothing written yet.")}</p>}
        <p className="mt-4 border-t border-line pt-3 text-xs leading-6 text-muted">{t(locale, "دکمه‌های رأی پس از انتشار، زیر همین پست اضافه می‌شوند.", "The vote buttons are attached below this post once it is published.")}</p>
      </div>
    </details>
  </div>;
}
