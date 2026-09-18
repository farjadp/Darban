"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { safeReturnPath, text, type Locale } from "@/lib/i18n";

export function TelegramLogin({ botUsername, locale = "fa", returnPath }: { botUsername: string; locale?: Locale; returnPath?: string }) {
  const router = useRouter();
  const container = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "submitting" | "error">("loading");
  const [error, setError] = useState("");
  const validUsername = /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(botUsername) && /bot$/i.test(botUsername);

  useEffect(() => {
    if (!validUsername || !container.current) return;
    const target = container.current;
    const controller = new AbortController();
    const callbackName = `darbanLogin_${crypto.randomUUID().replaceAll("-", "")}`;
    const callbacks = window as unknown as Record<string, unknown>;
    let pending = false;
    let loadTimer: ReturnType<typeof setTimeout> | undefined;
    const fail = (message?: unknown) => {
      if (controller.signal.aborted) return;
      const fallback = text(locale,"ورود انجام نشد. اتصال را بررسی و دوباره تلاش کنید.","Sign-in could not be completed. Check your connection and try again.");
      setError(typeof message === "string" && !(locale === "en" && /[\u0600-\u06ff]/.test(message)) ? message : fallback);
      setStatus("error");
    };
    async function initialize() {
      try {
        const response = await fetch("/api/auth/nonce", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "x-darban-locale": locale }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
        const payload = await response.json();
        if (!response.ok || typeof payload.nonce !== "string" || !/^[a-f0-9]{64}$/.test(payload.nonce)) { fail(payload.error); return; }
        if (controller.signal.aborted) return;
        callbacks[callbackName] = async (data: unknown) => {
          if (pending || controller.signal.aborted) return;
          pending = true;
          setStatus("submitting");
          try {
            const result = await fetch("/api/auth/telegram", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json", "x-darban-locale": locale }, body: JSON.stringify({ nonce: payload.nonce, data, locale }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
            const body = await result.json();
            if (!result.ok || body.ok !== true) { fail(body.error); return; }
            if (!controller.signal.aborted) { router.replace(safeReturnPath(returnPath,locale)); router.refresh(); }
          } catch { fail(); }
        };
        const script = document.createElement("script");
        script.src = "https://telegram.org/js/telegram-widget.js?22";
        script.async = true;
        script.setAttribute("data-telegram-login", botUsername);
        script.setAttribute("data-size", "large");
        script.setAttribute("data-userpic", "false");
        script.setAttribute("data-lang", locale);
        script.setAttribute("data-onauth", `${callbackName}(user)`);
        script.onload = () => { clearTimeout(loadTimer); if (!controller.signal.aborted) setStatus("ready"); };
        script.onerror = () => { clearTimeout(loadTimer); fail(text(locale,"ابزار ورود تلگرام بارگذاری نشد. اتصال اینترنت را بررسی کنید.","The Telegram sign-in widget did not load. Check your connection.")); };
        loadTimer = setTimeout(() => fail(text(locale,"بارگذاری تلگرام طول کشید. دوباره تلاش کنید.","Telegram took too long to load. Please try again.")),15000);
        target.replaceChildren(script);
      } catch { fail(); }
    }
    void initialize();
    return () => { controller.abort(); clearTimeout(loadTimer); delete callbacks[callbackName]; target.replaceChildren(); };
  }, [attempt, botUsername, validUsername, router, locale, returnPath]);

  if (!validUsername) return <p role="alert" className="text-sm leading-7 text-red-800">{text(locale,"ورود تلگرام هنوز پیکربندی نشده است.","Telegram sign-in is not configured yet.")}</p>;
  return <div className="space-y-4" aria-busy={status === "loading" || status === "submitting"}>
    <div ref={container} className={status === "error" || status === "submitting" ? "hidden" : "flex min-h-12 items-center justify-center"} />
    <p role="status" aria-live="polite" className="text-center text-sm leading-7 text-muted">{status === "loading" ? text(locale,"در حال آماده‌سازی ورود تلگرام…","Preparing Telegram sign-in…") : status === "submitting" ? text(locale,"در حال بررسی حساب…","Verifying your account…") : status === "ready" ? text(locale,"برای ادامه، حساب خود را در تلگرام تأیید کنید.","Confirm your Telegram account to continue.") : ""}</p>
    {status === "error" && <div className="space-y-3"><p role="alert" className="text-sm leading-7 text-red-800">{error}</p><button type="button" className="min-h-11 rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-canvas" onClick={() => { setError(""); setStatus("loading"); setAttempt(value => value+1); }}>{text(locale,"تلاش دوباره","Try again")}</button></div>}
  </div>;
}
