// Office-instelbaar prijsbeleid in Firestore-doc `instellingen/prijsbeleid`:
// multi-container kortingen, jaarcontractkorting en de welkomstcadeaus.
// De offerte-tool leest dit doc; ontbreekt het (nog), dan gelden de defaults.
// Overgezet uit de Streamlit-app (services/prijsbeleid_store.py).
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";

export interface PrijsBeleid {
  /** Korting in % op de 2e, 3e en 4e (en verdere) container. */
  korting2eContainer: number;
  korting3eContainer: number;
  korting4eContainer: number;
  /** Korting in % bij een jaarcontract (12 maanden vooruit). */
  kortingJaarcontract: number;
  /** Cadeau-tekst bij een jaarcontract. */
  cadeauJaarcontract: string;
  /** Welkomstcadeau voor iedereen bij eerste afsluiting. */
  cadeauWelkom: string;
}

/** Fallback + startwaarden in het beheerscherm (gelijk aan de Streamlit-defaults). */
export const DEFAULT_PRIJSBELEID: PrijsBeleid = {
  korting2eContainer: 10,
  korting3eContainer: 15,
  korting4eContainer: 20,
  kortingJaarcontract: 10,
  cadeauJaarcontract: "Welkomstpakket + 1 gratis extra reiniging bij aanvang",
  cadeauWelkom: "Eerste reiniging gratis",
};

const PRIJSBELEID_DOC = () => doc(getDb(), "instellingen", "prijsbeleid");

function getal(waarde: unknown, fallback: number): number {
  const n = typeof waarde === "number" ? waarde : Number(waarde);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function tekst(waarde: unknown, fallback: string): string {
  return typeof waarde === "string" && waarde.trim() ? waarde : fallback;
}

/** Lees het prijsbeleid; ontbrekende velden worden per veld aangevuld met de default. */
export async function getPrijsBeleid(): Promise<PrijsBeleid> {
  try {
    const snap = await getDoc(PRIJSBELEID_DOC());
    if (!snap.exists()) return DEFAULT_PRIJSBELEID;
    const d = snap.data() as Partial<Record<keyof PrijsBeleid, unknown>>;
    return {
      korting2eContainer: getal(d.korting2eContainer, DEFAULT_PRIJSBELEID.korting2eContainer),
      korting3eContainer: getal(d.korting3eContainer, DEFAULT_PRIJSBELEID.korting3eContainer),
      korting4eContainer: getal(d.korting4eContainer, DEFAULT_PRIJSBELEID.korting4eContainer),
      kortingJaarcontract: getal(d.kortingJaarcontract, DEFAULT_PRIJSBELEID.kortingJaarcontract),
      cadeauJaarcontract: tekst(d.cadeauJaarcontract, DEFAULT_PRIJSBELEID.cadeauJaarcontract),
      cadeauWelkom: tekst(d.cadeauWelkom, DEFAULT_PRIJSBELEID.cadeauWelkom),
    };
  } catch {
    return DEFAULT_PRIJSBELEID;
  }
}

/** Schrijf het volledige prijsbeleid weg (setDoc, dus ook de eerste keer). */
export async function savePrijsBeleid(pb: PrijsBeleid): Promise<void> {
  await setDoc(PRIJSBELEID_DOC(), { ...pb });
}

/** Kortingspercentage voor de n-de container (1-based index). Eerste = 0%. */
export function kortingVoorContainer(pb: PrijsBeleid, index: number): number {
  if (index <= 0) return 0;
  if (index === 1) return pb.korting2eContainer;
  if (index === 2) return pb.korting3eContainer;
  return pb.korting4eContainer;
}
