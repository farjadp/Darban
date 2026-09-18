"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate, formatMoney, type Locale } from "@/lib/i18n";
import { pricePresentation } from "@/lib/marketing-copy";
import type { PlanConfig } from "@/lib/plans";
import { planLabel, portalCopy, portalError, requestStatusLabel } from "@/lib/portal-copy";

type Interval = "monthly" | "annual";
export type RequestRow = { id: string; planId: string; interval: string; initialCents: number; renewalCents: number; currency: string; status: string; createdAt: string };
type Props = { locale: Locale; plans: PlanConfig[]; subscription: { planId: string; status: string }; requests: RequestRow[]; preselected?: { planId?: string; interval?: string }; disabled?: boolean };

const button = "inline-flex min-h-11 items-center justify-center rounded-md px-5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const card = "rounded-xl border border-line bg-white";

async function post(locale: Locale, body: object) {
  const response = await fetch("/api/account", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "x-darban-locale": locale }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(portalError(locale, response.status, result?.error));
  return result;
}

export function PlanChooser({ locale, plans, subscription, preselected, disabled = false }: Omit<Props, "requests">) {
  const c = portalCopy(locale);
  const router = useRouter();
  const [planId, setPlanId] = useState<string>(preselected?.planId === "free" || preselected?.planId === "pro" ? preselected.planId : "pro");
  const [interval, setInterval] = useState<Interval>(preselected?.interval === "monthly" ? "monthly" : "annual");
  // The idempotency key is minted once per screen, so a retried tap or a
  // flaky connection can never record the same request twice.
  const [requestId] = useState(() => crypto.randomUUID());
  const [state, setState] = useState<{ busy: boolean; message: string; error: boolean }>({ busy: false, message: "", error: false });
  const plan = plans.find((item) => item.id === planId) ?? plans[0];
  const quote = plan ? pricePresentation(plan, interval) : null;
  const current = subscription.planId === planId;

  async function submit() {
    if (!plan || !window.confirm(c.requestConfirm)) return;
    setState({ busy: true, message: "", error: false });
    try {
      await post(locale, { operation: "request-plan", planId: plan.id, interval, requestId });
      setState({ busy: false, message: c.requestRecorded, error: false });
      router.refresh();
    } catch (error) {
      setState({ busy: false, message: error instanceof Error ? error.message : c.requestError, error: true });
    }
  }

  return <div className={`${card} p-6 sm:p-8`}>
    <h2 className="text-lg font-semibold">{c.choosePlan}</h2>
    <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">{c.choosePlanHelp}</p>
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      <fieldset className="min-w-0">
        <legend className="mb-2 text-sm font-medium">{c.plan}</legend>
        <div className="grid gap-2">{plans.map((item) => <label key={item.id} className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md border px-4 py-2 text-sm ${planId === item.id ? "border-forest bg-mint text-forest" : "border-line hover:bg-canvas"} ${!item.available ? "opacity-50" : ""}`}><span className="flex items-center gap-3"><input type="radio" name="plan" value={item.id} checked={planId === item.id} disabled={disabled || !item.available} onChange={() => setPlanId(item.id)} className="accent-forest" />{planLabel(locale, item.id)}</span>{subscription.planId === item.id && <span className="text-xs">{c.currentPlan}</span>}</label>)}</div>
      </fieldset>
      <fieldset className="min-w-0">
        <legend className="mb-2 text-sm font-medium">{c.interval}</legend>
        <div className="grid gap-2">{(["annual", "monthly"] as const).map((value) => <label key={value} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-4 py-2 text-sm ${interval === value ? "border-forest bg-mint text-forest" : "border-line hover:bg-canvas"}`}><input type="radio" name="interval" value={value} checked={interval === value} disabled={disabled} onChange={() => setInterval(value)} className="accent-forest" />{value === "annual" ? c.annual : c.monthly}</label>)}</div>
      </fieldset>
    </div>
    {quote && <dl className="mt-6 grid gap-4 border-t border-line pt-6 sm:grid-cols-2" aria-live="polite">
      <div><dt className="text-xs text-muted">{c.firstPayment}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums"><bdi>{formatMoney(quote.initialCents, locale)}</bdi></dd></div>
      <div><dt className="text-xs text-muted">{c.renewal}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums"><bdi>{formatMoney(quote.renewalCents, locale)}</bdi> <span className="text-sm font-normal text-muted">{interval === "annual" ? c.annual : c.monthly}</span></dd></div>
      {quote.introductory && <p className="text-xs leading-6 text-muted sm:col-span-2">{c.introductory}</p>}
    </dl>}
    <div className="mt-6 flex flex-wrap items-center gap-4">
      <button type="button" onClick={submit} disabled={disabled || state.busy || !plan?.available || current} className={`${button} bg-forest text-white hover:bg-ink`}>{c.requestPlan}</button>
      {current && <span className="text-sm text-muted">{c.alreadyOnPlan}</span>}
      {plan && !plan.available && <span className="text-sm text-muted">{c.requestUnavailable}</span>}
    </div>
    {state.message && <p role={state.error ? "alert" : "status"} className={`mt-4 text-sm leading-7 ${state.error ? "text-red-800" : "text-forest"}`}>{state.message}</p>}
  </div>;
}

export function RequestList({ locale, requests, disabled = false }: Pick<Props, "locale" | "requests" | "disabled">) {
  const c = portalCopy(locale);
  const router = useRouter();
  const [state, setState] = useState<{ busy: string | null; message: string; error: boolean }>({ busy: null, message: "", error: false });

  async function cancel(id: string) {
    if (!window.confirm(c.cancelConfirm)) return;
    setState({ busy: id, message: "", error: false });
    try {
      await post(locale, { operation: "cancel-request", requestId: id });
      setState({ busy: null, message: c.requestCancelled, error: false });
      router.refresh();
    } catch (error) {
      setState({ busy: null, message: error instanceof Error ? error.message : c.requestError, error: true });
    }
  }

  return <div className={card}>
    <div className="border-b border-line px-6 py-5"><h2 className="text-lg font-semibold">{c.requests}</h2></div>
    {requests.length === 0 ? <p className="px-6 py-8 text-sm text-muted">{c.noRequests}</p> : <ul className="divide-y divide-line">{requests.map((request) => <li key={request.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
      <div className="min-w-0"><p className="font-medium">{planLabel(locale, request.planId)} · {request.interval === "annual" ? c.annual : c.monthly}</p><p className="mt-1 text-xs leading-6 text-muted"><bdi>{formatMoney(request.initialCents, locale, request.currency)}</bdi> → <bdi>{formatMoney(request.renewalCents, locale, request.currency)}</bdi> · {c.requestedOn} {formatDate(request.createdAt, locale)}</p></div>
      <div className="flex items-center gap-4"><span className={`rounded-md border px-2.5 py-1 text-xs font-medium ${request.status === "PENDING" ? "border-line bg-canvas text-muted" : request.status === "APPROVED" ? "border-emerald-200 bg-mint text-forest" : "border-line text-muted"}`}>{requestStatusLabel(locale, request.status)}</span>{request.status === "PENDING" && <button type="button" onClick={() => cancel(request.id)} disabled={disabled || state.busy !== null} className={`${button} border border-line text-ink hover:bg-canvas`}>{c.cancelRequest}</button>}</div>
    </li>)}</ul>}
    {state.message && <p role={state.error ? "alert" : "status"} className={`border-t border-line px-6 py-4 text-sm leading-7 ${state.error ? "text-red-800" : "text-forest"}`}>{state.message}</p>}
  </div>;
}
