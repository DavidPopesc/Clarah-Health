import { redirect } from "next/navigation";

// Overview (visit recaps) moved to the home page; keep old links working.
export default function VisitsPage() {
  redirect("/");
}
