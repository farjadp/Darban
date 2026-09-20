import Link from "next/link";
import type { ReactNode } from "react";
import { AdminForm } from "@/components/admin-form";
import { WorkspaceShell } from "@/components/workspace-shell";
import { candidateIds, type Chat, type DashboardData, type View } from "@/lib/dashboard";
import { actionLabel, dashboardCopy, statusLabel } from "@/lib/dashboard-copy";
import { formatDate, formatNumber, pathFor, type Locale } from "@/lib/i18n";

const secondaryLink = "inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-forest transition-colors hover:bg-canvas";
const primaryLink = "inline-flex min-h-11 items-center justify-center rounded-lg bg-forest px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-900";
const textLink = "inline-flex min-h-11 items-center text-sm font-semibold text-forest underline decoration-emerald-800/30 underline-offset-4 hover:decoration-emerald-800";
const cell = "px-4 py-5 text-start";

type ViewProps = { data: DashboardData; locale: Locale; disabled?: boolean; compact?: boolean };

function chatHref(locale: Locale, view: View, chatId: string | undefined, preview: boolean) {
  const params = new URLSearchParams({ view });
  if (chatId) params.set("chat", chatId);
  return `${pathFor(locale, preview ? "preview" : "portal")}?${params}`;
}

function Status({ value, locale }: { value: string; locale: Locale }) {
  return <span className={`inline-flex items-center gap-2 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-medium ${value === "SUCCEEDED" ? "border-emerald-200 bg-mint text-forest" : value === "FAILED" ? "border-red-200 bg-red-50 text-red-800" : "border-line bg-canvas text-muted"}`}><span aria-hidden="true" className={`size-1.5 rounded-full ${value === "SUCCEEDED" ? "bg-forest" : value === "FAILED" ? "bg-red-700" : "bg-current"}`} />{statusLabel(locale, value)}</span>;
}

function Empty({ title, children }: { title: string; children: ReactNode }) {
  return <div className="py-12 text-center"><h3 className="text-lg font-semibold text-ink">{title}</h3><p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted">{children}</p></div>;
}

function Section({ title, description, action, children, id }: { title: string; description?: string; action?: ReactNode; children: ReactNode; id?: string }) {
  return <section id={id} className="min-w-0 scroll-mt-8 rounded-xl border border-line bg-white p-5 sm:p-6"><div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-lg font-semibold">{title}</h2>{description && <p className="mt-1 max-w-3xl text-sm leading-7 text-muted">{description}</p>}</div>{action}</div>{children}</section>;
}

function Note({ children }: { children: ReactNode }) {
  return <p className="border-s-2 border-emerald-700/40 ps-4 text-sm leading-7 text-muted">{children}</p>;
}

function Rules({ chat, locale }: { chat: Chat; locale: Locale }) {
  const c = dashboardCopy(locale);
  return <dl className="divide-y divide-line text-sm">
    <div className="flex justify-between gap-5 py-4"><dt className="text-muted">{c.verification}</dt><dd className="font-medium">{chat.verification ? c.required : c.disabled}</dd></div>
    <div className="flex justify-between gap-5 py-4"><dt className="text-muted">{c.wait}</dt><dd className="whitespace-nowrap font-medium">{formatNumber(chat.waitHours, locale)} {c.hours}</dd></div>
    <div className="flex justify-between gap-5 py-4"><dt className="text-muted">{c.commentGate}</dt><dd className="font-medium">{chat.commentGate ? c.enabled : c.disabled}</dd></div>
    <div className="flex justify-between gap-5 py-4"><dt className="text-muted">{c.deleteJoinMessages}</dt><dd className="font-medium">{chat.deleteJoinMessages ? c.enabled : c.disabled}</dd></div>
    <div className="flex justify-between gap-5 py-4"><dt className="text-muted">{c.lockCommands}</dt><dd className="font-medium">{chat.lockCommands ? c.enabled : c.disabled}</dd></div>
    <div className="flex justify-between gap-5 py-4"><dt className="text-muted">{c.lockLinks}</dt><dd className="font-medium">{chat.lockLinks ? c.enabled : c.disabled}</dd></div>
    <div className="flex justify-between gap-5 py-4"><dt className="text-muted">{c.lockMedia}</dt><dd className="font-medium">{chat.lockMedia ? c.enabled : c.disabled}</dd></div>
    <div className="flex justify-between gap-5 py-4"><dt className="text-muted">{c.lockForwards}</dt><dd className="font-medium">{chat.lockForwards ? c.enabled : c.disabled}</dd></div>
    <div className="flex justify-between gap-5 py-4"><dt className="text-muted">{c.lockEmoji}</dt><dd className="font-medium">{chat.lockEmoji ? c.enabled : c.disabled}</dd></div>
    <div className="flex justify-between gap-5 py-4"><dt className="text-muted">{c.lockEmptyEmoji}</dt><dd className="font-medium">{chat.lockEmptyEmoji ? c.enabled : c.disabled}</dd></div>
    <div className="flex justify-between gap-5 py-4"><dt className="text-muted">{c.lockHashtags}</dt><dd className="font-medium">{chat.lockHashtags ? c.enabled : c.disabled}</dd></div>
  </dl>;
}

function Posts({ data, locale, disabled = false, compact = false }: ViewProps) {
  const c = dashboardCopy(locale);
  if (!data.posts.length) return <Empty title={c.noPosts}>{c.noPostsHelp}</Empty>;
  return <div className="divide-y divide-line">{(compact ? data.posts.slice(0, 3) : data.posts).map((post) => <article key={post.id} className="py-5 first:pt-0 last:pb-0">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-3"><Status value={post.status} locale={locale} /><span className="text-xs text-muted">{formatDate(post.createdAt, locale)}</span></div><span className="text-xs text-muted">{post.messageId ? <>{c.message} <bdi>{formatNumber(post.messageId, locale)}</bdi></> : c.noMessageId}</span></div>
    <p dir="auto" className={`mt-4 max-w-3xl whitespace-pre-wrap break-words text-sm leading-8 ${compact ? "line-clamp-2" : ""}`}>{post.text}</p>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-4"><dl className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted">{(["agree", "useful", "question"] as const).map((choice) => <div key={choice} className="flex gap-2"><dt>{c[choice]}</dt><dd className="font-semibold tabular-nums text-ink">{formatNumber(post.votes[choice], locale)}</dd></div>)}</dl>{!compact && data.chat && (post.status === "UNKNOWN" && !post.messageId
      ? <AdminForm locale={locale} operation="attach" chat={data.chat} postId={post.id} disabled={disabled} />
      : <AdminForm locale={locale} operation="sync" chat={data.chat} postId={post.id} disabled={disabled || !post.messageId} />)}</div>
  </article>)}</div>;
}

function Events({ data, locale, compact = false }: ViewProps) {
  const c = dashboardCopy(locale);
  if (!data.events.length) return <Empty title={c.noEvents}>{c.noEventsHelp}</Empty>;
  return <div className="max-w-full overflow-x-auto" role="region" aria-label={c.eventsCaption} tabIndex={0}><table className="w-full min-w-[720px] text-start text-sm"><caption className="sr-only">{c.eventsCaption}</caption><thead className="border-y border-line bg-canvas text-xs text-muted"><tr>{[c.actionTime, c.actor, c.target, c.reason, c.outcome].map((label) => <th scope="col" key={label} className="px-4 py-4 text-start font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-line">{(compact ? data.events.slice(0, 3) : data.events).map((event) => <tr key={event.id} className="align-top"><td className={cell}><span className="font-medium">{actionLabel(locale, event.action)}</span><span className="mt-2 block whitespace-nowrap text-xs text-muted">{formatDate(event.createdAt, locale)}</span></td><td className={cell}><bdi dir="ltr" className="font-mono text-xs">{event.actorId}</bdi></td><td className={cell}><bdi dir="ltr" className="font-mono text-xs">{event.targetId ?? "—"}</bdi></td><td className={`${cell} max-w-xs`}><p dir="auto" className="min-w-36 whitespace-pre-wrap break-words leading-7">{event.reason}</p>{event.detail && <p dir="auto" className="mt-1 whitespace-pre-wrap break-words text-xs leading-6 text-muted">{event.detail}</p>}</td><td className={cell}><Status value={event.status} locale={locale} /></td></tr>)}</tbody></table></div>;
}

function Members({ data, locale, disabled = false }: ViewProps) {
  const c = dashboardCopy(locale);
  if (!data.members.length) return <Empty title={c.noMembers}>{c.noMembersHelp}</Empty>;
  return <div className="max-w-full overflow-x-auto" role="region" aria-label={c.membersCaption} tabIndex={0}><table className="w-full min-w-[840px] text-start text-sm"><caption className="sr-only">{c.membersCaption}</caption><thead className="border-y border-line bg-canvas text-xs text-muted"><tr>{[c.accountId, c.observedJoin, c.verification, c.firstVote, c.adminAction].map((label) => <th key={label} scope="col" className="px-4 py-4 text-start font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-line">{data.members.map((member) => <tr key={member.userId} className="align-top"><td className={cell}><bdi className="font-medium">{member.name}</bdi><bdi dir="ltr" className="mt-2 block w-fit font-mono text-xs text-muted">{member.userId}</bdi><span className={`mt-2 block text-xs ${member.banned ? "text-red-800" : "text-muted"}`}>{member.banned ? c.banned : member.present ? c.present : c.left}</span></td><td className={`${cell} text-xs leading-7`}>{member.joinedAt ? formatDate(member.joinedAt, locale) : c.notRecorded}</td><td className={`${cell} text-xs leading-7`}>{member.verifiedAt ? formatDate(member.verifiedAt, locale) : c.notVerified}</td><td className={`${cell} text-xs leading-7`}>{member.firstVotedAt ? formatDate(member.firstVotedAt, locale) : c.notRecorded}</td><td className={`${cell} min-w-64`}><details><summary className="min-h-11 cursor-pointer py-2 font-medium text-forest underline decoration-emerald-800/30 underline-offset-4">{member.banned ? c.unban : c.ban}</summary><div className="mt-3">{data.chat && <AdminForm locale={locale} operation="moderate" chat={data.chat} targetId={member.userId} action={member.banned ? "unban" : "ban"} disabled={disabled} />}</div></details></td></tr>)}</tbody></table></div>;
}

function Alerts({ data, locale, disabled = false }: ViewProps) {
  const c = dashboardCopy(locale);
  if (!data.alerts.length) return <Empty title={c.noAlerts}>{c.noAlertsHelp}</Empty>;
  return <div className="divide-y divide-line">{data.alerts.map((alert) => {
    const candidates = candidateIds(alert.candidates);
    return <article key={alert.id} className="py-7 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="font-semibold">{c.firstVoteTiming}</h3><p className="mt-2 text-xs text-muted">{formatDate(alert.createdAt, locale)} · {c.humanReview}</p></div>{data.chat && <AdminForm locale={locale} operation="review" chat={data.chat} alertId={alert.id} disabled={disabled} />}</div>
      <p dir="auto" className="mt-5 max-w-3xl whitespace-pre-wrap break-words text-sm leading-8">{alert.text}</p><p className="mt-2 text-xs text-muted">{c.postId}: <bdi dir="ltr" className="break-all">{alert.postId}</bdi></p>
      <div className="my-5"><Note>{c.noAutomaticBans}</Note></div>
      <details className="mb-5 border-y border-line"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-forest">{c.evidence}</summary><pre dir="ltr" className="max-h-72 overflow-auto whitespace-pre-wrap break-all border-t border-line py-4 text-start font-mono text-xs leading-6">{JSON.stringify(alert.candidates, null, 2)?.slice(0, 16000)}</pre><p className="pb-3 text-xs text-muted">{c.evidenceLimit}</p></details>
      <div className="divide-y divide-line">{candidates.map((targetId) => <details key={targetId} className="py-2"><summary className="min-h-11 cursor-pointer py-3 text-sm">{c.inspectAccount} <bdi dir="ltr" className="font-mono">{targetId}</bdi></summary><div className="max-w-xl pb-4 pt-2">{data.chat && <AdminForm locale={locale} operation="moderate" chat={data.chat} targetId={targetId} action="ban" disabled={disabled} />}</div></details>)}</div>
      {!candidates.length && <p className="text-sm text-muted">{c.noCandidates}</p>}
    </article>;
  })}</div>;
}

export function Dashboard({ data, view, admin, preview = false, configurationReady = true, locale = "fa" }: { data: DashboardData; view: View; admin: { id: string; name: string; isPlatformAdmin?: boolean }; preview?: boolean; configurationReady?: boolean; locale?: Locale }) {
  const { chat } = data;
  const c = dashboardCopy(locale);
  const href = (destination: View, chatId = chat?.id) => chatHref(locale, destination, chatId, preview);
  const disabled = preview || !configurationReady;
  const descriptions: Record<View, string> = { overview: c.overviewDescription, posts: c.postsDescription, members: c.membersDescription, alerts: c.alertsDescription, events: c.eventsDescription, settings: c.settingsDescription };
  const chats = data.chats.slice(0, 50);

  return <WorkspaceShell locale={locale} area="portal" active={view} user={admin} preview={preview}>
    <div className="min-w-0 space-y-6 wrap-anywhere text-start text-ink">
      {!configurationReady && !preview && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-7 text-amber-950">{c.configurationWarning}</div>}
      <header className="flex flex-wrap items-start justify-between gap-5"><div className="min-w-0"><h1 className="text-2xl font-bold sm:text-3xl">{c[view]}</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-muted">{descriptions[view]}</p></div>{view === "overview" && chat && <Link href={href("posts")} className={primaryLink}>{c.writePost}</Link>}</header>

      <div className="rounded-xl border border-line bg-white px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4"><div className="min-w-0"><p className="text-xs text-muted">{c.currentChat}</p><div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2"><h2 className="break-words font-semibold"><bdi>{chat?.title ?? c.noChat}</bdi></h2>{chat && <bdi dir="ltr" className="font-mono text-xs text-muted">{chat.id}</bdi>}</div>{chat && <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted"><span>{preview ? c.sampleRole : c.chatAdmin}</span><span className={chat.active ? "text-forest" : "text-red-800"}>{chat.active ? c.active : c.inactive}</span></p>}</div><Link href={`${href("overview")}#connect`} className={secondaryLink}>{c.addChat}</Link></div>
        {chats.length > 0 && <details className="mt-3 border-t border-line pt-1"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-forest">{c.switchChat} · {formatNumber(chats.length, locale)}</summary><nav aria-label={c.yourChats} className="max-h-64 overflow-y-auto"><ul className="divide-y divide-line">{chats.map((item) => <li key={item.id}><Link href={href(view, item.id)} aria-current={chat?.id === item.id ? "true" : undefined} className={`flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-3 text-sm ${chat?.id === item.id ? "bg-mint font-medium text-forest" : "hover:bg-canvas"}`}><bdi className="break-words">{item.title}</bdi><bdi dir="ltr" className="font-mono text-xs">{item.id}</bdi></Link></li>)}</ul></nav><p className="py-3 text-xs leading-6 text-muted">{c.chatScope}</p></details>}
      </div>

      {data.unavailableChat && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-950">{c.unavailableChat}</div>}
      {!chat && !data.unavailableChat && <Empty title={c.firstChat}>{c.firstChatHelp}</Empty>}
      {chat && !chat.active && <Note>{c.inactiveWarning}</Note>}

      {chat && view === "overview" && <>
        <div className="rounded-xl border border-line bg-white"><dl className="grid divide-y divide-line sm:grid-cols-3 sm:divide-y-0">{[{ title: c.recordedMembers, value: data.counts.members, view: "members" as const }, { title: c.recordedPosts, value: data.counts.posts, view: "posts" as const }, { title: c.openAlerts, value: data.counts.alerts, view: "alerts" as const }].map((item) => <div key={item.view} className="px-6 py-5 sm:border-s sm:border-line first:sm:border-s-0"><dt><Link href={href(item.view)} className="inline-flex min-h-11 items-center text-sm text-muted hover:text-forest">{item.title}</Link></dt><dd className="mt-1 text-3xl font-semibold tabular-nums">{formatNumber(item.value, locale)}</dd></div>)}</dl><p className="border-t border-line px-6 py-4 text-xs leading-6 text-muted">{c.observedWarning}</p></div>
        {data.counts.alerts > 0 && <section className="flex flex-wrap items-center justify-between gap-5 rounded-xl border border-emerald-200 bg-mint p-5 text-forest"><div><h2 className="font-semibold">{c.reviewQueue} · {formatNumber(data.counts.alerts, locale)}</h2><p className="mt-2 text-sm leading-7">{c.reviewQueueHelp}</p></div><Link href={href("alerts")} className={primaryLink}>{c.reviewAlerts}</Link></section>}
        <Section title={c.latestPosts} description={c.latestPostsHelp} action={<Link href={href("posts")} className={textLink}>{c.allPosts}</Link>}><Posts data={data} locale={locale} disabled={disabled} compact /></Section>
        <Section title={c.rules} description={c.rulesHelp} action={<Link href={href("settings")} className={textLink}>{c.editSettings}</Link>}><Rules chat={chat} locale={locale} /><div className="mt-4 space-y-3"><Note>{c.joinWarning}</Note><Note>{c.nativeWarning}</Note></div></Section>
        <Section title={c.latestEvents} action={<Link href={href("events")} className={textLink}>{c.allEvents}</Link>}><Events data={data} locale={locale} compact /></Section>
      </>}

      {chat && view === "posts" && <>
        <Section title={c.publishTitle} description={c.publishHelp}><div className="max-w-3xl"><AdminForm key={chat.id} locale={locale} operation="publish" chat={chat} disabled={disabled || !chat.active} /><div className="mt-5"><Note>{c.nativeWarning}</Note></div></div></Section>
        <Section title={c.latestPosts} description={c.recentPostsHelp}><Posts data={data} locale={locale} disabled={disabled} /></Section>
      </>}
      {chat && view === "members" && <Section title={c.members} description={c.membersDescription}><div className="mb-6 space-y-3"><Note>{c.observedWarning}</Note><Note>{c.joinWarning}</Note><Note>{c.verificationWarning}</Note></div><Members data={data} locale={locale} disabled={disabled} /></Section>}
      {chat && view === "alerts" && <Section title={c.reviewQueue} description={c.alertsDescription}><Alerts data={data} locale={locale} disabled={disabled} /></Section>}
      {chat && view === "events" && <Section title={c.events}><div className="mb-6"><Note>{c.unknownWarning}</Note></div><Events data={data} locale={locale} /></Section>}
      {chat && view === "settings" && <Section title={c.rules} description={c.selectedOnly}><div className="max-w-3xl"><div className="mb-7 space-y-4"><Note>{c.nativeWarning}</Note><Note>{c.joinWarning}</Note><Note>{c.verificationWarning}</Note></div><AdminForm key={`${chat.id}-${chat.waitHours}-${chat.verification}-${chat.commentGate}-${chat.deleteJoinMessages}-${chat.lockCommands}-${chat.lockLinks}-${chat.lockMedia}-${chat.lockForwards}-${chat.lockEmoji}-${chat.lockEmptyEmoji}-${chat.lockHashtags}-${chat.discussionChatId}`} locale={locale} operation="settings" chat={chat} disabled={disabled} /></div></Section>}

      {(view === "overview" || !chat) && <Section id="connect" title={c.yourChats} description={c.chatScope}>
        {chats.length > 0 && <ul className="mb-7 divide-y divide-line">{chats.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><Link href={href("overview", item.id)} className={textLink}><bdi className="break-words">{item.title}</bdi></Link><div className="flex flex-wrap items-center gap-4"><bdi dir="ltr" className="font-mono text-xs text-muted">{item.id}</bdi><span className="text-xs text-muted">{item.active ? c.active : c.inactive}</span></div></li>)}</ul>}
        <div className="max-w-xl"><h3 className="mb-4 font-semibold">{c.connectTitle}</h3><AdminForm locale={locale} operation="connect" disabled={disabled} /></div>
      </Section>}
      <footer className="flex flex-wrap justify-between gap-3 border-t border-line pt-5 text-xs leading-6 text-muted"><p>{preview ? c.sampleData : c.scopedData}</p><p>{c.timezone}</p></footer>
    </div>
  </WorkspaceShell>;
}
