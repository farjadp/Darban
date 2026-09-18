import Link from "next/link";
import type { ReactNode } from "react";
import { AdminForm, LogoutButton } from "@/components/admin-form";
import { candidateIds, dashboardHref, date, number, viewLabels, views, type Chat, type DashboardData, type View } from "@/lib/dashboard";

const secondaryLink = "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-100";
const primaryLink = "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700";

function Icon({ name, className = "size-5" }: { name: View | "shield" | "arrow"; className?: string }) {
  const paths = {
    overview: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    posts: "M7 3h10l4 4v14H3V3h4m8 0v6h6M7 13h10M7 17h7",
    members: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    alerts: "M12 3 2 21h20L12 3zm0 6v5m0 3v1",
    events: "M4 3h16v18H4zM8 7h8M8 12h8M8 17h5",
    settings: "M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-6 0v6",
    shield: "M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4zm-4 9 3 3 5-6",
    arrow: "M19 12H5m6-6-6 6 6 6",
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><path d={paths[name]} /></svg>;
}
function Status({ value }: { value: string }) {
  const labels: Record<string, string> = { SUCCEEDED: "موفق", FAILED: "ناموفق", UNKNOWN: "نامشخص", PENDING: "در انتظار" };
  return <span className={`relative inline-flex items-center gap-2 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-medium ${value === "SUCCEEDED" ? "border-zinc-300 bg-white text-zinc-800" : value === "FAILED" ? "border-zinc-700 bg-zinc-100 text-zinc-950" : "border-dashed border-zinc-400 bg-zinc-50 text-zinc-700"}`}><span className={`size-1.5 rounded-full ${value === "SUCCEEDED" ? "bg-zinc-800" : "border border-zinc-500"}`} />{labels[value] ?? "وضعیت ثبت‌شده"}<bdi dir="ltr" className="sr-only">{value}</bdi></span>;
}
function Empty({ title, children }: { title: string; children: ReactNode }) {
  return <div className="border-y border-dashed border-zinc-300 py-12 text-center"><h3 className="font-semibold">{title}</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-zinc-600">{children}</p></div>;
}
function SectionHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">{title}</h2>{description && <p className="mt-1 text-sm leading-7 text-zinc-600">{description}</p>}</div>{action}</div>;
}
function Rules({ chat }: { chat: Chat }) {
  return <dl className="divide-y divide-zinc-200 border-y border-zinc-200 text-sm">
    <div className="flex justify-between gap-5 py-4"><dt className="text-zinc-600">تأیید حساب با ربات</dt><dd className="font-medium">{chat.verification ? "الزامی" : "غیرفعال"}</dd></div>
    <div className="flex justify-between gap-5 py-4"><dt className="text-zinc-600">زمان انتظار پس از عضویت</dt><dd className="font-medium">{number(chat.waitHours)} ساعت</dd></div>
    <div className="flex justify-between gap-5 py-4"><dt className="text-zinc-600">زمان انتظار دیدگاه‌ها در گروه مرتبط</dt><dd className="font-medium">{chat.commentGate ? "فعال" : "غیرفعال"}</dd></div>
  </dl>;
}
function Posts({ data, preview, compact = false }: { data: DashboardData; preview: boolean; compact?: boolean }) {
  if (!data.posts.length) return <Empty title="هنوز پستی ثبت نشده">از بخش انتشار، یک پست متنی با دکمه‌های رأی‌گیری بسازید. فقط پست‌های ثبت‌شده در این سامانه نمایش داده می‌شوند.</Empty>;
  return <div className="divide-y divide-zinc-200 border-y border-zinc-200">{(compact ? data.posts.slice(0, 3) : data.posts).map((post) => <article key={post.id} className="py-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-3"><Status value={post.status} /><span className="text-xs text-zinc-600">{date(post.createdAt)}</span></div><span className="text-xs text-zinc-500">{post.messageId ? <>پیام <bdi dir="ltr">{number(post.messageId)}</bdi></> : "بدون شناسهٔ پیام تلگرام"}</span></div>
    <p dir="auto" className={`mt-4 max-w-3xl whitespace-pre-wrap break-words text-sm leading-8 ${compact ? "line-clamp-2" : ""}`}>{post.text}</p>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-4"><dl className="flex flex-wrap gap-5 text-xs text-zinc-600"><div className="flex gap-2"><dt>موافقم</dt><dd className="font-semibold text-zinc-950">{number(post.votes.agree)}</dd></div><div className="flex gap-2"><dt>مفید بود</dt><dd className="font-semibold text-zinc-950">{number(post.votes.useful)}</dd></div><div className="flex gap-2"><dt>پرسش دارم</dt><dd className="font-semibold text-zinc-950">{number(post.votes.question)}</dd></div></dl>{!compact && data.chat && <AdminForm operation="sync" chat={data.chat} postId={post.id} disabled={preview || !post.messageId} />}</div>
  </article>)}</div>;
}
function Events({ data, compact = false }: { data: DashboardData; compact?: boolean }) {
  const labels: Record<string, string> = { ban: "مسدود کردن", unban: "رفع مسدودیت", publish: "انتشار پست", sync: "همگام‌سازی", settings: "تغییر تنظیمات", connect: "اتصال کانال", review: "بررسی هشدار" };
  if (!data.events.length) return <Empty title="عملیاتی ثبت نشده">پس از اولین اقدام مدیریتی، نتیجه و عامل آن در این بخش ثبت می‌شود.</Empty>;
  return <div className="overflow-x-auto rounded-md border border-zinc-200"><table className="w-full min-w-[720px] text-right text-sm"><caption className="sr-only">گزارش عملیات کانال؛ زمان‌ها به وقت تهران</caption><thead className="bg-zinc-50 text-xs text-zinc-600"><tr>{["عملیات / زمان", "عامل", "حساب هدف", "دلیل", "نتیجه"].map((label) => <th scope="col" key={label} className="px-5 py-4 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-zinc-200">{(compact ? data.events.slice(0, 3) : data.events).map((event) => <tr key={event.id} className="align-top"><td className="px-5 py-5"><span className="font-medium">{labels[event.action.toLowerCase()] ?? event.action}</span><span className="mt-2 block whitespace-nowrap text-xs text-zinc-500">{date(event.createdAt)}</span></td><td className="px-5 py-5"><bdi dir="ltr" className="font-mono text-xs">{event.actorId}</bdi></td><td className="px-5 py-5"><bdi dir="ltr" className="font-mono text-xs">{event.targetId ?? "—"}</bdi></td><td className="max-w-xs px-5 py-5"><p className="min-w-36 whitespace-pre-wrap break-words leading-7">{event.reason}</p>{event.detail && <p className="mt-1 text-xs leading-6 text-zinc-600">{event.detail}</p>}</td><td className="px-5 py-5"><Status value={event.status} /></td></tr>)}</tbody></table></div>;
}
function Members({ data, preview }: { data: DashboardData; preview: boolean }) {
  if (!data.members.length) return <Empty title="عضوی در سامانه ثبت نشده">تلگرام فهرست کامل اعضای کانال را در اختیار ربات قرار نمی‌دهد. حساب‌ها پس از دریافت رویدادهای عضویت یا تعامل ثبت می‌شوند.</Empty>;
  return <div className="overflow-x-auto rounded-md border border-zinc-200"><table className="w-full min-w-[820px] text-right text-sm"><caption className="sr-only">حداکثر ۵۰ عضو ثبت‌شدهٔ اخیر؛ نه فهرست کامل اعضای تلگرام</caption><thead className="bg-zinc-50 text-xs text-zinc-600"><tr>{["حساب / شناسه", "عضویت ثبت‌شده", "تأیید حساب", "اولین رأی", "اقدام مدیریتی"].map((label) => <th key={label} scope="col" className="px-5 py-4 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-zinc-200">{data.members.map((member) => <tr key={member.userId} className="align-top"><td className="px-5 py-5"><span className="font-medium">{member.name}</span><bdi dir="ltr" className="mt-2 block w-fit font-mono text-xs text-zinc-600">{member.userId}</bdi><span className="mt-2 block text-xs">{member.banned ? "مسدود" : member.present ? "حاضر" : "خارج‌شده"}</span></td><td className="px-5 py-5 text-xs leading-7">{date(member.joinedAt)}</td><td className="px-5 py-5 text-xs leading-7">{member.verifiedAt ? date(member.verifiedAt) : "تأیید نشده"}</td><td className="px-5 py-5 text-xs leading-7">{date(member.firstVotedAt)}</td><td className="min-w-64 px-5 py-5"><details><summary className="min-h-11 cursor-pointer rounded-md py-2 font-medium underline decoration-zinc-300 underline-offset-4">{member.banned ? "رفع مسدودیت" : "مسدود کردن"}</summary><div className="mt-3">{data.chat && <AdminForm operation="moderate" chat={data.chat} targetId={member.userId} action={member.banned ? "unban" : "ban"} disabled={preview} />}</div></details></td></tr>)}</tbody></table></div>;
}
function Alerts({ data, preview }: { data: DashboardData; preview: boolean }) {
  if (!data.alerts.length) return <Empty title="هشدار بررسی‌نشده‌ای وجود ندارد">هشدارهای ثبت‌شده برای بررسی انسانی در این بخش قرار می‌گیرند. نبود هشدار، تضمین نبود تخلف نیست.</Empty>;
  return <div className="divide-y divide-zinc-300 border-y border-zinc-300">{data.alerts.map((alert) => <article key={alert.id} className="py-7">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="font-semibold">هم‌زمانی اولین رأی‌ها</h3><p className="mt-2 text-xs text-zinc-600">{date(alert.createdAt)} · نیازمند بررسی انسانی</p></div>{data.chat && <AdminForm operation="review" chat={data.chat} alertId={alert.id} disabled={preview} />}</div>
    <p className="mt-5 max-w-3xl text-sm leading-8 text-zinc-700">{alert.text}</p><p className="mt-2 text-xs text-zinc-500">شناسهٔ پست: <bdi dir="ltr">{alert.postId}</bdi></p>
    <p className="my-5 text-sm leading-7">تقارن زمانی به‌تنهایی نشانهٔ تخلف نیست. شواهد را بررسی کنید و برای هر حساب جداگانه تصمیم بگیرید؛ هیچ حسابی خودکار مسدود نمی‌شود.</p>
    <details className="mb-5 rounded-md border border-zinc-200 px-4"><summary className="cursor-pointer py-3 text-sm font-medium">مشاهدهٔ شواهد ثبت‌شده</summary><pre dir="ltr" className="max-h-72 overflow-auto whitespace-pre-wrap break-all border-t border-zinc-200 py-4 text-left font-mono text-xs leading-6">{JSON.stringify(alert.candidates, null, 2)?.slice(0, 16000)}</pre><p className="pb-3 text-xs text-zinc-600">حداکثر ۱۶٬۰۰۰ نویسه از شواهد و ۵۰ شناسه در این نما نمایش داده می‌شود.</p></details>
    <div className="space-y-5">{candidateIds(alert.candidates).map((targetId) => <details key={targetId} className="border-b border-zinc-200 pb-3"><summary className="cursor-pointer py-2 text-sm">بررسی حساب <bdi dir="ltr" className="font-mono">{targetId}</bdi></summary><div className="max-w-xl pt-4">{data.chat && <AdminForm operation="moderate" chat={data.chat} targetId={targetId} action="ban" disabled={preview} />}</div></details>)}</div>
    {!candidateIds(alert.candidates).length && <p className="text-sm text-zinc-600">شناسهٔ قابل اقدام در شواهد پیدا نشد. داده‌های ثبت‌شده را بررسی کنید.</p>}
  </article>)}</div>;
}

export function Dashboard({ data, view, admin, preview = false, configurationReady = true }: { data: DashboardData; view: View; admin: { id: string; name: string }; preview?: boolean; configurationReady?: boolean }) {
  const { chat } = data;
  const href = (destination: View) => dashboardHref(destination, chat?.id, preview);
  const disabled = preview || !configurationReady;
  const descriptions: Record<View, string> = {
    overview: "وضعیت کانال، موارد نیازمند بررسی و آخرین فعالیت‌ها در یک نگاه.",
    posts: "انتشار متن و مدیریت رأی‌های ثبت‌شده با دکمه‌های ربات؛ نه واکنش‌های بومی تلگرام.",
    members: "حداکثر ۵۰ حساب ثبت‌شدهٔ اخیر؛ این فهرست، فهرست کامل اعضای تلگرام نیست.",
    alerts: "حداکثر ۵۰ هشدار بررسی‌نشدهٔ اخیر. تصمیم نهایی برای هر حساب با شماست.",
    events: "حداکثر ۵۰ عملیات اخیر با نتیجهٔ ثبت‌شده؛ همهٔ زمان‌ها به وقت تهران.",
    settings: "قواعد رأی‌دادن و نوشتن دیدگاه را برای همین کانال تنظیم کنید.",
  };
  return <div className="min-h-screen bg-white lg:flex">
    <aside className="border-b border-zinc-200 bg-zinc-50 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-l">
      <Link href={href("overview")} className="flex items-center gap-3 px-6 py-6 text-lg font-bold"><span className="flex size-9 items-center justify-center rounded-lg bg-zinc-950 text-white"><Icon name="shield" /></span>مدیریت تلگرام</Link>
      <nav aria-label="ناوبری اصلی" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1 lg:px-4 lg:py-3">{views.map((item) => <Link key={item} href={href(item)} aria-current={view === item ? "page" : undefined} className={`flex min-h-11 shrink-0 items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${view === item ? "bg-zinc-950 font-medium text-white" : "text-zinc-600 hover:bg-zinc-200 hover:text-zinc-950"}`}><Icon name={item} /><span>{viewLabels[item]}</span>{item === "alerts" && data.counts.alerts > 0 && <span className={`ms-auto rounded px-1.5 text-xs ${view === item ? "bg-white/20" : "bg-zinc-200"}`}>{number(data.counts.alerts)}</span>}</Link>)}</nav>
      <div className="hidden min-h-0 flex-1 px-6 pt-8 lg:block"><h2 className="text-xs font-medium text-zinc-500">کانال‌های شما</h2><p className="mt-1 text-xs leading-6 text-zinc-500">تا ۵۰ اتصال اخیر</p><ul className="mt-3 max-h-64 space-y-1 overflow-y-auto">{data.chats.map((item) => <li key={item.id}><Link href={dashboardHref(view, item.id, preview)} aria-current={chat?.id === item.id ? "true" : undefined} className={`block rounded-md px-2 py-3 text-sm ${chat?.id === item.id ? "bg-zinc-200 font-medium" : "text-zinc-600 hover:bg-zinc-100"}`}>{item.title}<bdi dir="ltr" className="mt-1 block w-fit text-xs font-normal text-zinc-500">{item.id}</bdi></Link></li>)}</ul><Link href={`${href("overview")}#connect`} className="mt-3 inline-flex min-h-11 items-center text-sm font-medium underline decoration-zinc-400 underline-offset-4">افزودن کانال</Link></div>
      <div className="hidden border-t border-zinc-200 px-6 py-5 lg:block"><p className="text-sm font-medium">{admin.name}</p><p className="mt-1 text-xs text-zinc-500">{preview ? "حساب نمایشی · فقط خواندنی" : "مدیر تأییدشده"}</p></div>
    </aside>
    <div className="min-w-0 flex-1">
      <header className="flex min-h-20 flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4 sm:px-8 lg:px-10"><div className="flex min-w-0 flex-wrap items-center gap-3 text-sm"><span className="text-zinc-500">فضای مدیریت</span><span aria-hidden="true" className="text-zinc-300">/</span><span className="font-medium">{chat?.title ?? "کانال‌ها"}</span>{chat && <bdi dir="ltr" className="text-xs text-zinc-500">{chat.id}</bdi>}</div>{preview ? <Link href="/login" className={secondaryLink}>ورود مدیر</Link> : <LogoutButton />}</header>
      {preview && <div role="status" className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-300 bg-zinc-100 px-5 py-4 text-sm font-semibold sm:px-8 lg:px-10"><span>پیش‌نمایش با داده‌ی نمونه؛ به تلگرام متصل نیست</span><span className="text-xs font-normal text-zinc-600">تمام اقدام‌ها غیرفعال‌اند</span></div>}
      {!configurationReady && !preview && <div role="alert" className="border-b border-zinc-300 bg-zinc-100 px-5 py-4 text-sm leading-7 sm:px-8 lg:px-10">پیکربندی اتصال کامل نیست. اقدام‌ها تا تکمیل تنظیمات سرور غیرفعال‌اند. داده‌های زیر فقط سوابق پایگاه داده هستند.</div>}
      <main id="main-content" className="mx-auto max-w-7xl px-5 pb-16 pt-8 sm:px-8 lg:px-10 lg:pt-10">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-5"><div><h1 className="text-2xl font-bold sm:text-3xl">{viewLabels[view]}</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-600">{descriptions[view]}</p></div>{view === "overview" && chat && <Link href={href("posts")} className={primaryLink}>نوشتن پست<Icon name="arrow" className="size-4" /></Link>}</div>
        <nav aria-label="انتخاب کانال" className="mb-7 flex gap-2 overflow-x-auto pb-2 lg:hidden">{data.chats.map((item) => <Link href={dashboardHref(view, item.id, preview)} key={item.id} className={`shrink-0 rounded-md border px-3 py-2 text-sm ${chat?.id === item.id ? "border-zinc-950 bg-zinc-100" : "border-zinc-300"}`}>{item.title}</Link>)}</nav>
        {data.unavailableChat && <div role="alert" className="mb-8 border border-zinc-300 p-5 text-sm leading-7">کانال انتخاب‌شده در دسترس شما نیست یا وجود ندارد. از فهرست کانال‌های خود انتخاب کنید.</div>}
        {!chat && !data.unavailableChat && <Empty title="اولین کانال را اضافه کنید">ابتدا ربات را در تلگرام مدیر کنید، سپس شناسهٔ کانال یا گروه را در فرم زیر وارد کنید. اتصال تنها پس از بررسی دسترسی‌ها انجام می‌شود.</Empty>}
        {chat && view === "overview" && <div className="space-y-10">
          <dl className="flex flex-wrap divide-zinc-200 border-y border-zinc-200 py-2 sm:flex-nowrap sm:divide-x sm:divide-x-reverse">{[{ title: "عضو ثبت‌شده", value: data.counts.members, view: "members" as View }, { title: "پست ثبت‌شده", value: data.counts.posts, view: "posts" as View }, { title: "هشدار بررسی‌نشده", value: data.counts.alerts, view: "alerts" as View }].map((item) => <div key={item.view} className="flex min-w-44 flex-1 items-baseline justify-between gap-5 px-4 py-5 first:pr-0"><dt><Link href={href(item.view)} className="text-sm text-zinc-600 underline decoration-zinc-300 underline-offset-4">{item.title}</Link></dt><dd className="text-2xl font-semibold tabular-nums">{number(item.value)}</dd></div>)}</dl>
          {data.counts.alerts > 0 && <section className="flex flex-wrap items-center justify-between gap-5 rounded-md border border-zinc-300 bg-zinc-50 px-5 py-5"><div className="flex items-start gap-4"><Icon name="alerts" className="mt-1 size-5 shrink-0" /><div><h2 className="font-semibold">{number(data.counts.alerts)} هشدار در انتظار بررسی شما</h2><p className="mt-2 text-sm leading-7 text-zinc-600">شواهد را ببینید؛ اقدام روی حساب‌ها فقط با تأیید شما انجام می‌شود.</p></div></div><Link href={href("alerts")} className={secondaryLink}>بررسی هشدارها<Icon name="arrow" className="size-4" /></Link></section>}
          <section><SectionHeader title="آخرین پست‌ها" description="۳ پست اخیر و رأی‌های ثبت‌شده در سامانه" action={<Link href={href("posts")} className="py-2 text-sm font-medium underline decoration-zinc-300 underline-offset-4">همهٔ پست‌های اخیر</Link>} /><Posts data={data} preview={disabled} compact /></section>
          <section><SectionHeader title="قواعد فعال کانال" description="این قواعد بر تعامل‌هایی اعمال می‌شوند که ربات دریافت می‌کند." action={<Link href={href("settings")} className="py-2 text-sm font-medium underline decoration-zinc-300 underline-offset-4">ویرایش تنظیمات</Link>} /><Rules chat={chat} /></section>
          <section><SectionHeader title="آخرین عملیات" action={<Link href={href("events")} className="py-2 text-sm font-medium underline decoration-zinc-300 underline-offset-4">گزارش کامل‌تر</Link>} /><Events data={data} compact /></section>
        </div>}
        {chat && view === "posts" && <div className="space-y-10"><section className="max-w-3xl"><SectionHeader title="انتشار پست جدید" description="پیش از انتشار، متن و مقصد را تأیید خواهید کرد." /><AdminForm key={chat.id} operation="publish" chat={chat} disabled={disabled || !chat.active} /></section><section><SectionHeader title="پست‌های اخیر" description="حداکثر ۵۰ پست اخیر. شمارنده‌ها مربوط به رأی‌های ثبت‌شده در سامانه‌اند." /><Posts data={data} preview={disabled} /></section></div>}
        {chat && view === "members" && <Members data={data} preview={disabled} />}
        {chat && view === "alerts" && <Alerts data={data} preview={disabled} />}
        {chat && view === "events" && <><p className="mb-6 border-r border-zinc-400 pr-4 text-sm leading-7 text-zinc-600">«نامشخص» یعنی نتیجهٔ قطعی دریافت نشده است؛ به معنی موفق یا ناموفق بودن نیست. پیش از تکرار اقدام، وضعیت را در تلگرام بررسی کنید.</p><Events data={data} /></>}
        {chat && view === "settings" && <section className="max-w-2xl"><SectionHeader title={`قواعد ${chat.title}`} description="تغییرات فقط برای کانال انتخاب‌شده ذخیره می‌شوند." /><p className="mb-6 border-y border-zinc-300 py-4 text-sm leading-8">واکنش‌های بومی تلگرام را در تنظیمات کانال، بخش Reactions، دستی خاموش کنید. بات امکان خاموش کردن آن‌ها را ندارد؛ در غیر این صورت رأی‌گیری بومی از این قواعد عبور می‌کند. زمان ورود اعضای قدیمی نامشخص می‌ماند و دوره‌ی انتظار برای آن‌ها اعمال نمی‌شود.</p><AdminForm key={`${chat.id}-${chat.waitHours}-${chat.verification}-${chat.commentGate}-${chat.discussionChatId}`} operation="settings" chat={chat} disabled={disabled} /></section>}
        {(view === "overview" || !chat) && <section id="connect" className="mt-12 scroll-mt-8 border-t border-zinc-200 pt-8"><SectionHeader title="کانال‌های متصل" description="حداکثر ۵۰ اتصال اخیر در دسترسی شما؛ وضعیت ثبت‌شده، تضمین اتصال لحظه‌ای نیست." /><ul className="mb-8 divide-y divide-zinc-200">{data.chats.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><Link href={dashboardHref("overview", item.id, preview)} className="font-medium underline decoration-zinc-300 underline-offset-4">{item.title}</Link><div className="flex flex-wrap items-center gap-4"><bdi dir="ltr" className="text-xs text-zinc-600">{item.id}</bdi><span className="text-xs text-zinc-600">{item.active ? "فعال در سامانه" : "غیرفعال در سامانه"}</span></div></li>)}</ul><div className="max-w-xl"><h3 className="mb-4 font-semibold">افزودن کانال یا گروه</h3><AdminForm operation="connect" disabled={disabled} /></div></section>}
        <footer className="mt-12 flex flex-wrap justify-between gap-3 border-t border-zinc-200 pt-5 text-xs leading-6 text-zinc-500"><p>{preview ? "داده‌ها، حساب‌ها و زمان‌ها ساختگی‌اند." : "فقط داده‌های ثبت‌شدهٔ کانال‌های تحت مدیریت شما نمایش داده می‌شوند."}</p><p>زمان‌ها به وقت تهران</p></footer>
      </main>
    </div>
  </div>;
}
