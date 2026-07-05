// Repository-helpers voor Firestore-collectie `buurten`: de office-beheerbare
// lijst van buurten/wijken die overal als dropdown en filter wordt gebruikt.
// Alleen aanroepen vanuit client components (Web SDK, geen Admin SDK).
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";

/** Dagdeel waarop Selibon (de afvalophaaldienst) in een buurt ophaalt. */
export type SelibonDagdeel = "ochtend" | "middag";

export interface Buurt {
  id: string;
  naam: string;
  actief: boolean;
  volgorde: number;
  /**
   * Weekdag waarop Selibon het afval in deze buurt ophaalt:
   * 1 = maandag .. 7 = zondag. Leeg/null = onbekend.
   * (Bewust breder dan `Weekdag` uit types.ts, die stopt bij zaterdag.)
   */
  selibonDag?: number | null;
  /** Dagdeel van de Selibon-ophaling. Leeg/null = onbekend. */
  selibonDagdeel?: SelibonDagdeel | null;
}

const BUURTEN = "buurten";

/**
 * Startlijst voor `seedBuurtenAlsLeeg()`. Daarna beheert office de lijst
 * volledig zelf via /beheer/buurten; deze constante is alleen het beginpunt.
 */
export const START_BUURTEN: string[] = [
  "Playa (Kralendijk centrum)",
  "Nikiboko",
  "Antriol",
  "Tera Kora",
  "Nort Saliña",
  "Belnem",
  "Hato",
  "Republiek",
  "Santa Barbara",
  "Rincon",
  "Sabadeco",
  "Lima",
];

/** Alle buurten, gesorteerd op volgorde (ook inactieve, voor het beheerscherm). */
export async function listBuurten(): Promise<Buurt[]> {
  const snap = await getDocs(
    query(collection(getDb(), BUURTEN), orderBy("volgorde", "asc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Buurt);
}

/** Alleen actieve buurten (voor dropdowns en filters). Client-side gefilterd
 * zodat er geen composite index (actief + volgorde) nodig is. */
export async function listActieveBuurten(): Promise<Buurt[]> {
  const actief = (await listBuurten()).filter((b) => b.actief);
  // Dedupliceer op naam: mocht de collectie ooit dubbele namen bevatten
  // (bv. door een oude dubbele seed), dan blijft de eerste over zodat
  // dropdowns/filters geen dubbele React-keys krijgen. Het beheerscherm
  // gebruikt listBuurten (met id's) en toont dubbelen wel, zodat office
  // er een kan verwijderen.
  const gezien = new Set<string>();
  return actief.filter((b) => {
    if (gezien.has(b.naam)) return false;
    gezien.add(b.naam);
    return true;
  });
}

export async function createBuurt(
  data: Omit<Buurt, "id">
): Promise<string> {
  // Firestore accepteert geen `undefined`-waarden: optionele Selibon-velden
  // die niet zijn ingevuld laten we weg uit het document.
  const schoon = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  );
  const ref = await addDoc(collection(getDb(), BUURTEN), schoon);
  return ref.id;
}

export async function updateBuurt(
  id: string,
  data: Partial<Omit<Buurt, "id">>
): Promise<void> {
  // "Onbekend" maken doe je met `null` (Firestore kent geen `undefined`).
  const schoon = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  );
  await updateDoc(doc(getDb(), BUURTEN, id), schoon);
}

export async function deleteBuurt(id: string): Promise<void> {
  // Klanten met deze buurt houden gewoon hun (tekst)waarde in `klant.wijk`;
  // de dropdowns tonen die waarde backwards-compatible als extra optie.
  await deleteDoc(doc(getDb(), BUURTEN, id));
}

/**
 * Eenmalige opruimactie voor de oude dubbele seed: groepeert alle buurten op
 * naam, houdt per naam de buurt met de LAAGSTE volgorde (bij gelijke volgorde
 * de eerste) en verwijdert de rest. Heeft de te-behouden buurt geen
 * Selibon-info maar een duplicaat wel, dan wordt die waarde eerst overgenomen
 * (merge) zodat er geen ingevulde data verloren gaat.
 * Geeft terug hoeveel dubbele er verwijderd zijn.
 */
export async function verwijderDubbeleBuurten(): Promise<number> {
  const alle = await listBuurten(); // gesorteerd op volgorde asc
  const db = getDb();
  const batch = writeBatch(db);

  // listBuurten is oplopend op volgorde gesorteerd: de eerste per naam is
  // dus automatisch de laagste volgorde (en bij gelijke volgorde de eerste).
  const behouden = new Map<string, Buurt>();
  let verwijderd = 0;

  for (const buurt of alle) {
    const keeper = behouden.get(buurt.naam);
    if (!keeper) {
      behouden.set(buurt.naam, buurt);
      continue;
    }
    // Merge: Selibon-velden van het duplicaat overnemen als de keeper ze
    // nog niet heeft ingevuld.
    const merge: Partial<Omit<Buurt, "id">> = {};
    if (keeper.selibonDag == null && buurt.selibonDag != null) {
      merge.selibonDag = buurt.selibonDag;
      keeper.selibonDag = buurt.selibonDag;
    }
    if (keeper.selibonDagdeel == null && buurt.selibonDagdeel != null) {
      merge.selibonDagdeel = buurt.selibonDagdeel;
      keeper.selibonDagdeel = buurt.selibonDagdeel;
    }
    if (Object.keys(merge).length > 0) {
      batch.update(doc(db, BUURTEN, keeper.id), merge);
    }
    batch.delete(doc(db, BUURTEN, buurt.id));
    verwijderd++;
  }

  if (verwijderd > 0) await batch.commit();
  return verwijderd;
}

/**
 * Volgorde van de hele lijst in 1 batch wegschrijven (volgorde = (index+1)*10).
 * Gebruikt door de omhoog/omlaag-knoppen in /beheer/buurten; renummeren van
 * alles voorkomt problemen met dubbele volgorde-waarden.
 */
export async function herschrijfVolgorde(buurten: Buurt[]): Promise<void> {
  const db = getDb();
  const batch = writeBatch(db);
  buurten.forEach((b, i) => {
    batch.update(doc(db, BUURTEN, b.id), { volgorde: (i + 1) * 10 });
  });
  await batch.commit();
}

/** Vaste doc-id op basis van de naam (slug). Zo schrijft een dubbele seed
 * naar dezelfde documenten in plaats van dubbele aan te maken. */
function buurtDocId(naam: string): string {
  return naam
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Idempotente seed: schrijft de startlijst alleen als de collectie leeg is.
 * Wordt aangeroepen bij het openen van /beheer/buurten. Gebruikt vaste doc-id's
 * (slug van de naam), zodat zelfs een dubbele aanroep (bv. React StrictMode die
 * effecten dubbel draait) naar dezelfde documenten schrijft en er nooit
 * dubbele buurten ontstaan.
 */
export async function seedBuurtenAlsLeeg(): Promise<void> {
  const db = getDb();
  const snap = await getDocs(collection(db, BUURTEN));
  if (!snap.empty) return;
  const batch = writeBatch(db);
  START_BUURTEN.forEach((naam, i) => {
    batch.set(doc(db, BUURTEN, buurtDocId(naam)), {
      naam,
      actief: true,
      volgorde: (i + 1) * 10,
    });
  });
  await batch.commit();
}
