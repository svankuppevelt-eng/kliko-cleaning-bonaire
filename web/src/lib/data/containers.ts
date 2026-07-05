// Repository-helpers voor Firestore-collectie `containers` (fysieke kliko's
// met een uniek klikonummer + QR-label) + teller-doc `tellers/containers`.
// Alleen aanroepen vanuit client components (Web SDK, geen Admin SDK).
//
// Nummering: sequentieel over alle klanten heen via `tellers/containers` in een
// runTransaction, format "KLB-00001". Doorlopend (niet per jaar): het nummer
// staat fysiek op de bak geplakt en moet uniek blijven zolang de bak bestaat.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { Container, Klant } from "./types";

const CONTAINERS = "containers";
const TELLER_DOC = ["tellers", "containers"] as const;

/** "KLB-00001" voor teller-stand 1. */
export function formatKlikonummer(stand: number): string {
  return `KLB-${String(stand).padStart(5, "0")}`;
}

/**
 * App-pad dat in de QR-code op het label staat (de QR-component plakt er de
 * origin voor). Als volledige URL werkt de code ook in een gewone camera-app.
 */
export function containerScanPad(containerId: string): string {
  return `/kliko/${containerId}`;
}

/**
 * Container-id uit een gescande QR-tekst halen. Accepteert zowel de volledige
 * label-URL (".../kliko/<id>") als een kale id (handmatig ingevoerd of een
 * oudere QR zonder URL). Onbruikbare invoer geeft null.
 */
export function parseContainerScan(tekst: string): string | null {
  const schoon = tekst.trim();
  if (!schoon) return null;
  const match = schoon.match(/\/kliko\/([A-Za-z0-9_-]+)/);
  if (match) return match[1];
  // Kale Firestore-id: geen slashes/spaties, redelijke lengte.
  if (/^[A-Za-z0-9_-]{6,64}$/.test(schoon)) return schoon;
  return null;
}

/** Alle containers van 1 klant, op volgnummer (kliko 1, 2, 3, ...). */
export async function listContainersVoorKlant(
  klantId: string
): Promise<Container[]> {
  const snap = await getDocs(
    query(collection(getDb(), CONTAINERS), where("klantId", "==", klantId))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Container)
    .sort((a, b) => a.volgnummer - b.volgnummer);
}

export async function getContainer(id: string): Promise<Container | null> {
  const snap = await getDoc(doc(getDb(), CONTAINERS, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Container) : null;
}

/**
 * Maak containers aan voor een klant tot er `aantal` ACTIEVE containers zijn.
 * Idempotent: heeft de klant al genoeg actieve containers, dan gebeurt er
 * niets; anders worden alleen de ontbrekende aangemaakt. Nummering + aanmaak
 * zitten in 1 transactie, zodat een uitgegeven klikonummer altijd bij precies
 * 1 document hoort (ook bij dubbel klikken vanaf 2 apparaten).
 *
 * Geeft de volledige (bijgewerkte) lijst containers van de klant terug.
 */
export async function genereerContainersVoorKlant(
  klant: Klant,
  aantal: number
): Promise<Container[]> {
  const db = getDb();
  const bestaand = await listContainersVoorKlant(klant.id);
  const actieve = bestaand.filter((c) => c.actief);
  const ontbrekend = Math.max(0, aantal - actieve.length);
  if (ontbrekend === 0) return bestaand;

  // Volgnummers lopen door over inactieve containers heen: een vervallen
  // "kliko 2" komt niet terug, de nieuwe bak wordt "kliko 3".
  const hoogsteVolgnummer = bestaand.reduce(
    (max, c) => Math.max(max, c.volgnummer),
    0
  );

  const nieuwe = await runTransaction(db, async (tx) => {
    const tellerRef = doc(db, ...TELLER_DOC);
    const tellerSnap = await tx.get(tellerRef);
    const vorige = (tellerSnap.data()?.stand as number | undefined) ?? 0;

    const aangemaakt: Container[] = [];
    for (let i = 0; i < ontbrekend; i++) {
      const stand = vorige + 1 + i;
      const ref = doc(collection(db, CONTAINERS));
      const data: Omit<Container, "id"> = {
        klikonummer: formatKlikonummer(stand),
        klantId: klant.id,
        klantNaam: klant.naam,
        volgnummer: hoogsteVolgnummer + 1 + i,
        actief: true,
        aangemaaktOp: new Date().toISOString(),
      };
      tx.set(ref, data);
      aangemaakt.push({ id: ref.id, ...data });
    }
    tx.set(tellerRef, { stand: vorige + ontbrekend }, { merge: true });
    return aangemaakt;
  });

  return [...bestaand, ...nieuwe].sort((a, b) => a.volgnummer - b.volgnummer);
}

/**
 * Label vervallen verklaren (bak weg, vervangen, verkeerd aangemaakt).
 * Het doc blijft bestaan zodat oude reinigingen-historie leesbaar blijft;
 * scannen van een inactief label toont een nette melding.
 */
export async function deactiveerContainer(id: string): Promise<void> {
  await updateDoc(doc(getDb(), CONTAINERS, id), { actief: false });
}
