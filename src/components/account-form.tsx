"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { portalCopy, portalError } from "@/lib/portal-copy";

export function AccountForm({ locale, currentLocale, disabled = false }: { locale: Locale; currentLocale: Locale; disabled?: boolean }) {
  const c = portalCopy(locale);
  const router = useRouter();
  const [choice, setChoice] = useState<Locale>(currentLocale);
  const [state, setState] = useState<{ busy: boolean; message: string; error: boolean }>({ busy: false, message: "", error: false });

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setState({ busy: true, message: "", error: false });
    try {
      const response = await fetch("/api/account", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "x-darban-locale": locale }, body: JSON.stringify({ operation: "profile", locale: choice }), signal: AbortSignal.timeout(30_000) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(portalError(locale, response.status, result?.error));
      setState({ busy: false, message: c.localeSaved, error: false });
      router.refresh();
    } catch (error) {
      setState({ busy: false, message: error instanceof Error ? error.message : c.requestError, error: true });
    }
  }

  return <form onSubmit={save} className="rounded-xl border border-line bg-white p-6 sm:p-8">
    <fieldset>
      <legend className="text-lg font-semibold">{c.preferredLocale}</legend>
      <p className="mt-2 max-w-xl text-sm leading-7 text-muted">{c.preferredLocaleHelp}</p>
      <div className="mt-5 grid gap-2 sm:max-w-sm">{([["fa", c.persian], ["en", c.english]] as const).map(([value, label]) => <label key={value} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-4 py-2 text-sm ${choice === value ? "border-forest bg-mint text-forest" : "border-line hover:bg-canvas"}`}><input type="radio" name="locale" value={value} checked={choice === value} disabled={disabled} onChange={() => setChoice(value)} className="accent-forest" />{label}</label>)}</div>
    </fieldset>
    <div className="mt-6 flex flex-wrap items-center gap-4">
      <button type="submit" disabled={disabled || state.busy || choice === currentLocale} className="inline-flex min-h-11 items-center justify-center rounded-md bg-forest px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50">{c.saveLocale}</button>
      {state.message && <p role={state.error ? "alert" : "status"} className={`text-sm leading-7 ${state.error ? "text-red-800" : "text-forest"}`}>{state.message}</p>}
    </div>
  </form>;
}
