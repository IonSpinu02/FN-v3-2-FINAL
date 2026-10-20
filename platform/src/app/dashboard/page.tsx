import { redirect } from "next/navigation";

/** Compatibilità link legacy */
export default function DashboardRedirectPage() {
  redirect("/app/scenario");
}
