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

export interface Buurt {
  id: string;
  naam: string;
  actief: boolean;
  volgorde: number;
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
  return (await listBuurten()).filter((b) => b.actief);
}

export async function createBuurt(
  data: Omit<Buurt, "id">
): Promise<string> {
  const ref = await addDoc(collection(getDb(), BUURTEN), data);
  return ref.id;
}

export async function updateBuurt(
  id: string,
  data: Partial<Omit<Buurt, "id">>
): Promise<void> {
  await updateDoc(doc(getDb(), BUURTEN, id), data);
}

export async function deleteBuurt(id: string): Promise<void> {
  // Klanten met deze buurt houden gewoon hun (tekst)waarde in `klant.wijk`;
  // de dropdowns tonen die waarde backwards-compatible als extra optie.
  await deleteDoc(doc(getDb(), BUURTEN, id));
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

/**
 * Idempotente seed: schrijft de startlijst alleen als de collectie leeg is.
 * Wordt aangeroepen bij het openen van /beheer/buurten; daarna nooit meer actief.
 */
export async function seedBuurtenAlsLeeg(): Promise<void> {
  const db = getDb();
  const snap = await getDocs(collection(db, BUURTEN));
  if (!snap.empty) return;
  const batch = writeBatch(db);
  START_BUURTEN.forEach((naam, i) => {
    batch.set(doc(collection(db, BUURTEN)), {
      naam,
      actief: true,
      volgorde: (i + 1) * 10,
    });
  });
  await batch.commit();
}
