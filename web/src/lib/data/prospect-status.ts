// Office-status per prospect uit de marktlijst (prospects.ts), opgeslagen in de
// Firestore-collectie `prospectStatus`. De prospect-data zelf is een statische
// onderzoekslijst; hier houden we alleen de verkoop-voortgang per prospect bij.
// Doc-id = een slug van de prospectnaam, zodat status en prospect gekoppeld
// blijven ook als de lijst-volgorde wijzigt.
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";

export const PROSPECT_STATUSSEN = [
  "nieuw",
  "benaderd",
  "in-gesprek",
  "klant",
  "afgewezen",
] as const;

export type ProspectStatusWaarde = (typeof PROSPECT_STATUSSEN)[number];

export const STATUS_LABEL: Record<ProspectStatusWaarde, string> = {
  nieuw: "Nieuw",
  benaderd: "Benaderd",
  "in-gesprek": "In gesprek",
  klant: "Klant",
  afgewezen: "Afgewezen",
};

export interface ProspectStatus {
  status: ProspectStatusWaarde;
  notitie: string;
  bewerktOp: string;
}

/** Stabiele doc-id op basis van de prospectnaam. */
export function prospectSlug(naam: string): string {
  return naam
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const PROSPECT_STATUS = "prospectStatus";

/** Alle opgeslagen statussen, als map slug -> status. */
export async function listProspectStatus(): Promise<Map<string, ProspectStatus>> {
  const map = new Map<string, ProspectStatus>();
  try {
    const snap = await getDocs(collection(getDb(), PROSPECT_STATUS));
    for (const d of snap.docs) map.set(d.id, d.data() as ProspectStatus);
  } catch {
    // Firestore onbereikbaar: lege map, UI toont overal "nieuw".
  }
  return map;
}

export async function setProspectStatus(
  naam: string,
  data: ProspectStatus
): Promise<void> {
  await setDoc(doc(getDb(), PROSPECT_STATUS, prospectSlug(naam)), data);
}

/** Terug naar "nieuw": doc verwijderen (geen apart record meer). */
export async function clearProspectStatus(naam: string): Promise<void> {
  await deleteDoc(doc(getDb(), PROSPECT_STATUS, prospectSlug(naam)));
}
