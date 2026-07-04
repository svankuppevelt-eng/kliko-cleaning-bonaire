// Pure offerte-berekening: containers + prijstabel + prijsbeleid -> regels en
// totalen. Geen React, geen Firestore. Overgezet uit de Streamlit-offerte-tool
// (pages/06_Offerte.py). Alle bedragen in USD.
import type { Frequentie, KlantType } from "@/lib/data/types";
import { kortingVoorContainer, type PrijsBeleid } from "@/lib/data/prijsbeleid";

export type Contractduur = "maandelijks" | "jaar";

/** Eén container-regel in de offerte-invoer. */
export interface OfferteContainer {
  type: KlantType;
  frequentie: Frequentie;
}

/** Prijstabel zoals in de instellingen: per klanttype x frequentie (USD/mnd). */
export type Prijstabel = Record<KlantType, Record<Frequentie, number>>;

export interface OfferteRegel {
  nummer: number;
  type: KlantType;
  frequentie: Frequentie;
  basis: number;
  kortingPct: number;
  kortingBedrag: number;
  netto: number;
}

export interface OfferteResultaat {
  regels: OfferteRegel[];
  /** Som van de basisprijzen per maand (zonder korting). */
  basisPerMaand: number;
  /** Som na container-kortingen, vóór jaarcontractkorting. */
  subtotaalPerMaand: number;
  jaarKortingPct: number;
  jaarKortingBedrag: number;
  /** Uiteindelijke prijs per maand. */
  nettoPerMaand: number;
  /** Totaal over 12 maanden. */
  totaalJaar: number;
  /** Besparing over een jaar t.o.v. de basisprijs zonder korting. */
  besparingPerJaar: number;
  cadeaus: string[];
}

export function berekenOfferte(
  containers: OfferteContainer[],
  prijzen: Prijstabel,
  beleid: PrijsBeleid,
  contractduur: Contractduur
): OfferteResultaat {
  const regels: OfferteRegel[] = containers.map((c, idx) => {
    const kortingPct = kortingVoorContainer(beleid, idx);
    const basis = prijzen[c.type]?.[c.frequentie] ?? 0;
    const kortingBedrag = (basis * kortingPct) / 100;
    return {
      nummer: idx + 1,
      type: c.type,
      frequentie: c.frequentie,
      basis,
      kortingPct,
      kortingBedrag,
      netto: basis - kortingBedrag,
    };
  });

  const basisPerMaand = regels.reduce((s, r) => s + r.basis, 0);
  const subtotaalPerMaand = regels.reduce((s, r) => s + r.netto, 0);

  const jaarKortingPct = contractduur === "jaar" ? beleid.kortingJaarcontract : 0;
  const jaarKortingBedrag = (subtotaalPerMaand * jaarKortingPct) / 100;
  const nettoPerMaand = subtotaalPerMaand - jaarKortingBedrag;

  const totaalJaar = nettoPerMaand * 12;
  const besparingPerJaar = (basisPerMaand - nettoPerMaand) * 12;

  const cadeaus = [beleid.cadeauWelkom];
  if (contractduur === "jaar") cadeaus.push(beleid.cadeauJaarcontract);

  return {
    regels,
    basisPerMaand,
    subtotaalPerMaand,
    jaarKortingPct,
    jaarKortingBedrag,
    nettoPerMaand,
    totaalJaar,
    besparingPerJaar,
    cadeaus,
  };
}

/** Formatteer een USD-bedrag met 2 decimalen, bv. 12.5 -> "$12.50". */
export function usd(bedrag: number): string {
  return `$${bedrag.toFixed(2)}`;
}
