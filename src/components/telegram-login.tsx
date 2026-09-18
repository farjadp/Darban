"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function TelegramLogin({ botUsername }: { botUsername: string }) {
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

    const fail = (message: string) => {
      if (!controller.signal.aborted) {
        setError(message);
        setStatus("error");
      }
    };

    async function initialize() {
      try {
        const response = await fetch("/api/auth/nonce", {
          method: "POST", credentials: "same-origin", cache: "no-store",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
        });
        const payload = await response.json();
        if (!response.ok || typeof payload.nonce !== "string" || !/^[a-f0-9]{64}$/.test(payload.nonce)) {
          fail(typeof payload.error === "string" ? payload.error : "آماده‌سازی ورود انجام نشد. دوباره تلاش کنید.");
          return;
        }
        if (controller.signal.aborted) return;
        callbacks[callbackName] = async (data: unknown) => {
          if (pending || controller.signal.aborted) return;
          pending = true;
          setStatus("submitting");
          try {
            const result = await fetch("/api/auth/telegram", {
              method: "POST", credentials: "same-origin", cache: "no-store",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ nonce: payload.nonce, data }),
              signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
            });
            const body = await result.json();
            if (!result.ok || body.ok !== true) {
              fail(typeof body.error === "string" ? body.error : "ورود انجام نشد. دوباره تلاش کنید.");
              return;
            }
            if (!controller.signal.aborted) { router.replace("/"); router.refresh(); }
          } catch {
            fail("ارتباط با سرویس ورود برقرار نشد. دوباره تلاش کنید.");
          }
        };
        const script = document.createElement("script");
        script.src = "https://telegram.org/js/telegram-widget.js?22";
        script.async = true;
        script.setAttribute("data-telegram-login", botUsername);
        script.setAttribute("data-size", "large");
        script.setAttribute("data-userpic", "false");
        script.setAttribute("data-onauth", `${callbackName}(user)`);
        script.onload = () => {
          clearTimeout(loadTimer);
          if (!controller.signal.aborted) setStatus("ready");
        };
        script.onerror = () => {
          clearTimeout(loadTimer);
          fail("ابزار ورود تلگرام بارگذاری نشد. اتصال اینترنت را بررسی کنید.");
        };
        loadTimer = setTimeout(() => fail("بارگذاری تلگرام طول کشید. دوباره تلاش کنید."), 15_000);
        target.replaceChildren(script);
      } catch {
        fail("ارتباط با سرویس ورود برقرار نشد. دوباره تلاش کنید.");
      }
    }

    void initialize();
    return () => {
      controller.abort();
      clearTimeout(loadTimer);
      delete callbacks[callbackName];
      target.replaceChildren();
    };
  }, [attempt, botUsername, validUsername, router]);

  if (!validUsername) {
    return <p role="alert" className="text-sm leading-7 text-red-700">تنظیمات ورود تلگرام کامل نیست. با مدیر سامانه تماس بگیرید.</p>;
  }

  return (
    <div className="space-y-4" dir="rtl" aria-busy={status === "loading" || status === "submitting"}>
      <div ref={container} className={status === "error" || status === "submitting" ? "hidden" : "flex min-h-12 items-center justify-center"} />
      <p role="status" aria-live="polite" className="text-center text-sm leading-7 text-stone-600">
        {status === "loading" ? "در حال آماده‌سازی ورود تلگرام…" : status === "submitting" ? "در حال بررسی دسترسی…" : status === "ready" ? "برای ورود، هویت خود را در تلگرام تأیید کنید." : ""}
      </p>
      {status === "error" && (
        <div className="space-y-3">
          <p role="alert" className="text-sm leading-7 text-red-700">{error}</p>
          <button type="button" className="min-h-11 rounded-lg border border-stone-400 px-4 py-2 text-sm font-medium text-stone-900 transition-colors hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-900" onClick={() => {
            setError("");
            setStatus("loading");
            setAttempt((value) => value + 1);
          }}>تلاش دوباره</button>
        </div>
      )}
    </div>
  );
}
