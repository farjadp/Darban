import { Dashboard } from "@/components/dashboard";
import { parseView, sampleDashboard } from "@/lib/dashboard";

export const metadata = { title: "پیش‌نمایش نمونه | مدیریت تلگرام" };
export default async function Preview({ searchParams }: { searchParams: Promise<{ view?: string | string[]; chat?: string | string[] }> }) {
  const params = await searchParams;
  const data = sampleDashboard();
  if (typeof params.chat === "string" && params.chat !== data.chat?.id) {
    data.chat = null;
    data.unavailableChat = true;
  }
  return <Dashboard data={data} view={parseView(params.view)} admin={{ id: "900000000", name: "مدیر نمونه" }} preview />;
}
