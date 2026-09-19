"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Chat } from "@/lib/dashboard";
import { dashboardCopy, mutationError } from "@/lib/dashboard-copy";
import { pathFor, type Locale } from "@/lib/i18n";
import { PostEditor } from "@/components/post-editor";

type Props = { disabled?: boolean; locale?: Locale } & (
  | { operation: "connect" }
  | { operation: "publish"; chat: Chat }
  | { operation: "moderate"; chat: Chat; targetId: string; action: "ban" | "unban" }
  | { operation: "settings"; chat: Chat }
  | { operation: "review"; chat: Chat; alertId: string }
  | { operation: "sync"; chat: Chat; postId: string }
  | { operation: "attach"; chat: Chat; postId: string }
);
/** The admin may paste the whole message link; the id is the number it ends with. */
function messageNumber(raw: string): number {
  const match = /([0-9]{1,10})\s*$/.exec(raw.trim());
  return match ? Number(match[1]) : 0;
}
const inputClass = "min-h-11 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm leading-6 text-ink placeholder:text-muted focus:border-forest focus:outline-2 focus:outline-offset-2 focus:outline-forest disabled:bg-canvas";
const buttonClass = "inline-flex min-h-11 items-center justify-center rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted";

export function AdminForm(props: Props) {
  const locale = props.locale ?? "fa";
  const c = dashboardCopy(locale);
  const id = useId();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  // A published post must leave an empty editor; the editor owns its own state, so it is remounted rather than reset.
  const [editorKey, setEditorKey] = useState(0);
  const request = useRef<{ key: string; id: string } | null>(null);
  const inFlight = useRef(false);
  const labels = { connect: c.connect, publish: c.publish, moderate: props.operation === "moderate" && props.action === "unban" ? c.unban : c.ban, settings: c.saveSettings, review: c.review, sync: c.sync, attach: c.attach };

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
    if (props.operation === "settings") payload = { ...payload, waitHours: Number(fields.get("waitHours")), verification: fields.get("verification") === "on", commentGate: fields.get("commentGate") === "on", deleteJoinMessages: fields.get("deleteJoinMessages") === "on", lockCommands: fields.get("lockCommands") === "on", lockLinks: fields.get("lockLinks") === "on", discussionChatId: String(fields.get("discussionChatId") ?? "").trim() || null };
    if (props.operation === "review") payload.alertId = props.alertId;
    if (props.operation === "sync") payload.postId = props.postId;
    if (props.operation === "attach") payload = { ...payload, postId: props.postId, messageId: messageNumber(String(fields.get("messageId") ?? "")) };
    if (props.operation === "publish" || props.operation === "moderate") {
      const description = props.operation === "publish"
        ? `${c.publishConfirm}\n${c.destination}: ${props.chat.title} (${props.chat.id})\n\n${payload.text}`
        : `${c.moderateConfirm}\n${labels.moderate}: ${props.targetId}\n${c.destination}: ${props.chat.title} (${props.chat.id})\n${c.reason}: ${payload.reason}\n\n${c.moderationWarning}`;
      if (!window.confirm(description)) return;
      const key = JSON.stringify(payload);
      if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
      payload.requestId = request.current.id;
    }
    inFlight.current = true;
    setPending(true);
    setFeedback("");
    try {
      const withPhoto = props.operation === "publish" && photo;
      let body: BodyInit = JSON.stringify(payload);
      const headers: Record<string, string> = { "Content-Type": "application/json", "x-darban-locale": locale };
      if (withPhoto) {
        // multipart is the only way to hand Telegram a file it has not seen.
        const form = new FormData();
        for (const [key, value] of Object.entries(payload)) form.append(key, String(value));
        form.append("photo", photo);
        body = form;
        delete headers["Content-Type"];
      }
      const response = await fetch("/api/admin", { method: "POST", credentials: "same-origin", headers, body, signal: AbortSignal.timeout(withPhoto ? 90_000 : 30_000) });
      const result = await response.json();
      if (!response.ok || result.ok !== true) {
        setFeedback(mutationError(locale, response.status, result.error, result.detail));
        return;
      }
      const status = result.result?.status ?? result.status;
      const requiresDefiniteResult = props.operation === "publish" || props.operation === "moderate";
      const message = status === "PENDING" ? c.pendingResult : status === "FAILED" ? c.failedResult : status === "UNKNOWN" || (requiresDefiniteResult && status !== "SUCCEEDED") ? c.unknownResult : c.successResult;
      const warning = result.result?.warning ?? result.warning;
      const localizedWarning = typeof warning === "string" ? locale === "en" && /[\u0600-\u06ff]/.test(warning) ? c.resultWarning : warning : "";
      setFeedback(localizedWarning ? `${message} ${localizedWarning}` : message);
      if (props.operation === "publish" && status === "SUCCEEDED") {
        form.reset();
        setPhoto(null);
        setEditorKey((key) => key + 1);
        request.current = null;
      }
    } catch {
      setFeedback(c.networkError);
    } finally {
      inFlight.current = false;
      setPending(false);
      router.refresh();
    }
  }

  return <form onSubmit={submit} aria-label={labels[props.operation]} aria-busy={pending} className="space-y-3 text-start">
    <fieldset disabled={pending || (props.disabled && props.operation !== "publish")} className="min-w-0 space-y-4 disabled:opacity-75">
      {props.operation === "connect" && <>
        <div className="space-y-2"><label htmlFor={`${id}-chat`} className="block text-sm font-medium">{c.chatIdLabel}</label><input id={`${id}-chat`} name="chatId" required pattern="(?:-[0-9]{1,20}|@[a-zA-Z0-9_]{5,32})" placeholder="@channel_name" dir="ltr" className={inputClass} aria-describedby={`${id}-chat-help`} /></div>
        <p id={`${id}-chat-help`} className="text-sm leading-7 text-muted">{c.connectHelp} <bdi dir="ltr">-1001234567890</bdi> · <bdi dir="ltr">@channel_name</bdi></p>
      </>}
      {props.operation === "publish" && <>
        <div className="space-y-2"><span className="block text-sm font-medium">{c.postText}</span><PostEditor key={editorKey} locale={locale} disabled={pending} onPhotoChange={setPhoto} /></div>
        <p className="break-words text-sm text-muted">{c.destination}: <bdi>{props.chat.title}</bdi> · <bdi dir="ltr">{props.chat.id}</bdi></p>
      </>}
      {props.operation === "moderate" && <>
        <p className="break-words text-sm leading-7">{c.account}: <bdi dir="ltr" className="font-mono">{props.targetId}</bdi> · <bdi>{props.chat.title}</bdi> · <bdi dir="ltr">{props.chat.id}</bdi></p>
        <div className="space-y-2"><label htmlFor={`${id}-reason`} className="block text-sm font-medium">{c.actionReason}</label><input id={`${id}-reason`} name="reason" dir="auto" required maxLength={500} placeholder={c.reasonPlaceholder} className={inputClass} aria-describedby={`${id}-moderation-help`} /></div>
        <p id={`${id}-moderation-help`} className="max-w-xl text-sm leading-7 text-muted">{c.moderationWarning}</p>
      </>}
      {props.operation === "attach" && <>
        <p id={`${id}-attach-help`} className="max-w-xl text-sm leading-7 text-muted">{c.attachHelp}</p>
        <div className="max-w-xs space-y-2"><label htmlFor={`${id}-message`} className="block text-sm font-medium">{c.messageIdLabel}</label><input id={`${id}-message`} name="messageId" required inputMode="numeric" pattern="[^0-9]*[0-9]{1,10}" placeholder="123" dir="ltr" className={inputClass} aria-describedby={`${id}-attach-help`} /></div>
      </>}
      {props.operation === "settings" && <>
        <div className="max-w-xs space-y-2"><label htmlFor={`${id}-hours`} className="block text-sm font-medium">{c.waitHoursLabel}</label><input id={`${id}-hours`} name="waitHours" type="number" min={0} max={168} step={1} required defaultValue={props.chat.waitHours} className={inputClass} aria-describedby={`${id}-hours-help`} /><p id={`${id}-hours-help`} className="text-sm text-muted">{c.waitRange}</p></div>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="verification" defaultChecked={props.chat.verification} className="size-5 shrink-0 accent-forest" />{c.verifyBeforeVote}</label>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="commentGate" defaultChecked={props.chat.commentGate} className="size-5 shrink-0 accent-forest" />{c.gateComments}</label>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="deleteJoinMessages" defaultChecked={props.chat.deleteJoinMessages} className="size-5 shrink-0 accent-forest" />{c.deleteJoinMessagesLabel}</label>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="lockCommands" defaultChecked={props.chat.lockCommands} className="size-5 shrink-0 accent-forest" />{c.lockCommandsLabel}</label>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="lockLinks" defaultChecked={props.chat.lockLinks} className="size-5 shrink-0 accent-forest" />{c.lockLinksLabel}</label>
        <div className="max-w-md space-y-2"><label htmlFor={`${id}-discussion`} className="block text-sm font-medium">{c.discussionId}</label><input id={`${id}-discussion`} name="discussionChatId" pattern="-?[0-9]+" dir="ltr" defaultValue={props.chat.discussionChatId ?? ""} placeholder="-1001234567890" className={inputClass} aria-describedby={`${id}-discussion-help`} /><p id={`${id}-discussion-help`} className="text-sm leading-7 text-muted">{c.discussionHelp}</p></div>
      </>}
      <button type="submit" disabled={pending || props.disabled} className={buttonClass}>{pending ? c.sending : labels[props.operation]}</button>
    </fieldset>
    {feedback && <p role="alert" className="max-w-2xl rounded-lg border border-line bg-canvas px-4 py-3 text-sm leading-7">{feedback}</p>}
  </form>;
}

export function LogoutButton({ locale = "fa" }: { locale?: Locale } = {}) {
  const router = useRouter();
  const c = dashboardCopy(locale);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  async function logout() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", headers: { "x-darban-locale": locale }, signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error();
      router.replace(pathFor(locale, "login"));
      router.refresh();
    } catch {
      setError(c.logoutError);
      setPending(false);
      inFlight.current = false;
    }
  }
  return <div><button onClick={logout} disabled={pending} aria-busy={pending} className="min-h-11 rounded-lg px-3 text-sm text-muted hover:bg-canvas hover:text-ink disabled:opacity-50">{pending ? c.loggingOut : c.logout}</button>{error && <p role="alert" className="text-sm">{error}</p>}</div>;
}
