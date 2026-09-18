import { redirect } from "next/navigation";

// Every public route lives under /fa or /en. The bare origin lands on Persian,
// the primary audience; the header's language switcher covers the rest.
export default function Root() {
  redirect("/fa");
}
