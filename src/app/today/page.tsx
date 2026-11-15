import { redirect } from "next/navigation";

// My profile replaced Today; keep old links working.
export default function TodayPage() {
  redirect("/profile");
}
