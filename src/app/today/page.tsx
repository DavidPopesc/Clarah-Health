import { redirect } from "next/navigation";

// The home page replaced Today; keep old links working.
export default function TodayPage() {
  redirect("/");
}
