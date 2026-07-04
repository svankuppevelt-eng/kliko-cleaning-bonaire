// Repository-helpers voor Firestore-collecties `klanten` en `abonnementen`.
// Alleen aanroepen vanuit client components (Web SDK, geen Admin SDK).
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { Abonnement, Klant } from "./types";

const KLANTEN = "klanten";
const ABONNEMENTEN = "abonnementen";

export async function createKlant(data: Omit<Klant, "id">): Promise<string> {
  const ref = await addDoc(collection(getDb(), KLANTEN), data);
  return ref.id;
}

export async function listKlanten(): Promise<Klant[]> {
  const snap = await getDocs(
    query(collection(getDb(), KLANTEN), orderBy("aangemaaktOp", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Klant);
}

export async function getKlant(id: string): Promise<Klant | null> {
  const snap = await getDoc(doc(getDb(), KLANTEN, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Klant) : null;
}

export async function createAbonnement(
  data: Omit<Abonnement, "id">
): Promise<string> {
  const ref = await addDoc(collection(getDb(), ABONNEMENTEN), data);
  return ref.id;
}

export async function listAbonnementenVoorKlant(
  klantId: string
): Promise<Abonnement[]> {
  const snap = await getDocs(
    query(collection(getDb(), ABONNEMENTEN), where("klantId", "==", klantId))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Abonnement);
}

/** Alle abonnementen in 1 keer (voor de beheer-lijst), gegroepeerd per klantId. */
export async function listAbonnementenPerKlant(): Promise<
  Map<string, Abonnement[]>
> {
  const snap = await getDocs(collection(getDb(), ABONNEMENTEN));
  const map = new Map<string, Abonnement[]>();
  for (const d of snap.docs) {
    const ab = { id: d.id, ...d.data() } as Abonnement;
    const arr = map.get(ab.klantId) ?? [];
    arr.push(ab);
    map.set(ab.klantId, arr);
  }
  return map;
}
