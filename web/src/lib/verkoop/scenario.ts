// Rentabiliteits-calculator: scenario-invoer -> break-even, winst, terugverdientijd.
// Pure rekenlogica + Firestore-CRUD (collectie `scenarios`). Overgezet uit de
// Streamlit-app (models.py + services/calculator.py). Alle bedragen in USD,
// gebaseerd op 1 cleaner met een vast maandsalaris.
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
import type { Frequentie, KlantType } from "@/lib/data/types";

/** Prijs (USD/mnd) en aantal klanten per klanttype x frequentie. */
export type PerAbonnement<T> = Record<KlantType, Record<Frequentie, T>>;

export interface Scenario {
  id: string;
  naam: string;
  omschrijving: string;

  /** Eenmalige investering (totaal, USD). */
  investeringTotaal: number;

  /** Variabele kosten per reiniging. */
  waterPerReiniging: number;
  overigPerReiniging: number;

  /** Vaste maandkosten (excl. personeel) en het personeelssalaris per maand. */
  vasteKostenPerMaand: number;
  personeelPerMaand: number;

  /** Capaciteit. */
  containersPerDag: number;
  werkdagenPerMaand: number;

  /** Prijzen en klantaantallen per abonnementsvorm. */
  prijzen: PerAbonnement<number>;
  klanten: PerAbonnement<number>;
}

const FREQS: Frequentie[] = [1, 2, 4];
const TYPES: KlantType[] = ["huishouden", "bedrijf"];

/** Nieuw leeg scenario met de Streamlit-startwaarden. */
export function nieuwScenario(naam: string): Omit<Scenario, "id"> {
  return {
    naam,
    omschrijving: "",
    investeringTotaal: 0,
    waterPerReiniging: 0.3,
    overigPerReiniging: 0.5,
    vasteKostenPerMaand: 0,
    personeelPerMaand: 2500,
    containersPerDag: 60,
    werkdagenPerMaand: 20,
    prijzen: {
      huishouden: { 1: 10, 2: 18, 4: 22 },
      bedrijf: { 1: 18, 2: 30, 4: 36 },
    },
    klanten: {
      huishouden: { 1: 0, 2: 0, 4: 0 },
      bedrijf: { 1: 0, 2: 0, 4: 0 },
    },
  };
}

export interface Resultaat {
  investering: number;
  totaalOmzet: number;
  reinigingen: number;
  totaalKlanten: number;
  capaciteitPerMaand: number;
  /** 0.0 - 1.0 (of hoger bij overboeking). */
  capaciteitBenut: number;
  variabeleKosten: number;
  personeelKosten: number;
  overigeVasteKosten: number;
  vasteKosten: number;
  totaalKosten: number;
  nettoWinst: number;
  kostenPerReiniging: number;
  gemOpbrengstPerReiniging: number;
  /** null als er (nog) geen winst is. */
  terugverdienMaanden: number | null;
  terugverdienJaren: number | null;
  /** Minimaal aantal klanten (goedkoopste abo) om de vaste kosten te dekken. */
  breakEvenKlanten: number | null;
}

export function bereken(s: Scenario): Resultaat {
  const investering = s.investeringTotaal;
  const capaciteit = s.containersPerDag * s.werkdagenPerMaand;

  let reinigingen = 0;
  let totaalKlanten = 0;
  let totaalOmzet = 0;
  for (const type of TYPES) {
    for (const f of FREQS) {
      const aantal = s.klanten[type][f];
      reinigingen += aantal * f;
      totaalKlanten += aantal;
      totaalOmzet += aantal * s.prijzen[type][f];
    }
  }

  const kostenPerJob = s.waterPerReiniging + s.overigPerReiniging;
  const variabeleKosten = reinigingen * kostenPerJob;
  const overigeVasteKosten = s.vasteKostenPerMaand;
  const personeelKosten = s.personeelPerMaand;
  const vasteKosten = personeelKosten + overigeVasteKosten;
  const totaalKosten = variabeleKosten + vasteKosten;
  const nettoWinst = totaalOmzet - totaalKosten;

  const capaciteitBenut = capaciteit > 0 ? reinigingen / capaciteit : 0;
  const gemOpbrengst = reinigingen > 0 ? totaalOmzet / reinigingen : 0;

  let terugverdienMaanden: number | null = null;
  let terugverdienJaren: number | null = null;
  if (nettoWinst > 0) {
    terugverdienMaanden = investering / nettoWinst;
    terugverdienJaren = terugverdienMaanden / 12;
  }

  // Break-even: goedkoopste abo is huishouden 1x/mnd.
  const margeGoedkoopste = s.prijzen.huishouden[1] - kostenPerJob;
  const breakEvenKlanten =
    margeGoedkoopste > 0 ? Math.ceil(vasteKosten / margeGoedkoopste) : null;

  return {
    investering,
    totaalOmzet,
    reinigingen,
    totaalKlanten,
    capaciteitPerMaand: capaciteit,
    capaciteitBenut,
    variabeleKosten,
    personeelKosten,
    overigeVasteKosten,
    vasteKosten,
    totaalKosten,
    nettoWinst,
    kostenPerReiniging: kostenPerJob,
    gemOpbrengstPerReiniging: gemOpbrengst,
    terugverdienMaanden,
    terugverdienJaren,
    breakEvenKlanten,
  };
}

/** Cumulatief saldo per maand (start = -investering), voor een grafiek. */
export function cumulatief(s: Scenario, maanden = 48): number[] {
  const r = bereken(s);
  const punten: number[] = [];
  let saldo = -r.investering;
  for (let m = 1; m <= maanden; m++) {
    saldo += r.nettoWinst;
    punten.push(Math.round(saldo * 100) / 100);
  }
  return punten;
}

// ── Firestore ────────────────────────────────────────────────────────────────

const SCENARIOS = "scenarios";

export async function listScenarios(): Promise<Scenario[]> {
  const snap = await getDocs(
    query(collection(getDb(), SCENARIOS), orderBy("naam"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Scenario);
}

export async function createScenario(
  data: Omit<Scenario, "id">
): Promise<string> {
  const ref = await addDoc(collection(getDb(), SCENARIOS), data);
  return ref.id;
}

export async function updateScenario(
  id: string,
  data: Partial<Omit<Scenario, "id">>
): Promise<void> {
  await updateDoc(doc(getDb(), SCENARIOS, id), data);
}

export async function deleteScenario(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), SCENARIOS, id));
}
