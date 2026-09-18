"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { planSchema, type PlanConfig } from "@/lib/plan-schema";
import { planLabel, portalCopy, portalError } from "@/lib/portal-copy";

const button = "inline-flex min-h-11 items-center justify-center rounded-md px-5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const field = "mt-1 block w-full rounded-md border border-line bg-white px-3 py-2 text-sm focus:border-forest";

async function post(locale: Locale, body: object) {
  const response = await fetch("/api/platform", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "x-darban-locale": locale }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(portalError(locale, response.status, result?.error));
  return result;
}

type Feedback = { busy: boolean; message: string; error: boolean };
const idle: Feedback = { busy: false, message: "", error: false };

export function PlanEditor({ locale, plan, disabled = false }: { locale: Locale; plan: PlanConfig; disabled?: boolean }) {
  const c = portalCopy(locale);
  const router = useRouter();
  const pro = plan.id === "pro";
  const [draft, setDraft] = useState({ monthly: String(plan.monthlyCents), annual: String(plan.annualCents), intro: plan.introAnnualCents === null ? "" : String(plan.introAnnualCents), featuresFa: plan.featuresFa.join("\n"), featuresEn: plan.featuresEn.join("\n"), available: plan.available });
  const [state, setState] = useState<Feedback>(idle);
  const lines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const candidate = { id: plan.id, currency: "USD" as const, monthlyCents: Number(draft.monthly), annualCents: Number(draft.annual), introAnnualCents: draft.intro.trim() === "" ? null : Number(draft.intro), featuresFa: lines(draft.featuresFa), featuresEn: lines(draft.featuresEn), available: draft.available };
    const parsed = planSchema.safeParse(candidate);
    if (!parsed.success) { setState({ busy: false, message: c.invalidPlan, error: true }); return; }
    setState({ busy: true, message: "", error: false });
    try {
      await post(locale, { operation: "update-plan", plan: parsed.data });
      setState({ busy: false, message: c.planSaved, error: false });
      router.refresh();
    } catch (error) {
      setState({ busy: false, message: error instanceof Error ? error.message : c.requestError, error: true });
    }
  }

  return <form onSubmit={save} className="rounded-xl border border-line bg-white p-6 sm:p-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold">{planLabel(locale, plan.id)}</h3><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={draft.available} disabled={disabled} onChange={(event) => setDraft({ ...draft, available: event.target.checked })} className="accent-forest" />{c.available}</label></div>
    {pro && <div className="mt-5 grid gap-4 sm:grid-cols-3">
      <label className="text-sm"><span className="font-medium">{c.monthlyPrice}</span><input type="number" inputMode="numeric" min={1} max={100000000} dir="ltr" value={draft.monthly} disabled={disabled} onChange={(event) => setDraft({ ...draft, monthly: event.target.value })} className={field} /></label>
      <label className="text-sm"><span className="font-medium">{c.annualPrice}</span><input type="number" inputMode="numeric" min={1} max={100000000} dir="ltr" value={draft.annual} disabled={disabled} onChange={(event) => setDraft({ ...draft, annual: event.target.value })} className={field} /></label>
      <label className="text-sm"><span className="font-medium">{c.introPrice}</span><input type="number" inputMode="numeric" min={1} max={100000000} dir="ltr" value={draft.intro} disabled={disabled} onChange={(event) => setDraft({ ...draft, intro: event.target.value })} className={field} /><span className="mt-1 block text-xs leading-5 text-muted">{c.introPriceHelp}</span></label>
      <p className="text-xs leading-6 text-muted sm:col-span-3">{c.usdCents}</p>
    </div>}
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="text-sm"><span className="font-medium">{c.featuresFa}</span><textarea rows={5} dir="rtl" value={draft.featuresFa} disabled={disabled} onChange={(event) => setDraft({ ...draft, featuresFa: event.target.value })} className={field} /></label>
      <label className="text-sm"><span className="font-medium">{c.featuresEn}</span><textarea rows={5} dir="ltr" value={draft.featuresEn} disabled={disabled} onChange={(event) => setDraft({ ...draft, featuresEn: event.target.value })} className={field} /></label>
      <p className="text-xs leading-6 text-muted sm:col-span-2">{c.featuresHelp}</p>
    </div>
    <div className="mt-6 flex flex-wrap items-center gap-4">
      <button type="submit" disabled={disabled || state.busy} className={`${button} bg-forest text-white hover:bg-ink`}>{c.savePlan}</button>
      {state.message && <p role={state.error ? "alert" : "status"} className={`text-sm leading-7 ${state.error ? "text-red-800" : "text-forest"}`}>{state.message}</p>}
    </div>
  </form>;
}

export function AccountStatusButton({ locale, accountId, status, disabled = false }: { locale: Locale; accountId: string; status: string; disabled?: boolean }) {
  const c = portalCopy(locale);
  const router = useRouter();
  const [state, setState] = useState<Feedback>(idle);
  const suspending = status === "ACTIVE";

  async function toggle() {
    if (!window.confirm(suspending ? c.suspendConfirm : c.reinstateConfirm)) return;
    setState({ busy: true, message: "", error: false });
    try {
      await post(locale, { operation: "account-status", accountId, status: suspending ? "SUSPENDED" : "ACTIVE" });
      setState({ busy: false, message: c.statusSaved, error: false });
      router.refresh();
    } catch (error) {
      setState({ busy: false, message: error instanceof Error ? error.message : c.requestError, error: true });
    }
  }

  return <div className="flex flex-wrap items-center gap-3">
    <button type="button" onClick={toggle} disabled={disabled || state.busy} className={`${button} border ${suspending ? "border-red-200 text-red-800 hover:bg-red-50" : "border-line text-ink hover:bg-canvas"}`}>{suspending ? c.suspend : c.reinstate}</button>
    {state.message && <span role={state.error ? "alert" : "status"} className={`text-xs leading-6 ${state.error ? "text-red-800" : "text-forest"}`}>{state.message}</span>}
  </div>;
}
