// Factuur-types Kliko Cleaning Bonaire.
// Bewust een APART bestand naast types.ts om merge-conflicten met parallelle
// features te vermijden.
//
// Geld-regels (overgenomen uit het BP-factuursysteem):
//  - Alle bedragen in HELE DOLLARCENTEN (integer), nooit floats.
//  - Belasting = ABB (Algemene Bestedingsbelasting, Bonaire), standaard 8%
//    op diensten. De abonnementsprijs is EXCLUSIEF ABB: de factuur toont
//    subtotaal excl, telt daar 8% ABB bij op en komt zo op het totaal.
//    Dit is dus GEEN incl-naar-excl-splitsing zoals bij Nederlandse btw.

/** Bedrag in hele dollarcenten (integer). */
export type Cent = number;

/**
 * ABB-percentage op diensten (Bonaire). Config-constante voor nu;
 * wordt later office-instelbaar via het `instellingen`-doc (een parallelle
 * feature bouwt dat scherm; hier bewust NIET aan gekoppeld). Elke factuur
 * bewaart zijn eigen `abbPct`-snapshot, dus een latere wijziging raakt
 * bestaande facturen niet.
 */
export const ABB_PCT = 8;

/** Betaaltermijn in dagen: vervaldatum = uitgiftedatum + deze termijn. */
export const BETAALTERMIJN_DAGEN = 14;

export type FactuurStatus = "concept" | "verstuurd" | "betaald" | "teLaat";

/** Eén regel op de factuur. Bedragen per stuk en totaal, excl. ABB. */
export interface FactuurRegel {
  omschrijving: string;
  aantal: number;
  /** Per-stuk bedrag EXCL ABB in dollarcenten. */
  bedragCentExcl: Cent;
  /** Totaal voor de regel EXCL ABB = aantal * bedragCentExcl. */
  totaalCentExcl: Cent;
}

/**
 * Issuer-snapshot: de gegevens van Kliko Cleaning Bonaire op het moment van
 * uitgifte. Snapshot op de factuur zelf, zodat een later adres of ander
 * rekeningnummer bestaande facturen niet verandert.
 */
export interface FactuurIssuer {
  naam: string;
  /** Juridisch onderschrift, bv. "BV in oprichting". */
  legalSuffix?: string;
  adres: string;
  plaats: string;
  land: string;
  email: string;
  telefoon?: string;
  /** KvK-nummer (Kamer van Koophandel Bonaire). */
  kvk: string;
  /** CRIB-nummer (belastingnummer BES) - optioneel tot bekend. */
  crib?: string;
  /** Bankrekening (MCB / lokale bank). */
  bankrekening: string;
  bankNaam?: string;
}

/**
 * Default issuer. PLACEHOLDERS: KvK, adres en bankrekening invullen zodra de
 * BV rond is. Wordt later office-instelbaar via het `instellingen`-doc.
 */
export const KLIKO_ISSUER: FactuurIssuer = {
  naam: "Kliko Cleaning Bonaire",
  legalSuffix: "BV in oprichting",
  adres: "Kaya (adres volgt)",
  plaats: "Kralendijk, Bonaire",
  land: "Caribisch Nederland",
  email: "info@klikocleaningbonaire.com",
  telefoon: "",
  kvk: "KvK Bonaire (nummer volgt)",
  crib: "",
  bankrekening: "MCB (rekeningnummer volgt)",
  bankNaam: "MCB Bonaire",
};

/** Firestore-doc in collectie `facturen`. Doc-id = `${periode}_${klantId}`. */
export interface Factuur {
  id: string;
  /** Bv. "KLIKO-2026-0001", sequentieel per jaar via teller-doc. */
  nummer: string;
  klantId: string;
  klantNaam: string;
  adres: string;
  buurt: string;
  /** Factuurmaand, "yyyy-mm". */
  periode: string;
  regels: FactuurRegel[];
  subtotaalCentExcl: Cent;
  /** ABB-percentage van deze factuur (snapshot van ABB_PCT). */
  abbPct: number;
  abbCent: Cent;
  totaalCentIncl: Cent;
  valuta: "USD";
  status: FactuurStatus;
  /** ISO-datum "yyyy-mm-dd". */
  uitgiftedatum: string;
  /** ISO-datum "yyyy-mm-dd". */
  vervaldatum: string;
  /** ISO-datum "yyyy-mm-dd", alleen bij status "betaald". */
  betaaldOp?: string;
  /** ISO-timestamp van aanmaak. */
  aangemaaktOp: string;
  issuer: FactuurIssuer;
}

/**
 * Formatteer dollarcenten als bedrag, bv. 1850 -> "$18.00".
 * LET OP: dit is de cent-variant; `formatUsd` in prijzen.ts werkt met hele
 * dollars (abonnementsprijzen) en blijft daarvoor in gebruik.
 */
export function formatUsdCent(cent: Cent): string {
  const dollars = cent / 100;
  return `$${dollars.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** ABB bovenop het subtotaal (excl -> incl). Alles in hele centen. */
export function berekenAbb(
  subtotaalCentExcl: Cent,
  abbPct: number = ABB_PCT
): { abbCent: Cent; totaalCentIncl: Cent } {
  if (subtotaalCentExcl < 0) {
    throw new Error("berekenAbb: subtotaal mag niet negatief zijn");
  }
  const abbCent = Math.round((subtotaalCentExcl * abbPct) / 100);
  return { abbCent, totaalCentIncl: subtotaalCentExcl + abbCent };
}

/**
 * Weergave-status: een verstuurde factuur waarvan de vervaldatum voorbij is
 * telt als "teLaat". Afgeleid, zodat er geen aparte batch-job nodig is om
 * statussen om te zetten.
 */
export function effectieveStatus(
  factuur: Pick<Factuur, "status" | "vervaldatum">,
  vandaagIso: string = new Date().toISOString().slice(0, 10)
): FactuurStatus {
  if (factuur.status === "verstuurd" && factuur.vervaldatum < vandaagIso) {
    return "teLaat";
  }
  return factuur.status;
}
