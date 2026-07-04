// Office-instelbare instellingen in Firestore-doc `instellingen/algemeen`:
// de prijstabel (per type x frequentie) en de dagcapaciteit.
// Bestaat het doc (nog) niet of is Firestore onbereikbaar, dan vallen we
// terug op de constanten uit prijzen.ts / planning.ts (geen crash, geen lege prijzen).
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { PRIJS_PER_MAAND } from "./prijzen";
import { CONTAINERS_PER_DAG } from "./planning";
import type { Frequentie, KlantType } from "./types";

export interface Instellingen {
  /** Prijs per maand in USD, per klanttype x frequentie. */
  prijzen: Record<KlantType, Record<Frequentie, number>>;
  /** Maximaal aantal kliko's dat het team op 1 dag kan reinigen. */
  containersPerDag: number;
}

/** Fallback: de huidige constanten. Ook de startwaarde in het beheerscherm. */
export const DEFAULT_INSTELLINGEN: Instellingen = {
  prijzen: {
    huishouden: { ...PRIJS_PER_MAAND.huishouden },
    bedrijf: { ...PRIJS_PER_MAAND.bedrijf },
  },
  containersPerDag: CONTAINERS_PER_DAG,
};

const INSTELLINGEN_DOC = () => doc(getDb(), "instellingen", "algemeen");

function positiefGetal(waarde: unknown, fallback: number): number {
  const n = typeof waarde === "number" ? waarde : Number(waarde);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Lees de instellingen; ontbrekende of ongeldige velden worden per veld
 * aangevuld met de default, zodat een half doc nooit lege prijzen oplevert.
 */
export async function getInstellingen(): Promise<Instellingen> {
  try {
    const snap = await getDoc(INSTELLINGEN_DOC());
    if (!snap.exists()) return DEFAULT_INSTELLINGEN;
    const data = snap.data() as {
      prijzen?: Partial<Record<KlantType, Partial<Record<Frequentie, unknown>>>>;
      containersPerDag?: unknown;
    };
    const prijzen = {} as Record<KlantType, Record<Frequentie, number>>;
    for (const type of ["huishouden", "bedrijf"] as KlantType[]) {
      prijzen[type] = {} as Record<Frequentie, number>;
      for (const f of [1, 2, 4] as Frequentie[]) {
        prijzen[type][f] = positiefGetal(
          data.prijzen?.[type]?.[f],
          DEFAULT_INSTELLINGEN.prijzen[type][f]
        );
      }
    }
    return {
      prijzen,
      containersPerDag: positiefGetal(
        data.containersPerDag,
        DEFAULT_INSTELLINGEN.containersPerDag
      ),
    };
  } catch {
    // Firestore onbereikbaar of rules blokkeren lezen: gewoon de defaults.
    return DEFAULT_INSTELLINGEN;
  }
}

/** Schrijf de volledige instellingen weg (setDoc, dus ook eerste keer). */
export async function saveInstellingen(inst: Instellingen): Promise<void> {
  await setDoc(INSTELLINGEN_DOC(), {
    prijzen: {
      huishouden: { ...inst.prijzen.huishouden },
      bedrijf: { ...inst.prijzen.bedrijf },
    },
    containersPerDag: inst.containersPerDag,
  });
}
