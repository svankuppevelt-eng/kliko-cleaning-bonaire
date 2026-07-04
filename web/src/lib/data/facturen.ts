// Repository-helpers voor Firestore-collectie `facturen` + teller-doc
// `tellers/facturen`. Alleen aanroepen vanuit client components (Web SDK).
//
// Nummering: sequentieel per jaar via `tellers/facturen` in een runTransaction,
// format "KLIKO-<jaar>-<0001>". Idempotentie maandgeneratie: doc-id is
// deterministisch `${periode}_${klantId}`, dus dezelfde klant kan nooit twee
// facturen voor dezelfde maand krijgen, ook niet bij dubbel klikken.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  updateDoc,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { Abonnement, Klant } from "./types";
import { listAbonnementenPerKlant, listKlanten } from "./klanten";
import {
  ABB_PCT,
  BETAALTERMIJN_DAGEN,
  berekenAbb,
  KLIKO_ISSUER,
  type Factuur,
  type FactuurRegel,
} from "./facturen-types";

const FACTUREN = "facturen";
const TELLER_DOC = ["tellers", "facturen"] as const;

// De regel-omschrijving op de factuur is bewust Nederlands: de factuur is een
// zakelijk document met 1 vaste taal (net als het PDF-sjabloon).
const NL_MAANDEN = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
];

/** "2026-07" -> "juli 2026". Ongeldig formaat komt letterlijk terug. */
export function maandLabel(periode: string): string {
  const m = periode.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!m) return periode;
  return `${NL_MAANDEN[Number(m[2]) - 1]} ${m[1]}`;
}

function isoDatum(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function vervaldatumVanaf(uitgifte: Date): string {
  const d = new Date(uitgifte);
  d.setDate(d.getDate() + BETAALTERMIJN_DAGEN);
  return isoDatum(d);
}

export async function listFacturen(): Promise<Factuur[]> {
  const snap = await getDocs(
    query(collection(getDb(), FACTUREN), orderBy("nummer", "desc"))
  );
  return snap.docs.map((d) => ({ ...(d.data() as Omit<Factuur, "id">), id: d.id }));
}

export async function getFactuur(id: string): Promise<Factuur | null> {
  const snap = await getDoc(doc(getDb(), FACTUREN, id));
  return snap.exists()
    ? { ...(snap.data() as Omit<Factuur, "id">), id: snap.id }
    : null;
}

/** Markeer als verstuurd (vanaf concept). */
export async function markeerVerstuurd(id: string): Promise<void> {
  await updateDoc(doc(getDb(), FACTUREN, id), { status: "verstuurd" });
}

/** Markeer als betaald, met betaaldatum (default vandaag). */
export async function markeerBetaald(
  id: string,
  betaaldOp: string = isoDatum(new Date())
): Promise<void> {
  await updateDoc(doc(getDb(), FACTUREN, id), { status: "betaald", betaaldOp });
}

export interface GenereerResultaat {
  aangemaakt: number;
  overgeslagen: number;
}

/**
 * Maak per ACTIEF abonnement een concept-factuur voor `periode` ("yyyy-mm").
 * 1 regel per factuur: "Kliko-reiniging <maand>, <frequentie>x per maand",
 * bedrag = abonnementsprijs (excl ABB) + 8% ABB erbovenop.
 *
 * Idempotent: bestaat `facturen/${periode}_${klantId}` al, dan wordt die
 * klant overgeslagen (telt mee in `overgeslagen`). Nummering en aanmaak
 * zitten samen in 1 transactie per factuur, zodat een uitgegeven nummer
 * altijd bij precies 1 document hoort.
 */
export async function genereerMaandFacturen(
  periode: string
): Promise<GenereerResultaat> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periode)) {
    throw new Error(`genereerMaandFacturen: ongeldige periode "${periode}"`);
  }
  const db = getDb();
  const [klanten, abosPerKlant] = await Promise.all([
    listKlanten(),
    listAbonnementenPerKlant(),
  ]);
  const klantById = new Map(klanten.map((k) => [k.id, k]));

  const nu = new Date();
  let aangemaakt = 0;
  let overgeslagen = 0;

  for (const [klantId, abos] of abosPerKlant) {
    const actieve = abos.filter((a) => a.status === "actief");
    if (actieve.length === 0) continue;
    const klant = klantById.get(klantId);
    if (!klant) {
      // Abonnement zonder klant-doc (zou niet moeten voorkomen): overslaan.
      overgeslagen++;
      continue;
    }

    const factuurRef = doc(db, FACTUREN, `${periode}_${klantId}`);
    const isNieuw = await runTransaction(db, async (tx) => {
      const bestaand = await tx.get(factuurRef);
      if (bestaand.exists()) return false;

      const tellerRef = doc(db, ...TELLER_DOC);
      const tellerSnap = await tx.get(tellerRef);
      const jaar = String(nu.getFullYear());
      const vorige = (tellerSnap.data()?.[jaar] as number | undefined) ?? 0;
      const volgnummer = vorige + 1;
      const nummer = `KLIKO-${jaar}-${String(volgnummer).padStart(4, "0")}`;

      const factuur = bouwConceptFactuur({ nummer, klant, abos: actieve, periode, nu });
      tx.set(tellerRef, { [jaar]: volgnummer }, { merge: true });
      // Zonder id-veld: het doc-id is de id, net als bij de andere collecties.
      const { id: _id, ...data } = factuur;
      void _id;
      tx.set(factuurRef, data);
      return true;
    });

    if (isNieuw) aangemaakt++;
    else overgeslagen++;
  }

  return { aangemaakt, overgeslagen };
}

function bouwConceptFactuur(input: {
  nummer: string;
  klant: Klant;
  abos: Abonnement[];
  periode: string;
  nu: Date;
}): Factuur {
  const { nummer, klant, abos, periode, nu } = input;
  // 1 regel per actief abonnement (vrijwel altijd precies 1 per klant).
  const regels: FactuurRegel[] = abos.map((abo) => {
    // prijsPerMaand staat in hele dollars in `abonnementen` -> naar centen.
    const bedragCentExcl = Math.round(abo.prijsPerMaand * 100);
    return {
      omschrijving: `Kliko-reiniging ${maandLabel(periode)}, ${abo.frequentie}x per maand`,
      aantal: 1,
      bedragCentExcl,
      totaalCentExcl: bedragCentExcl,
    };
  });
  const subtotaalCentExcl = regels.reduce((som, r) => som + r.totaalCentExcl, 0);
  const { abbCent, totaalCentIncl } = berekenAbb(subtotaalCentExcl, ABB_PCT);

  return {
    id: `${periode}_${klant.id}`,
    nummer,
    klantId: klant.id,
    klantNaam: klant.naam,
    adres: klant.adres,
    buurt: klant.wijk,
    periode,
    regels,
    subtotaalCentExcl,
    abbPct: ABB_PCT,
    abbCent,
    totaalCentIncl,
    valuta: "USD",
    status: "concept",
    uitgiftedatum: isoDatum(nu),
    vervaldatum: vervaldatumVanaf(nu),
    aangemaaktOp: nu.toISOString(),
    issuer: { ...KLIKO_ISSUER },
  };
}
