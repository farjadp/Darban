const paths = {
  overview: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  posts: "M5 3h10l4 4v14H5V3Zm9 0v6h5M9 13h6M9 17h6",
  members: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  alerts: "M12 3 2 21h20L12 3Zm0 6v5m0 3v1",
  events: "M4 3h16v18H4zM8 7h8M8 12h8M8 17h5",
  settings: "M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-6 0v6",
  subscription: "M3 5h18v14H3V5Zm0 5h18M7 15h3",
  account: "M20 21v-2a7 7 0 0 0-14 0v2M17 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  check: "m5 12 4 4L19 6",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  shield: "m12 3-9 4v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Zm-4 9 3 3 5-6",
} as const;
export type IconName = keyof typeof paths;
export function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><path d={paths[name]} /></svg>;
}
