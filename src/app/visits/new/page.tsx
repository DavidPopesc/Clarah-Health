import { redirect } from "next/navigation";

// Recording moved to the Care team tab; keep old links working.
export default function NewVisitPage() {
  redirect("/care-team");
}
