"use client";

import Link from "next/link";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main id="main-content" className="mx-auto max-w-xl px-6 py-24"><h1 className="text-2xl font-bold">صفحه بارگذاری نشد</h1><p role="alert" className="mt-5 text-sm leading-8 text-zinc-600">خطایی در دریافت یا نمایش اطلاعات رخ داد. هیچ نتیجه‌ای از این صفحه قابل تأیید نیست. دوباره تلاش کنید؛ اگر خطا ادامه داشت، تنظیمات سرور را بررسی کنید.</p><div className="mt-7 flex flex-wrap gap-3"><button onClick={reset} className="min-h-11 rounded-md bg-zinc-950 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700">تلاش دوباره</button><Link href="/login" className="inline-flex min-h-11 items-center rounded-md border border-zinc-300 px-5 py-2 text-sm hover:bg-zinc-100">صفحهٔ ورود</Link></div></main>;
}
