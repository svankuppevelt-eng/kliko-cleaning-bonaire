import { redirect } from "next/navigation";

// /beheer/verkoop opent standaard de Offertes-tab.
export default function VerkoopPage() {
  redirect("/beheer/verkoop/offertes");
}
