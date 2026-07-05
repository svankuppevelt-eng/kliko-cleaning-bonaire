// Pure offerte-berekening: containers + instellingen (prijzen, container-
// korting, cadeaus) -> regels en totalen. Geen React, geen Firestore.
// Alle bedragen in USD. De prijsafspraken komen uit /beheer/instellingen
// (Firestore-doc instellingen/algemeen); het oude aparte prijsbeleid-doc
// is daarin opgegaan.
import type { Frequentie, KlantType } from "@/lib/data/types";
import {
  kortingPctVoorAantal,
  type ContainerKortingRegel,
  type TierPrijs,
} from "@/lib/data/prijzen";

export type Contractduur = "maandelijks" | "jaar";

/** Eén container-regel in de offerte-invoer. */
export interface OfferteContainer {
  type: KlantType;
  frequentie: Frequentie;
}

/** Prijstabel zoals in de instellingen: per klanttype x frequentie. */
export type Prijstabel = Record<KlantType, Record<Frequentie, TierPrijs>>;

/** Het deel van de instellingen dat de offerte nodig heeft. */
export interface OffertePrijsafspraken {
  prijzen: Prijstabel;
  containerKorting: ContainerKortingRegel[];
  cadeauWelkom: string;
  cadeauJaarcontract: string;
}

export interface OfferteRegel {
  nummer: number;
  type: KlantType;
  frequentie: Frequentie;
  /** Maandprijs zonder korting. */
  basis: number;
  /** Container-korting (hoogste toepasselijke drempel, geldt voor elke regel). */
  kortingPct: number;
  kortingBedrag: number;
  /** Maandprijs na container-korting. */
  netto: number;
  /** Jaarprijs (12 maanden vooruit) na container-korting. */
  nettoJaar: number;
}

export interface OfferteResultaat {
  regels: OfferteRegel[];
  /** Som van de basis-maandprijzen (zonder korting). */
  basisPerMaand: number;
  /** Som van de maandprijzen na container-korting. */
  subtotaalPerMaand: number;
  /** Toegepaste container-korting in procenten (0 = geen). */
  containerKortingPct: number;
  /** Effectieve prijs per maand (bij jaarcontract: jaarprijs / 12). */
  nettoPerMaand: number;
  /** Totaal over 12 maanden. */
  totaalJaar: number;
  /** Voordeel van het jaarcontract t.o.v. 12x de maandprijs (0 bij maandelijks). */
  jaarVoordeel: number;
  /** Besparing over een jaar t.o.v. de basisprijs zonder enige korting. */
  besparingPerJaar: number;
  cadeaus: string[];
}

export function berekenOfferte(
  containers: OfferteContainer[],
  afspraken: OffertePrijsafspraken,
  contractduur: Contractduur
): OfferteResultaat {
  const kortingPct = kortingPctVoorAantal(
    afspraken.containerKorting,
    containers.length
  );
  const factor = (100 - kortingPct) / 100;

  const regels: OfferteRegel[] = containers.map((c, idx) => {
    const tier = afspraken.prijzen[c.type]?.[c.frequentie] ?? {
      maand: 0,
      jaar: 0,
    };
    const kortingBedrag = (tier.maand * kortingPct) / 100;
    return {
      nummer: idx + 1,
      type: c.type,
      frequentie: c.frequentie,
      basis: tier.maand,
      kortingPct,
      kortingBedrag,
      netto: tier.maand - kortingBedrag,
      nettoJaar: tier.jaar * factor,
    };
  });

  const basisPerMaand = regels.reduce((s, r) => s + r.basis, 0);
  const subtotaalPerMaand = regels.reduce((s, r) => s + r.netto, 0);

  // Jaarcontract = de jaarprijzen uit de instellingen (al met korting t.o.v.
  // 12x de maandprijs), plus dezelfde container-korting.
  const jaarTotaal = regels.reduce((s, r) => s + r.nettoJaar, 0);
  const totaalJaar =
    contractduur === "jaar" ? jaarTotaal : subtotaalPerMaand * 12;
  const nettoPerMaand =
    contractduur === "jaar" ? jaarTotaal / 12 : subtotaalPerMaand;
  const jaarVoordeel =
    contractduur === "jaar" ? subtotaalPerMaand * 12 - jaarTotaal : 0;
  const besparingPerJaar = basisPerMaand * 12 - totaalJaar;

  const cadeaus = [afspraken.cadeauWelkom];
  if (contractduur === "jaar") cadeaus.push(afspraken.cadeauJaarcontract);

  return {
    regels,
    basisPerMaand,
    subtotaalPerMaand,
    containerKortingPct: kortingPct,
    nettoPerMaand,
    totaalJaar,
    jaarVoordeel,
    besparingPerJaar,
    cadeaus,
  };
}

/** Formatteer een USD-bedrag met 2 decimalen, bv. 12.5 -> "$12.50". */
export function usd(bedrag: number): string {
  return `$${bedrag.toFixed(2)}`;
}
