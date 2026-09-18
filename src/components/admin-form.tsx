"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Chat } from "@/lib/dashboard";

type Props = { disabled?: boolean } & (
  | { operation: "connect" }
  | { operation: "publish"; chat: Chat }
  | { operation: "moderate"; chat: Chat; targetId: string; action: "ban" | "unban" }
  | { operation: "settings"; chat: Chat }
  | { operation: "review"; chat: Chat; alertId: string }
  | { operation: "sync"; chat: Chat; postId: string }
);
const inputClass = "w-full rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-sm leading-6 placeholder:text-zinc-500 disabled:bg-zinc-100";
const buttonClass = "inline-flex min-h-11 items-center justify-center rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-600";

export function AdminForm(props: Props) {
  const id = useId();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [length, setLength] = useState(0);
  const request = useRef<{ key: string; id: string } | null>(null);
  const inFlight = useRef(false);
  const labels = { connect: "بررسی و اتصال کانال", publish: "بررسی و انتشار", moderate: props.operation === "moderate" && props.action === "unban" ? "رفع مسدودیت" : "مسدود کردن", settings: "ذخیرهٔ تنظیمات", review: "ثبت به‌عنوان بررسی‌شده", sync: "همگام‌سازی شمارنده‌ها" };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (props.disabled || inFlight.current) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    let payload: Record<string, unknown> = { operation: props.operation };
    if (props.operation !== "connect") payload.chatId = props.chat.id;
    if (props.operation === "connect") payload.chatId = String(fields.get("chatId") ?? "").trim();
    if (props.operation === "publish") payload.text = String(fields.get("text") ?? "").trim();
    if (props.operation === "moderate") payload = { ...payload, targetId: props.targetId, action: props.action, reason: String(fields.get("reason") ?? "").trim() };
    if (props.operation === "settings") payload = { ...payload, waitHours: Number(fields.get("waitHours")), verification: fields.get("verification") === "on", commentGate: fields.get("commentGate") === "on", discussionChatId: String(fields.get("discussionChatId") ?? "").trim() || null };
    if (props.operation === "review") payload.alertId = props.alertId;
    if (props.operation === "sync") payload.postId = props.postId;
    if (props.operation === "publish" || props.operation === "moderate") {
      const description = props.operation === "publish"
        ? `انتشار این متن در «${props.chat.title}» (${props.chat.id}) برای مخاطبان کانال؟\n\n${payload.text}`
        : `${props.action === "ban" ? "مسدود کردن" : "رفع مسدودیت"} حساب ${props.targetId} در «${props.chat.title}» (${props.chat.id})؟\nدلیل: ${payload.reason}\n\nمسدود کردن در تلگرام ممکن است تاریخچهٔ پیام‌ها را حذف کند. رفع مسدودیت، عضویت را بازنمی‌گرداند.`;
      if (!window.confirm(description)) return;
      const key = JSON.stringify(payload);
      if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
      payload.requestId = request.current.id;
    }
    inFlight.current = true;
    setPending(true);
    setFeedback("");
    try {
      const response = await fetch("/api/admin", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(30_000) });
      const result = await response.json();
      if (!response.ok || result.ok !== true) {
        setFeedback(typeof result.error === "string" ? result.error : "درخواست انجام نشد. وضعیت اتصال را بررسی و دوباره تلاش کنید.");
        return;
      }
      const status = result.result?.status ?? result.status;
      const requiresDefiniteResult = props.operation === "publish" || props.operation === "moderate";
      const message = status === "PENDING" ? "درخواست در انتظار نتیجه است. گزارش عملیات را بررسی کنید." : status === "FAILED" ? "عملیات ناموفق بود. جزئیات را در گزارش عملیات بررسی کنید." : status === "UNKNOWN" || (requiresDefiniteResult && status !== "SUCCEEDED") ? "نتیجه نامشخص است. پیش از اقدام دوباره، گزارش عملیات و تلگرام را بررسی کنید." : "درخواست با موفقیت ثبت شد.";
      const warning = result.result?.warning ?? result.warning;
      setFeedback(typeof warning === "string" ? `${message} ${warning}` : message);
      if (props.operation === "publish" && status === "SUCCEEDED") {
        form.reset();
        setLength(0);
        request.current = null;
      }
    } catch {
      setFeedback("پاسخ معتبری دریافت نشد؛ نتیجه ممکن است نامشخص باشد. برای تلاش مجدد با همان شناسه، فرم را تغییر ندهید و صفحه را نبندید.");
    } finally {
      inFlight.current = false;
      setPending(false);
      router.refresh();
    }
  }

  return <form onSubmit={submit} aria-label={labels[props.operation]} aria-busy={pending} className="space-y-3">
    <fieldset disabled={pending || props.disabled} className="min-w-0 space-y-4 disabled:opacity-75">
      {props.operation === "connect" && <>
        <div className="space-y-2"><label htmlFor={`${id}-chat`} className="block text-sm font-medium">شناسهٔ عددی یا نام کاربری کانال یا گروه</label><input id={`${id}-chat`} name="chatId" required pattern="(?:-[0-9]{1,20}|@[a-zA-Z0-9_]{5,32})" placeholder="@channel_name" dir="ltr" className={inputClass} /></div>
        <p className="text-sm leading-7 text-zinc-600">شناسهٔ عددی مانند <bdi dir="ltr">-1001234567890</bdi> یا نام کاربری مانند <bdi dir="ltr">@channel_name</bdi> را وارد کنید. ربات باید مدیر باشد و اجازهٔ ارسال پست و محدود کردن اعضا داشته باشد. دسترسی مدیریتی شما در تلگرام بررسی می‌شود.</p>
      </>}
      {props.operation === "publish" && <>
        <div className="space-y-2"><label htmlFor={`${id}-text`} className="block text-sm font-medium">متن پست</label><textarea id={`${id}-text`} name="text" required minLength={1} maxLength={4096} rows={5} onChange={(event) => setLength(event.target.value.length)} placeholder="متنی که می‌خواهید در کانال منتشر شود…" className={inputClass} aria-describedby={`${id}-text-help`} /></div>
        <p id={`${id}-text-help`} className="text-sm text-zinc-600">{new Intl.NumberFormat("fa-IR").format(length)} از ۴٬۰۹۶ نویسه · فقط متن؛ با دکمه‌های رأی‌گیری ربات</p>
        <p className="text-sm text-zinc-600">مقصد: {props.chat.title} · <bdi dir="ltr">{props.chat.id}</bdi></p>
      </>}
      {props.operation === "moderate" && <>
        <p className="text-sm leading-7">حساب <bdi dir="ltr" className="font-mono">{props.targetId}</bdi> در {props.chat.title} · <bdi dir="ltr">{props.chat.id}</bdi></p>
        <div className="space-y-2"><label htmlFor={`${id}-reason`} className="block text-sm font-medium">دلیل اقدام</label><input id={`${id}-reason`} name="reason" required maxLength={500} placeholder="دلیل قابل ثبت در گزارش عملیات" className={inputClass} /></div>
        <p className="max-w-xl text-sm leading-7 text-zinc-600">مسدود کردن در تلگرام ممکن است تاریخچهٔ پیام‌ها را حذف کند. رفع مسدودیت، عضویت را بازنمی‌گرداند.</p>
      </>}
      {props.operation === "settings" && <>
        <div className="max-w-xs space-y-2"><label htmlFor={`${id}-hours`} className="block text-sm font-medium">مدت انتظار از زمان عضویت (ساعت)</label><input id={`${id}-hours`} name="waitHours" type="number" min={0} max={168} step={1} required defaultValue={props.chat.waitHours} className={inputClass} /><p className="text-sm text-zinc-600">بین ۰ تا ۱۶۸ ساعت</p></div>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="verification" defaultChecked={props.chat.verification} className="size-5 accent-zinc-950" />تأیید حساب با ربات پیش از رأی دادن</label>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="commentGate" defaultChecked={props.chat.commentGate} className="size-5 accent-zinc-950" />اعمال زمان انتظار پس از عضویت برای دیدگاه‌ها</label>
        <div className="max-w-md space-y-2"><label htmlFor={`${id}-discussion`} className="block text-sm font-medium">شناسهٔ گروه گفتگوی مرتبط</label><input id={`${id}-discussion`} name="discussionChatId" pattern="-?[0-9]+" dir="ltr" defaultValue={props.chat.discussionChatId ?? ""} placeholder="-1001234567890" className={inputClass} /><p className="text-sm leading-7 text-zinc-600">برای کنترل دیدگاه‌ها، گروه مرتبط و دسترسی مدیریتی ربات لازم است. خالی گذاشتن یعنی بدون گروه مرتبط.</p></div>
      </>}
      <button type="submit" className={buttonClass}>{pending ? "در حال ارسال…" : labels[props.operation]}</button>
    </fieldset>
    {feedback && <p role="alert" className="max-w-2xl rounded-md border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm leading-7">{feedback}</p>}
  </form>;
}

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setPending(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error();
      router.replace("/login");
      router.refresh();
    } catch { setError("خروج انجام نشد. دوباره تلاش کنید."); setPending(false); }
  }
  return <div><button onClick={logout} disabled={pending} className="min-h-11 rounded-md px-3 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 disabled:opacity-50">{pending ? "در حال خروج…" : "خروج از حساب"}</button>{error && <p role="alert" className="text-sm">{error}</p>}</div>;
}
