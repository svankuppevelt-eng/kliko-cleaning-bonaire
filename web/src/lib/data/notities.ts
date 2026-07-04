// Repository-helpers voor de Firestore-collectie `notities`.
// Losse werk-aantekeningen van office, per categorie. Alleen aanroepen vanuit
// client components. Overgezet uit de Streamlit-app (services/notes_store.py).
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";

export const NOTITIE_CATEGORIEEN = [
  "Algemeen",
  "Investeringen",
  "Prijsstelling",
  "Marketing",
  "Klanten",
  "Operationeel",
  "Vragen",
] as const;

export type NotitieCategorie = (typeof NOTITIE_CATEGORIEEN)[number];

export interface Notitie {
  id: string;
  titel: string;
  inhoud: string;
  categorie: NotitieCategorie;
  /** ISO-timestamp (yyyy-mm-ddThh:mm) van de laatste bewerking. */
  bewerktOp: string;
}

const NOTITIES = "notities";

export async function listNotities(): Promise<Notitie[]> {
  const snap = await getDocs(
    query(collection(getDb(), NOTITIES), orderBy("bewerktOp", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Notitie);
}

export async function createNotitie(
  data: Omit<Notitie, "id">
): Promise<string> {
  const ref = await addDoc(collection(getDb(), NOTITIES), data);
  return ref.id;
}

export async function updateNotitie(
  id: string,
  data: Partial<Omit<Notitie, "id">>
): Promise<void> {
  await updateDoc(doc(getDb(), NOTITIES, id), data);
}

export async function deleteNotitie(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), NOTITIES, id));
}
