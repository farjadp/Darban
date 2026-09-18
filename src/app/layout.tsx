import type { Metadata } from "next";
import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/500.css";
import "@fontsource/vazirmatn/600.css";
import "@fontsource/vazirmatn/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "مدیریت تلگرام | نگهبان کانال",
  description: "مدیریت کانال‌های تلگرام، بررسی هشدارها و ثبت شفاف اقدامات مدیریتی",
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fa" dir="rtl"><body className="bg-white font-sans text-zinc-950 antialiased"><a href="#main-content" className="sr-only z-50 rounded-md bg-zinc-950 text-sm text-white focus:not-sr-only focus:fixed focus:right-4 focus:top-4 focus:px-5 focus:py-3">رفتن به محتوای اصلی</a>{children}</body></html>;
}
