// Office-instelbare instellingen in Firestore-doc `instellingen/algemeen`:
// alle prijsafspraken op 1 plek (maand- en jaarprijs per tier, de
// container-korting, de offerte-cadeaus) plus de dagcapaciteit.
// Bestaat het doc (nog) niet of is Firestore onbereikbaar, dan vallen we
// terug op de constanten uit prijzen.ts / planning.ts (geen crash, geen lege
// prijzen). Migratie-veilig: een oud doc met alleen maandprijzen (nummers in
// plaats van { maand, jaar }) blijft werken; de ontbrekende jaarprijs valt
// dan terug op de standaard.
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import {
  STANDAARD_PRIJZEN,
  type ContainerKortingRegel,
  type TierPrijs,
} from "./prijzen";
import { CONTAINERS_PER_DAG } from "./planning";
import type { Frequentie, KlantType } from "./types";

export interface Instellingen {
  /** Prijs per klanttype x frequentie: maandprijs + jaarprijs (USD). */
  prijzen: Record<KlantType, Record<Frequentie, TierPrijs>>;
  /**
   * Korting bij meerdere containers: drempels met een percentage.
   * Leeg = geen korting. Het hoogste toepasselijke percentage geldt.
   */
  containerKorting: ContainerKortingRegel[];
  /** Welkomstcadeau voor iedereen bij eerste afsluiting (offerte-tool). */
  cadeauWelkom: string;
  /** Cadeau-tekst bij een jaarcontract (offerte-tool). */
  cadeauJaarcontract: string;
  /** Maximaal aantal kliko's dat het team op 1 dag kan reinigen. */
  containersPerDag: number;
}

/** Fallback: de constanten. Ook de startwaarde in het beheerscherm. */
export const DEFAULT_INSTELLINGEN: Instellingen = {
  prijzen: {
    huishouden: {
      1: { ...STANDAARD_PRIJZEN.huishouden[1] },
      2: { ...STANDAARD_PRIJZEN.huishouden[2] },
      4: { ...STANDAARD_PRIJZEN.huishouden[4] },
    },
    bedrijf: {
      1: { ...STANDAARD_PRIJZEN.bedrijf[1] },
      2: { ...STANDAARD_PRIJZEN.bedrijf[2] },
      4: { ...STANDAARD_PRIJZEN.bedrijf[4] },
    },
  },
  containerKorting: [],
  cadeauWelkom: "Eerste reiniging gratis",
  cadeauJaarcontract: "Welkomstpakket + 1 gratis extra reiniging bij aanvang",
  containersPerDag: CONTAINERS_PER_DAG,
};

const INSTELLINGEN_DOC = () => doc(getDb(), "instellingen", "algemeen");

function positiefGetal(waarde: unknown, fallback: number): number {
  const n = typeof waarde === "number" ? waarde : Number(waarde);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function tekst(waarde: unknown, fallback: string): string {
  return typeof waarde === "string" && waarde.trim() ? waarde : fallback;
}

/**
 * Parse 1 tier uit het doc. Oud formaat: een los getal (alleen de maandprijs);
 * nieuw formaat: { maand, jaar }. Ontbrekende velden vallen per veld terug
 * op de standaard, zodat een oud of half doc nooit crasht.
 */
function parseTier(waarde: unknown, fallback: TierPrijs): TierPrijs {
  if (typeof waarde === "number") {
    // Oud doc: alleen een maandprijs opgeslagen.
    return { maand: positiefGetal(waarde, fallback.maand), jaar: fallback.jaar };
  }
  const obj = (waarde ?? {}) as { maand?: unknown; jaar?: unknown };
  return {
    maand: positiefGetal(obj.maand, fallback.maand),
    jaar: positiefGetal(obj.jaar, fallback.jaar),
  };
}

/** Parse de kortingslijst; ongeldige rijen vervallen, gesorteerd op drempel. */
function parseContainerKorting(waarde: unknown): ContainerKortingRegel[] {
  if (!Array.isArray(waarde)) return [];
  const regels: ContainerKortingRegel[] = [];
  for (const rij of waarde) {
    const obj = (rij ?? {}) as { vanafAantal?: unknown; kortingPct?: unknown };
    const vanafAantal = Number(obj.vanafAantal);
    const kortingPct = Number(obj.kortingPct);
    if (
      Number.isInteger(vanafAantal) &&
      vanafAantal >= 2 &&
      Number.isFinite(kortingPct) &&
      kortingPct > 0 &&
      kortingPct <= 100
    ) {
      regels.push({ vanafAantal, kortingPct });
    }
  }
  return regels.sort((a, b) => a.vanafAantal - b.vanafAantal);
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
      containerKorting?: unknown;
      cadeauWelkom?: unknown;
      cadeauJaarcontract?: unknown;
      containersPerDag?: unknown;
    };
    const prijzen = {} as Record<KlantType, Record<Frequentie, TierPrijs>>;
    for (const type of ["huishouden", "bedrijf"] as KlantType[]) {
      prijzen[type] = {} as Record<Frequentie, TierPrijs>;
      for (const f of [1, 2, 4] as Frequentie[]) {
        prijzen[type][f] = parseTier(
          data.prijzen?.[type]?.[f],
          DEFAULT_INSTELLINGEN.prijzen[type][f]
        );
      }
    }
    return {
      prijzen,
      containerKorting: parseContainerKorting(data.containerKorting),
      cadeauWelkom: tekst(data.cadeauWelkom, DEFAULT_INSTELLINGEN.cadeauWelkom),
      cadeauJaarcontract: tekst(
        data.cadeauJaarcontract,
        DEFAULT_INSTELLINGEN.cadeauJaarcontract
      ),
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
      huishouden: {
        1: { ...inst.prijzen.huishouden[1] },
        2: { ...inst.prijzen.huishouden[2] },
        4: { ...inst.prijzen.huishouden[4] },
      },
      bedrijf: {
        1: { ...inst.prijzen.bedrijf[1] },
        2: { ...inst.prijzen.bedrijf[2] },
        4: { ...inst.prijzen.bedrijf[4] },
      },
    },
    containerKorting: inst.containerKorting.map((r) => ({ ...r })),
    cadeauWelkom: inst.cadeauWelkom,
    cadeauJaarcontract: inst.cadeauJaarcontract,
    containersPerDag: inst.containersPerDag,
  });
}
