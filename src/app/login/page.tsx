import { redirect } from "next/navigation";

export default async function LegacyLogin({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  redirect(next ? `/fa/login?next=${encodeURIComponent(next)}` : "/fa/login");
}
