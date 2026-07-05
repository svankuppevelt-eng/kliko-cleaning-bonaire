// Repository-helpers voor Firestore-collectie `reinigingen` (uitgevoerde of
// overgeslagen schoonmaakbeurten) + foto-upload naar Firebase Storage.
// Alleen aanroepen vanuit client components (Web SDK, geen Admin SDK).
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getDb, getFirebaseStorage } from "@/lib/firebase";
import type { Container, Reiniging } from "./types";

const REINIGINGEN = "reinigingen";
const ABONNEMENTEN = "abonnementen";
const CONTAINERS = "containers";

/** Gedeelde invoer voor gedaan/overgeslagen (klantdata gedenormaliseerd). */
export interface ReinigingInput {
  klantId: string;
  abonnementId: string;
  klantNaam: string;
  adres: string;
  wijk: string;
  /** ISO-datum yyyy-mm-dd van de beurt (meestal vandaag). */
  datum: string;
  uitgevoerdDoorUid: string;
  uitgevoerdDoorNaam: string;
}

/**
 * Beurt afvinken als gedaan: schrijft een reiniging-doc en werkt daarna
 * `abonnement.laatsteReiniging` bij zodat de stop niet opnieuw "due" wordt.
 * `fotoUrl` is optioneel (Storage kan nog niet actief zijn); gebruik dan `notitie`.
 */
export async function markeerGedaan(
  input: ReinigingInput & { fotoUrl?: string; notitie?: string }
): Promise<string> {
  const { fotoUrl, notitie, ...basis } = input;
  // Firestore accepteert geen `undefined`, dus optionele velden alleen meesturen als ze er zijn.
  const data: Omit<Reiniging, "id"> = {
    ...basis,
    status: "gedaan",
    uitgevoerdOp: new Date().toISOString(),
    ...(fotoUrl ? { fotoUrl } : {}),
    ...(notitie ? { notitie } : {}),
  };
  const reinigingRef = await addDoc(collection(getDb(), REINIGINGEN), data);
  await updateDoc(doc(getDb(), ABONNEMENTEN, input.abonnementId), {
    laatsteReiniging: input.datum,
  });
  return reinigingRef.id;
}

/** Invoer voor een container-niveau registratie (QR-scan op de bak). */
export interface ContainerGedaanInput {
  container: Container;
  /**
   * Klantgegevens voor de gedenormaliseerde velden. Null als het klant-doc
   * niet (meer) bestaat; dan vallen we terug op wat op de container staat.
   */
  klant: { naam: string; adres: string; wijk: string } | null;
  /** ISO-datum yyyy-mm-dd van de beurt (meestal vandaag). */
  datum: string;
  fotoUrl?: string;
  notitie?: string;
  uitgevoerdDoorUid: string;
  uitgevoerdDoorNaam: string;
}

/**
 * Container-niveau beurt registreren (na QR-scan): schrijft een reiniging-doc
 * MET containerId + klikonummer en werkt `container.laatsteReiniging` bij.
 * Het abonnement-niveau (`abonnement.laatsteReiniging`) blijft bewust
 * ongemoeid: per container is de nieuwe waarheid, de stop-flow blijft de
 * bestaande terugval. `abonnementId` is hier leeg (zie types.ts).
 */
export async function markeerContainerGedaan(
  input: ContainerGedaanInput
): Promise<string> {
  const { container, klant, datum, fotoUrl, notitie, ...uitvoerder } = input;
  const data: Omit<Reiniging, "id"> = {
    klantId: container.klantId,
    abonnementId: "",
    klantNaam: klant?.naam ?? container.klantNaam,
    adres: klant?.adres ?? "",
    wijk: klant?.wijk ?? "",
    datum,
    status: "gedaan",
    containerId: container.id,
    klikonummer: container.klikonummer,
    uitgevoerdOp: new Date().toISOString(),
    ...uitvoerder,
    ...(fotoUrl ? { fotoUrl } : {}),
    ...(notitie ? { notitie } : {}),
  };
  const reinigingRef = await addDoc(collection(getDb(), REINIGINGEN), data);
  await updateDoc(doc(getDb(), CONTAINERS, container.id), {
    laatsteReiniging: datum,
  });
  return reinigingRef.id;
}

/**
 * Bewijsfoto achteraf aan een bestaande reiniging hangen (scan-flow:
 * eerst registreren, dan optioneel een foto erbij).
 */
export async function voegFotoToeAanReiniging(
  reinigingId: string,
  fotoUrl: string
): Promise<void> {
  await updateDoc(doc(getDb(), REINIGINGEN, reinigingId), { fotoUrl });
}

/**
 * Beurt markeren als overgeslagen (kliko niet buiten, toegang geblokkeerd, ...).
 * Werkt `laatsteReiniging` bewust NIET bij: de beurt is niet uitgevoerd.
 */
export async function markeerOvergeslagen(
  input: ReinigingInput & { redenOverslaan: string }
): Promise<string> {
  const data: Omit<Reiniging, "id"> = {
    ...input,
    status: "overgeslagen",
    uitgevoerdOp: new Date().toISOString(),
  };
  const reinigingRef = await addDoc(collection(getDb(), REINIGINGEN), data);
  return reinigingRef.id;
}

/** Alle reinigingen op 1 datum (voor de dag-lijst van de schoonmaker). */
export async function listReinigingenOpDatum(datum: string): Promise<Reiniging[]> {
  const snap = await getDocs(
    query(collection(getDb(), REINIGINGEN), where("datum", "==", datum))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Reiniging);
}

/** Reiniging-historie van 1 klant (voor de klantkaart, nieuwste eerst). */
export async function listReinigingenVoorKlant(klantId: string): Promise<Reiniging[]> {
  const snap = await getDocs(
    query(collection(getDb(), REINIGINGEN), where("klantId", "==", klantId))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Reiniging)
    .sort((a, b) => b.datum.localeCompare(a.datum));
}

/**
 * Bewijsfoto uploaden naar Firebase Storage.
 * Pad: reinigingen/<datum>/<abonnementId>-<timestamp>.jpg
 * Geeft de download-URL terug voor in het reiniging-doc.
 */
export async function uploadReinigingFoto(
  datum: string,
  abonnementId: string,
  file: File
): Promise<string> {
  const pad = `reinigingen/${datum}/${abonnementId}-${Date.now()}.jpg`;
  const fotoRef = ref(getFirebaseStorage(), pad);
  await uploadBytes(fotoRef, file, { contentType: file.type || "image/jpeg" });
  return getDownloadURL(fotoRef);
}
