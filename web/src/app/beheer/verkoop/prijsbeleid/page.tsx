// Het prijsbeleid is opgegaan in Instellingen (/beheer/instellingen):
// alle prijsafspraken staan daar nu op 1 plek. Deze route blijft bestaan
// als doorverwijzing voor oude bookmarks.
import { redirect } from "next/navigation";

export default function PrijsbeleidRedirect() {
  redirect("/beheer/instellingen");
}
