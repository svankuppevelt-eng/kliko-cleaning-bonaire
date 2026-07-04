// Repository-helpers voor Firestore-collectie `kosten`: office-beheerbare
// maandkosten (water, materiaal, personeel, brandstof, overig) die het
// finance-dashboard voeden. Alleen aanroepen vanuit client components (Web SDK).
//
// Bedragen in HELE DOLLARCENTEN (integer), zie facturen-types.ts.
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { Cent } from "./facturen-types";

export type KostenCategorie =
  | "water"
  | "materiaal"
  | "personeel"
  | "brandstof"
  | "overig";

export const KOSTEN_CATEGORIEEN: KostenCategorie[] = [
  "water",
  "materiaal",
  "personeel",
  "brandstof",
  "overig",
];

/** Firestore-doc in collectie `kosten`. */
export interface KostenPost {
  id: string;
  /** Kostenmaand, "yyyy-mm". */
  maand: string;
  categorie: KostenCategorie;
  omschrijving: string;
  /** Bedrag in hele dollarcenten (integer). */
  bedragCent: Cent;
  /** ISO-timestamp van aanmaak. */
  aangemaaktOp: string;
}

const KOSTEN = "kosten";

/** Alle kostenposten, nieuwste maand eerst. */
export async function listKosten(): Promise<KostenPost[]> {
  const snap = await getDocs(
    query(collection(getDb(), KOSTEN), orderBy("maand", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as KostenPost);
}

/** Kostenposten voor 1 maand ("yyyy-mm"). */
export async function listKostenVoorMaand(
  maand: string
): Promise<KostenPost[]> {
  const snap = await getDocs(
    query(collection(getDb(), KOSTEN), where("maand", "==", maand))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as KostenPost);
}

export async function createKosten(
  data: Omit<KostenPost, "id">
): Promise<string> {
  const ref = await addDoc(collection(getDb(), KOSTEN), data);
  return ref.id;
}

export async function updateKosten(
  id: string,
  data: Partial<Omit<KostenPost, "id" | "aangemaaktOp">>
): Promise<void> {
  await updateDoc(doc(getDb(), KOSTEN, id), data);
}

export async function deleteKosten(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), KOSTEN, id));
}
